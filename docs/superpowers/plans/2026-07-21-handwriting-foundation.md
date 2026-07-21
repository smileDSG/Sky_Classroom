# Handwriting Grading Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first safe foundation for handwritten grading: domain contracts, legal submission transitions, confidence disposition, and a hard gate that prevents untrusted grading results from entering mistakes or student mastery.

**Architecture:** Add a focused `lib/handwriting/` domain module with no UI, database, or model dependencies. Pure functions make the safety policy deterministic and easy to test before API and OCR work begins.

**Tech Stack:** TypeScript 5, Vitest 4, existing `@/*` path aliases.

---

### Task 1: Define handwritten grading domain contracts

**Files:**
- Create: `lib/handwriting/types.ts`
- Create: `lib/handwriting/index.ts`
- Test: `tests/handwriting/domain-types.test.ts`

- [ ] **Step 1: Write the failing type contract test**

```ts
import { describe, expect, it } from 'vitest';
import { HANDWRITING_SUBMISSION_STATUSES } from '@/lib/handwriting';
import type { GradingRun, HandwritingSubmission, RecognitionRevision } from '@/lib/handwriting';

describe('handwriting domain contracts', () => {
  it('supports an immutable confirmed recognition revision linked to a grading run', () => {
    const revision: RecognitionRevision = {
      id: 'revision-1', submissionId: 'submission-1', version: 2,
      steps: [], source: 'student_edit', confirmedByStudent: true,
      confirmedAt: 2, createdAt: 1,
    };
    const run: GradingRun = {
      id: 'run-1', submissionId: 'submission-1', recognitionRevisionId: revision.id,
      attempt: 1, status: 'completed', decisions: [], stepGrades: [],
      finalScore: 80, overallConfidence: 0.9, eligibleForLearningCommit: true,
      createdAt: 3, completedAt: 4,
    };
    const submission: HandwritingSubmission = {
      id: 'submission-1', userId: 'user-1', subject: 'math', status: 'graded',
      pageIds: ['page-1'], confirmedRecognitionRevisionId: revision.id,
      activeGradingRunId: run.id, createdAt: 1, updatedAt: 4,
    };
    expect(submission.confirmedRecognitionRevisionId).toBe(run.recognitionRevisionId);
    expect(HANDWRITING_SUBMISSION_STATUSES).toContain('awaiting_student_confirmation');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/domain-types.test.ts`

Expected: FAIL because `@/lib/handwriting` does not exist.

- [ ] **Step 3: Add the domain types and public exports**

Implement the spec contracts for `HandwritingSubmission`, `SubmissionPage`, `RecognitionRevision`, `RecognizedStep`, `EvidenceReference`, `StepGrade`, `AgentDecision`, `GradingRun`, `GradingFeedbackReport`, and `LearningCommit`. Export them from `lib/handwriting/index.ts`.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/domain-types.test.ts`

Expected: PASS.

### Task 2: Enforce legal submission state transitions

**Files:**
- Create: `lib/handwriting/submission-state.ts`
- Modify: `lib/handwriting/index.ts`
- Test: `tests/handwriting/submission-state.test.ts`

- [ ] **Step 1: Write failing transition tests**

```ts
import { describe, expect, it } from 'vitest';
import { canTransitionSubmission, transitionSubmission } from '@/lib/handwriting';

describe('handwriting submission state', () => {
  it('requires student confirmation before grading', () => {
    expect(canTransitionSubmission('awaiting_student_confirmation', 'grading')).toBe(false);
    expect(canTransitionSubmission('awaiting_student_confirmation', 'ready_to_grade')).toBe(true);
  });

  it('rejects illegal transitions with a useful error', () => {
    expect(() => transitionSubmission('uploaded', 'graded')).toThrow(
      'Illegal handwriting submission transition: uploaded -> graded',
    );
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/submission-state.test.ts`

Expected: FAIL because the transition functions do not exist.

- [ ] **Step 3: Implement a closed transition map**

```ts
const ALLOWED_TRANSITIONS: Record<SubmissionStatus, readonly SubmissionStatus[]> = {
  draft: ['uploaded', 'closed'],
  uploaded: ['quality_checking', 'closed'],
  quality_checking: ['quality_rejected', 'awaiting_region_confirmation', 'recognizing'],
  quality_rejected: ['uploaded', 'closed'],
  awaiting_region_confirmation: ['recognizing', 'closed'],
  recognizing: ['awaiting_student_confirmation', 'quality_rejected', 'closed'],
  awaiting_student_confirmation: ['ready_to_grade', 'recognizing', 'closed'],
  ready_to_grade: ['grading', 'closed'],
  grading: ['reviewing_conflict', 'needs_teacher_review', 'graded', 'ready_to_grade'],
  reviewing_conflict: ['needs_teacher_review', 'graded', 'ready_to_grade'],
  needs_teacher_review: ['graded', 'ready_to_grade', 'closed'],
  graded: ['committed_to_learning', 'ready_to_grade', 'closed'],
  committed_to_learning: ['ready_to_grade', 'closed'],
  closed: [],
};
```

- [ ] **Step 4: Run transition tests and verify GREEN**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/submission-state.test.ts`

Expected: PASS.

### Task 3: Add confidence disposition and learning-write gate

**Files:**
- Create: `lib/handwriting/trust-policy.ts`
- Create: `lib/handwriting/learning-gate.ts`
- Modify: `lib/handwriting/index.ts`
- Test: `tests/handwriting/trust-policy.test.ts`
- Test: `tests/handwriting/learning-gate.test.ts`

- [ ] **Step 1: Write failing confidence tests**

```ts
import { describe, expect, it } from 'vitest';
import { computeOverallConfidence, determineResultDisposition } from '@/lib/handwriting';

describe('handwriting trust policy', () => {
  it('computes the specified weighted confidence', () => {
    expect(computeOverallConfidence({
      imageQuality: 0.8, recognitionCompleteness: 0.9,
      graderConfidence: 0.85, validatorConfidence: 0.8, agentAgreement: 1,
    })).toBeCloseTo(0.8525, 4);
  });

  it('never publishes a formal result when a blocking condition exists', () => {
    expect(determineResultDisposition(0.95, true)).toBe('undetermined');
  });
});
```

- [ ] **Step 2: Run confidence tests and verify RED**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/trust-policy.test.ts`

Expected: FAIL because the trust policy functions do not exist.

- [ ] **Step 3: Implement weighted confidence and disposition thresholds**

Return `formal` at confidence `>= 0.8`, `provisional` at `>= 0.6`, otherwise `undetermined`; any blocking condition returns `undetermined`.

- [ ] **Step 4: Run confidence tests and verify GREEN**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/trust-policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing learning gate tests**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateLearningEligibility } from '@/lib/handwriting';

const trusted = {
  recognitionConfirmed: true, gradingStatus: 'completed' as const,
  overallConfidence: 0.9, hasOpenFeedback: false, needsTeacherReview: false,
  evidenceCount: 1, idempotencyKey: 'commit-1', alreadyCommitted: false,
};

describe('handwriting learning gate', () => {
  it('accepts a fully trusted result', () => {
    expect(evaluateLearningEligibility(trusted)).toEqual({ eligible: true, reasons: [] });
  });

  it('rejects low confidence and open feedback with explicit reasons', () => {
    expect(evaluateLearningEligibility({ ...trusted, overallConfidence: 0.79, hasOpenFeedback: true }))
      .toEqual({ eligible: false, reasons: ['confidence_below_threshold', 'open_feedback'] });
  });
});
```

- [ ] **Step 6: Run learning gate tests and verify RED**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/learning-gate.test.ts`

Expected: FAIL because the gate does not exist.

- [ ] **Step 7: Implement the learning gate**

Evaluate all seven spec conditions and return every rejection reason in deterministic order. Never throw for an untrusted result.

- [ ] **Step 8: Run all foundation tests**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting`

Expected: all foundation tests PASS.

- [ ] **Step 9: Run focused typecheck and lint**

Run: `node_modules/.bin/tsc.cmd --noEmit --pretty false`

Expected: no new errors referencing `lib/handwriting` or `tests/handwriting`. Existing unrelated repository errors may remain and must be reported separately.

## Execution Status

- [x] Task 1 completed with RED/GREEN verification.
- [x] Task 2 completed with RED/GREEN verification.
- [x] Task 3 completed with RED/GREEN verification.
- [x] All `tests/handwriting` tests pass.
- [x] ESLint and Prettier pass for the new module and tests.
- [x] Full TypeScript check still has pre-existing repository errors; zero error lines reference the new handwriting files.
