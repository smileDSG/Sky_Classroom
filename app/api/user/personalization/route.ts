/**
 * GET /api/user/personalization  (deprecated)
 * PATCH /api/user/personalization (deprecated)
 *
 * This route is kept for backwards compatibility. It now proxies to the
 * authoritative learner profile service and returns a deprecation marker.
 * New clients should use /api/user/learner-profile directly.
 */
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createUserDAO } from '@/lib/storage/dao/users';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { LearnerProfileService } from '@/lib/adaptive-learning/profile/service';
import { learnerPreferencesInputSchema } from '@/lib/adaptive-learning/contracts';
import {
  extractLegacyPersonalizationFields,
  migrateLegacyPersonalizationToPreferences,
} from '@/lib/adaptive-learning/profile/migrate-legacy-personalization';

const DEPRECATION_HEADERS = {
  Deprecation: 'true',
  Sunset: 'Sat, 31 Oct 2026 00:00:00 GMT',
  Link: '</api/user/learner-profile>; rel="successor-version"',
};

const patchRequestSchema = z
  .object({
    personalization: learnerPreferencesInputSchema,
  })
  .strict();

async function getOrMigratePreferences(userId: string) {
  const storage = await getRequiredServerStorage();
  const repository = new LearnerProfileRepository(storage);

  const existing = await repository.getLatestPreferences(userId);
  if (existing) return existing;

  const userDao = await createUserDAO(storage);
  const user = await userDao.getById(userId);
  if (!user) return null;

  const legacy = extractLegacyPersonalizationFields(user);
  const hasAnyLegacyField = Object.values(legacy).some(
    (value) => value !== null && value !== undefined,
  );
  if (!hasAnyLegacyField) return null;

  const service = new LearnerProfileService(repository);
  const migrated = await service.savePreferences({
    userId,
    expectedVersion: 0,
    updatedBy: 'migration',
    preferences: migrateLegacyPersonalizationToPreferences(userId, legacy),
  });

  return migrated;
}

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const preferences = await getOrMigratePreferences(auth.user.id);
    if (!preferences) {
      return apiError('PROFILE_NOT_FOUND', 404, 'Learner profile not found', undefined, {
        ...DEPRECATION_HEADERS,
      });
    }

    return apiSuccess({ personalization: preferences, deprecation: true }, 200, {
      ...DEPRECATION_HEADERS,
    });
  } catch (error) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to load learner profile', undefined, {
      ...DEPRECATION_HEADERS,
    });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Request body must be valid JSON', undefined, {
      ...DEPRECATION_HEADERS,
    });
  }

  const parsed = patchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'INVALID_REQUEST',
      400,
      'Invalid learner preferences',
      parsed.error.issues[0]?.message,
      { ...DEPRECATION_HEADERS },
    );
  }

  try {
    const storage = await getRequiredServerStorage();
    const repository = new LearnerProfileRepository(storage);
    const latest = await repository.getLatestPreferences(auth.user.id);
    const currentVersion = latest?.version ?? 0;

    const service = new LearnerProfileService(repository);
    const preferences = await service.savePreferences({
      userId: auth.user.id,
      expectedVersion: currentVersion,
      updatedBy: 'user',
      preferences: parsed.data.personalization,
    });

    return apiSuccess({ personalization: preferences, deprecation: true }, 200, {
      ...DEPRECATION_HEADERS,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('PROFILE_VERSION_CONFLICT')) {
      return apiError(
        'PROFILE_VERSION_CONFLICT',
        409,
        'Learner profile changed since it was loaded',
        undefined,
        {
          ...DEPRECATION_HEADERS,
        },
      );
    }
    return apiError('INTERNAL_ERROR', 500, 'Failed to save learner profile', undefined, {
      ...DEPRECATION_HEADERS,
    });
  }
}
