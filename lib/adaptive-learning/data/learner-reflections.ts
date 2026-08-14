import { z } from 'zod';

import type { StorageProvider } from '@/lib/storage/storage-types';

const TABLE = 'learner_reflections';

export const reflectionDimensionSchema = z.enum([
  'goal',
  'knowledge',
  'error-pattern',
  'pace',
  'format-preference',
  'explanation-preference',
  'persistence',
  'intervention-response',
]);

export const learnerReflectionHypothesisSchema = z
  .object({
    dimension: reflectionDimensionSchema,
    statement: z.string().min(1).max(500),
    confidence: z.number().min(0).max(1),
    evidenceEventIds: z.array(z.string().min(1)).min(1),
    expiresAt: z.string().datetime(),
  })
  .strict();

export const learnerReflectionSchema = z
  .object({
    reflectionId: z.string().min(1),
    userId: z.string().min(1),
    windowStart: z.string().datetime(),
    windowEnd: z.string().datetime(),
    hypotheses: z.array(learnerReflectionHypothesisSchema),
    sourceEventIds: z.array(z.string().min(1)),
    modelId: z.string().min(1),
    generatedAt: z.string().datetime(),
    inputEventWatermark: z.number().int().min(0),
  })
  .strict();

export type LearnerReflection = z.infer<typeof learnerReflectionSchema>;

export interface LearnerReflectionDAO {
  add(reflection: LearnerReflection): Promise<LearnerReflection>;
  get(reflectionId: string): Promise<LearnerReflection | null>;
  getLatest(userId: string): Promise<LearnerReflection | null>;
  listByUser(userId: string): Promise<LearnerReflection[]>;
}

export function createLearnerReflectionDAO(storage: StorageProvider): LearnerReflectionDAO {
  return {
    async add(input) {
      const reflection = learnerReflectionSchema.parse(input);
      const timestamp = new Date(reflection.generatedAt).getTime();
      await storage.set(TABLE, {
        id: reflection.reflectionId,
        data: reflection,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return reflection;
    },

    async get(reflectionId) {
      const entry = await storage.get<LearnerReflection>(TABLE, reflectionId);
      return entry ? learnerReflectionSchema.parse(entry.data) : null;
    },

    async getLatest(userId) {
      const reflections = await this.listByUser(userId);
      return reflections[0] ?? null;
    },

    async listByUser(userId) {
      const entries = await storage.getAll<LearnerReflection>(
        TABLE,
        (entry) => entry.data.userId === userId,
      );
      return entries
        .map((entry) => learnerReflectionSchema.parse(entry.data))
        .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
    },
  };
}
