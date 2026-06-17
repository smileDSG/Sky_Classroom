/**
 * D-003 Content Generator — Teaching Content Engine
 *
 * Generates teaching content section-by-section from a LessonPlan.
 * Supports SSE streaming: push each section's content as soon as it's generated.
 */

import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { structuredContentSchema } from '@/lib/generation/classroom-content-agent';
import type { StructuredContent } from '@/lib/generation/classroom-content-agent';
import { resolveSolverModel } from '@/lib/solve/solver-constants';
import type { LessonPlan, LessonSection } from './lesson-types';
import type { ContentChunk, PrecedingSection } from './content-types';
import {
  CONTENT_SYSTEM_PROMPT,
  STRUCTURED_CONTENT_SYSTEM_PROMPT,
  buildContentPrompt,
  buildStructuredContentPrompt,
} from './content-prompts';
import { createLogger } from '@/lib/logger';

const log = createLogger('ContentGenerator');

export interface GeneratedSection {
  section: LessonSection;
  chunks: ContentChunk[];
  structured?: StructuredContent;
  /** 该 section 在 plan.sections 中的真实索引（由 generateLessonConcurrent 填充） */
  index?: number;
}

/** Generate content for a single section — tries structured first, falls back to chunks */
export async function generateSectionContent(
  section: LessonSection,
  precedingSections?: PrecedingSection[],
): Promise<{ chunks: ContentChunk[]; structured?: StructuredContent }> {
  const modelConfig = resolveSolverModel('universal');
  const { model } = getModel(modelConfig);

  // ── Attempt 1: Structured content (rich slides) ──
  const structuredPrompt = buildStructuredContentPrompt(section, precedingSections);
  if (structuredPrompt) {
    try {
      const result = await callLLM(
        {
          model,
          messages: [{ role: 'user', content: structuredPrompt }] as any,
          temperature: 0.6,
          maxOutputTokens: 4096,
        },
        'content-generator-structured',
        { retries: 2 },
        undefined,
        STRUCTURED_CONTENT_SYSTEM_PROMPT,
      );

      const raw = (result.text || '').trim();
      // Strip markdown fences if present
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      const validation = structuredContentSchema.safeParse(parsed);
      if (validation.success) {
        log.info(
          `[ContentGen] Structured content generated for ${section.id} (type=${validation.data.type})`,
        );
        // Also generate chunks as fallback data (quiz questions, etc.)
        const chunks = await generateChunksContent(section, model, precedingSections);
        return { chunks, structured: validation.data };
      }
      log.warn(
        `[ContentGen] Structured validation failed for ${section.id}, falling back to chunks`,
      );
    } catch (err) {
      log.warn(
        `[ContentGen] Structured generation failed for ${section.id}, falling back to chunks:`,
        err,
      );
    }
  }

  // ── Attempt 2: Fallback to chunk-based content ──
  const chunks = await generateChunksContent(section, model, precedingSections);
  return { chunks };
}

/** Generate chunk-based content (original approach) */
async function generateChunksContent(
  section: LessonSection,
  model: string,
  precedingSections?: PrecedingSection[],
): Promise<ContentChunk[]> {
  try {
    const prompt = buildContentPrompt(section, precedingSections);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: prompt }] as any,
        temperature: 0.6,
        maxOutputTokens: 4096,
      },
      'content-generator',
      { retries: 2 },
      undefined,
      CONTENT_SYSTEM_PROMPT,
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed || !Array.isArray(parsed.chunks)) {
      // LLM 返回了内容但无法解析为 JSON chunks —— 用原文兜底展示，避免直接降级为"生成失败"
      const rawText = (result.text || '').trim();
      if (rawText) {
        log.warn(
          `[ContentGen] Unparseable chunks for ${section.id}, using raw LLM text as fallback`,
        );
        return [
          {
            sectionId: section.id,
            type: 'text',
            content: rawText,
            order: 1,
          },
        ];
      }
      return fallbackContent(section);
    }

    const rawChunks = parsed.chunks as Record<string, unknown>[];
    return rawChunks
      .map((c, i) => {
        const type = ['text', 'formula', 'example', 'quiz', 'diagram'].includes(c.type as string)
          ? (c.type as ContentChunk['type'])
          : 'text';

        const chunk: ContentChunk = {
          sectionId: section.id,
          type,
          content: typeof c.content === 'string' ? (c.content as string) : '',
          order: typeof c.order === 'number' ? c.order : i + 1,
        };

        if (type === 'quiz') {
          if (typeof c.question === 'string') {
            chunk.question = c.question;
          }
          if (Array.isArray(c.options)) {
            chunk.options = c.options.filter((o): o is string => typeof o === 'string');
          }
          if (typeof c.correctAnswer === 'number') {
            chunk.correctAnswer = c.correctAnswer;
          }
        }

        return chunk;
      })
      .filter((c) => c.content.length > 0);
  } catch (err) {
    log.warn(`generateChunksContent failed for ${section.id}:`, err);
    return fallbackContent(section);
  }
}

/** Fallback content when LLM fails */
function fallbackContent(section: LessonSection): ContentChunk[] {
  const kps = section.knowledgePoints.join('、');
  return [
    {
      sectionId: section.id,
      type: 'text',
      content: `## ${section.title}\n\n本环节知识点：${kps}\n\n内容生成失败，请点击重试`,
      order: 1,
      failed: true,
    },
  ];
}

/**
 * Generate content for the entire lesson plan, section by section.
 * Returns an async generator that yields each completed section.
 */
export async function* generateLessonStream(plan: LessonPlan): AsyncGenerator<GeneratedSection> {
  for (const section of plan.sections) {
    const { chunks, structured } = await generateSectionContent(section);
    yield { section, chunks, structured };
  }
}

/**
 * Generate all content without streaming (for non-SSE usage).
 */
export async function generateLessonContent(plan: LessonPlan): Promise<GeneratedSection[]> {
  const sections: GeneratedSection[] = [];
  for (const section of plan.sections) {
    const { chunks, structured } = await generateSectionContent(section);
    sections.push({ section, chunks, structured });
  }
  return sections;
}

/**
 * Extract content summary from chunks (first text chunk, up to 200 chars).
 */
export function extractContentSummary(chunks: ContentChunk[]): string {
  const textChunk = chunks.find((c) => c.type === 'text' && !c.failed);
  if (!textChunk) return '';
  return textChunk.content.slice(0, 200);
}

/**
 * Generate content concurrently with controlled parallelism.
 * - Section 0 is generated alone (ensures opening quality)
 * - Sections 1+ are generated in parallel batches (2 concurrent)
 * - Each completed section is yielded immediately
 */
export async function* generateLessonConcurrent(
  plan: LessonPlan,
  concurrency: number = 2,
): AsyncGenerator<GeneratedSection> {
  const sections = plan.sections;
  if (sections.length === 0) return;

  // Section 0: generate alone
  const firstResult = await generateSectionContent(sections[0]);
  yield {
    section: sections[0],
    chunks: firstResult.chunks,
    structured: firstResult.structured,
    index: 0,
  };

  if (sections.length === 1) return;

  // Build preceding context map
  const precedingMap = new Map<string, PrecedingSection>();
  precedingMap.set(sections[0].id, {
    title: sections[0].title,
    knowledgePoints: sections[0].knowledgePoints,
    depth: sections[0].depth,
    contentSummary: extractContentSummary(firstResult.chunks),
  });

  // Sections 1+: generate in parallel batches
  for (let batchStart = 1; batchStart < sections.length; batchStart += concurrency) {
    const batchEnd = Math.min(batchStart + concurrency, sections.length);
    const batch = sections.slice(batchStart, batchEnd);

    // Build preceding sections for this batch (snapshot at batch start)
    const precedingSections: PrecedingSection[] = [];
    for (let i = 0; i < batchStart; i++) {
      const ps = precedingMap.get(sections[i].id);
      if (ps) precedingSections.push(ps);
    }

    // Generate batch in parallel
    const results = await Promise.allSettled(
      batch.map(async (section) => {
        const { chunks, structured } = await generateSectionContent(section, precedingSections);
        return { section, chunks, structured };
      }),
    );

    // Yield completed sections and update preceding map.
    // 关键：rejected 的章节也必须 yield（用 fallbackContent 占位），
    // 否则 sections 数组会比 plan 短、且后续 sectionIndex 会错位，
    // 导致前端翻页出现章节缺失/顺序混乱。占位章节带真实 plan 索引。
    for (let k = 0; k < results.length; k++) {
      const section = batch[k];
      const index = batchStart + k;
      const result = results[k];
      if (result.status === 'fulfilled') {
        const { chunks, structured } = result.value;
        precedingMap.set(section.id, {
          title: section.title,
          knowledgePoints: section.knowledgePoints,
          depth: section.depth,
          contentSummary: extractContentSummary(chunks),
        });
        yield { section, chunks, structured, index };
      } else {
        log.error(
          `Parallel section generation failed (index=${index}, id=${section.id}):`,
          result.reason,
        );
        const chunks = fallbackContent(section);
        precedingMap.set(section.id, {
          title: section.title,
          knowledgePoints: section.knowledgePoints,
          depth: section.depth,
          contentSummary: extractContentSummary(chunks),
        });
        yield { section, chunks, index };
      }
    }
  }
}
