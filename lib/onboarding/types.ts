import { z } from 'zod';
import type { Subject } from '@/lib/solve/agents/analyze-types';
import {
  EDUCATION_MANAGER_NEEDS,
  EDUCATION_MANAGER_PREFERENCES,
  EDUCATOR_NEEDS,
  EDUCATOR_PREFERENCES,
  GUARDIAN_NEEDS,
  GUARDIAN_PREFERENCES,
  IDENTITY_CONFIG,
  LEARNER_NEEDS,
  LEARNER_PREFERENCES,
  LEARNER_FOUNDATIONS,
  LEARNER_WEEKLY_TIME,
  OTHER_NEEDS,
  OTHER_PREFERENCES,
  PRODUCT_IDENTITIES,
  PROFILE_STAGES,
  getDomainsForStage,
  isOpenDomainStage,
  type CatalogOption,
  type ProductIdentity,
  type ProfileStage,
} from '@/lib/onboarding/catalog';

export const CURRENT_ONBOARDING_VERSION = 2 as const;
export const LEGACY_ONBOARDING_VERSION = 1 as const;

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

const legacySubjectSchema = z.enum(ONBOARDING_SUBJECT_IDS);

export const completeLearningOnboardingSchema = z
  .object({
    educationLevel: z.enum(['middle', 'high']),
    grade: z.enum(['初一', '初二', '初三', '高一', '高二', '高三']),
    favoriteSubjects: z.array(legacySubjectSchema).max(9),
    weakSubjects: z.array(legacySubjectSchema).max(9),
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

export type LegacyLearningOnboardingProfile =
  | ({
      version: typeof LEGACY_ONBOARDING_VERSION;
      status: 'completed';
      completedAt: number;
    } & Pick<
      CompleteLearningOnboardingInput,
      'weakSubjects' | 'learningGoal' | 'goalDetail' | 'teachingPreference'
    >)
  | {
      version: typeof LEGACY_ONBOARDING_VERSION;
      status: 'skipped';
      skippedAt: number;
    };

type LearnerNeed = (typeof LEARNER_NEEDS)[number]['id'];
type EducatorNeed = (typeof EDUCATOR_NEEDS)[number]['id'];
type GuardianNeed = (typeof GUARDIAN_NEEDS)[number]['id'];
type EducationManagerNeed = (typeof EDUCATION_MANAGER_NEEDS)[number]['id'];
type OtherNeed = (typeof OTHER_NEEDS)[number]['id'];
type LearnerPreference = (typeof LEARNER_PREFERENCES)[number]['id'];
type EducatorPreference = (typeof EDUCATOR_PREFERENCES)[number]['id'];
type GuardianPreference = (typeof GUARDIAN_PREFERENCES)[number]['id'];
type EducationManagerPreference = (typeof EDUCATION_MANAGER_PREFERENCES)[number]['id'];
type OtherPreference = (typeof OTHER_PREFERENCES)[number]['id'];

function optionEnum<T extends string>(options: readonly CatalogOption<T>[]) {
  return z.enum(options.map((item) => item.id) as [T, ...T[]]);
}

const catalogDomainRefSchema = z
  .object({
    source: z.literal('catalog'),
    id: z.string().min(1).max(80),
    name: z.string().trim().min(1).max(40),
  })
  .strict();
const customDomainRefSchema = z
  .object({
    source: z.literal('custom'),
    name: z.string().trim().min(1).max(40),
  })
  .strict();
export const domainRefSchema = z.discriminatedUnion('source', [
  catalogDomainRefSchema,
  customDomainRefSchema,
]);

export const profileGoalSchema = z.discriminatedUnion('source', [
  z
    .object({
      source: z.literal('catalog'),
      id: z.string().min(1).max(80),
      label: z.string().trim().min(1).max(40),
    })
    .strict(),
  z
    .object({
      source: z.literal('custom'),
      label: z.string().trim().min(1).max(40),
    })
    .strict(),
]);

const domainSelectionSchema = z
  .object({
    domain: domainRefSchema,
    challenges: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
  })
  .strict();
const stageSchema = z.enum(PROFILE_STAGES);
const profileBase = {
  goals: z.array(profileGoalSchema).min(1).max(3),
  detail: z.string().trim().max(120).optional(),
};

const learnerProfileInputSchema = z
  .object({
    identity: z.literal('learner'),
    context: z
      .object({
        stage: stageSchema,
        learningDomains: z.array(domainSelectionSchema).max(12),
        supportDomains: z.array(domainRefSchema).max(12),
        legacyGrade: z.string().trim().min(1).max(40).optional(),
      })
      .strict(),
    ...profileBase,
    roleNeeds: z.array(optionEnum(LEARNER_NEEDS)).max(3),
    preferences: z.object({ explanationStyle: optionEnum(LEARNER_PREFERENCES) }).strict(),
    baseline: z
      .object({
        foundation: optionEnum(LEARNER_FOUNDATIONS),
        weeklyTime: optionEnum(LEARNER_WEEKLY_TIME),
      })
      .strict()
      .optional(),
  })
  .strict();

const educatorProfileInputSchema = z
  .object({
    identity: z.literal('educator'),
    contexts: z
      .array(
        z
          .object({
            stage: stageSchema,
            teachingDomains: z.array(domainSelectionSchema).max(12),
          })
          .strict(),
      )
      .min(1)
      .max(5),
    ...profileBase,
    roleNeeds: z.array(optionEnum(EDUCATOR_NEEDS)).max(3),
    preferences: z.object({ primarySupport: optionEnum(EDUCATOR_PREFERENCES) }).strict(),
  })
  .strict();

const guardianProfileInputSchema = z
  .object({
    identity: z.literal('guardian'),
    contexts: z
      .array(
        z
          .object({
            stage: stageSchema,
            supportDomains: z.array(domainSelectionSchema).max(12),
          })
          .strict(),
      )
      .min(1)
      .max(5),
    ...profileBase,
    roleNeeds: z.array(optionEnum(GUARDIAN_NEEDS)).max(3),
    preferences: z.object({ guidanceStyle: optionEnum(GUARDIAN_PREFERENCES) }).strict(),
  })
  .strict();

const educationManagerProfileInputSchema = z
  .object({
    identity: z.literal('education-manager'),
    contexts: z
      .array(
        z
          .object({
            stage: stageSchema,
            managedDomains: z.array(domainSelectionSchema).max(12),
          })
          .strict(),
      )
      .min(1)
      .max(5),
    ...profileBase,
    roleNeeds: z.array(optionEnum(EDUCATION_MANAGER_NEEDS)).max(3),
    preferences: z.object({ managementFocus: optionEnum(EDUCATION_MANAGER_PREFERENCES) }).strict(),
  })
  .strict();

const otherProfileInputSchema = z
  .object({
    identity: z.literal('other'),
    context: z
      .object({
        stage: stageSchema,
        domains: z.array(domainSelectionSchema).max(12),
      })
      .strict(),
    ...profileBase,
    roleNeeds: z.array(optionEnum(OTHER_NEEDS)).max(3),
    preferences: z.object({ collaborationStyle: optionEnum(OTHER_PREFERENCES) }).strict(),
  })
  .strict();

export const identityProfileInputSchema = z.discriminatedUnion('identity', [
  learnerProfileInputSchema,
  educatorProfileInputSchema,
  guardianProfileInputSchema,
  educationManagerProfileInputSchema,
  otherProfileInputSchema,
]);

const profileMapSchema = z
  .object({
    learner: learnerProfileInputSchema.optional(),
    educator: educatorProfileInputSchema.optional(),
    guardian: guardianProfileInputSchema.optional(),
    'education-manager': educationManagerProfileInputSchema.optional(),
    other: otherProfileInputSchema.optional(),
  })
  .strict();

type DomainRef = z.infer<typeof domainRefSchema>;
type DomainSelection = z.infer<typeof domainSelectionSchema>;
type IdentityProfileInput = z.infer<typeof identityProfileInputSchema>;

function profileContexts(profile: IdentityProfileInput): Array<{
  stage: ProfileStage;
  domains: DomainSelection[];
  supportDomains?: DomainRef[];
}> {
  switch (profile.identity) {
    case 'learner':
      return [
        {
          stage: profile.context.stage,
          domains: profile.context.learningDomains,
          supportDomains: profile.context.supportDomains,
        },
      ];
    case 'educator':
      return profile.contexts.map((context) => ({
        stage: context.stage,
        domains: context.teachingDomains,
      }));
    case 'guardian':
      return profile.contexts.map((context) => ({
        stage: context.stage,
        domains: context.supportDomains,
      }));
    case 'education-manager':
      return profile.contexts.map((context) => ({
        stage: context.stage,
        domains: context.managedDomains,
      }));
    case 'other':
      return [{ stage: profile.context.stage, domains: profile.context.domains }];
  }
}

function validateDomainRef(
  ref: DomainRef,
  stage: ProfileStage,
  ctx: z.RefinementCtx,
  path: PropertyKey[],
) {
  if (ref.source === 'custom') {
    if (!isOpenDomainStage(stage)) {
      ctx.addIssue({ code: 'custom', path, message: '该学习阶段不支持自定义领域' });
    }
    return;
  }

  const configured = getDomainsForStage(stage).find((domain) => domain.id === ref.id);
  if (!configured || configured.label !== ref.name) {
    ctx.addIssue({ code: 'custom', path, message: '领域与学习阶段不匹配' });
  }
}

function validateProfile(profile: IdentityProfileInput, ctx: z.RefinementCtx, root: PropertyKey[]) {
  const contexts = profileContexts(profile);
  const seenStages = new Set<ProfileStage>();
  for (const [contextIndex, context] of contexts.entries()) {
    if (seenStages.has(context.stage)) {
      ctx.addIssue({
        code: 'custom',
        path: [...root, 'contexts', contextIndex, 'stage'],
        message: '同一身份不能重复添加相同学习阶段',
      });
    }
    seenStages.add(context.stage);

    const domainGroups = [
      context.domains.map((selection) => selection.domain),
      context.supportDomains ?? [],
    ];
    for (const [groupIndex, refs] of domainGroups.entries()) {
      const seenDomains = new Set<string>();
      for (const [domainIndex, ref] of refs.entries()) {
        validateDomainRef(ref, context.stage, ctx, [
          ...root,
          'contexts',
          contextIndex,
          groupIndex,
          domainIndex,
        ]);
        const key = `${ref.source}:${ref.source === 'catalog' ? ref.id : ref.name.toLocaleLowerCase()}`;
        if (seenDomains.has(key)) {
          ctx.addIssue({
            code: 'custom',
            path: [...root, 'contexts', contextIndex, groupIndex, domainIndex],
            message: '同一学习阶段不能重复选择领域',
          });
        }
        seenDomains.add(key);
      }
    }
  }

  const goals = IDENTITY_CONFIG[profile.identity].goals as readonly CatalogOption[];
  for (const [goalIndex, goal] of profile.goals.entries()) {
    if (goal.source === 'custom') continue;
    const configured = goals.find((item) => item.id === goal.id);
    if (!configured || configured.label !== goal.label) {
      ctx.addIssue({
        code: 'custom',
        path: [...root, 'goals', goalIndex],
        message: '目标与当前身份不匹配',
      });
    }
  }
}

export const completeUniversalOnboardingSchema = z
  .object({
    version: z.literal(CURRENT_ONBOARDING_VERSION),
    identities: z.array(z.enum(PRODUCT_IDENTITIES)).min(1).max(5),
    primaryIdentity: z.enum(PRODUCT_IDENTITIES),
    profiles: profileMapSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const identities = new Set(value.identities);
    if (identities.size !== value.identities.length) {
      ctx.addIssue({ code: 'custom', path: ['identities'], message: '身份不能重复' });
    }
    if (!identities.has(value.primaryIdentity)) {
      ctx.addIssue({ code: 'custom', path: ['primaryIdentity'], message: '主身份必须已选择' });
    }
    if (!value.profiles[value.primaryIdentity]) {
      ctx.addIssue({
        code: 'custom',
        path: ['profiles', value.primaryIdentity],
        message: '主身份画像未完成',
      });
    }

    for (const identity of PRODUCT_IDENTITIES) {
      const profile = value.profiles[identity];
      if (!profile) continue;
      if (!identities.has(identity)) {
        ctx.addIssue({
          code: 'custom',
          path: ['profiles', identity],
          message: '未选择的身份不能包含画像',
        });
      }
      validateProfile(profile, ctx, ['profiles', identity]);
    }
  });

export type CompleteUniversalOnboardingInput = z.infer<typeof completeUniversalOnboardingSchema>;
export type UniversalIdentityProfileInput = z.infer<typeof identityProfileInputSchema>;
export type LearnerProfileInput = z.infer<typeof learnerProfileInputSchema>;
export type EducatorProfileInput = z.infer<typeof educatorProfileInputSchema>;
export type GuardianProfileInput = z.infer<typeof guardianProfileInputSchema>;
export type EducationManagerProfileInput = z.infer<typeof educationManagerProfileInputSchema>;
export type OtherProfileInput = z.infer<typeof otherProfileInputSchema>;
export type UniversalIdentityProfile = UniversalIdentityProfileInput & { completedAt: number };

export type UniversalOnboardingProfile =
  | {
      version: typeof CURRENT_ONBOARDING_VERSION;
      status: 'completed';
      identities: ProductIdentity[];
      primaryIdentity: ProductIdentity;
      profiles: Partial<Record<ProductIdentity, UniversalIdentityProfile>>;
      completedAt: number;
      migratedFromVersion?: typeof LEGACY_ONBOARDING_VERSION;
    }
  | {
      version: typeof CURRENT_ONBOARDING_VERSION;
      status: 'skipped';
      skippedAt: number;
    };

export type LearningOnboardingProfile =
  | LegacyLearningOnboardingProfile
  | UniversalOnboardingProfile;
export type LearningOnboardingStatus = 'pending' | 'completed' | 'skipped';

export function getLearningOnboardingStatus(
  profile: LearningOnboardingProfile | null | undefined,
): LearningOnboardingStatus {
  if (!profile) return 'pending';
  if (
    profile.version !== LEGACY_ONBOARDING_VERSION &&
    profile.version !== CURRENT_ONBOARDING_VERSION
  ) {
    return 'pending';
  }
  return profile.status;
}

export type {
  DomainRef,
  DomainSelection,
  EducationManagerNeed,
  EducationManagerPreference,
  EducatorNeed,
  EducatorPreference,
  GuardianNeed,
  GuardianPreference,
  LearnerNeed,
  LearnerPreference,
  OtherNeed,
  OtherPreference,
  ProductIdentity,
  ProfileStage,
};
