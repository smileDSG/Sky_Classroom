import { z } from 'zod';

import { nodeIdSchema } from './curriculum';
import { isoDateTimeSchema } from './resource';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const learnerProfileSchema = z
  .object({
    userId: z.string().min(1),
    stage: z.literal('senior-high'),
    grade: z.literal('grade-12'),
    subject: z.literal('math'),
    curriculumPackVersion: z.string().min(1),
    examDate: dateSchema,
    targetScore: z.number().min(0).max(150).optional(),
    latestScore: z.number().min(0).max(150).optional(),
    weeklyAvailableMinutes: z.number().int().positive(),
    dailyAvailability: z.record(z.string(), z.number().int().min(0)),
    preferredSessionMinutes: z.number().int().min(10).max(120),
    constraints: z
      .object({
        restDays: z.array(z.string().min(1)),
        maxDailyMinutes: z.number().int().positive(),
        teacherLockedNodeIds: z.array(nodeIdSchema),
      })
      .strict(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const knowledgeStateSchema = z
  .object({
    userId: z.string().min(1),
    nodeId: nodeIdSchema,
    alpha: z.number().positive(),
    beta: z.number().positive(),
    mastery: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    retention: z.number().min(0).max(1),
    reviewStabilityDays: z.number().positive(),
    repeatedErrorCount: z.number().int().min(0),
    lastEvidenceAt: isoDateTimeSchema.optional(),
    lastReviewedAt: isoDateTimeSchema.optional(),
    evidenceCount: z.number().int().min(0),
    version: z.number().int().positive(),
  })
  .strict();

export const learningEventTypeSchema = z.enum([
  'assessment-imported',
  'answer-submitted',
  'mistake-recorded',
  'review-completed',
  'task-started',
  'task-completed',
  'study-time-recorded',
  'teacher-correction',
  'profile-updated',
]);

export const learningEventSchema = z
  .object({
    eventId: z.string().min(1),
    userId: z.string().min(1),
    type: learningEventTypeSchema,
    occurredAt: isoDateTimeSchema,
    source: z.string().min(1),
    nodeIds: z.array(nodeIdSchema),
    payload: z.record(z.string(), z.unknown()),
    schemaVersion: z.literal('1.0.0'),
    correlationId: z.string().min(1).optional(),
  })
  .strict();

export type LearnerProfile = z.infer<typeof learnerProfileSchema>;
export type KnowledgeState = z.infer<typeof knowledgeStateSchema>;
export type LearningEvent = z.infer<typeof learningEventSchema>;
