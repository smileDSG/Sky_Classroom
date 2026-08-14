import { describe, expect, it } from 'vitest';

import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import { recordFixedItemAbilityAnswer } from '@/lib/adaptive-learning/profile/ability-state-repository';

describe('ability state repository', () => {
  it('persists a user ability update for a verified fixed item', async () => {
    const storage = new MemoryStorageProvider();

    const result = await recordFixedItemAbilityAnswer(storage, {
      userId: 'student-1',
      dimensionId: 'ai-intro',
      itemId: 'ai-10-010',
      itemVersion: 'v0.1.0',
      contentHash: 'sha256:ai-10-010',
      generatorVersion: 'course-bank-v0.1.0',
      nodeIds: ['multi-agent-orchestration'],
      difficulty: 0.7,
      correct: true,
      occurredAt: '2026-08-01T00:00:00.000Z',
    });

    expect(result.theta).toBeGreaterThan(0);
    expect(result.answerCount).toBe(1);
  });
});
