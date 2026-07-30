import { z } from 'zod';

import { nodeIdSchema } from './curriculum';
import { contentFormatPreferenceSchema } from './learner';
import { isoDateTimeSchema } from './resource';

const dateSchema = z.iso.date();

export const profileProjectionKindSchema = z.enum([
  'teaching',
  'assessment',
  'retrieval',
  'planning',
  'dashboard',
]);

export const profileDecisionTraceSchema = z
  .object({
    traceId: z.string().min(1),
    userId: z.string().min(1),
    consumer: z.string().min(1),
    decisionType: z.string().min(1),
    projectionKind: profileProjectionKindSchema,
    projectionId: z.string().min(1),
    snapshotId: z.string().min(1),
    profileVersion: z.number().int().positive(),
    eventWatermark: z.number().int().min(0),
    fieldPaths: z.array(z.string().min(1)).min(1),
    reasonCodes: z.array(z.string().min(1)).min(1),
    createdAt: isoDateTimeSchema,
    schemaVersion: z.literal('1.0.0'),
  })
  .strict();

const projectionCompletenessSchema = z
  .object({
    complete: z.boolean(),
    missingFields: z.array(z.string().min(1)),
  })
  .strict();

const snapshotFocusAreaSchema = z
  .object({
    domainProfileId: z.string().min(1),
    nodeId: nodeIdSchema,
    mastery: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    reasonCodes: z.array(z.string().min(1)).min(1),
  })
  .strict();

const teachingKnowledgeSignalSchema = z
  .object({
    nodeId: nodeIdSchema,
    mastery: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    reasonCodes: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const teachingProfileProjectionSchema = z
  .object({
    projectionId: z.string().min(1),
    kind: z.literal('teaching'),
    userId: z.string().min(1),
    snapshotId: z.string().min(1),
    profileVersion: z.number().int().positive(),
    eventWatermark: z.number().int().min(0),
    schemaVersion: z.literal('1.0.0'),
    generatedAt: isoDateTimeSchema,
    data: z
      .object({
        preferredLanguage: z.string().min(2).max(20),
        contentFormatPreferences: z.array(contentFormatPreferenceSchema).min(1),
        explanationDepth: z.enum(['concise', 'standard', 'detailed', 'comprehensive']),
        learningPace: z.enum(['slow', 'standard', 'fast']),
        stepByStepMode: z.enum(['always', 'when-needed', 'hints-first']),
        interactionTone: z.enum(['friendly', 'professional', 'encouraging', 'strict', 'humorous']),
        assistantName: z.string().min(1).max(20),
        activeDomain: z
          .object({
            domainProfileId: z.string().min(1),
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
          })
          .strict(),
        knowledgeStatus: z.enum(['ready', 'no-evidence']),
        strengths: z.array(teachingKnowledgeSignalSchema),
        growthAreas: z.array(teachingKnowledgeSignalSchema),
      })
      .strict(),
  })
  .strict();

const assessmentKnowledgeSignalSchema = z
  .object({
    nodeId: nodeIdSchema,
    mastery: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    retention: z.number().min(0).max(1),
    evidenceCount: z.number().int().min(0),
    repeatedErrorCount: z.number().int().min(0),
    lastEvidenceAt: isoDateTimeSchema.optional(),
    reasonCodes: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const assessmentProfileProjectionSchema = z
  .object({
    projectionId: z.string().min(1),
    kind: z.literal('assessment'),
    userId: z.string().min(1),
    snapshotId: z.string().min(1),
    profileVersion: z.number().int().positive(),
    eventWatermark: z.number().int().min(0),
    schemaVersion: z.literal('1.0.0'),
    generatedAt: isoDateTimeSchema,
    data: z
      .object({
        preferredLanguage: z.string().min(2).max(20),
        explanationDepth: z.enum(['concise', 'standard', 'detailed', 'comprehensive']),
        stepByStepMode: z.enum(['always', 'when-needed', 'hints-first']),
        interactionTone: z.enum(['friendly', 'professional', 'encouraging', 'strict', 'humorous']),
        activeDomain: z
          .object({
            domainProfileId: z.string().min(1),
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
          })
          .strict(),
        knowledgeStatus: z.enum(['ready', 'no-evidence']),
        targetKnowledge: z.array(assessmentKnowledgeSignalSchema),
      })
      .strict(),
  })
  .strict();

export const retrievalProfileProjectionSchema = z
  .object({
    projectionId: z.string().min(1),
    kind: z.literal('retrieval'),
    userId: z.string().min(1),
    snapshotId: z.string().min(1),
    profileVersion: z.number().int().positive(),
    eventWatermark: z.number().int().min(0),
    schemaVersion: z.literal('1.0.0'),
    generatedAt: isoDateTimeSchema,
    data: z
      .object({
        preferredLanguage: z.string().min(2).max(20),
        activeDomain: z
          .object({
            domainProfileId: z.string().min(1),
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
          })
          .strict(),
        focusNodeIds: z.array(nodeIdSchema).min(1),
        allowedSourceScopes: z
          .array(
            z
              .object({
                kbType: z.string().min(1),
                scope: z.enum(['public-curriculum', 'private-user']),
                verifiedOnly: z.boolean(),
              })
              .strict(),
          )
          .min(1),
        privateKnowledgeRetrieval: z.boolean(),
      })
      .strict()
      .superRefine((data, ctx) => {
        if (
          !data.privateKnowledgeRetrieval &&
          data.allowedSourceScopes.some((source) => source.scope === 'private-user')
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['allowedSourceScopes'],
            message: 'private-user sources require privateKnowledgeRetrieval consent',
          });
        }
      }),
  })
  .strict();

const planningKnowledgeSignalSchema = z
  .object({
    nodeId: nodeIdSchema,
    mastery: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    retention: z.number().min(0).max(1),
    reviewStabilityDays: z.number().positive(),
    evidenceCount: z.number().int().min(0),
    lastEvidenceAt: isoDateTimeSchema.optional(),
    reasonCodes: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const planningProfileProjectionSchema = z
  .object({
    projectionId: z.string().min(1),
    kind: z.literal('planning'),
    userId: z.string().min(1),
    snapshotId: z.string().min(1),
    profileVersion: z.number().int().positive(),
    eventWatermark: z.number().int().min(0),
    schemaVersion: z.literal('1.0.0'),
    generatedAt: isoDateTimeSchema,
    data: z
      .object({
        planningMode: z.enum(['exam', 'mastery']),
        activeDomain: z
          .object({
            domainProfileId: z.string().min(1),
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
          })
          .strict(),
        availability: z
          .object({
            weeklyAvailableMinutes: z.number().int().positive(),
            dailyAvailability: z.record(z.string(), z.number().int().min(0)),
            preferredSessionMinutes: z.number().int().min(10).max(120),
            restDays: z.array(z.string().min(1)),
            maxDailyMinutes: z.number().int().positive(),
          })
          .strict(),
        teacherLockedNodeIds: z.array(nodeIdSchema),
        knowledgeStatus: z.enum(['ready', 'no-evidence']),
        targetKnowledge: z.array(planningKnowledgeSignalSchema),
        engagementSummary: z
          .object({
            studyMinutes7d: z.number().int().min(0),
            activeDays7d: z.number().int().min(0),
          })
          .strict(),
        contentFormatPreferences: z.array(contentFormatPreferenceSchema).min(1),
      })
      .strict()
      .superRefine((data, ctx) => {
        const domain = data.activeDomain;

        if (data.planningMode === 'exam') {
          for (const field of ['examSystem', 'examDate', 'targetScore', 'scoreScaleMax'] as const) {
            if (domain[field] === undefined) {
              ctx.addIssue({
                code: 'custom',
                path: ['activeDomain', field],
                message: `${field} is required for exam planning`,
              });
            }
          }
        }

        if (data.planningMode === 'mastery') {
          if (!domain.targetNodeIds?.length) {
            ctx.addIssue({
              code: 'custom',
              path: ['activeDomain', 'targetNodeIds'],
              message: 'targetNodeIds are required for mastery planning',
            });
          }
          if (domain.horizonDays === undefined) {
            ctx.addIssue({
              code: 'custom',
              path: ['activeDomain', 'horizonDays'],
              message: 'horizonDays is required for mastery planning',
            });
          }
        }

        if (
          domain.targetScore !== undefined &&
          domain.scoreScaleMax !== undefined &&
          domain.targetScore > domain.scoreScaleMax
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['activeDomain', 'targetScore'],
            message: 'targetScore must not exceed scoreScaleMax',
          });
        }
      }),
  })
  .strict();

const dashboardKnowledgeSignalSchema = z
  .object({
    nodeId: nodeIdSchema,
    mastery: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    reasonCodes: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const dashboardProfileProjectionSchema = z
  .object({
    projectionId: z.string().min(1),
    kind: z.literal('dashboard'),
    userId: z.string().min(1),
    snapshotId: z.string().min(1),
    profileVersion: z.number().int().positive(),
    eventWatermark: z.number().int().min(0),
    schemaVersion: z.literal('1.0.0'),
    generatedAt: isoDateTimeSchema,
    data: z
      .object({
        status: z.enum(['ready', 'no-evidence']),
        engagement: z
          .object({
            todayStudyMinutes: z.number().int().min(0),
            studyMinutes7d: z.number().int().min(0),
            activeDays7d: z.number().int().min(0),
            checkInStreak: z.number().int().min(0),
            checkedInToday: z.boolean(),
          })
          .strict(),
        progress: z
          .object({
            completedTasks: z.number().int().min(0),
            totalTasks: z.number().int().min(0),
            problemsAttempted: z.number().int().min(0),
            problemsCorrect: z.number().int().min(0),
            scenesCompleted: z.number().int().min(0),
            dueReviewCount: z.number().int().min(0),
          })
          .strict(),
        knowledge: z
          .object({
            overallMastery: z.number().min(0).max(1).nullable(),
            strengths: z.array(dashboardKnowledgeSignalSchema),
            growthAreas: z.array(dashboardKnowledgeSignalSchema),
          })
          .strict(),
        trend: z.array(
          z
            .object({
              date: dateSchema,
              studyMinutes: z.number().int().min(0),
              evidenceCount: z.number().int().min(0),
            })
            .strict(),
        ),
        recentActivities: z.array(
          z
            .object({
              type: z.string().min(1),
              occurredAt: isoDateTimeSchema,
              nodeIds: z.array(nodeIdSchema),
            })
            .strict(),
        ),
        profileCompleteness: z
          .object({
            score: z.number().min(0).max(1),
            missingByProjection: z
              .object({
                teaching: z.array(z.string().min(1)),
                assessment: z.array(z.string().min(1)),
                retrieval: z.array(z.string().min(1)),
                planning: z.array(z.string().min(1)),
                dashboard: z.array(z.string().min(1)),
              })
              .strict(),
          })
          .strict(),
      })
      .strict()
      .superRefine((data, ctx) => {
        if (data.status === 'no-evidence' && data.knowledge.overallMastery !== null) {
          ctx.addIssue({
            code: 'custom',
            path: ['knowledge', 'overallMastery'],
            message: 'overallMastery must be null when status is no-evidence',
          });
        }
        if (data.status === 'ready' && data.knowledge.overallMastery === null) {
          ctx.addIssue({
            code: 'custom',
            path: ['knowledge', 'overallMastery'],
            message: 'overallMastery is required when status is ready',
          });
        }
      }),
  })
  .strict();

export const learnerProfileSnapshotSchema = z
  .object({
    snapshotId: z.string().min(1),
    userId: z.string().min(1),
    version: z.number().int().positive(),
    schemaVersion: z.literal('1.0.0'),
    preferencesVersion: z.number().int().positive(),
    domainProfileVersions: z.record(z.string().min(1), z.number().int().positive()),
    eventWatermark: z.number().int().min(0),
    completeness: z
      .object({
        status: z.enum(['complete', 'incomplete']),
        score: z.number().min(0).max(1),
        missingFields: z.array(z.string().min(1)),
        byProjection: z
          .object({
            teaching: projectionCompletenessSchema,
            assessment: projectionCompletenessSchema,
            retrieval: projectionCompletenessSchema,
            planning: projectionCompletenessSchema,
            dashboard: projectionCompletenessSchema,
          })
          .strict(),
      })
      .strict(),
    strengths: z.array(snapshotFocusAreaSchema),
    growthAreas: z.array(snapshotFocusAreaSchema),
    engagementSummary: z
      .object({
        studyMinutes7d: z.number().int().min(0),
        activeDays7d: z.number().int().min(0),
        checkInStreak: z.number().int().min(0),
      })
      .strict(),
    progressSummary: z
      .object({
        completedTasks: z.number().int().min(0),
        totalTasks: z.number().int().min(0),
      })
      .strict(),
    evidenceSummary: z
      .object({
        verifiedEvidenceCount: z.number().int().min(0),
        totalEvidenceCount: z.number().int().min(0),
        lastEvidenceAt: isoDateTimeSchema,
      })
      .strict(),
    generatedAt: isoDateTimeSchema,
    builderVersion: z.string().min(1),
  })
  .strict();

export type ProfileProjectionKind = z.infer<typeof profileProjectionKindSchema>;
export type ProfileDecisionTrace = z.infer<typeof profileDecisionTraceSchema>;
export type LearnerProfileSnapshot = z.infer<typeof learnerProfileSnapshotSchema>;
export type TeachingProfileProjection = z.infer<typeof teachingProfileProjectionSchema>;
export type AssessmentProfileProjection = z.infer<typeof assessmentProfileProjectionSchema>;
export type RetrievalProfileProjection = z.infer<typeof retrievalProfileProjectionSchema>;
export type PlanningProfileProjection = z.infer<typeof planningProfileProjectionSchema>;
export type DashboardProfileProjection = z.infer<typeof dashboardProfileProjectionSchema>;
