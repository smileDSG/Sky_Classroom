import { LEARNER_GOALS, getDomainsForStage, type ProfileStage } from '@/lib/onboarding/catalog';
import type {
  DomainRef,
  LearnerProfileInput,
  LearningOnboardingProfile,
  UniversalIdentityProfile,
  UniversalOnboardingProfile,
} from '@/lib/onboarding/types';

export interface LegacyProfileSource {
  learningOnboarding: LearningOnboardingProfile | null;
  educationLevel: string | null;
  grade: string | null;
  favoriteSubjects: Array<{ id: string; name: string; enabled: boolean }> | null;
}

function legacyStage(value: string | null): ProfileStage {
  return value === 'middle' || value === 'high' ? value : 'other';
}

function normalizeLegacyDomainId(id: string, stage: ProfileStage): string {
  return stage === 'middle' && id === 'politics' ? 'ethics-law' : id;
}

function catalogDomain(id: string, stage: ProfileStage): DomainRef | null {
  const normalizedId = normalizeLegacyDomainId(id, stage);
  const configured = getDomainsForStage(stage).find((item) => item.id === normalizedId);
  if (!configured) return null;
  return { source: 'catalog', id: configured.id, name: configured.label };
}

function convertCompletedV1(
  source: LegacyProfileSource,
): Extract<UniversalOnboardingProfile, { status: 'completed' }> {
  const legacy = source.learningOnboarding;
  if (!legacy || legacy.version !== 1 || legacy.status !== 'completed') {
    throw new Error('Expected a completed version 1 onboarding profile');
  }

  const stage = legacyStage(source.educationLevel);
  const learningDomains = (source.favoriteSubjects ?? [])
    .filter((subject) => subject.enabled)
    .map((subject) => catalogDomain(subject.id, stage))
    .filter((domain): domain is DomainRef => domain !== null)
    .map((domain) => ({ domain }));
  const supportDomains = legacy.weakSubjects
    .map((id) => catalogDomain(id, stage))
    .filter((domain): domain is DomainRef => domain !== null);
  const goal = LEARNER_GOALS.find((item) => item.id === legacy.learningGoal);

  const learner: LearnerProfileInput & { completedAt: number } = {
    identity: 'learner',
    context: {
      stage,
      learningDomains,
      supportDomains,
      ...(source.grade?.trim() ? { legacyGrade: source.grade.trim() } : {}),
    },
    goals: goal ? [{ source: 'catalog', id: goal.id, label: goal.label }] : [],
    roleNeeds: [],
    preferences: { explanationStyle: legacy.teachingPreference },
    ...(legacy.goalDetail ? { detail: legacy.goalDetail } : {}),
    completedAt: legacy.completedAt,
  };

  return {
    version: 2,
    status: 'completed',
    identities: ['learner'],
    primaryIdentity: 'learner',
    profiles: { learner: learner as UniversalIdentityProfile },
    completedAt: legacy.completedAt,
    migratedFromVersion: 1,
  };
}

export function readUniversalOnboarding(
  source: LegacyProfileSource,
): UniversalOnboardingProfile | null {
  const profile = source.learningOnboarding;
  if (!profile) return null;
  if (profile.version === 2) return profile;
  if (profile.status === 'skipped') {
    return { version: 2, status: 'skipped', skippedAt: profile.skippedAt };
  }
  return convertCompletedV1(source);
}
