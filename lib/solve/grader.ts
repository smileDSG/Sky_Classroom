/**
 * Grader Engine — compare user answer with correct answer.
 *
 * Strategy:
 * 1. Call LLM to analyze correctness, score, and error cause
 * 2. If LLM fails, fall back to rule-based similarity check
 * 3. Support step-by-step partial credit for multi-step problems
 */

import type { GradeResult, MistakeCause } from './types';
import { classifyErrorCause } from './error-classifier';
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { SOLVE_THINKING_CONFIG } from './solver-constants';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { createLogger } from '@/lib/logger';

const log = createLogger('Grader');

const GRADING_PROMPT = `你是一位经验丰富的教师，需要客观公正地批改学生的作业答案。

请严格按照以下要求批改：

## 题目
{problemText}

## 标准答案
{correctAnswer}

## 学生答案
{userAnswer}

{stepsContext}

## 批改要求

1. **对错判断**：对比标准答案和学生答案，判断是否正确
2. **评分**：给出 0-100 分
   - 完全正确：100 分
   - 部分正确：按步骤给分
   - 完全错误：0-20 分
3. **错因分类**：必须从以下六种中选择一种：
   - concept-unclear：概念不清（不理解核心概念或定理）
   - calculation-error：计算失误（思路正确但算错）
   - misreading：审题错误（误解题目要求或条件）
   - method-wrong：方法错误（使用了错误的解题方法）
   - careless：粗心（遗漏符号、单位、小数点等）
   - format-error：格式错误（答案正确但格式不规范）
4. **错误分析**：用中文简要说明错误原因
5. **分步评分**：如果题目有步骤，给出每步得分和评语

## 输出格式

请严格输出以下 JSON，不要包含任何其他文字：

{
  "isCorrect": boolean,
  "score": number,
  "errorAnalysis": "string",
  "cause": "one of the six causes above",
  "partialCredit": [
    { "step": "步骤1", "maxScore": 10, "earnedScore": 8, "comment": "评语" }
  ]
}`;

interface LLMGradeOutput {
  isCorrect: boolean;
  score: number;
  errorAnalysis: string;
  cause: string;
  partialCredit?: { step: string; maxScore: number; earnedScore: number; comment: string }[];
}

function parseLLMGrade(text: string): LLMGradeOutput | null {
  const parsed = parseJsonResponse<LLMGradeOutput>(text);
  if (!parsed) return null;
  if (typeof parsed.isCorrect !== 'boolean') return null;
  if (typeof parsed.score !== 'number') return null;
  return parsed;
}

/**
 * Rule-based fallback: simple similarity scoring.
 * Used when LLM call fails.
 */
function ruleBasedGrade(correctAnswer: string, userAnswer: string): GradeResult {
  const normalizedCorrect = correctAnswer.trim().toLowerCase();
  const normalizedUser = userAnswer.trim().toLowerCase();

  // Exact match
  if (normalizedCorrect === normalizedUser) {
    return {
      isCorrect: true,
      score: 100,
      correctAnswer,
      userAnswer,
      errorAnalysis: '答案正确',
      cause: 'careless',
    };
  }

  // Contains core answer
  const coreLength = Math.min(normalizedCorrect.length, 30);
  const coreCorrect = normalizedCorrect.slice(0, coreLength);
  const coreUser = normalizedUser.slice(0, coreLength);

  if (normalizedCorrect.includes(normalizedUser) || normalizedUser.includes(normalizedCorrect)) {
    return {
      isCorrect: true,
      score: 80,
      correctAnswer,
      userAnswer,
      errorAnalysis: '答案核心正确，但表述不完全一致',
      cause: 'format-error',
    };
  }

  // Partial match on core content
  let matchCount = 0;
  for (let i = 0; i < coreLength; i++) {
    if (coreCorrect[i] === coreUser[i]) matchCount++;
  }
  const similarity = matchCount / coreLength;

  const cause = similarity > 0.3 ? 'calculation-error' : 'method-wrong';
  const score = Math.round(similarity * 50);

  return {
    isCorrect: false,
    score,
    correctAnswer,
    userAnswer,
    errorAnalysis:
      similarity > 0.3 ? '答案思路部分正确，但结果有误，请核对计算过程' : '答案不正确，请重新审题',
    cause,
  };
}

/**
 * Grade a user answer against the correct answer.
 *
 * Uses LLM-based analysis with rule-based fallback.
 * Supports step-by-step partial credit when userAnswerSteps are provided.
 *
 * @param problemText - The original problem text
 * @param correctAnswer - The expected correct answer
 * @param userAnswer - The student's answer
 * @param correctAnswerSteps - Optional steps for the correct answer (for partial credit)
 */
export async function gradeAnswer(
  problemText: string,
  correctAnswer: string,
  userAnswer: string,
  correctAnswerSteps?: string[],
  teachingProjection?: string,
): Promise<GradeResult> {
  try {
    const modelWithInfo = getModel({
      providerId: 'deepseek',
      modelId: 'deepseek-v4-pro',
      apiKey: process.env.DEEPSEEK_API_KEY ?? '',
      providerType: 'openai',
    });

    const stepsContext = correctAnswerSteps
      ? `## 标准答案步骤\n${correctAnswerSteps.map((s, i) => `步骤${i + 1}: ${s}`).join('\n')}`
      : '';

    const prompt = GRADING_PROMPT.replace('{problemText}', problemText)
      .replace('{correctAnswer}', correctAnswer)
      .replace('{userAnswer}', userAnswer)
      .replace('{stepsContext}', stepsContext);

    const systemContent = teachingProjection
      ? `${prompt}\n\n# Learner Profile (authoritative)\n${teachingProjection}\n\n请严格按上述学习者画像调整讲解深度、语气和分步详略。`
      : prompt;

    const messages: Array<{ role: string; content: unknown }> = [
      { role: 'system', content: systemContent },
    ];

    const result = await callLLM(
      {
        model: modelWithInfo.model,
        messages: messages as any,
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
      'grade-answer',
      { retries: 1 },
      SOLVE_THINKING_CONFIG,
    );

    const parsed = parseLLMGrade(result.text);
    if (!parsed) {
      log.warn('[Grader] LLM response parse failed, using rule-based fallback');
      return ruleBasedGrade(correctAnswer, userAnswer);
    }

    return {
      isCorrect: parsed.isCorrect,
      score: Math.max(0, Math.min(100, parsed.score)),
      correctAnswer,
      userAnswer,
      errorAnalysis: parsed.errorAnalysis || (parsed.isCorrect ? '答案正确' : '答案有误'),
      cause: classifyErrorCause(parsed.cause),
      partialCredit: parsed.partialCredit?.map((pc) => ({
        step: pc.step,
        maxScore: pc.maxScore,
        earnedScore: Math.max(0, pc.earnedScore),
        comment: pc.comment || '',
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`[Grader] gradeAnswer failed: ${message}, using rule-based fallback`);
    return ruleBasedGrade(correctAnswer, userAnswer);
  }
}

/**
 * Synchronous rule-based grading (no LLM call).
 * Useful for quick checks or when LLM is unavailable.
 */
export function gradeAnswerSync(
  problemText: string,
  correctAnswer: string,
  userAnswer: string,
): GradeResult {
  return ruleBasedGrade(correctAnswer, userAnswer);
}
