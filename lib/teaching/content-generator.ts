/**
 * D-003 Content Generator — Teaching Content Engine
 *
 * Generates teaching content section-by-section from a LessonPlan.
 * Supports SSE streaming: push each section's content as soon as it's generated.
 */

import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveSolverModel } from '@/lib/solve/solver-constants';
import type { LessonPlan, LessonSection } from './lesson-types';
import type { ContentChunk } from './content-types';
import { CONTENT_SYSTEM_PROMPT, buildContentPrompt } from './content-prompts';
import { createLogger } from '@/lib/logger';

const log = createLogger('ContentGenerator');

export interface GeneratedSection {
  section: LessonSection;
  chunks: ContentChunk[];
}

/** Generate content for a single section */
export async function generateSectionContent(section: LessonSection): Promise<ContentChunk[]> {
  try {
    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);

    const prompt = buildContentPrompt(section);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: prompt }] as any,
        temperature: 0.6,
        maxOutputTokens: 4096,
      },
      'content-generator',
      { retries: 1 },
      undefined,
      CONTENT_SYSTEM_PROMPT,
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed || !Array.isArray(parsed.chunks)) {
      return fallbackContent(section);
    }

    const rawChunks = parsed.chunks as Record<string, unknown>[];
    return rawChunks
      .map((c, i) => ({
        sectionId: section.id,
        type: ['text', 'formula', 'example', 'quiz', 'diagram'].includes(c.type as string)
          ? (c.type as ContentChunk['type'])
          : 'text',
        content: typeof c.content === 'string' ? (c.content as string) : '',
        order: typeof c.order === 'number' ? c.order : i + 1,
      }))
      .filter((c) => c.content.length > 0);
  } catch (err) {
    log.warn(`generateSectionContent failed for ${section.id}:`, err);
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
      content: `## ${section.title}\n\n本环节知识点：${kps}\n\n内容正在生成中...`,
      order: 1,
    },
  ];
}

/**
 * Generate content for the entire lesson plan, section by section.
 * Returns an async generator that yields each completed section.
 */
export async function* generateLessonStream(plan: LessonPlan): AsyncGenerator<GeneratedSection> {
  for (const section of plan.sections) {
    const chunks = await generateSectionContent(section);
    yield { section, chunks };
  }
}

/**
 * Generate all content without streaming (for non-SSE usage).
 */
export async function generateLessonContent(plan: LessonPlan): Promise<GeneratedSection[]> {
  const sections: GeneratedSection[] = [];
  for (const section of plan.sections) {
    const chunks = await generateSectionContent(section);
    sections.push({ section, chunks });
  }
  return sections;
}
