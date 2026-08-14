import { describe, expect, it } from 'vitest';

import {
  createInitialAbilityState,
  updateAbilityFromAnswer,
} from '@/lib/adaptive-learning/profile/ability-engine';

describe('ability engine', () => {
  it('raises ability after a correct answer to a fixed hard item without mutating item difficulty', () => {
    const initial = createInitialAbilityState({
      userId: 'student-1',
      dimensionId: 'ai-intro',
    });
    const item = {
      itemId: 'ai-10-010',
      itemVersion: 'v0.1.0',
      contentHash: 'sha256:demo',
      generatorVersion: 'course-bank-v0.1.0',
      dimensionId: 'ai-intro',
      nodeIds: ['multi-agent-orchestration'],
      difficulty: 0.7,
    };

    const result = updateAbilityFromAnswer({
      previous: initial,
      item,
      correct: true,
      occurredAt: '2026-08-01T00:00:00.000Z',
    });

    expect(result.next.theta).toBeGreaterThan(initial.theta);
    expect(result.predictedCorrectness).toBeLessThan(0.5);
    expect(result.itemDifficulty).toBe(0.7);
    expect(result.next.answerCount).toBe(1);
  });
});
