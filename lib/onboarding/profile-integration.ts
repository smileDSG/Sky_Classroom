import type {
  LearnerPreferences,
  LearnerPreferencesInput,
} from '@/lib/adaptive-learning/contracts';
import {
  extractLegacyPersonalizationFields,
  migrateLegacyPersonalizationToPreferences,
} from '@/lib/adaptive-learning/profile/migrate-legacy-personalization';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { LearnerProfileService } from '@/lib/adaptive-learning/profile/service';
import {
  LEARNER_FOUNDATIONS,
  STAGE_LABELS,
  type LearnerWeeklyTime,
  type ProfileStage,
} from '@/lib/onboarding/catalog';
import { getPrimaryIdentityProfile } from '@/lib/onboarding/selectors';
import type {
  DomainRef,
  UniversalIdentityProfile,
  UniversalOnboardingProfile,
} from '@/lib/onboarding/types';
import { createUserDAO, type UserEntry } from '@/lib/storage/dao/users';
import type { StorageProvider } from '@/lib/storage/storage-types';
import {
  createProfileSignalDAO,
  type ProfileSignal,
  type ProfileSignalDimension,
} from '@/lib/student/profile-signals';

type CompletedOnboardingProfile = Extract<UniversalOnboardingProfile, { status: 'completed' }>;
const PROFILE_SIGNALS_TABLE = 'profile_signals';

interface PrimaryContext {
  stage: ProfileStage;
  domains: DomainRef[];
  supportDomains: DomainRef[];
  preference: string;
  legacyGrade?: string;
}

interface IntegrationInput {
  storage: StorageProvider;
  userId: string;
  profile: CompletedOnboardingProfile;
  now?: Date;
}

export interface OnboardingProfileIntegrationResult {
  user: UserEntry;
  preferences: LearnerPreferences;
  signals: ProfileSignal[];
}

function domainId(domain: DomainRef): string {
  return domain.source === 'catalog' ? domain.id : domain.name;
}

function primaryContext(profile: UniversalIdentityProfile): PrimaryContext {
  switch (profile.identity) {
    case 'learner':
      return {
        stage: profile.context.stage,
        domains: profile.context.learningDomains.map((item) => item.domain),
        supportDomains: profile.context.supportDomains,
        preference: profile.preferences.explanationStyle,
        legacyGrade: profile.context.legacyGrade,
      };
    case 'educator': {
      const context = profile.contexts[0];
      return {
        stage: context?.stage ?? 'other',
        domains: context?.teachingDomains.map((item) => item.domain) ?? [],
        supportDomains: [],
        preference: profile.preferences.primarySupport,
      };
    }
    case 'guardian': {
      const context = profile.contexts[0];
      return {
        stage: context?.stage ?? 'other',
        domains: context?.supportDomains.map((item) => item.domain) ?? [],
        supportDomains: [],
        preference: profile.preferences.guidanceStyle,
      };
    }
    case 'education-manager': {
      const context = profile.contexts[0];
      return {
        stage: context?.stage ?? 'other',
        domains: context?.managedDomains.map((item) => item.domain) ?? [],
        supportDomains: [],
        preference: profile.preferences.managementFocus,
      };
    }
    case 'other':
      return {
        stage: profile.context.stage,
        domains: profile.context.domains.map((item) => item.domain),
        supportDomains: [],
        preference: profile.preferences.collaborationStyle,
      };
  }
}

function identitySummary(profile: UniversalIdentityProfile): string {
  const contexts: Array<{ stage: ProfileStage; domains: DomainRef[] }> = (() => {
    switch (profile.identity) {
      case 'learner':
        return [
          {
            stage: profile.context.stage,
            domains: [
              ...profile.context.learningDomains.map((item) => item.domain),
              ...profile.context.supportDomains,
            ],
          },
        ];
      case 'educator':
        return profile.contexts.map((context) => ({
          stage: context.stage,
          domains: context.teachingDomains.map((item) => item.domain),
        }));
      case 'guardian':
        return profile.contexts.map((context) => ({
          stage: context.stage,
          domains: context.supportDomains.map((item) => item.domain),
        }));
      case 'education-manager':
        return profile.contexts.map((context) => ({
          stage: context.stage,
          domains: context.managedDomains.map((item) => item.domain),
        }));
      case 'other':
        return [
          {
            stage: profile.context.stage,
            domains: profile.context.domains.map((item) => item.domain),
          },
        ];
    }
  })();
  const stages = [...new Set(contexts.map((context) => context.stage))];
  const domains = [...new Set(contexts.flatMap((context) => context.domains.map(domainId)))];
  const goals = profile.goals.map((goal) => goal.label);
  return [
    `identity=${profile.identity}`,
    `stages=${stages.join(',')}`,
    `domains=${domains.join(',')}`,
    `goals=${goals.join(',')}`,
    `needs=${profile.roleNeeds.join(',')}`,
  ].join(';');
}

function educationLevel(stage: ProfileStage): string {
  if (stage === 'postgraduate') return 'graduate';
  if (['primary', 'middle', 'high', 'undergraduate'].includes(stage)) return stage;
  return 'other';
}

function learningStyle(preference: string): string {
  if (preference.includes('visual')) return 'visual';
  if (preference.includes('practice') || preference.includes('interactive')) return 'kinesthetic';
  if (preference.includes('step') || preference.includes('structured')) return 'reading';
  return 'balanced';
}

function preferenceOverlay(
  preference: string,
): Pick<LearnerPreferencesInput, 'contentFormatPreferences' | 'stepByStepMode'> {
  if (preference.includes('visual')) {
    return {
      contentFormatPreferences: ['diagram', 'worked-example'],
      stepByStepMode: 'when-needed',
    };
  }
  if (preference.includes('practice') || preference.includes('interactive')) {
    return {
      contentFormatPreferences: ['interactive', 'worked-example'],
      stepByStepMode: 'hints-first',
    };
  }
  if (preference.includes('step')) {
    return { contentFormatPreferences: ['text', 'worked-example'], stepByStepMode: 'always' };
  }
  if (preference.includes('example')) {
    return { contentFormatPreferences: ['worked-example', 'text'], stepByStepMode: 'when-needed' };
  }
  return { contentFormatPreferences: ['worked-example', 'diagram'], stepByStepMode: 'when-needed' };
}

function preferencesInput(preferences: LearnerPreferences): LearnerPreferencesInput {
  return {
    preferredLanguage: preferences.preferredLanguage,
    contentFormatPreferences: [...preferences.contentFormatPreferences],
    explanationDepth: preferences.explanationDepth,
    learningPace: preferences.learningPace,
    stepByStepMode: preferences.stepByStepMode,
    interactionTone: preferences.interactionTone,
    assistantName: preferences.assistantName,
    preferenceNotes: preferences.preferenceNotes,
    privacy: { ...preferences.privacy },
  };
}

function samePreferences(left: LearnerPreferencesInput, right: LearnerPreferencesInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function signal(input: {
  userId: string;
  dimension: ProfileSignalDimension;
  value: ProfileSignal['value'];
  evidence: string[];
  createdAt: number;
  confidence?: number;
}): ProfileSignal {
  return {
    id: onboardingProfileSignalId(input.userId, input.dimension),
    userId: input.userId,
    dimension: input.dimension,
    value: input.value,
    source: 'onboarding_chat',
    confidence: input.confidence ?? 0.85,
    evidence: input.evidence,
    createdAt: input.createdAt,
  };
}

export function onboardingProfileSignalId(
  userId: string,
  dimension: ProfileSignalDimension,
): string {
  return `onboarding_profile:${encodeURIComponent(userId)}:${dimension}`;
}

export async function isOnboardingProfileIntegrated(input: {
  storage: StorageProvider;
  userId: string;
  profile: CompletedOnboardingProfile;
}): Promise<boolean> {
  const entry = await input.storage.get<ProfileSignal>(
    PROFILE_SIGNALS_TABLE,
    onboardingProfileSignalId(input.userId, 'majorBackground'),
  );
  return Boolean(entry && entry.data.createdAt >= input.profile.completedAt);
}

function buildSignals(input: {
  userId: string;
  profile: CompletedOnboardingProfile;
  primary: UniversalIdentityProfile;
  context: PrimaryContext;
  createdAt: number;
}): ProfileSignal[] {
  const selectedProfiles = input.profile.identities
    .map((identity) => input.profile.profiles[identity])
    .filter((profile): profile is UniversalIdentityProfile => Boolean(profile));
  const evidence = selectedProfiles.map(identitySummary);
  const goals = selectedProfiles.flatMap((profile) => profile.goals.map((goal) => goal.label));
  const details = selectedProfiles.map((profile) => profile.detail).filter(Boolean);
  const goal = [...goals, ...details].join('；');
  const formats = preferenceOverlay(input.context.preference).contentFormatPreferences;
  const signals: ProfileSignal[] = [
    signal({
      userId: input.userId,
      dimension: 'majorBackground',
      value: evidence.join('\n'),
      evidence,
      createdAt: input.createdAt,
      confidence: 0.9,
    }),
    signal({
      userId: input.userId,
      dimension: 'interactionPreference',
      value: input.context.preference,
      evidence,
      createdAt: input.createdAt,
      confidence: 0.8,
    }),
    signal({
      userId: input.userId,
      dimension: 'resourcePreference',
      value: formats,
      evidence,
      createdAt: input.createdAt,
      confidence: 0.8,
    }),
  ];

  if (goal) {
    signals.push(
      signal({
        userId: input.userId,
        dimension: 'learningGoal',
        value: goal,
        evidence,
        createdAt: input.createdAt,
        confidence: 0.85,
      }),
    );
  }

  const learnerProfile = input.profile.profiles.learner;
  if (learnerProfile?.identity === 'learner') {
    const supportDomains = learnerProfile.context.supportDomains.map(domainId);
    signals.push(
      signal({
        userId: input.userId,
        dimension: 'knowledgeBase',
        value: { strongPoints: [], weakPoints: supportDomains },
        evidence,
        createdAt: input.createdAt,
        confidence: 0.6,
      }),
    );
    if (learnerProfile.baseline) {
      const foundationLabel =
        LEARNER_FOUNDATIONS.find((item) => item.id === learnerProfile.baseline?.foundation)
          ?.label ?? learnerProfile.baseline.foundation;
      signals.push(
        signal({
          userId: input.userId,
          dimension: 'currentLearningState',
          value: `自评基础：${foundationLabel}`,
          evidence,
          createdAt: input.createdAt,
          confidence: 0.6,
        }),
        signal({
          userId: input.userId,
          dimension: 'learningPace',
          value: weeklyTimeToLearningPace(learnerProfile.baseline.weeklyTime),
          evidence,
          createdAt: input.createdAt,
          confidence: 0.75,
        }),
      );
    }
  }

  return signals;
}

function weeklyTimeToLearningPace(
  weeklyTime: LearnerWeeklyTime,
): LearnerPreferencesInput['learningPace'] {
  if (weeklyTime === 'light') return 'slow';
  if (weeklyTime === 'intensive') return 'fast';
  return 'standard';
}

export async function integrateCompletedOnboardingProfile(
  input: IntegrationInput,
): Promise<OnboardingProfileIntegrationResult> {
  const users = await createUserDAO(input.storage);
  const existingUser = await users.getById(input.userId);
  if (!existingUser) throw new Error('Cannot integrate onboarding for missing user');

  const primary = getPrimaryIdentityProfile(input.profile);
  if (!primary) throw new Error('Completed onboarding is missing its primary identity profile');

  const context = primaryContext(primary);
  const favoriteSubjects = [...context.domains, ...context.supportDomains].filter(
    (domain, index, domains) =>
      domains.findIndex((item) => domainId(item) === domainId(domain)) === index,
  );
  const updatedUser = await users.update(input.userId, {
    learningOnboarding: input.profile,
    educationLevel: educationLevel(context.stage),
    grade: context.legacyGrade ?? STAGE_LABELS[context.stage],
    favoriteSubjects: favoriteSubjects.map((domain) => ({
      id: domainId(domain),
      name: domain.name,
      enabled: true,
    })),
    learningStyle: learningStyle(context.preference),
    showStepByStep: context.preference.includes('step'),
  });
  if (!updatedUser) throw new Error('Cannot integrate onboarding for missing user');

  const repository = new LearnerProfileRepository(input.storage);
  const currentPreferences = await repository.getLatestPreferences(input.userId);
  const basePreferences = currentPreferences
    ? preferencesInput(currentPreferences)
    : migrateLegacyPersonalizationToPreferences(
        input.userId,
        extractLegacyPersonalizationFields(updatedUser),
      );
  const nextPreferences: LearnerPreferencesInput = {
    ...basePreferences,
    ...preferenceOverlay(context.preference),
    ...(primary.identity === 'learner' && primary.baseline
      ? { learningPace: weeklyTimeToLearningPace(primary.baseline.weeklyTime) }
      : {}),
  };

  let preferences = currentPreferences;
  if (!preferences || !samePreferences(preferencesInput(preferences), nextPreferences)) {
    preferences = await new LearnerProfileService(repository, {
      now: () => input.now ?? new Date(),
    }).savePreferences({
      userId: input.userId,
      expectedVersion: currentPreferences?.version ?? 0,
      updatedBy: 'system',
      preferences: nextPreferences,
    });
  }

  const signals = buildSignals({
    userId: input.userId,
    profile: input.profile,
    primary,
    context,
    createdAt: (input.now ?? new Date()).getTime(),
  });
  await createProfileSignalDAO(input.storage).addMany(signals);

  return { user: updatedUser, preferences, signals };
}
