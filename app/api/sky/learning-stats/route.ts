/**
 * GET /api/sky/learning-stats
 *
 * Returns aggregated learning metrics from user_stats table:
 *  - todayStudyMinutes: real study time today (from user_stats)
 *  - streakDays: consecutive check-in days (from user_stats)
 *  - masteryPercent: comprehensive mastery score (from user_stats)
 *  - checkedInToday: whether user has checked in today
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createUserStatsDAO } from '@/lib/storage/dao/user-stats';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';

const log = createLogger('API:LearningStats');

const CHECKIN_TABLE = 'user_checkins';

interface CheckInEntry {
  userId: string;
  date: string;
  timestamp: number;
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

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

    const storage = await getServerStorage();
    const statsDAO = createUserStatsDAO(storage);

    // Get today's stats from user_stats table
    const stats = await statsDAO.getOrCreate(userId);

    // ── Checked in today ──
    const todayStr = getTodayStr();
    const checkInEntry = await storage.get<CheckInEntry>(CHECKIN_TABLE, `${userId}_${todayStr}`);
    const checkedInToday = !!checkInEntry?.data;

    return apiSuccess({
      todayStudyMinutes: Math.round(stats.studySeconds / 60 * 10) / 10,
      streakDays: stats.checkinStreak,
      masteryPercent: stats.masteryScore,
      checkedInToday,
      problemsAttempted: stats.problemsAttempted,
      problemsCorrect: stats.problemsCorrect,
      scenesCompleted: stats.scenesCompleted,
    });
  } catch (err) {
    log.error('Learning stats error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '学习统计查询失败');
  }
}
