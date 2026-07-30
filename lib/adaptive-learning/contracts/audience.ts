import { z } from 'zod';

export const audienceProfileSchema = z
  .object({
    audienceId: z.string().min(1),
    audienceType: z.enum(['individual', 'cohort', 'public']),
    label: z.string().min(1).max(100),
    preferredLanguage: z.string().min(2).max(20),
    educationStage: z.enum([
      'primary',
      'junior-high',
      'senior-high',
      'vocational',
      'undergraduate',
      'graduate',
      'other',
    ]),
    gradeLevel: z.string().min(1).max(50),
    priorKnowledgeLevel: z.enum(['none', 'beginner', 'intermediate', 'advanced', 'mixed']),
    learningGoals: z.array(z.string().min(1).max(200)).min(1),
    backgroundNotes: z.string().max(2000),
    accessibilityNeeds: z.array(z.string().min(1).max(200)),
    schemaVersion: z.literal('1.0.0'),
  })
  .strict();

export type AudienceProfile = z.infer<typeof audienceProfileSchema>;
