import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { replayAbilityResponses } from '@/lib/adaptive-learning/profile/ability-replay';

interface ReplayDataset {
  responses: Array<{
    userId: string;
    dimensionId: string;
    itemId: string;
    difficulty: number;
    correct: boolean;
    occurredAt: string;
  }>;
}

describe('ability replay dataset', () => {
  it('predicts each response before learning from it and beats the constant baseline', () => {
    const fixturePath = path.join(
      process.cwd(),
      'data/adaptive-learning/evaluation/ability-replay.v1.json',
    );
    const dataset = JSON.parse(readFileSync(fixturePath, 'utf8')) as ReplayDataset;

    const result = replayAbilityResponses(dataset.responses);

    expect(result.rows).toHaveLength(dataset.responses.length);
    expect(result.rows[0]?.predictedCorrectness).toBeCloseTo(0.668188, 5);
    expect(result.metrics.brier).toBeLessThan(result.metrics.baselineBrier);
    expect(result.metrics.auc).toBeGreaterThan(0.7);
  });
});
