/**
 * POST /api/sky/study-timer
 *
 * Receive study time increments from the frontend and accumulate in user_stats.
 * Called periodically (every 30s) or on page unload.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createUserStatsDAO } from '@/lib/storage/dao/user-stats';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';

const log = createLogger('API:StudyTimer');

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    if (!accessToken) {
      return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Not authenticated');
    }

    const payload = await verifyAccessToken(accessToken.value);
    if (!payload) {
      return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Invalid token');
    }

    const userId = payload.sub;
    const body = await req.json();
    const seconds = Number(body?.seconds);

    if (!seconds || seconds <= 0 || seconds > 300) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid seconds (1-300)');
    }

    const storage = await getServerStorage();
    const statsDAO = createUserStatsDAO(storage);
    const stats = await statsDAO.addStudySeconds(userId, seconds);

    return apiSuccess({
      todayStudySeconds: stats.studySeconds,
    });
  } catch (err) {
    log.error('Study timer error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '学习计时更新失败');
  }
}
