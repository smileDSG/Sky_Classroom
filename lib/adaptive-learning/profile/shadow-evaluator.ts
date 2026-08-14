import { replayAbilityResponses, type AbilityReplayResponse } from './ability-replay';

export interface ShadowMetrics {
  brier: number;
  auc: number;
}

export interface AbilityShadowReport {
  evaluatedResponses: number;
  newModel: ShadowMetrics;
  baseline: ShadowMetrics;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function auc(rows: Array<{ prediction: number; correct: boolean }>): number {
  const positives = rows.filter((row) => row.correct);
  const negatives = rows.filter((row) => !row.correct);
  if (positives.length === 0 || negatives.length === 0) return 0.5;
  let wins = 0;
  for (const positive of positives) {
    for (const negative of negatives) {
      if (positive.prediction > negative.prediction) wins += 1;
      else if (positive.prediction === negative.prediction) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
}

function brier(rows: Array<{ prediction: number; correct: boolean }>): number {
  return rows.reduce((sum, row) => sum + (row.prediction - Number(row.correct)) ** 2, 0) / rows.length;
}

/** Read-only comparison against an online Beta correctness baseline. */
export function evaluateAbilityShadow(responses: AbilityReplayResponse[]): AbilityShadowReport {
  const ordered = [...responses].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const replay = replayAbilityResponses(ordered);
  const betaByUser = new Map<string, { alpha: number; beta: number }>();
  const baselineRows: Array<{ prediction: number; correct: boolean }> = [];

  for (const response of ordered) {
    const key = `${response.userId}:${response.dimensionId}`;
    const state = betaByUser.get(key) ?? { alpha: 1, beta: 1 };
    baselineRows.push({ prediction: state.alpha / (state.alpha + state.beta), correct: response.correct });
    if (response.correct) state.alpha += 1;
    else state.beta += 1;
    betaByUser.set(key, state);
  }

  const newRows = replay.rows.map((row) => ({
    prediction: row.predictedCorrectness,
    correct: row.correct,
  }));
  return {
    evaluatedResponses: ordered.length,
    newModel: { brier: round(brier(newRows)), auc: round(auc(newRows)) },
    baseline: { brier: round(brier(baselineRows)), auc: round(auc(baselineRows)) },
  };
}
