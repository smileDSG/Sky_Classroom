/**
 * GET /api/sky/student/profile
 *
 * Returns the student profile: mastery by subject/knowledge point,
 * weak/strong points, error patterns, and aggregate stats.
 *
 * Query params:
 *   userId  — optional user identifier (default: "default-user")
 *   force   — set to "true" to bypass the 5-minute cache
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { buildStudentProfile, invalidateProfileCache } from '@/lib/student/profile-builder';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';

const log = createLogger('API:StudentProfile');

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const userId = auth.user.id;
    const forceRefresh = url.searchParams.get('force') === 'true';

    if (forceRefresh) {
      invalidateProfileCache(userId);
    }

    const profile = await buildStudentProfile(userId);
    log.info(
      `Profile returned for ${userId}: ${profile.totalQuestions} questions, ${profile.errorPatterns.length} error patterns`,
    );

    return apiSuccess({ profile });
  } catch (err) {
    log.error('Student profile API error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '学生画像查询失败');
  }
}
