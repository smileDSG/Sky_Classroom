import type { PersonalizationDifficulty } from './types';

interface DifficultyPolicyInput {
  hasLearningData?: boolean;
  recentAccuracy?: number | null;
  primaryMastery?: number | null;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function derivePreferredDifficulty(input: DifficultyPolicyInput): PersonalizationDifficulty {
  const recentAccuracy = isNumber(input.recentAccuracy) ? input.recentAccuracy : null;
  const primaryMastery = isNumber(input.primaryMastery) ? input.primaryMastery : null;

  if (!input.hasLearningData && recentAccuracy === null && primaryMastery === null) {
    return 'medium';
  }

  if (
    (recentAccuracy !== null && recentAccuracy < 55) ||
    (primaryMastery !== null && primaryMastery < 50)
  ) {
    return 'easy';
  }

  if (
    recentAccuracy !== null &&
    primaryMastery !== null &&
    recentAccuracy > 80 &&
    primaryMastery > 75
  ) {
    return 'hard';
  }

  return 'medium';
}
