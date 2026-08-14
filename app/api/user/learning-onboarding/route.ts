import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getServerStorage } from '@/lib/server/server-storage';
import { readUniversalOnboarding } from '@/lib/onboarding/migration';
import { integrateCompletedOnboardingProfile } from '@/lib/onboarding/profile-integration';
import { buildInitialProfileSnapshot } from '@/lib/onboarding/initial-profile';
import {
  CURRENT_ONBOARDING_VERSION,
  completeUniversalOnboardingSchema,
  getLearningOnboardingStatus,
  type CompleteUniversalOnboardingInput,
  type UniversalIdentityProfile,
  type UniversalOnboardingProfile,
} from '@/lib/onboarding/types';
import { PRODUCT_IDENTITIES, type ProductIdentity } from '@/lib/onboarding/catalog';
import type { UserEntry } from '@/lib/storage/dao/users';

function normalizedProfile(user: UserEntry): UniversalOnboardingProfile | null {
  return readUniversalOnboarding({
    learningOnboarding: user.learningOnboarding,
    educationLevel: user.educationLevel,
    grade: user.grade,
    favoriteSubjects: user.favoriteSubjects,
  });
}

function buildStoredProfile(
  input: CompleteUniversalOnboardingInput,
  user: UserEntry,
  now: number,
): Extract<UniversalOnboardingProfile, { status: 'completed' }> {
  const existing = normalizedProfile(user);
  const existingProfiles = existing?.status === 'completed' ? existing.profiles : {};
  const profiles: Partial<Record<ProductIdentity, UniversalIdentityProfile>> = {};

  for (const identity of PRODUCT_IDENTITIES) {
    if (!input.identities.includes(identity)) continue;
    const submitted = input.profiles[identity];
    if (submitted) {
      profiles[identity] = { ...submitted, completedAt: now } as UniversalIdentityProfile;
    } else if (existingProfiles[identity]) {
      profiles[identity] = existingProfiles[identity];
    }
  }

  const migratedFromVersion =
    user.learningOnboarding?.version === 1 && user.learningOnboarding.status === 'completed'
      ? 1
      : existing?.status === 'completed'
        ? existing.migratedFromVersion
        : undefined;

  return {
    version: CURRENT_ONBOARDING_VERSION,
    status: 'completed',
    identities: input.identities,
    primaryIdentity: input.primaryIdentity,
    profiles,
    completedAt: now,
    ...(migratedFromVersion ? { migratedFromVersion } : {}),
  };
}

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const onboarding = normalizedProfile(auth.user);
  return apiSuccess({
    status: getLearningOnboardingStatus(auth.user.learningOnboarding),
    onboarding,
    initialProfile: buildInitialProfileSnapshot(onboarding),
  });
}

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const parsed = completeUniversalOnboardingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, 'Validation failed', parsed.error.issues[0]?.message);
  }

  const completed = buildStoredProfile(parsed.data, auth.user, Date.now());
  const storage = await getServerStorage();
  const { user: updated } = await integrateCompletedOnboardingProfile({
    storage,
    userId: auth.user.id,
    profile: completed,
  });

  return apiSuccess({
    onboarding: updated.learningOnboarding,
    status: getLearningOnboardingStatus(updated.learningOnboarding),
    initialProfile: buildInitialProfileSnapshot(normalizedProfile(updated)),
  });
}
