import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { LearnerProfileService } from '@/lib/adaptive-learning/profile/service';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { learnerPreferencesInputSchema } from '@/lib/adaptive-learning/contracts';
import { readUniversalOnboarding } from '@/lib/onboarding/migration';
import {
  integrateCompletedOnboardingProfile,
  isOnboardingProfileIntegrated,
} from '@/lib/onboarding/profile-integration';
import { z } from 'zod';

const savePreferencesRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    preferences: learnerPreferencesInputSchema,
  })
  .strict();

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const storage = await getRequiredServerStorage();
    const repository = new LearnerProfileRepository(storage);
    let preferences = await repository.getLatestPreferences(auth.user.id);

    const onboarding = readUniversalOnboarding(auth.user);
    if (onboarding?.status === 'completed') {
      const integrated = await isOnboardingProfileIntegrated({
        storage,
        userId: auth.user.id,
        profile: onboarding,
      });
      if (!preferences || !integrated) {
        preferences = (
          await integrateCompletedOnboardingProfile({
            storage,
            userId: auth.user.id,
            profile: onboarding,
          })
        ).preferences;
      }
    }

    if (!preferences) {
      return apiError('PROFILE_NOT_FOUND', 404, 'Learner profile not found');
    }

    return apiSuccess({ preferences });
  } catch (error) {
    if (error instanceof AdaptiveLearningError && error.code === 'PERSISTENT_STORAGE_UNAVAILABLE') {
      return apiError(
        'PERSISTENT_STORAGE_UNAVAILABLE',
        503,
        'Persistent learner profile storage is unavailable',
      );
    }
    return apiError('INTERNAL_ERROR', 500, 'Failed to load learner profile');
  }
}

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Request body must be valid JSON');
  }

  const parsed = savePreferencesRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'INVALID_REQUEST',
      400,
      'Invalid learner preferences',
      parsed.error.issues[0]?.message,
    );
  }

  try {
    const storage = await getRequiredServerStorage();
    const repository = new LearnerProfileRepository(storage);
    const service = new LearnerProfileService(repository);
    const preferences = await service.savePreferences({
      userId: auth.user.id,
      expectedVersion: parsed.data.expectedVersion,
      updatedBy: 'user',
      preferences: parsed.data.preferences,
    });

    return apiSuccess({ preferences });
  } catch (error) {
    if (error instanceof AdaptiveLearningError) {
      if (error.code === 'PROFILE_VERSION_CONFLICT') {
        return apiError('PROFILE_VERSION_CONFLICT', 409, error.message);
      }
      if (error.code === 'PERSISTENT_STORAGE_UNAVAILABLE') {
        return apiError('PERSISTENT_STORAGE_UNAVAILABLE', 503, error.message);
      }
    }
    return apiError('INTERNAL_ERROR', 500, 'Failed to save learner preferences');
  }
}
