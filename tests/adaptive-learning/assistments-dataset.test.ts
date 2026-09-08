import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  replayAbilityResponses,
  type AbilityReplayResponse,
} from '@/lib/adaptive-learning/profile/ability-replay';

interface NormalizedRow extends AbilityReplayResponse {
  timestampMode: string;
  skillName: string;
}

describe('ASSISTments09 normalized dataset', () => {
  it('feeds ordered public interactions into the ability replay model', () => {
    const fixturePath = path.join(
      process.cwd(),
      'data/adaptive-learning/external/assistments09/normalized.sample.jsonl',
    );
    const rows = readFileSync(fixturePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as NormalizedRow);

    const result = replayAbilityResponses(rows);
    const users = new Set(rows.map((row) => row.userId));

    expect(rows).toHaveLength(5000);
    expect(users.size).toBeGreaterThan(1);
    expect(rows.every((row) => row.timestampMode === 'synthetic-sequence-order')).toBe(true);
    expect(rows.every((row) => row.dimensionId.startsWith('assistments09:skill:'))).toBe(true);
    expect(result.rows).toHaveLength(rows.length);
    expect(Number.isFinite(result.metrics.brier)).toBe(true);
    expect(Number.isFinite(result.metrics.auc)).toBe(true);
  });
});
