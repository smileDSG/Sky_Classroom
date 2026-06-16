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
import { getServerStorage } from '@/lib/server/server-storage';
import { createUserStatsDAO } from '@/lib/storage/dao/user-stats';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';

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
    const mistakeDAO = createMistakeBookDAO(storage);

    // Get today's stats from user_stats table
    const stats = await statsDAO.getOrCreate(userId);

    // ── Checked in today ──
    const todayStr = getTodayStr();
    const checkInEntry = await storage.get<CheckInEntry>(CHECKIN_TABLE, `${userId}_${todayStr}`);
    const checkedInToday = !!checkInEntry?.data;

    // ── Calculate mastery from knowledge graph ──
    let masteryPercent = 0;
    try {
      const mistakesResult = await mistakeDAO.list({ pageSize: 1000 });
      if (mistakesResult.items.length > 0) {
        const clientMistakes = mistakesResult.items.map((entry) => ({
          id: entry.id,
          problem: entry.problemText,
          userAnswer: entry.userAnswer,
          correctAnswer: entry.correctAnswer,
          cause: entry.errorType as any,
          solvedAt: entry.lastReview ? new Date(entry.lastReview) : new Date(),
          reviewed: entry.reviewed,
          reviewCount: entry.reviewCount,
          knowledgePoints: entry.knowledgePoints ?? [],
        }));
        const graph = buildKnowledgeGraph(clientMistakes);
        if (graph.nodes.length > 0) {
          const totalMastery = graph.nodes.reduce((sum, node) => sum + node.mastery, 0);
          masteryPercent = Math.round(totalMastery / graph.nodes.length);
        }
      }
    } catch (err) {
      log.error('Failed to calculate mastery:', err);
    }

    return apiSuccess({
      todayStudyMinutes: Math.round(stats.studySeconds / 60 * 10) / 10,
      streakDays: stats.checkinStreak,
      masteryPercent,
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
