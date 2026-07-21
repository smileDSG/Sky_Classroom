import { describe, expect, it } from 'vitest';
import { HANDWRITING_SUBMISSION_STATUSES } from '@/lib/handwriting';
import type { GradingRun, HandwritingSubmission, RecognitionRevision } from '@/lib/handwriting';

describe('handwriting domain contracts', () => {
  it('supports a confirmed recognition revision linked to a grading run', () => {
    const revision: RecognitionRevision = {
      id: 'revision-1',
      submissionId: 'submission-1',
      version: 2,
      steps: [],
      source: 'student_edit',
      confirmedByStudent: true,
      confirmedAt: 2,
      createdAt: 1,
    };
    const run: GradingRun = {
      id: 'run-1',
      submissionId: 'submission-1',
      recognitionRevisionId: revision.id,
      attempt: 1,
      status: 'completed',
      decisions: [],
      stepGrades: [],
      finalScore: 80,
      overallConfidence: 0.9,
      eligibleForLearningCommit: true,
      createdAt: 3,
      completedAt: 4,
    };
    const submission: HandwritingSubmission = {
      id: 'submission-1',
      userId: 'user-1',
      subject: 'math',
      status: 'graded',
      pageIds: ['page-1'],
      confirmedRecognitionRevisionId: revision.id,
      activeGradingRunId: run.id,
      createdAt: 1,
      updatedAt: 4,
    };

    expect(submission.confirmedRecognitionRevisionId).toBe(run.recognitionRevisionId);
    expect(HANDWRITING_SUBMISSION_STATUSES).toContain('awaiting_student_confirmation');
  });
});
