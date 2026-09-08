import { describe, expect, it } from 'vitest';

import { evaluateAbilityShadow } from '@/lib/adaptive-learning/profile/shadow-evaluator';

describe('ability shadow evaluator', () => {
  it('compares the new model with the historical Beta baseline without writing learner state', () => {
    const report = evaluateAbilityShadow([
      {
        userId: 'a',
        dimensionId: 'math',
        itemId: 'easy-1',
        difficulty: -0.7,
        correct: true,
        occurredAt: '2026-08-01T08:00:00.000Z',
      },
      {
        userId: 'a',
        dimensionId: 'math',
        itemId: 'hard-1',
        difficulty: 0.7,
        correct: false,
        occurredAt: '2026-08-01T08:01:00.000Z',
      },
      {
        userId: 'a',
        dimensionId: 'math',
        itemId: 'easy-2',
        difficulty: -0.7,
        correct: true,
        occurredAt: '2026-08-01T08:02:00.000Z',
      },
      {
        userId: 'a',
        dimensionId: 'math',
        itemId: 'hard-2',
        difficulty: 0.7,
        correct: false,
        occurredAt: '2026-08-01T08:03:00.000Z',
      },
    ]);

    expect(report.evaluatedResponses).toBe(4);
    expect(report.newModel.auc).toBeGreaterThan(report.baseline.auc);
    expect(report.newModel.brier).toBeLessThan(report.baseline.brier);
  });
});
