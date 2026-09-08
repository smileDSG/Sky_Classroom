/**
 * Question Bank — PDF Question Splitter Agent.
 *
 * Uses a lightweight LLM to identify question boundaries in raw PDF text.
 * Returns an array of text segments, each representing one question.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('QB:PDF:Split');

// ── Types ───────────────────────────────────────────────────────────

export interface QuestionSegment {
  text: string;
  confidence: number; // 0.0 - 1.0
}

export interface SplitDeps {
  callLLM: CallLLMFn;
  model?: string;
}

export interface CallLLMFn {
  (
    params: {
      model: string;
      system?: string;
      prompt: string;
      temperature?: number;
      maxOutputTokens?: number;
    },
    source: string,
  ): Promise<{ text: string }>;
}

// ── System prompt ───────────────────────────────────────────────────

const SPLIT_SYSTEM_PROMPT = `你是一个教育材料分析专家。你的任务是从教材或试卷的文本中识别出每一道独立的题目。

要求：
1. 将输入文本分割为若干道独立题目
2. 每道题目必须包含完整的题干
3. 如果题目包含选项（A/B/C/D），必须一并包含
4. 如果题目包含图片占位符（如 [图1]），保留占位符
5. 忽略页眉、页脚、章节标题等非题目内容
6. 对每道题目给出置信度（0.0-1.0），表示这是否真的是一道题目

输出格式（严格 JSON，无 Markdown 代码块）：
{
  "segments": [
    { "text": "题目1的完整文本...", "confidence": 0.95 },
    { "text": "题目2的完整文本...", "confidence": 0.88 }
  ]
}`;

// ── Split implementation ────────────────────────────────────────────

const DEFAULT_MODEL = 'deepseek-chat';
const MAX_CHARS_PER_CALL = 12000; // ~4k tokens, safe for most contexts

/**
 * Split raw PDF text into individual question segments.
 *
 * If text is very long, it is chunked and processed in parallel.
 */
export async function splitQuestions(text: string, deps: SplitDeps): Promise<QuestionSegment[]> {
  const model = deps.model ?? DEFAULT_MODEL;

  // Chunk long text to avoid exceeding context window
  const chunks = chunkText(text, MAX_CHARS_PER_CALL);
  log.info(`Splitting PDF text into questions: ${text.length} chars, ${chunks.length} chunks`);

  const results = await Promise.all(
    chunks.map((chunk, idx) => splitChunk(chunk, idx, model, deps.callLLM)),
  );

  const allSegments = results.flat();
  log.info(`Found ${allSegments.length} question segments`);
  return allSegments;
}

async function splitChunk(
  text: string,
  chunkIndex: number,
  model: string,
  callLLM: CallLLMFn,
): Promise<QuestionSegment[]> {
  const prompt = `请分析以下教材/试卷文本，识别出所有独立题目：

---
${text}
---

请输出 JSON 格式的题目列表。`;

  try {
    const result = await callLLM(
      {
        model,
        system: SPLIT_SYSTEM_PROMPT,
        prompt,
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
      `pdf-split-chunk-${chunkIndex}`,
    );

    const segments = parseSplitResult(result.text);
    return segments;
  } catch (err: any) {
    log.error(`Split chunk ${chunkIndex} failed:`, err);
    return [];
  }
}

function parseSplitResult(text: string): QuestionSegment[] {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/i, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.segments)) {
      return parsed.segments
        .filter((s: unknown) => s && typeof (s as QuestionSegment).text === 'string')
        .map((s: unknown) => ({
          text: String((s as QuestionSegment).text).trim(),
          confidence: Number((s as QuestionSegment).confidence) || 0.5,
        }))
        .filter((s: QuestionSegment) => s.text.length > 5);
    }
  } catch {
    // Fallback: try to extract JSON array from text
    const jsonMatch = cleaned.match(/\{[\s\S]*"segments"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.segments)) {
          return parsed.segments
            .filter((s: unknown) => s && typeof (s as QuestionSegment).text === 'string')
            .map((s: unknown) => ({
              text: String((s as QuestionSegment).text).trim(),
              confidence: Number((s as QuestionSegment).confidence) || 0.5,
            }))
            .filter((s: QuestionSegment) => s.text.length > 5);
        }
      } catch {
        // ignore
      }
    }
  }

  log.warn('Failed to parse split result, returning empty');
  return [];
}

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    // Try to break at a newline or Chinese period
    const searchStart = Math.max(start, end - 500);
    const slice = text.slice(searchStart, end);
    const breakIndex = Math.max(
      slice.lastIndexOf('\n\n'),
      slice.lastIndexOf('。'),
      slice.lastIndexOf('. '),
    );

    if (breakIndex > 0) {
      end = searchStart + breakIndex + 1;
    }

    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}
