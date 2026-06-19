/**
 * GET /api/sky/learning-stats
 *
 * Returns aggregated learning metrics from user_stats table:
 *  - todayStudyMinutes: real study time today (from user_stats)
 *  - streakDays: consecutive check-in days (from user_stats)
 *  - masteryPercent: comprehensive mastery score (calculated from knowledge graph)
 *  - checkedInToday: whether user has checked in today
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getLearningStats } from '@/lib/server/learning-stats';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:LearningStats');

export async function GET(req: NextRequest) {
  try {
    // Verify user authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    let userId: string | null = null;

    if (accessToken) {
      const payload = await verifyAccessToken(accessToken.value);
      if (payload) {
        userId = payload.sub;
      }
    }

    // If not authenticated, return default values
    if (!userId) {
      return apiSuccess({
        todayStudyMinutes: 0,
        streakDays: 0,
        masteryPercent: 0,
        checkedInToday: false,
        todayMistakeCount: 0,
        totalMistakes: 0,
      });
    }

    const stats = await getLearningStats(userId);
    return apiSuccess({ ...stats });
  } catch (err) {
    log.error('Learning stats error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '学习统计查询失败');
  }
}
