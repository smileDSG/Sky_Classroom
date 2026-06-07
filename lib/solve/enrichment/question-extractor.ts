/**
 * Question extractor — uses LLM to identify and extract structured
 * educational questions from scraped page text.
 *
 * The LLM is prompted to:
 * 1. Find all questions in the text
 * 2. Classify subject and grade level
 * 3. Determine question type
 * 4. Extract the answer if present on the source page
 * 5. Assign a confidence score to each extraction
 */

import type { ExtractedQuestion, SubjectId, GradeLevel } from './types';
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { createLogger } from '@/lib/logger';
import { MAX_QUESTIONS_PER_RUN } from './config';

const log = createLogger('Enrichment:Extractor');

// ── LLM extraction schema ───────────────────────────────────────────

interface ExtractedQuestionRaw {
  problemText: string;
  subject: string;
  gradeLevel: string;
  questionType: string;
  sourceAnswer: string | null;
  extractionConfidence: number;
}

interface ExtractionResponse {
  questions: ExtractedQuestionRaw[];
}

const EXTRACTION_SYSTEM_PROMPT = `你是一个教育题目提取专家。你的任务是从给定的网页文本中识别并提取所有数学/物理/化学/生物/语文/英语/历史/地理/政治题目。

## 输出格式
以 JSON 返回，包含 questions 数组，每个题目包含：
- problemText: 完整的题目文本（必须包含所有条件和问题）
- subject: 学科分类（math/physics/chemistry/chinese/english/biology/history/geography/politics）
- gradeLevel: 年级（junior=初中/senior=高中/college=大学）
- questionType: 题型（choice=选择题/fill=填空题/solve=解答题/judge=判断题）
- sourceAnswer: 页面中给出的答案（如"答案：C"或"解析：..."），没有则为 null
- extractionConfidence: 提取置信度 0-1（0.8+ = 完整题目，0.5-0.8 = 部分提取，<0.5 = 不确认）

## 规则
1. 只提取完整的有意义的题目（忽略导航、广告、评论等）
2. 数学公式用 LaTeX 格式（如 $x^2 + y^2 = 1$）
3. 化学方程式保持原格式
4. 选择题必须保留所有选项
5. 如果页面提供了答案或解析，提取到 sourceAnswer
6. 忽略明显不完整或无法理解的题目
7. 每题独立，不要合并
8. 最多提取 20 道题`;

// ── Model resolution ──────────────────────────────────────────────────

/**
 * Resolve the DeepSeek model config for question extraction.
 * Follows the same pattern as resolveSolverModel in solver-agent.ts.
 */
function resolveExtractorModel() {
  const providerId = 'deepseek' as const;
  const modelId = 'deepseek-v4-flash';
  return {
    providerId,
    modelId,
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || undefined,
    providerType: 'openai' as const,
  };
}

// ── Normalization ────────────────────────────────────────────────────

const VALID_SUBJECTS: Set<string> = new Set([
  'math', 'physics', 'chemistry', 'chinese', 'english',
  'biology', 'history', 'geography', 'politics',
]);

const VALID_GRADES: Set<string> = new Set(['junior', 'senior', 'college']);

const VALID_TYPES: Set<string> = new Set(['choice', 'fill', 'solve', 'judge']);

function normalizeSubject(raw: string): SubjectId {
  const s = raw.toLowerCase().trim();
  if (VALID_SUBJECTS.has(s)) return s as SubjectId;
  // Fuzzy match
  if (s.includes('math') || s.includes('数学')) return 'math';
  if (s.includes('physics') || s.includes('物理')) return 'physics';
  if (s.includes('chemistry') || s.includes('化学')) return 'chemistry';
  if (s.includes('chinese') || s.includes('语文')) return 'chinese';
  if (s.includes('english') || s.includes('英语')) return 'english';
  if (s.includes('biology') || s.includes('生物')) return 'biology';
  if (s.includes('history') || s.includes('历史')) return 'history';
  if (s.includes('geography') || s.includes('地理')) return 'geography';
  if (s.includes('politics') || s.includes('政治')) return 'politics';
  return 'math'; // default
}

function normalizeGrade(raw: string): GradeLevel {
  const s = raw.toLowerCase().trim();
  if (VALID_GRADES.has(s)) return s as GradeLevel;
  if (s.includes('junior') || s.includes('初中')) return 'junior';
  if (s.includes('senior') || s.includes('高中')) return 'senior';
  if (s.includes('college') || s.includes('大学')) return 'college';
  return 'senior'; // default
}

function normalizeType(raw: string): ExtractedQuestion['questionType'] {
  const s = raw.toLowerCase().trim();
  if (VALID_TYPES.has(s)) return s as ExtractedQuestion['questionType'];
  if (s.includes('choice') || s.includes('选择')) return 'choice';
  if (s.includes('fill') || s.includes('填空')) return 'fill';
  if (s.includes('solve') || s.includes('解答') || s.includes('证明') || s.includes('计算')) return 'solve';
  if (s.includes('judge') || s.includes('判断')) return 'judge';
  return 'solve';
}

// ── Main extractor ──────────────────────────────────────────────────

export interface ExtractQuestionsOptions {
  /** The scraped text content */
  textContent: string;
  /** Expected subject (used to weight extraction) */
  expectedSubject?: SubjectId;
  /** Expected grade level */
  expectedGrade?: GradeLevel;
  /** Max questions to extract from this page */
  maxQuestions?: number;
}

/**
 * Use LLM to extract structured questions from scraped page text.
 *
 * @returns Array of ExtractedQuestion, or empty array if extraction fails
 */
export async function extractQuestionsFromText(
  opts: ExtractQuestionsOptions,
): Promise<ExtractedQuestion[]> {
  const {
    textContent,
    expectedSubject,
    expectedGrade,
    maxQuestions = 20,
  } = opts;

  // Truncate input — 15K chars is enough context for LLM extraction
  const truncatedText = textContent.slice(0, 15_000);

  const userPrompt = expectedSubject && expectedGrade
    ? `以下网页文本来自 ${expectedSubject} ${expectedGrade} 相关页面。提取其中的所有题目：\n\n${truncatedText}`
    : `以下网页文本来自教育相关页面。提取其中的所有题目：\n\n${truncatedText}`;

  try {
    const modelWithInfo = getModel(resolveExtractorModel());

    const result = await callLLM(
      {
        model: modelWithInfo.model,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ] as any,
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
      'enrichment-extractor',
      { retries: 1 },
    );

    log.info(`[Extractor] Raw response length: ${result.text?.length ?? 0}, first 200: ${result.text?.slice(0, 200) ?? '(empty)'}`);

    let parsed = parseJsonResponse<ExtractionResponse>(result.text);

    // Fallback: regex extract JSON blocks from raw text when json-repair fails
    if (!parsed || !Array.isArray(parsed.questions)) {
      const jsonStart = result.text.indexOf('{');
      const jsonEnd = result.text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        try {
          const candidate = JSON.parse(result.text.slice(jsonStart, jsonEnd + 1)) as ExtractionResponse;
          if (candidate && Array.isArray(candidate.questions)) {
            parsed = candidate;
            log.info('[Extractor] Recovered via regex fallback');
          }
        } catch { /* not valid JSON — will be caught by next guard */ }
      }
    }

    if (!parsed || !Array.isArray(parsed.questions)) {
      log.warn('[Extractor] LLM returned no valid questions');
      return [];
    }

    // Normalize and validate
    const questions: ExtractedQuestion[] = parsed.questions
      .filter((q) => q.problemText && q.problemText.length >= 10)
      .map((q) => ({
        problemText: q.problemText.trim(),
        subject: normalizeSubject(q.subject),
        gradeLevel: normalizeGrade(q.gradeLevel),
        questionType: normalizeType(q.questionType),
        sourceAnswer: q.sourceAnswer?.trim() || undefined,
        sourceUrl: '', // Will be filled by pipeline
        extractionConfidence: clampConfidence(q.extractionConfidence),
      }))
      .filter((q) => q.extractionConfidence >= 0.5)
      .slice(0, maxQuestions);

    log.info(`[Extractor] Extracted ${questions.length} valid questions`);
    return questions;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[Extractor] Extraction failed: ${msg}`);
    return [];
  }
}

function clampConfidence(c: number): number {
  if (typeof c !== 'number' || isNaN(c)) return 0.7;
  return Math.max(0, Math.min(1, c));
}

export interface ExtractQuestionsFromPagesOptions {
  pages: Array<{ url: string; textContent: string }>;
  expectedSubject?: SubjectId;
  expectedGrade?: GradeLevel;
  maxTotalQuestions?: number;
}

/**
 * Extract questions from multiple pages.
 */
export async function extractQuestionsFromPages(
  opts: ExtractQuestionsFromPagesOptions,
): Promise<ExtractedQuestion[]> {
  const {
    pages,
    expectedSubject,
    expectedGrade,
    maxTotalQuestions = MAX_QUESTIONS_PER_RUN,
  } = opts;

  const allQuestions: ExtractedQuestion[] = [];

  for (const page of pages) {
    const questions = await extractQuestionsFromText({
      textContent: page.textContent,
      expectedSubject,
      expectedGrade,
      maxQuestions: 10,
    });

    // Attach source URL
    for (const q of questions) {
      q.sourceUrl = page.url;
    }

    allQuestions.push(...questions);

    if (allQuestions.length >= maxTotalQuestions) break;
  }

  log.info(`[Extractor] Total extracted: ${allQuestions.length} from ${pages.length} pages`);

  // Deduplicate by problem text similarity
  return deduplicateQuestions(allQuestions).slice(0, maxTotalQuestions);
}

// ── Deduplication ────────────────────────────────────────────────────

function deduplicateQuestions(questions: ExtractedQuestion[]): ExtractedQuestion[] {
  const seen = new Set<string>();
  const result: ExtractedQuestion[] = [];

  for (const q of questions) {
    // Simple dedup: first 100 chars + last 50 chars
    const key = q.problemText.slice(0, 100) + '|END|' + q.problemText.slice(-50);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(q);
  }

  return result;
}
