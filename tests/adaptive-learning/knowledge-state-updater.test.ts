import { describe, expect, it } from 'vitest';

import { updateKnowledgeStateFromAnswer } from '@/lib/adaptive-learning/profile/knowledge-state-updater';

describe('updateKnowledgeStateFromAnswer', () => {
  it('raises mastery after a verified correct answer', () => {
    const state = updateKnowledgeStateFromAnswer({
      userId: 'student-1',
      nodeId: 'functions-basic',
      correct: true,
      evidenceQuality: 'verified',
      occurredAt: '2026-07-30T08:00:00.000Z',
      defaultStabilityDays: 7,
    });

    expect(state.mastery).toBeGreaterThan(0.5);
    expect(state.alpha).toBeGreaterThan(state.beta);
    expect(state.evidenceCount).toBe(1);
    expect(state.lastEvidenceAt).toBe('2026-07-30T08:00:00.000Z');
  });

  it('lowers mastery and stability after an incorrect answer', () => {
    const state = updateKnowledgeStateFromAnswer({
      userId: 'student-1',
      nodeId: 'functions-basic',
      correct: false,
      evidenceQuality: 'verified',
      occurredAt: '2026-07-30T08:00:00.000Z',
      defaultStabilityDays: 8,
    });

    expect(state.mastery).toBeLessThan(0.5);
    expect(state.reviewStabilityDays).toBe(4);
    expect(state.repeatedErrorCount).toBe(1);
  });
});
