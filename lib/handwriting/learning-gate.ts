import type { GradingRun } from './types';

export type LearningEligibilityReason =
  | 'recognition_unconfirmed'
  | 'grading_incomplete'
  | 'confidence_below_threshold'
  | 'open_feedback'
  | 'teacher_review_required'
  | 'missing_evidence'
  | 'missing_idempotency_key'
  | 'already_committed';

export interface LearningEligibilityInput {
  recognitionConfirmed: boolean;
  gradingStatus: GradingRun['status'];
  overallConfidence: number;
  hasOpenFeedback: boolean;
  needsTeacherReview: boolean;
  evidenceCount: number;
  idempotencyKey: string;
  alreadyCommitted: boolean;
}

export interface LearningEligibilityResult {
  eligible: boolean;
  reasons: LearningEligibilityReason[];
}

export function evaluateLearningEligibility(
  input: LearningEligibilityInput,
): LearningEligibilityResult {
  const reasons: LearningEligibilityReason[] = [];

  if (!input.recognitionConfirmed) reasons.push('recognition_unconfirmed');
  if (input.gradingStatus !== 'completed') reasons.push('grading_incomplete');
  if (!Number.isFinite(input.overallConfidence) || input.overallConfidence < 0.8) {
    reasons.push('confidence_below_threshold');
  }
  if (input.hasOpenFeedback) reasons.push('open_feedback');
  if (input.needsTeacherReview) reasons.push('teacher_review_required');
  if (!Number.isFinite(input.evidenceCount) || input.evidenceCount < 1) {
    reasons.push('missing_evidence');
  }
  if (!input.idempotencyKey.trim()) reasons.push('missing_idempotency_key');
  if (input.alreadyCommitted) reasons.push('already_committed');

  return { eligible: reasons.length === 0, reasons };
}
