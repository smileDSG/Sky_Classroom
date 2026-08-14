import { abilityStateSchema, type AbilityState } from '@/lib/adaptive-learning/contracts';
import type { StorageProvider } from '@/lib/storage/storage-types';

import {
  createInitialAbilityState,
  updateAbilityFromAnswer,
  type FixedDifficultyItem,
} from './ability-engine';

const ABILITY_STATE_TABLE = 'learner-ability-states';

function entryId(userId: string, dimensionId: string): string {
  return `ability:${encodeURIComponent(userId)}:${encodeURIComponent(dimensionId)}`;
}

export async function getAbilityState(
  storage: StorageProvider,
  userId: string,
  dimensionId: string,
): Promise<AbilityState | null> {
  const entry = await storage.get<unknown>(ABILITY_STATE_TABLE, entryId(userId, dimensionId));
  return entry ? abilityStateSchema.parse(entry.data) : null;
}

export async function recordFixedItemAbilityAnswer(
  storage: StorageProvider,
  input: FixedDifficultyItem & {
    userId: string;
    correct: boolean;
    occurredAt: string;
  },
): Promise<AbilityState> {
  const previous =
    (await getAbilityState(storage, input.userId, input.dimensionId)) ??
    createInitialAbilityState({ userId: input.userId, dimensionId: input.dimensionId });
  const next = abilityStateSchema.parse(
    updateAbilityFromAnswer({
      previous,
      item: input,
      correct: input.correct,
      occurredAt: input.occurredAt,
    }).next,
  );
  const timestamp = new Date(input.occurredAt).getTime();
  await storage.set(ABILITY_STATE_TABLE, {
    id: entryId(input.userId, input.dimensionId),
    data: next,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return next;
}
