import { describe, expect, it } from 'vitest';
import { evaluateLearningEligibility } from '@/lib/handwriting';
import type { LearningEligibilityInput } from '@/lib/handwriting';

const trusted: LearningEligibilityInput = {
  recognitionConfirmed: true,
  gradingStatus: 'completed',
  overallConfidence: 0.9,
  hasOpenFeedback: false,
  needsTeacherReview: false,
  evidenceCount: 1,
  idempotencyKey: 'commit-1',
  alreadyCommitted: false,
};

describe('handwriting learning gate', () => {
  it('accepts a fully trusted result', () => {
    expect(evaluateLearningEligibility(trusted)).toEqual({ eligible: true, reasons: [] });
  });

  it('rejects low confidence and open feedback with explicit reasons', () => {
    expect(
      evaluateLearningEligibility({
        ...trusted,
        overallConfidence: 0.79,
        hasOpenFeedback: true,
      }),
    ).toEqual({
      eligible: false,
      reasons: ['confidence_below_threshold', 'open_feedback'],
    });
  });

  it('rejects unconfirmed recognition, missing evidence, and teacher review', () => {
    expect(
      evaluateLearningEligibility({
        ...trusted,
        recognitionConfirmed: false,
        needsTeacherReview: true,
        evidenceCount: 0,
      }),
    ).toEqual({
      eligible: false,
      reasons: ['recognition_unconfirmed', 'teacher_review_required', 'missing_evidence'],
    });
  });

  it('rejects incomplete grading and duplicate or unidentified commits', () => {
    expect(
      evaluateLearningEligibility({
        ...trusted,
        gradingStatus: 'conflict',
        idempotencyKey: '',
        alreadyCommitted: true,
      }),
    ).toEqual({
      eligible: false,
      reasons: ['grading_incomplete', 'missing_idempotency_key', 'already_committed'],
    });
  });
});
