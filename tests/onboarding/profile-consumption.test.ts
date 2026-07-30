import { describe, expect, it } from 'vitest';
import { getLearnerSupportSubjectIds } from '@/lib/onboarding/consumption';
import type { LegacyProfileSource } from '@/lib/onboarding/migration';

function source(
  learningOnboarding: LegacyProfileSource['learningOnboarding'],
): LegacyProfileSource {
  return {
    learningOnboarding,
    educationLevel: null,
    grade: null,
    favoriteSubjects: null,
  };
}

describe('profile consumption boundaries', () => {
  it('returns only supported learner subject IDs for cold-start recommendations', () => {
    expect(
      getLearnerSupportSubjectIds(
        source({
          version: 2,
          status: 'completed',
          identities: ['learner'],
          primaryIdentity: 'learner',
          profiles: {
            learner: {
              identity: 'learner',
              context: {
                stage: 'high',
                learningDomains: [],
                supportDomains: [
                  { source: 'catalog', id: 'physics', name: '物理' },
                  { source: 'catalog', id: 'general-technology', name: '通用技术' },
                ],
              },
              goals: [{ source: 'catalog', id: 'exam-prep', label: '准备考试' }],
              roleNeeds: [],
              preferences: { explanationStyle: 'balanced' },
              completedAt: 10,
            },
          },
          completedAt: 10,
        }),
      ),
    ).toEqual(['physics']);
  });

  it.each(['educator', 'guardian', 'education-manager'] as const)(
    'does not turn %s needs into learner weak subjects',
    (identity) => {
      const profile =
        identity === 'educator'
          ? {
              identity,
              contexts: [{ stage: 'high' as const, teachingDomains: [] }],
              goals: [{ source: 'catalog' as const, id: 'prepare-lessons', label: '备课' }],
              roleNeeds: ['question-design' as const],
              preferences: { primarySupport: 'balanced' as const },
              completedAt: 10,
            }
          : identity === 'guardian'
            ? {
                identity,
                contexts: [{ stage: 'primary' as const, supportDomains: [] }],
                goals: [{ source: 'catalog' as const, id: 'homework-support', label: '作业辅导' }],
                roleNeeds: ['hint-strategy' as const],
                preferences: { guidanceStyle: 'balanced' as const },
                completedAt: 10,
              }
            : {
                identity,
                contexts: [{ stage: 'high' as const, managedDomains: [] }],
                goals: [
                  { source: 'catalog' as const, id: 'curriculum-planning', label: '课程规划' },
                ],
                roleNeeds: ['standards-alignment' as const],
                preferences: { managementFocus: 'balanced' as const },
                completedAt: 10,
              };

      expect(
        getLearnerSupportSubjectIds(
          source({
            version: 2,
            status: 'completed',
            identities: [identity],
            primaryIdentity: identity,
            profiles: { [identity]: profile },
            completedAt: 10,
          }),
        ),
      ).toBeUndefined();
    },
  );
});
