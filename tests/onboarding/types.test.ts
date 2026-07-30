import { describe, expect, it } from 'vitest';
import {
  completeUniversalOnboardingSchema,
  getLearningOnboardingStatus,
  type CompleteUniversalOnboardingInput,
} from '@/lib/onboarding/types';
import { readUniversalOnboarding } from '@/lib/onboarding/migration';

const catalogDomain = (id: string, name: string) => ({
  domain: { source: 'catalog' as const, id, name },
});

const learnerPayload: CompleteUniversalOnboardingInput = {
  version: 2,
  identities: ['learner'],
  primaryIdentity: 'learner',
  profiles: {
    learner: {
      identity: 'learner',
      context: {
        stage: 'middle',
        learningDomains: [catalogDomain('math', '数学')],
        supportDomains: [{ source: 'catalog', id: 'math', name: '数学' }],
      },
      goals: [{ source: 'catalog', id: 'build-foundations', label: '巩固基础' }],
      roleNeeds: ['identify-gaps'],
      preferences: { explanationStyle: 'step-by-step' },
      detail: '先补齐代数基础',
    },
  },
};

const educatorPayload: CompleteUniversalOnboardingInput = {
  version: 2,
  identities: ['educator'],
  primaryIdentity: 'educator',
  profiles: {
    educator: {
      identity: 'educator',
      contexts: [
        { stage: 'middle', teachingDomains: [catalogDomain('math', '数学')] },
        { stage: 'undergraduate', teachingDomains: [catalogDomain('programming', '编程')] },
      ],
      goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
      roleNeeds: ['question-design'],
      preferences: { primarySupport: 'lesson-plan-structure' },
    },
  },
};

describe('universal onboarding contract', () => {
  it('accepts valid learner and educator profiles', () => {
    expect(completeUniversalOnboardingSchema.parse(learnerPayload)).toEqual(learnerPayload);
    expect(completeUniversalOnboardingSchema.parse(educatorPayload)).toEqual(educatorPayload);
  });

  it('accepts valid guardian, education manager, and other profiles', () => {
    const profiles: CompleteUniversalOnboardingInput[] = [
      {
        version: 2,
        identities: ['guardian'],
        primaryIdentity: 'guardian',
        profiles: {
          guardian: {
            identity: 'guardian',
            contexts: [{ stage: 'primary', supportDomains: [catalogDomain('chinese', '语文')] }],
            goals: [{ source: 'catalog', id: 'homework-support', label: '作业辅导' }],
            roleNeeds: ['hint-strategy'],
            preferences: { guidanceStyle: 'hint-first' },
          },
        },
      },
      {
        version: 2,
        identities: ['education-manager'],
        primaryIdentity: 'education-manager',
        profiles: {
          'education-manager': {
            identity: 'education-manager',
            contexts: [{ stage: 'high', managedDomains: [catalogDomain('physics', '物理')] }],
            goals: [{ source: 'catalog', id: 'curriculum-planning', label: '课程规划' }],
            roleNeeds: ['standards-alignment'],
            preferences: { managementFocus: 'overview-analysis' },
          },
        },
      },
      {
        version: 2,
        identities: ['other'],
        primaryIdentity: 'other',
        profiles: {
          other: {
            identity: 'other',
            context: {
              stage: 'professional',
              domains: [{ domain: { source: 'custom', name: '产品管理' } }],
            },
            goals: [{ source: 'catalog', id: 'career-skills', label: '发展职业能力' }],
            roleNeeds: ['time-planning'],
            preferences: { collaborationStyle: 'structured-content' },
          },
        },
      },
    ];

    for (const profile of profiles) {
      expect(completeUniversalOnboardingSchema.parse(profile)).toEqual(profile);
    }
  });

  it('requires the primary identity and matching profile discriminator', () => {
    expect(() =>
      completeUniversalOnboardingSchema.parse({
        ...learnerPayload,
        identities: ['educator'],
      }),
    ).toThrow();
    expect(() =>
      completeUniversalOnboardingSchema.parse({
        ...learnerPayload,
        profiles: {
          learner: { ...learnerPayload.profiles.learner, identity: 'educator' },
        },
      }),
    ).toThrow();
  });

  it('allows incomplete secondary identities but rejects unselected profiles', () => {
    expect(
      completeUniversalOnboardingSchema.parse({
        ...learnerPayload,
        identities: ['learner', 'educator'],
      }),
    ).toBeTruthy();
    expect(() =>
      completeUniversalOnboardingSchema.parse({
        ...learnerPayload,
        profiles: {
          ...learnerPayload.profiles,
          educator: educatorPayload.profiles.educator,
        },
      }),
    ).toThrow();
  });

  it('validates catalog domains by stage and custom domains by stage type', () => {
    expect(() =>
      completeUniversalOnboardingSchema.parse({
        ...learnerPayload,
        profiles: {
          learner: {
            ...learnerPayload.profiles.learner!,
            context: {
              ...learnerPayload.profiles.learner!.context,
              learningDomains: [catalogDomain('general-technology', '通用技术')],
            },
          },
        },
      }),
    ).toThrow();
    expect(() =>
      completeUniversalOnboardingSchema.parse({
        ...learnerPayload,
        profiles: {
          learner: {
            ...learnerPayload.profiles.learner!,
            context: {
              ...learnerPayload.profiles.learner!.context,
              learningDomains: [{ domain: { source: 'custom', name: '自定义学科' } }],
            },
          },
        },
      }),
    ).toThrow();

    const undergraduate = structuredClone(learnerPayload);
    undergraduate.profiles.learner!.context = {
      stage: 'undergraduate',
      learningDomains: [{ domain: { source: 'custom', name: '量子信息' } }],
      supportDomains: [],
    };
    expect(completeUniversalOnboardingSchema.parse(undergraduate)).toEqual(undergraduate);
  });

  it('rejects duplicate stages, too many selections, and foreign preferences', () => {
    expect(() =>
      completeUniversalOnboardingSchema.parse({
        ...educatorPayload,
        profiles: {
          educator: {
            ...educatorPayload.profiles.educator,
            contexts: [
              educatorPayload.profiles.educator!.contexts[0],
              educatorPayload.profiles.educator!.contexts[0],
            ],
          },
        },
      }),
    ).toThrow();
    expect(() =>
      completeUniversalOnboardingSchema.parse({
        ...learnerPayload,
        profiles: {
          learner: {
            ...learnerPayload.profiles.learner,
            roleNeeds: ['identify-gaps', 'learning-plan', 'motivation', 'practice-feedback'],
          },
        },
      }),
    ).toThrow();
    expect(() =>
      completeUniversalOnboardingSchema.parse({
        ...learnerPayload,
        profiles: {
          learner: {
            ...learnerPayload.profiles.learner,
            preferences: { primarySupport: 'lesson-plan-structure' },
          },
        },
      }),
    ).toThrow();
  });

  it('normalizes custom labels and enforces text limits', () => {
    const payload = structuredClone(learnerPayload);
    payload.profiles.learner!.context = {
      stage: 'undergraduate',
      learningDomains: [{ domain: { source: 'custom', name: '  量子信息  ' } }],
      supportDomains: [],
    };
    expect(
      completeUniversalOnboardingSchema.parse(payload).profiles.learner?.context.learningDomains[0]
        .domain.name,
    ).toBe('量子信息');
    payload.profiles.learner!.detail = 'x'.repeat(121);
    expect(() => completeUniversalOnboardingSchema.parse(payload)).toThrow();
  });
});

describe('legacy onboarding compatibility', () => {
  it('converts a completed v1 record into a read-only learner view', () => {
    const result = readUniversalOnboarding({
      learningOnboarding: {
        version: 1,
        status: 'completed',
        weakSubjects: ['math'],
        learningGoal: 'build-foundations',
        goalDetail: '补齐代数基础',
        teachingPreference: 'step-by-step',
        completedAt: 100,
      },
      educationLevel: 'middle',
      grade: '初二',
      favoriteSubjects: [{ id: 'physics', name: '物理', enabled: true }],
    });

    expect(result).toMatchObject({
      version: 2,
      status: 'completed',
      identities: ['learner'],
      primaryIdentity: 'learner',
      migratedFromVersion: 1,
      completedAt: 100,
      profiles: {
        learner: {
          identity: 'learner',
          context: {
            stage: 'middle',
            legacyGrade: '初二',
            learningDomains: [{ domain: { source: 'catalog', id: 'physics', name: '物理' } }],
            supportDomains: [{ source: 'catalog', id: 'math', name: '数学' }],
          },
          goals: [{ source: 'catalog', id: 'build-foundations' }],
          preferences: { explanationStyle: 'step-by-step' },
          detail: '补齐代数基础',
          completedAt: 100,
        },
      },
    });
  });

  it('keeps skipped v1 users terminal without fabricating identities', () => {
    expect(
      readUniversalOnboarding({
        learningOnboarding: { version: 1, status: 'skipped', skippedAt: 1 },
        educationLevel: null,
        grade: null,
        favoriteSubjects: null,
      }),
    ).toEqual({ version: 2, status: 'skipped', skippedAt: 1 });
    expect(getLearningOnboardingStatus({ version: 1, status: 'skipped', skippedAt: 1 })).toBe(
      'skipped',
    );
  });
});
