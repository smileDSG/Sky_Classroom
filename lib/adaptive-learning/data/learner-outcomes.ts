import { z } from 'zod';

import type { StorageProvider } from '@/lib/storage/storage-types';

const TABLE = 'learner_outcomes';

export const learnerOutcomeSchema = z
  .object({
    outcomeId: z.string().min(1),
    decisionId: z.string().min(1),
    userId: z.string().min(1),
    windowStart: z.string().datetime(),
    windowEnd: z.string().datetime(),
    correctCount: z.number().int().min(0),
    questionCount: z.number().int().min(0),
    correctRate: z.number().min(0).max(1),
    hintsRequested: z.number().int().min(0).default(0),
    durationSeconds: z.number().min(0),
    completed: z.boolean(),
    exited: z.boolean(),
    errorTypes: z.array(z.string()),
    nextDecisionId: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type LearnerOutcome = z.infer<typeof learnerOutcomeSchema>;

export interface LearnerOutcomeDAO {
  add(outcome: LearnerOutcome): Promise<LearnerOutcome>;
  get(outcomeId: string): Promise<LearnerOutcome | null>;
  getByDecisionId(decisionId: string): Promise<LearnerOutcome | null>;
  listByUser(userId: string): Promise<LearnerOutcome[]>;
}

export function createLearnerOutcomeDAO(storage: StorageProvider): LearnerOutcomeDAO {
  return {
    async add(input) {
      const outcome = learnerOutcomeSchema.parse(input);
      const existing = await this.getByDecisionId(outcome.decisionId);
      if (existing) return existing;
      const timestamp = new Date(outcome.createdAt).getTime();
      await storage.set(TABLE, {
        id: outcome.outcomeId,
        data: outcome,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return outcome;
    },

    async get(outcomeId) {
      const entry = await storage.get<LearnerOutcome>(TABLE, outcomeId);
      return entry ? learnerOutcomeSchema.parse(entry.data) : null;
    },

    async getByDecisionId(decisionId) {
      const entries = await storage.getAll<LearnerOutcome>(
        TABLE,
        (entry) => entry.data.decisionId === decisionId,
      );
      const latest = entries.sort((left, right) =>
        right.data.createdAt.localeCompare(left.data.createdAt),
      )[0];
      return latest ? learnerOutcomeSchema.parse(latest.data) : null;
    },

    async listByUser(userId) {
      const entries = await storage.getAll<LearnerOutcome>(
        TABLE,
        (entry) => entry.data.userId === userId,
      );
      return entries
        .map((entry) => learnerOutcomeSchema.parse(entry.data))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
  };
}
