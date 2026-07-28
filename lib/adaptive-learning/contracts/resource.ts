import { z } from 'zod';

import { nodeIdSchema } from './curriculum';

export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const mathResourceStatusSchema = z.enum(['verified', 'needs-review', 'rejected']);

export const mathResourceTypeSchema = z.enum([
  'concept',
  'worked-example',
  'exercise',
  'solution',
  'review',
]);

export const mathResourceLanguageSchema = z.enum(['zh-CN', 'en', 'mixed']);

export const mathResourceSchema = z
  .object({
    id: z.string().regex(/^math_[a-f0-9]{16}$/),
    sourcePath: z.string().min(1),
    canonicalUrl: z.string().url(),
    title: z.string().min(1),
    language: mathResourceLanguageSchema,
    subject: z.literal('math'),
    stage: z.literal('senior-high'),
    examSystem: z.literal('gaokao'),
    nodeIds: z.array(nodeIdSchema),
    resourceType: mathResourceTypeSchema,
    difficulty: z.number().int().min(1).max(5),
    qualityScore: z.number().min(0).max(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    excerpt: z.string().min(1).max(4000),
    status: mathResourceStatusSchema,
    verifiedBy: z.string().min(1).optional(),
    verifiedAt: isoDateTimeSchema.optional(),
    rejectionReasons: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((resource, ctx) => {
    if (resource.status === 'verified') {
      if (!resource.verifiedBy || !resource.verifiedAt) {
        ctx.addIssue({
          code: 'custom',
          message: 'verified resources require verifiedBy and verifiedAt',
        });
      }
      if (resource.nodeIds.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'verified resources require nodeIds' });
      }
      if (resource.rejectionReasons.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'verified resources cannot have rejectionReasons',
        });
      }
    }
    if (resource.status === 'rejected' && resource.rejectionReasons.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'rejected resources require a reason' });
    }
  });

const verifiedManifestEntrySchema = z
  .object({
    sourcePath: z.string().min(1),
    status: z.literal('verified'),
    nodeIds: z.array(nodeIdSchema).min(1),
    resourceType: mathResourceTypeSchema,
    difficulty: z.number().int().min(1).max(5),
    reviewer: z.string().min(1),
    reviewedAt: isoDateTimeSchema,
    notes: z.string().min(1),
  })
  .strict();

const rejectedManifestEntrySchema = z
  .object({
    sourcePath: z.string().min(1),
    status: z.literal('rejected'),
    reasons: z.array(z.string().min(1)).min(1),
    reviewer: z.string().min(1),
    reviewedAt: isoDateTimeSchema,
    notes: z.string().min(1),
  })
  .strict();

export const manualVerificationEntrySchema = z.discriminatedUnion('status', [
  verifiedManifestEntrySchema,
  rejectedManifestEntrySchema,
]);

export const manualVerificationManifestSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    curriculumPackId: z.string().min(1),
    entries: z.array(manualVerificationEntrySchema),
  })
  .strict();

export const resourceIndexSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    indexVersion: z.string().min(1),
    curriculumPackId: z.string().min(1),
    generatedAt: isoDateTimeSchema,
    resources: z.array(mathResourceSchema),
  })
  .strict();

export const governanceReportSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    indexVersion: z.string().min(1),
    scanned: z.number().int().min(0),
    parsed: z.number().int().min(0),
    statusCounts: z
      .object({
        verified: z.number().int().min(0),
        needsReview: z.number().int().min(0),
        rejected: z.number().int().min(0),
      })
      .strict(),
    reasonCounts: z.record(z.string(), z.number().int().min(0)),
    parseFailures: z.array(
      z
        .object({
          sourcePath: z.string(),
          code: z.string(),
          message: z.string(),
        })
        .strict(),
    ),
    resourceGapNodeIds: z.array(nodeIdSchema),
  })
  .strict();

export const mathResourceQuerySchema = z
  .object({
    nodeId: nodeIdSchema.optional(),
    resourceType: mathResourceTypeSchema.optional(),
    maxDifficulty: z.coerce.number().int().min(1).max(5).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type MathResource = z.infer<typeof mathResourceSchema>;
export type MathResourceStatus = z.infer<typeof mathResourceStatusSchema>;
export type MathResourceType = z.infer<typeof mathResourceTypeSchema>;
export type MathResourceLanguage = z.infer<typeof mathResourceLanguageSchema>;
export type ManualVerificationManifest = z.infer<typeof manualVerificationManifestSchema>;
export type ResourceIndex = z.infer<typeof resourceIndexSchema>;
export type GovernanceReport = z.infer<typeof governanceReportSchema>;
export type MathResourceQuery = z.infer<typeof mathResourceQuerySchema>;
