import { describe, expect, it } from 'vitest';
import {
  completeLearningOnboardingSchema,
  getLearningOnboardingStatus,
} from '@/lib/onboarding/types';

const valid = {
  educationLevel: 'middle',
  grade: '初二',
  favoriteSubjects: ['math', 'physics'],
  weakSubjects: ['math'],
  learningGoal: 'build-foundations',
  goalDetail: '先补齐代数基础',
  teachingPreference: 'step-by-step',
};

describe('learning onboarding contract', () => {
  it('accepts a complete middle-school profile', () => {
    expect(completeLearningOnboardingSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a grade outside the selected stage', () => {
    expect(() => completeLearningOnboardingSchema.parse({ ...valid, grade: '高一' })).toThrow(
      '年级与学习阶段不匹配',
    );
  });

  it('rejects unsupported subjects and long details', () => {
    expect(() =>
      completeLearningOnboardingSchema.parse({
        ...valid,
        weakSubjects: ['computer'],
        goalDetail: 'x'.repeat(121),
      }),
    ).toThrow();
  });

  it('maps null and terminal records to public status', () => {
    expect(getLearningOnboardingStatus(null)).toBe('pending');
    expect(getLearningOnboardingStatus({ version: 1, status: 'skipped', skippedAt: 1 })).toBe(
      'skipped',
    );
  });
});
