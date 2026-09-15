/**
 * Answer self-verification decision logic for the solve pipeline.
 *
 * Pure, framework-free functions so the verification policy can be unit-tested
 * without any LLM or DB dependency. The goal (per R1 in cloud-mind-solve-plan):
 * for 可判定题 (choice/fill/judge — deterministic answer) we must force an
 * independent verification, and on inconsistency we retry or surface
 * "答案待确认" — never silently present a wrong answer.
 */

export type VerifiableQuestionType = 'choice' | 'fill' | 'solve' | 'judge';

/** Where the final answer's trust level ended up after self-verification. */
export type AnswerReviewStatus =
  | 'verified' // 独立复核通过，答案可信
  | 'corrected' // 独立复核不一致，已由修正 agent 给出新答案
  | 'pending-confirmation' // 校验不一致/失败且未能修正 → 标注「答案待确认」
  | 'skipped'; // 无答案/缓存题库命中，跳过复核

/**
 * 可判定题：答案是一个定值（选择/填空/判断）。
 * 这类题最容易被"态度诚恳但算错"的模型带偏，因此必须独立复核。
 */
export function isDeterministic(questionType?: string | null): boolean {
  return questionType === 'choice' || questionType === 'fill' || questionType === 'judge';
}

export interface VerifyDecision {
  shouldVerify: boolean;
  reason: string;
}

/**
 * 决定是否需要独立复核答案。
 *
 * - 可判定题(choice/fill/judge)：答案定值，无条件强制复核。
 * - 开放解答题(solve)：有答案即做"结论级"独立复核 —— 用户需要知道
 *   大题/证明题的结论是否可信，不能因"置信度高"就跳过。
 *
 * 仅当没有提取到答案时跳过。
 *
 * @param analysisConfidence 分析阶段自报置信度 0..1（开放题现不据此跳过）
 */
export function decideVerification(params: {
  questionType?: string | null;
  hasAnswer: boolean;
  analysisConfidence: number;
}): VerifyDecision {
  if (!params.hasAnswer) {
    return { shouldVerify: false, reason: '无答案，跳过校验' };
  }
  if (isDeterministic(params.questionType)) {
    return {
      shouldVerify: true,
      reason: '可判定题(选择/填空/判断)，答案定值，强制独立复核',
    };
  }
  return { shouldVerify: true, reason: '开放解答，结论级独立复核' };
}

/**
 * 将"校验是否运行/是否通过/是否已修正"归约成最终复核状态。
 *
 * @param skipped  本次校验被有意跳过（开放高置信 / 无答案）
 * @param verifyPassed 独立校验通过（isCorrect=true）
 * @param corrected 独立校验不一致后，修正 agent 是否给出了新答案
 */
export function resolveReviewStatus(params: {
  skipped: boolean;
  verifyPassed: boolean;
  corrected: boolean;
}): AnswerReviewStatus {
  if (params.skipped) return 'skipped';
  if (params.verifyPassed) return 'verified';
  return params.corrected ? 'corrected' : 'pending-confirmation';
}

/**
 * 一个"待确认"答案是否可被安全写入题库的 verified 标志。
 * 只有复核通过或已由独立修正得出新答案，才标 verified；其余一律 false。
 */
export function isVerifiedReview(status: AnswerReviewStatus | undefined | null): boolean {
  return status === 'verified' || status === 'corrected';
}
