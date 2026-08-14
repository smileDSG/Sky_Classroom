import {
  learningPlanSchema,
  planAdjustmentSchema,
  type LearningPlan,
  type PlanAdjustment,
} from '@/lib/adaptive-learning/contracts';
import type { StorageProvider } from '@/lib/storage/storage-types';

const PLAN_TABLE = 'learning_plans';
const ADJUSTMENT_TABLE = 'learning_plan_adjustments';

export interface LearningPlanDAO {
  add(plan: LearningPlan): Promise<LearningPlan>;
  get(id: string): Promise<LearningPlan | null>;
  update(id: string, partial: Partial<LearningPlan>): Promise<LearningPlan | null>;
  listByUser(userId: string): Promise<LearningPlan[]>;
  getActiveByUser(userId: string): Promise<LearningPlan | null>;
  addAdjustment(adjustment: PlanAdjustment): Promise<PlanAdjustment>;
  listAdjustments(userId: string): Promise<PlanAdjustment[]>;
}

export function createLearningPlanDAO(storage: StorageProvider): LearningPlanDAO {
  return {
    async add(plan) {
      const validated = learningPlanSchema.parse(plan);
      const now = Date.now();
      await storage.set(PLAN_TABLE, {
        id: validated.id,
        data: validated,
        createdAt: now,
        updatedAt: now,
      });
      return validated;
    },

    async get(id) {
      const entry = await storage.get<LearningPlan>(PLAN_TABLE, id);
      return entry ? learningPlanSchema.parse(entry.data) : null;
    },

    async update(id, partial) {
      const entry = await storage.get<LearningPlan>(PLAN_TABLE, id);
      if (!entry) return null;
      const updated = learningPlanSchema.parse({ ...entry.data, ...partial });
      await storage.set(PLAN_TABLE, {
        id,
        data: updated,
        createdAt: entry.createdAt,
        updatedAt: Date.now(),
      });
      return updated;
    },

    async listByUser(userId) {
      const entries = await storage.getAll<LearningPlan>(
        PLAN_TABLE,
        (entry) => entry.data.userId === userId,
      );
      return entries
        .map((entry) => learningPlanSchema.parse(entry.data))
        .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
    },

    async getActiveByUser(userId) {
      const plans = await this.listByUser(userId);
      return plans.find((plan) => plan.status === 'active') ?? null;
    },

    async addAdjustment(adjustment) {
      const validated = planAdjustmentSchema.parse(adjustment);
      const now = Date.now();
      await storage.set(ADJUSTMENT_TABLE, {
        id: validated.id,
        data: validated,
        createdAt: now,
        updatedAt: now,
      });
      return validated;
    },

    async listAdjustments(userId) {
      const entries = await storage.getAll<PlanAdjustment>(
        ADJUSTMENT_TABLE,
        (entry) => entry.data.userId === userId,
      );
      return entries
        .map((entry) => planAdjustmentSchema.parse(entry.data))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
  };
}
