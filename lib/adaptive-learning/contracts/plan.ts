import { z } from 'zod';

import { nodeIdSchema } from './curriculum';
import { learnerProfileSchema } from './learner';
import { isoDateTimeSchema } from './resource';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const learningTaskSchema = z
  .object({
    id: z.string().min(1),
    nodeId: nodeIdSchema,
    type: z.enum(['learn', 'worked-example', 'practice', 'review', 'diagnostic']),
    title: z.string().min(1),
    objective: z.string().min(1),
    plannedMinutes: z.number().int().positive(),
    difficulty: z.number().int().min(1).max(5),
    resourceIds: z.array(z.string().regex(/^math_[a-f0-9]{16}$/)),
    successCriteria: z.array(z.string().min(1)).min(1),
    status: z.enum(['pending', 'in-progress', 'completed', 'skipped']),
    scheduledDate: dateSchema,
    reasonCodes: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const weeklyTargetSchema = z
  .object({
    weekStart: dateSchema,
    targetNodeIds: z.array(nodeIdSchema),
    plannedMinutes: z.number().int().min(0),
    expectedOutcomes: z.array(z.string().min(1)),
  })
  .strict();

export const learningPlanSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    version: z.number().int().positive(),
    status: z.enum(['draft', 'active', 'superseded', 'completed']),
    generatedAt: isoDateTimeSchema,
    validFrom: dateSchema,
    validTo: dateSchema,
    curriculumPackVersion: z.string().min(1),
    plannerVersion: z.string().min(1),
    profileSnapshot: learnerProfileSchema,
    tasks: z.array(learningTaskSchema),
    weeklyTargets: z.array(weeklyTargetSchema),
    constraintChecks: z.array(z.string().min(1)),
    evidenceEventIds: z.array(z.string().min(1)),
  })
  .strict();

export const planAdjustmentSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    previousPlanId: z.string().min(1),
    nextPlanId: z.string().min(1),
    mode: z.enum(['micro', 'full']),
    triggerEventIds: z.array(z.string().min(1)).min(1),
    changedTaskIds: z.array(z.string().min(1)),
    preservedTaskIds: z.array(z.string().min(1)),
    ruleEvidence: z.array(
      z
        .object({
          nodeId: nodeIdSchema,
          reasonCode: z.string().min(1),
          before: z.union([z.number(), z.string(), z.boolean()]),
          after: z.union([z.number(), z.string(), z.boolean()]),
        })
        .strict(),
    ),
    explanation: z.string().min(1),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type LearningTask = z.infer<typeof learningTaskSchema>;
export type LearningPlan = z.infer<typeof learningPlanSchema>;
export type PlanAdjustment = z.infer<typeof planAdjustmentSchema>;
