import { z } from 'zod';

export const nodeIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const activityTypeSchema = z.enum([
  'learn',
  'worked-example',
  'practice',
  'review',
  'diagnostic',
]);

export const curriculumNodeSchema = z
  .object({
    id: nodeIdSchema,
    version: z.string().min(1),
    subject: z.literal('math'),
    stage: z.literal('senior-high'),
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)).min(1),
    description: z.string().min(1),
    parentId: nodeIdSchema.optional(),
    prerequisiteIds: z.array(nodeIdSchema),
    relatedIds: z.array(nodeIdSchema),
    examWeight: z.number().min(0).max(1),
    defaultStabilityDays: z.number().positive(),
    commonErrorCodes: z.array(z.string().min(1)),
    activityTypes: z.array(activityTypeSchema).min(1),
  })
  .strict();

export const curriculumPackSchema = z
  .object({
    id: z.string().regex(/^gaokao-math-\d{4}\.\d+$/),
    version: z.string().regex(/^\d{4}\.\d+$/),
    title: z.string().min(1),
    subject: z.literal('math'),
    stage: z.literal('senior-high'),
    examSystem: z.literal('gaokao'),
    examYear: z.number().int().min(2026),
    nodes: z.array(curriculumNodeSchema).min(1),
  })
  .strict();

export type ActivityType = z.infer<typeof activityTypeSchema>;
export type CurriculumNode = z.infer<typeof curriculumNodeSchema>;
export type CurriculumPack = z.infer<typeof curriculumPackSchema>;
