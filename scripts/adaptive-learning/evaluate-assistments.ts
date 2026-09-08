import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  replayAbilityResponses,
  type AbilityReplayResponse,
} from '@/lib/adaptive-learning/profile/ability-replay';

interface NormalizedAssistmentsRow extends AbilityReplayResponse {
  timestampMode: string;
}

const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve('data/adaptive-learning/external/assistments09/normalized.sample.jsonl');

const rows = readFileSync(inputPath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as NormalizedAssistmentsRow);

const result = replayAbilityResponses(rows);
console.log(
  JSON.stringify(
    {
      dataset: 'ASSISTments09',
      inputPath,
      rows: result.rows.length,
      timestampMode: rows[0]?.timestampMode ?? 'unknown',
      metrics: result.metrics,
    },
    null,
    2,
  ),
);
