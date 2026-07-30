import { describe, expect, it } from 'vitest';
import {
  getLearnerSelfReport,
  getPrimaryIdentityProfile,
  resolveOnboardingRecommendation,
} from '@/lib/onboarding/selectors';
import type { UniversalOnboardingProfile } from '@/lib/onboarding/types';

const learnerProfile: UniversalOnboardingProfile = {
  version: 2,
  status: 'completed',
  identities: ['learner'],
  primaryIdentity: 'learner',
  profiles: {
    learner: {
      identity: 'learner',
      context: {
        stage: 'high',
        learningDomains: [{ domain: { source: 'catalog', id: 'math', name: '数学' } }],
        supportDomains: [{ source: 'catalog', id: 'physics', name: '物理' }],
      },
      goals: [{ source: 'catalog', id: 'exam-prep', label: '准备考试' }],
      roleNeeds: ['identify-gaps'],
      preferences: { explanationStyle: 'step-by-step' },
      completedAt: 10,
    },
  },
  completedAt: 10,
};

describe('onboarding selectors', () => {
  it('resolves the primary identity profile', () => {
    expect(getPrimaryIdentityProfile(learnerProfile)).toMatchObject({ identity: 'learner' });
    expect(getPrimaryIdentityProfile({ version: 2, status: 'skipped', skippedAt: 1 })).toBeNull();
  });

  it('returns learner self-report without inventing observed mastery', () => {
    expect(getLearnerSelfReport(learnerProfile)).toEqual({
      learningDomains: ['math'],
      supportDomains: ['physics'],
      needs: ['identify-gaps'],
    });
  });

  it('does not expose non-learner needs as learner self-report', () => {
    const educator: UniversalOnboardingProfile = {
      version: 2,
      status: 'completed',
      identities: ['educator'],
      primaryIdentity: 'educator',
      profiles: {
        educator: {
          identity: 'educator',
          contexts: [{ stage: 'high', teachingDomains: [] }],
          goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
          roleNeeds: ['question-design'],
          preferences: { primarySupport: 'lesson-plan-structure' },
          completedAt: 10,
        },
      },
      completedAt: 10,
    };

    expect(getLearnerSelfReport(educator)).toBeNull();
  });

  it('routes learner diagnostics using stage, domain, and goal', () => {
    expect(resolveOnboardingRecommendation(learnerProfile, '/sky')).toEqual({
      primaryHref: '/sky/cloud-mind/quiz?subject=physics&stage=high&goal=exam-prep&mode=diagnostic',
      primaryLabel: '开始学习诊断',
      secondaryHref: '/sky',
    });
  });

  it('routes educator lesson preparation and sanitizes fallback redirects', () => {
    const educator: UniversalOnboardingProfile = {
      version: 2,
      status: 'completed',
      identities: ['educator'],
      primaryIdentity: 'educator',
      profiles: {
        educator: {
          identity: 'educator',
          contexts: [
            {
              stage: 'high',
              teachingDomains: [{ domain: { source: 'catalog', id: 'math', name: '数学' } }],
            },
          ],
          goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
          roleNeeds: [],
          preferences: { primarySupport: 'balanced' },
          completedAt: 10,
        },
      },
      completedAt: 10,
    };

    expect(resolveOnboardingRecommendation(educator, '//evil.example')).toEqual({
      primaryHref: '/sky/teaching?stage=high&domain=math&goal=prepare-lessons',
      primaryLabel: '开始备课',
      secondaryHref: '/sky',
    });
  });
});
