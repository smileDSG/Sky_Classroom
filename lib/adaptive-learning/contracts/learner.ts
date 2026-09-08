import { z } from 'zod';

import { nodeIdSchema } from './curriculum';
import { isoDateTimeSchema } from './resource';

const dateSchema = z.iso.date();

export const contentFormatPreferenceSchema = z.enum([
  'text',
  'worked-example',
  'diagram',
  'interactive',
  'audio',
]);

export const learnerPreferencesSchema = z
  .object({
    userId: z.string().min(1),
    preferredLanguage: z.string().min(2).max(20),
    contentFormatPreferences: z
      .array(contentFormatPreferenceSchema)
      .min(1)
      .refine((formats) => new Set(formats).size === formats.length, {
        message: 'contentFormatPreferences must not contain duplicates',
      }),
    explanationDepth: z.enum(['concise', 'standard', 'detailed', 'comprehensive']),
    learningPace: z.enum(['slow', 'standard', 'fast']),
    stepByStepMode: z.enum(['always', 'when-needed', 'hints-first']),
    interactionTone: z.enum(['friendly', 'professional', 'encouraging', 'strict', 'humorous']),
    assistantName: z.string().min(1).max(20),
    preferenceNotes: z.string().max(500),
    privacy: z
      .object({
        conversationMemory: z.enum(['off', 'session', 'persistent']),
        optionalBehaviorSignals: z.boolean(),
        privateKnowledgeRetrieval: z.boolean(),
      })
      .strict(),
    version: z.number().int().positive(),
    schemaVersion: z.literal('1.0.0'),
    updatedAt: isoDateTimeSchema,
    updatedBy: z.enum(['user', 'teacher', 'system', 'migration']),
  })
  .strict();

export const learnerPreferencesInputSchema = learnerPreferencesSchema.omit({
  userId: true,
  version: true,
  schemaVersion: true,
  updatedAt: true,
  updatedBy: true,
});

export const domainLearnerProfileSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    subjectId: z.string().min(1),
    educationStage: z.enum([
      'primary',
      'junior-high',
      'senior-high',
      'vocational',
      'undergraduate',
      'graduate',
      'other',
    ]),
    gradeLevel: z.string().min(1),
    curriculumPackId: z.string().min(1),
    curriculumPackVersion: z.string().min(1),
    examSystem: z.string().min(1).optional(),
    examDate: dateSchema.optional(),
    targetScore: z.number().min(0).optional(),
    scoreScaleMax: z.number().positive().optional(),
    latestVerifiedScore: z.number().min(0).optional(),
    targetNodeIds: z.array(nodeIdSchema).optional(),
    horizonDays: z.number().int().positive().optional(),
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
    status: z.enum(['active', 'archived']),
    version: z.number().int().positive(),
    schemaVersion: z.literal('1.0.0'),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((profile, ctx) => {
    if (
      profile.targetScore !== undefined &&
      profile.scoreScaleMax !== undefined &&
      profile.targetScore > profile.scoreScaleMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetScore'],
        message: 'targetScore must not exceed scoreScaleMax',
      });
    }
  });

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
    displayName: z.string().min(1).optional(),
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
  'segment-replayed',
  'segment-paused',
  'dwell-recorded',
  'question-asked',
  'self-reported',
  'mistake-recorded',
  'review-completed',
  'task-started',
  'task-completed',
  'shadow-decision-recorded',
  'study-time-recorded',
  'teacher-correction',
  'profile-updated',
  'intervention-planned',
  'intervention-selected',
  'question-presented',
  'hint-requested',
  'explanation-viewed',
  'session-completed',
  'session-exited',
]);

export const learningEvidenceQualitySchema = z.enum([
  'verified',
  'teacher-verified',
  'self-reported',
  'inferred',
  'unverified',
]);

const answerSubmittedPayloadSchema = z
  .object({
    correct: z.boolean(),
    knowledgePoints: z.array(z.string()).optional(),
    itemId: z.string().min(1).optional(),
    itemVersion: z.string().min(1).optional(),
    itemDifficulty: z.number().finite().optional(),
    dimensionId: z.string().min(1).optional(),
    contentHash: z.string().min(1).optional(),
    generatorVersion: z.string().min(1).optional(),
  })
  .strict();

export const abilityStateSchema = z
  .object({
    userId: z.string().min(1),
    dimensionId: z.string().min(1),
    theta: z.number().finite(),
    answerCount: z.number().int().min(0),
    lastEvidenceAt: isoDateTimeSchema.optional(),
    version: z.number().int().positive(),
  })
  .strict();

const behaviorPayloadSchemas = {
  'segment-replayed': z
    .object({
      replayCount: z.number().int().positive(),
      knowledgePoints: z.array(z.string().min(1)).optional(),
    })
    .strict(),
  'segment-paused': z
    .object({
      activeDurationSeconds: z.number().min(0),
      knowledgePoints: z.array(z.string().min(1)).optional(),
    })
    .strict(),
  'dwell-recorded': z
    .object({
      activeDurationSeconds: z.number().min(0),
      baselineDurationSeconds: z.number().positive(),
      knowledgePoints: z.array(z.string().min(1)).optional(),
    })
    .strict(),
  'question-asked': z
    .object({
      intent: z.string().min(1).max(80),
      knowledgePoints: z.array(z.string().min(1)).optional(),
    })
    .strict(),
  'self-reported': z
    .object({
      level: z.enum(['confused', 'understood']),
      knowledgePoints: z.array(z.string().min(1)).optional(),
    })
    .strict(),
  'shadow-decision-recorded': z
    .object({
      baselineTargetTool: z.enum(['solve', 'slides', 'quiz', 'memory', 'teaching']).nullable(),
      newTargetTool: z.enum(['solve', 'slides', 'quiz', 'memory', 'teaching']).nullable(),
      baselineHref: z.string().min(1).nullable(),
      newHref: z.string().min(1).nullable(),
      changed: z.boolean(),
      topic: z.string().min(1).nullable(),
      action: z.enum(['diagnostic', 'teach', 'review', 'quiz']).nullable(),
      profileVersion: z.number().int().min(0),
      reasonCodes: z.array(z.string().min(1)),
    })
    .strict(),
  'intervention-planned': z
    .object({
      decisionId: z.string().min(1),
      sessionId: z.string().min(1),
      candidatePlanIds: z.array(z.string().min(1)),
      fallbackUsed: z.boolean(),
    })
    .strict(),
  'intervention-selected': z
    .object({
      decisionId: z.string().min(1),
      planId: z.string().min(1),
      action: z.enum(['teach', 'review', 'quiz', 'diagnostic']),
      topic: z.string().min(1).nullable(),
    })
    .strict(),
  'question-presented': z
    .object({
      decisionId: z.string().min(1),
      questionId: z.string().min(1),
      difficulty: z.enum(['easy', 'medium', 'hard']),
    })
    .strict(),
  'hint-requested': z
    .object({
      decisionId: z.string().min(1),
      questionId: z.string().min(1),
      hintLevel: z.number().int().min(1).max(3),
    })
    .strict(),
  'explanation-viewed': z
    .object({
      decisionId: z.string().min(1),
      durationSeconds: z.number().min(0),
    })
    .strict(),
  'session-completed': z
    .object({
      decisionId: z.string().min(1),
      durationSeconds: z.number().min(0),
      questionCount: z.number().int().min(0),
      correctCount: z.number().int().min(0),
    })
    .strict(),
  'session-exited': z
    .object({
      decisionId: z.string().min(1),
      durationSeconds: z.number().min(0),
      reason: z.string().min(1).max(120),
    })
    .strict(),
} as const;

export const learningEventSchema = z
  .object({
    eventId: z.string().min(1),
    userId: z.string().min(1),
    type: learningEventTypeSchema,
    occurredAt: isoDateTimeSchema,
    source: z.string().min(1),
    nodeIds: z.array(nodeIdSchema).optional().default([]),
    evidenceQuality: learningEvidenceQualitySchema,
    payload: z.record(z.string(), z.unknown()),
    schemaVersion: z.literal('1.0.0'),
    correlationId: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    const payloadSchema =
      event.type === 'answer-submitted'
        ? answerSubmittedPayloadSchema
        : behaviorPayloadSchemas[event.type as keyof typeof behaviorPayloadSchemas];
    if (!payloadSchema) return;

    const payload = payloadSchema.safeParse(event.payload);
    if (payload.success) return;

    for (const issue of payload.error.issues) {
      ctx.addIssue({
        code: 'custom',
        path: ['payload', ...issue.path],
        message: issue.message,
      });
    }
  });

export type LearnerProfile = z.infer<typeof learnerProfileSchema>;
export type LearnerPreferences = z.infer<typeof learnerPreferencesSchema>;
export type LearnerPreferencesInput = z.infer<typeof learnerPreferencesInputSchema>;
export type DomainLearnerProfile = z.infer<typeof domainLearnerProfileSchema>;
export type KnowledgeState = z.infer<typeof knowledgeStateSchema>;
export type AbilityState = z.infer<typeof abilityStateSchema>;
export type LearningEvent = z.infer<typeof learningEventSchema>;
export type LearningEventType = z.infer<typeof learningEventTypeSchema>;
export type LearningEvidenceQuality = z.infer<typeof learningEvidenceQualitySchema>;
export type EvidenceQuality = LearningEvidenceQuality;
export type ContentFormatPreference = z.infer<typeof contentFormatPreferenceSchema>;
