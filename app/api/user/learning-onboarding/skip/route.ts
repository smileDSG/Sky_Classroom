import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { createUserDAO } from '@/lib/storage/dao/users';
import {
  CURRENT_ONBOARDING_VERSION,
  getLearningOnboardingStatus,
  type LearningOnboardingProfile,
} from '@/lib/onboarding/types';

export async function POST() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const skipped: LearningOnboardingProfile = {
    version: CURRENT_ONBOARDING_VERSION,
    status: 'skipped',
    skippedAt: Date.now(),
  };
  const dao = await createUserDAO();
  const updated = await dao.update(auth.user.id, { learningOnboarding: skipped });
  if (!updated) return apiError('NOT_FOUND', 404, 'User not found');

  return apiSuccess({
    onboarding: updated.learningOnboarding,
    status: getLearningOnboardingStatus(updated.learningOnboarding),
  });
}
