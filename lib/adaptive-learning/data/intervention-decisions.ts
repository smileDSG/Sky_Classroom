import { z } from 'zod';

import type { StorageProvider } from '@/lib/storage/storage-types';

const TABLE = 'intervention_decisions';

export const interventionPlanSchema = z
  .object({
    id: z.string().min(1),
    action: z.enum(['teach', 'review', 'quiz', 'diagnostic']),
    topic: z.string().nullable().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    format: z.enum(['worked-example', 'diagram', 'interactive']).optional(),
    expectedEffects: z.array(z.string()).optional(),
    risks: z.array(z.string()).optional(),
    rationale: z.array(z.string()).optional(),
    score: z.number().finite().optional(),
  })
  .passthrough();

export const interventionDecisionSchema = z
  .object({
    decisionId: z.string().min(1),
    userId: z.string().min(1),
    sessionId: z.string().min(1),
    stateSnapshot: z.record(z.string(), z.unknown()),
    reflectionSnapshot: z.record(z.string(), z.unknown()).optional(),
    candidatePlans: z.array(interventionPlanSchema),
    selectedPlan: interventionPlanSchema.nullable(),
    fallbackUsed: z.boolean(),
    modelId: z.string().min(1).nullable(),
    correlationId: z.string().min(1),
    createdAt: z.string().datetime(),
  })
  .strict();

export type InterventionPlan = z.infer<typeof interventionPlanSchema>;
export type InterventionDecision = z.infer<typeof interventionDecisionSchema>;

export interface InterventionDecisionDAO {
  add(decision: InterventionDecision): Promise<InterventionDecision>;
  get(decisionId: string): Promise<InterventionDecision | null>;
  listByUser(userId: string): Promise<InterventionDecision[]>;
}

export function createInterventionDecisionDAO(storage: StorageProvider): InterventionDecisionDAO {
  return {
    async add(input) {
      const decision = interventionDecisionSchema.parse(input);
      const timestamp = new Date(decision.createdAt).getTime();
      await storage.set(TABLE, {
        id: decision.decisionId,
        data: decision,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return decision;
    },

    async get(decisionId) {
      const entry = await storage.get<InterventionDecision>(TABLE, decisionId);
      return entry ? interventionDecisionSchema.parse(entry.data) : null;
    },

    async listByUser(userId) {
      const entries = await storage.getAll<InterventionDecision>(
        TABLE,
        (entry) => entry.data.userId === userId,
      );
      return entries
        .map((entry) => interventionDecisionSchema.parse(entry.data))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
  };
}
