import { z } from 'zod';
import type { Subject } from '@/lib/solve/agents/analyze-types';

export const CURRENT_ONBOARDING_VERSION = 1 as const;

export const ONBOARDING_SUBJECT_IDS = [
  'math',
  'physics',
  'chemistry',
  'biology',
  'chinese',
  'english',
  'history',
  'geography',
  'politics',
] as const satisfies readonly Subject[];

export const LEARNING_GOALS = [
  'improve-grades',
  'exam-prep',
  'build-foundations',
  'explore-interest',
] as const;

export const TEACHING_PREFERENCES = [
  'example-first',
  'visual-explanation',
  'step-by-step',
  'practice-first',
  'balanced',
] as const;

const subjectSchema = z.enum(ONBOARDING_SUBJECT_IDS);

export const completeLearningOnboardingSchema = z
  .object({
    educationLevel: z.enum(['middle', 'high']),
    grade: z.enum(['初一', '初二', '初三', '高一', '高二', '高三']),
    favoriteSubjects: z.array(subjectSchema).max(9),
    weakSubjects: z.array(subjectSchema).max(9),
    learningGoal: z.enum(LEARNING_GOALS),
    goalDetail: z.string().trim().max(120).optional(),
    teachingPreference: z.enum(TEACHING_PREFERENCES),
  })
  .superRefine((value, ctx) => {
    const grades: readonly string[] =
      value.educationLevel === 'middle' ? ['初一', '初二', '初三'] : ['高一', '高二', '高三'];
    if (!grades.includes(value.grade)) {
      ctx.addIssue({
        code: 'custom',
        path: ['grade'],
        message: '年级与学习阶段不匹配',
      });
    }
  });

export type CompleteLearningOnboardingInput = z.infer<typeof completeLearningOnboardingSchema>;
export type TeachingPreference = CompleteLearningOnboardingInput['teachingPreference'];

export type LearningOnboardingProfile =
  | ({
      version: typeof CURRENT_ONBOARDING_VERSION;
      status: 'completed';
      completedAt: number;
    } & Pick<
      CompleteLearningOnboardingInput,
      'weakSubjects' | 'learningGoal' | 'goalDetail' | 'teachingPreference'
    >)
  | {
      version: typeof CURRENT_ONBOARDING_VERSION;
      status: 'skipped';
      skippedAt: number;
    };

export type LearningOnboardingStatus = 'pending' | 'completed' | 'skipped';

export function getLearningOnboardingStatus(
  profile: LearningOnboardingProfile | null | undefined,
): LearningOnboardingStatus {
  if (!profile || profile.version !== CURRENT_ONBOARDING_VERSION) return 'pending';
  return profile.status;
}
