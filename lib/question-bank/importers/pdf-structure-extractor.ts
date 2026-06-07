/**
 * Question Bank — PDF Structure Extractor Agent.
 *
 * Takes a single question text segment and extracts structured fields
 * (subject, grade, difficulty, questionType, content, answer, etc.).
 */

import { createLogger } from '@/lib/logger';
import type { QuestionBankInsert } from '@/lib/question-bank/types';
import type { CallLLMFn } from './pdf-question-splitter';

const log = createLogger('QB:PDF:Extract');

// ── Types ───────────────────────────────────────────────────────────

export interface ExtractedQuestion {
  data: QuestionBankInsert;
  confidence: number; // 0.0 - 1.0
}

export interface ExtractDeps {
  callLLM: CallLLMFn;
  model?: string;
}

// ── System prompt ───────────────────────────────────────────────────

const EXTRACT_SYSTEM_PROMPT = `你是一个教育题目结构化专家。你的任务是从一道题目的原始文本中提取结构化信息。

输入：一道题目的原始文本（可能包含题干、选项、答案、解析等）
输出：JSON 格式的结构化数据

字段说明：
- subject: 学科名称（如：数学、物理、化学、语文、英语、历史、地理、政治、生物）
- grade: 年级（如：初一、初二、高一、高二、高三、小学、大学）
- difficulty: 难度等级，只能是 easy（简单）、medium（中等）、hard（困难）之一
- questionType: 题型，只能是 choice（选择题）、fill（填空题）、solve（解答题）、judge（判断题）之一
- content: 题目内容（纯题干，不含选项、答案、解析）
- answer: 标准答案
- explanation: 答案解析（如果有）
- knowledgePoints: 知识点列表（数组，如 ["三角函数", "正弦定理"]）
- options: 选项列表（数组，仅选择题需要，如 ["A. xxx", "B. xxx", "C. xxx", "D. xxx"]）
- source: 来源（如果有，如 "2024年高考真题"）

要求：
1. 尽可能准确提取每个字段
2. 如果某个字段无法确定，返回 null 或合理默认值
3. content 字段必须只包含题目题干，不要包含答案和解析
4. 对于选择题，options 数组必须包含所有选项
5. confidence 表示你对提取结果的整体置信度（0.0-1.0）

输出格式（严格 JSON，无 Markdown 代码块）：
{
  "subject": "数学",
  "grade": "高一",
  "difficulty": "medium",
  "questionType": "choice",
  "content": "已知函数 f(x) = sin(2x + π/3)，则 f(x) 的最小正周期为",
  "answer": "B",
  "explanation": "T = 2π/|ω| = 2π/2 = π",
  "knowledgePoints": ["三角函数", "周期"],
  "options": ["A. π/2", "B. π", "C. 2π", "D. 4π"],
  "source": null,
  "confidence": 0.92
}`;

// ── Extract implementation ──────────────────────────────────────────

const DEFAULT_MODEL = 'deepseek-chat';

/**
 * Extract structured question data from a raw text segment.
 */
export async function extractStructure(
  segmentText: string,
  deps: ExtractDeps,
): Promise<ExtractedQuestion | null> {
  const model = deps.model ?? DEFAULT_MODEL;

  const prompt = `请从以下题目文本中提取结构化信息：

---
${segmentText}
---

请输出 JSON 格式的结构化数据。`;

  try {
    const result = await deps.callLLM(
      {
        model,
        system: EXTRACT_SYSTEM_PROMPT,
        prompt,
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
      'pdf-extract-structure',
    );

    return parseExtractResult(result.text);
  } catch (err: any) {
    log.error('Extract structure failed:', err);
    return null;
  }
}

function parseExtractResult(text: string): ExtractedQuestion | null {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '');

  try {
    const parsed = JSON.parse(cleaned);
    const confidence = Number(parsed.confidence) || 0.5;

    const data: QuestionBankInsert = {
      subject: parsed.subject ?? '未知学科',
      grade: parsed.grade ?? '',
      difficulty: normalizeDifficulty(parsed.difficulty),
      questionType: normalizeQuestionType(parsed.questionType),
      content: parsed.content ?? '',
      answer: parsed.answer ?? '',
      explanation: parsed.explanation ?? '',
      knowledgePoints: normalizeArray(parsed.knowledgePoints),
      options: normalizeArray(parsed.options),
      source: parsed.source ?? undefined,
      tags: [],
    };

    return { data, confidence };
  } catch {
    // Fallback: try to extract JSON object from text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const confidence = Number(parsed.confidence) || 0.5;
        const data: QuestionBankInsert = {
          subject: parsed.subject ?? '未知学科',
          grade: parsed.grade ?? '',
          difficulty: normalizeDifficulty(parsed.difficulty),
          questionType: normalizeQuestionType(parsed.questionType),
          content: parsed.content ?? '',
          answer: parsed.answer ?? '',
          explanation: parsed.explanation ?? '',
          knowledgePoints: normalizeArray(parsed.knowledgePoints),
          options: normalizeArray(parsed.options),
          source: parsed.source ?? undefined,
          tags: [],
        };
        return { data, confidence };
      } catch {
        // ignore
      }
    }
  }

  log.warn('Failed to parse extract result');
  return null;
}

function normalizeDifficulty(v: unknown): 'easy' | 'medium' | 'hard' {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['easy', '简单', '易'].includes(s)) return 'easy';
    if (['hard', '困难', '难'].includes(s)) return 'hard';
  }
  return 'medium';
}

function normalizeQuestionType(v: unknown): 'choice' | 'fill' | 'solve' | 'judge' {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['choice', '选择', '选择题', '单选', '多选'].includes(s)) return 'choice';
    if (['fill', '填空', '填空题'].includes(s)) return 'fill';
    if (['judge', '判断', '判断题'].includes(s)) return 'judge';
  }
  return 'solve';
}

function normalizeArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      return v.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return undefined;
}
