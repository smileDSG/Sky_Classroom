import { createInitialAbilityState, updateAbilityFromAnswer } from './ability-engine';
import type { AbilityState } from '@/lib/adaptive-learning/contracts';

export interface AbilityReplayResponse {
  userId: string;
  dimensionId: string;
  itemId: string;
  difficulty: number;
  correct: boolean;
  occurredAt: string;
}

export interface AbilityReplayRow extends AbilityReplayResponse {
  predictedCorrectness: number;
  thetaBefore: number;
  thetaAfter: number;
}

export interface AbilityReplayMetrics {
  brier: number;
  baselineBrier: number;
  auc: number;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function brier(rows: AbilityReplayRow[], constant?: number): number {
  if (rows.length === 0) return 0;
  return (
    rows.reduce((sum, row) => {
      const prediction = constant ?? row.predictedCorrectness;
      return sum + (prediction - Number(row.correct)) ** 2;
    }, 0) / rows.length
  );
}

function auc(rows: AbilityReplayRow[]): number {
  const positives = rows.filter((row) => row.correct);
  const negatives = rows.filter((row) => !row.correct);
  if (positives.length === 0 || negatives.length === 0) return 0.5;

  let wins = 0;
  for (const positive of positives) {
    for (const negative of negatives) {
      if (positive.predictedCorrectness > negative.predictedCorrectness) wins += 1;
      else if (positive.predictedCorrectness === negative.predictedCorrectness) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
}

export function replayAbilityResponses(responses: AbilityReplayResponse[]): {
  rows: AbilityReplayRow[];
  metrics: AbilityReplayMetrics;
} {
  const states = new Map<string, AbilityState>();
  const rows: AbilityReplayRow[] = [];
  const ordered = [...responses].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) || left.itemId.localeCompare(right.itemId),
  );

  for (const response of ordered) {
    const stateKey = `${response.userId}:${response.dimensionId}`;
    const previous =
      states.get(stateKey) ??
      createInitialAbilityState({
        userId: response.userId,
        dimensionId: response.dimensionId,
      });
    const update = updateAbilityFromAnswer({
      previous,
      item: {
        itemId: response.itemId,
        itemVersion: 'replay.v1',
        contentHash: `replay:${response.itemId}`,
        generatorVersion: 'replay-dataset.v1',
        dimensionId: response.dimensionId,
        nodeIds: [],
        difficulty: response.difficulty,
      },
      correct: response.correct,
      occurredAt: response.occurredAt,
    });
    states.set(stateKey, update.next);
    rows.push({
      ...response,
      predictedCorrectness: update.predictedCorrectness,
      thetaBefore: previous.theta,
      thetaAfter: update.next.theta,
    });
  }

  const meanCorrectness = rows.reduce((sum, row) => sum + Number(row.correct), 0) / rows.length;
  return {
    rows,
    metrics: {
      brier: round(brier(rows)),
      baselineBrier: round(brier(rows, meanCorrectness)),
      auc: round(auc(rows)),
    },
  };
}
