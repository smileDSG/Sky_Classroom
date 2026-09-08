/**
 * Four-Part Output Generator — format solution into structured output.
 *
 * Four sections:
 *   1. Answer — final answer with bold highlighting
 *   2. Steps — step-by-step breakdown with labels, content, key points
 *   3. Knowledge Points — related concepts with difficulty
 *   4. Similar Questions — 2-3 practice problems of similar type
 *
 * Graded mode extends with:
 *   - gradeResult, mistakeAnalysis, recommendedPractice
 */

import type { FourPartOutput, GradedFourPartOutput, GradeResult } from './types';
import { postProcessFourPartOutput } from './math-postprocessor';

/**
 * Raw solution data from the solver agent.
 * May come directly from LLM JSON output or from question bank.
 */
interface RawSolution {
  solution?: string;
  answer: string;
  steps?: { label: string; content: string; keyPoints?: string[] }[];
  knowledgePoints?: { name: string; description: string; difficulty?: string }[];
  similarQuestions?: { problem: string; difficulty?: number; knowledgePoint?: string }[];
  questionType?: 'choice' | 'fill' | 'solve' | 'judge';
  options?: string[];
}

/**
 * Generate FourPartOutput from a raw solution.
 *
 * Normalizes missing/invalid fields and ensures all arrays have sensible defaults.
 */
export function generateFourPartOutput(raw: RawSolution): FourPartOutput {
  const output = {
    solution: raw.solution || '',
    answer: formatAnswer(raw.answer),
    steps: normalizeSteps(raw.steps, raw.answer, raw.solution),
    knowledgePoints: normalizeKnowledgePoints(raw.knowledgePoints),
    similarQuestions: normalizeSimilarQuestions(raw.similarQuestions),
    questionType: normalizeQuestionType(raw.questionType),
    options: normalizeOptions(raw.options, raw.questionType),
  };
  return postProcessFourPartOutput(output);
}

/**
 * Generate GradedFourPartOutput from a raw solution + grade result.
 *
 * Includes mistake analysis and recommended practice based on the
 * grading outcome.
 */
export function generateGradedFourPartOutput(
  raw: RawSolution,
  gradeResult: GradeResult,
): GradedFourPartOutput {
  const base = postProcessFourPartOutput(generateFourPartOutput(raw));

  return {
    ...base,
    gradeResult,
    mistakeAnalysis: buildMistakeAnalysis(gradeResult),
    recommendedPractice: buildRecommendedPractice(gradeResult, raw),
  };
}

// ── Normalization helpers ──────────────────────────────────────────

function formatAnswer(answer: string): string {
  if (!answer || !answer.trim()) return '暂无答案';
  // Return clean answer — UI handles styling
  return answer.trim();
}

function normalizeSteps(
  steps: { label: string; content: string; keyPoints?: string[] }[] | undefined,
  fallbackAnswer: string,
  rawSolution?: string,
): FourPartOutput['steps'] {
  if (!steps || steps.length === 0) {
    // Use full solution derivation when steps are absent (common for complex
    // problems like series/calculation, or salvaged prose answers). Split it
    // into paragraphs so the report reads as a derivation, not one blob.
    const content = (rawSolution && rawSolution.trim()) ? rawSolution : fallbackAnswer;
    const split = splitProseIntoSteps(content);
    if (split.length > 1) return split;
    return [{ label: '解答', content, keyPoints: [] }];
  }

  return steps.map((step, index) => ({
    label: step.label || `步骤${index + 1}`,
    content: step.content || '',
    keyPoints: step.keyPoints || [],
  }));
}

/** Split a prose solution into labeled steps by common derivation markers. */
function splitProseIntoSteps(solution: string): FourPartOutput['steps'] {
  const text = solution.trim();
  if (!text) return [];

  // Preferred: explicit step markers (第一步 / 第1步 / Step 1 / **步骤N** …).
  const markerRegex = /(?:^|\n)\s*(?:\*\*)?(第[一二三四五六七八九十\d]+步|Step\s*\d+|步骤\s*\d+)(?:\*\*)?[：:.、\s]*/g;
  const matches = [...text.matchAll(markerRegex)];
  if (matches.length >= 2 && matches.length <= 8) {
    const steps: FourPartOutput['steps'] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = (matches[i].index ?? 0) + matches[i][0].length;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
      const content = text.slice(start, end).trim();
      if (content) steps.push({ label: matches[i][1], content, keyPoints: [] });
    }
    if (steps.length >= 2) return steps;
  }

  // Fallback: paragraphs (blank-line separated), capped at 6.
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/^[-*]\s+/gm, '').trim())
    .filter((p) => p.length > 0)
    .slice(0, 6);
  if (paragraphs.length >= 2) {
    return paragraphs.map((p, i) => ({ label: `步骤${i + 1}`, content: p, keyPoints: [] }));
  }

  return [];
}

function normalizeKnowledgePoints(
  points: { name: string; description: string; difficulty?: string }[] | undefined,
): FourPartOutput['knowledgePoints'] {
  if (!points || points.length === 0) {
    return [];
  }

  return points.map((p) => ({
    name: p.name || '未知知识点',
    description: p.description || '',
    difficulty: normalizeDifficulty(p.difficulty),
  }));
}

function normalizeDifficulty(raw?: string): 'easy' | 'medium' | 'hard' {
  const d = (raw ?? '').toLowerCase();
  if (d.includes('easy') || d.includes('简') || d.includes('初')) return 'easy';
  if (d.includes('hard') || d.includes('难') || d.includes('高')) return 'hard';
  return 'medium';
}

function normalizeSimilarQuestions(
  questions: { problem: string; difficulty?: number; knowledgePoint?: string; answer?: string }[] | undefined,
): FourPartOutput['similarQuestions'] {
  if (!questions || questions.length === 0) {
    return [];
  }

  return questions.slice(0, 5).map((q) => ({
    problem: q.problem || '',
    difficulty: typeof q.difficulty === 'number' ? q.difficulty : 0.5,
    knowledgePoint: q.knowledgePoint || '综合',
    ...(q.answer ? { answer: q.answer } : {}),
  }));
}

function normalizeQuestionType(
  raw?: string,
): FourPartOutput['questionType'] {
  if (raw === 'choice' || raw === 'fill' || raw === 'solve' || raw === 'judge') return raw;
  return undefined;
}

function normalizeOptions(
  raw?: string[],
  questionType?: string,
): string[] | undefined {
  if (!raw || raw.length === 0) return undefined;
  if (questionType === 'judge') {
    return ['正确', '错误'];
  }
  if (questionType === 'choice') {
    return raw.slice(0, 4);
  }
  return undefined;
}

// ── Graded output helpers ─────────────────────────────────────────

function buildMistakeAnalysis(gradeResult: GradeResult): string {
  const { isCorrect, errorAnalysis, cause } = gradeResult;

  if (isCorrect) {
    return '回答正确，请继续保持！';
  }

  const causeLabels: Record<string, string> = {
    'concept-unclear': '概念不清',
    'calculation-error': '计算失误',
    misreading: '审题错误',
    'method-wrong': '方法错误',
    careless: '粗心',
    'format-error': '格式错误',
  };

  const causeLabel = causeLabels[cause] || cause;
  return `错因：${causeLabel}。${errorAnalysis}`;
}

function buildRecommendedPractice(
  gradeResult: GradeResult,
  raw: RawSolution,
): GradedFourPartOutput['recommendedPractice'] {
  if (gradeResult.isCorrect) {
    return generateChallengeQuestions(raw);
  }

  return generateRemedialQuestions(gradeResult, raw);
}

/**
 * When the student answered correctly, generate challenge questions.
 */
function generateChallengeQuestions(raw: RawSolution): GradedFourPartOutput['recommendedPractice'] {
  const questions: GradedFourPartOutput['recommendedPractice'] = [];

  // Use similar questions as practice if available
  if (raw.similarQuestions && raw.similarQuestions.length > 0) {
    const picked = raw.similarQuestions.slice(0, 3);
    for (const q of picked) {
      questions.push({
        problem: q.problem,
        reason: '同类练习，巩固知识',
      });
    }
  }

  return questions;
}

/**
 * When the student answered incorrectly, generate targeted remedial questions.
 */
function generateRemedialQuestions(
  gradeResult: GradeResult,
  raw: RawSolution,
): GradedFourPartOutput['recommendedPractice'] {
  const questions: GradedFourPartOutput['recommendedPractice'] = [];

  // Base recommendation on the cause
  const causeAdvice: Record<string, string> = {
    'concept-unclear': '请复习相关概念后再尝试',
    'calculation-error': '请仔细检查计算步骤',
    misreading: '请仔细阅读题目条件',
    'method-wrong': '请学习正确的解题方法',
    careless: '请注意细节',
    'format-error': '请注意答题格式',
  };

  const reason = causeAdvice[gradeResult.cause] || '建议复习相关知识点';

  // Use similar questions for practice if available
  if (raw.similarQuestions && raw.similarQuestions.length > 0) {
    const picked = raw.similarQuestions.slice(0, 3);
    for (const q of picked) {
      questions.push({
        problem: q.problem,
        reason,
      });
    }
  } else {
    questions.push({
      problem: '请参考教材中的类似练习',
      reason,
    });
  }

  return questions;
}
