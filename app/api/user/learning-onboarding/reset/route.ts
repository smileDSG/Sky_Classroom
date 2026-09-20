import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { createUserDAO } from '@/lib/storage/dao/users';
import { getLearningOnboardingStatus } from '@/lib/onboarding/types';

export async function POST() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const dao = await createUserDAO();
  const updated = await dao.update(auth.user.id, { learningOnboarding: null });
  if (!updated) return apiError('NOT_FOUND', 404, 'User not found');

  return apiSuccess({
    onboarding: null,
    status: getLearningOnboardingStatus(updated.learningOnboarding),
  });
}
