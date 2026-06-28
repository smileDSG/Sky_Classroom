/**
 * GET /api/sky/workshop
 *
 * Aggregates the live data needed by 天梯工坊:
 * mistakes, review schedule, learning stats, and student profile.
 */
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { getServerStorage } from '@/lib/server/server-storage';
import { getLearningStats } from '@/lib/server/learning-stats';
import { buildStudentProfile, invalidateProfileCache } from '@/lib/student/profile-builder';
import { createMistakeBookDAO, type ErrorType } from '@/lib/storage/dao/mistakes';
import { buildReviewSchedule, getMasteryProgress } from '@/lib/schedule/review-scheduler';
import type { MistakeCause } from '@/lib/solve/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SkyWorkshop');

function causeFromErrorType(errorType: ErrorType): MistakeCause {
  const map: Record<ErrorType, MistakeCause> = {
    calculation: 'calculation-error',
    concept: 'concept-unclear',
    reasoning: 'method-wrong',
    reading: 'misreading',
    careless: 'careless',
  };
  return map[errorType];
}

async function resolveUserId(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    if (!accessToken) return 'default-user';
    const payload = await verifyAccessToken(accessToken.value);
    return payload?.sub ?? 'default-user';
  } catch {
    return 'default-user';
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('force') === 'true';
    const userId = await resolveUserId();
    if (forceRefresh) {
      await invalidateProfileCache(userId);
    }

    const storage = await getServerStorage();
    const mistakeDAO = createMistakeBookDAO(storage);

    const [{ items: mistakeEntries, total }, learningStats, profile] = await Promise.all([
      mistakeDAO.list({ pageSize: 9999 }),
      getLearningStats(userId).catch((error) => {
        log.warn('Learning stats unavailable:', error);
        return null;
      }),
      buildStudentProfile(userId).catch((error) => {
        log.warn('Student profile unavailable:', error);
        return null;
      }),
    ]);

    const reviewSchedule = buildReviewSchedule(mistakeEntries);
    const masteryProgress = getMasteryProgress(mistakeEntries);
    const mistakes = mistakeEntries.map((entry) => ({
      id: entry.id,
      problem: entry.problemText,
      userAnswer: entry.userAnswer,
      correctAnswer: entry.correctAnswer,
      cause: causeFromErrorType(entry.errorType),
      solvedAt: entry.lastReview ?? Date.now(),
      reviewed: entry.reviewed,
      reviewCount: entry.reviewCount,
      knowledgePoints: entry.knowledgePoints ?? [],
      lastReview: entry.lastReview,
      nextReview: entry.nextReview,
      masteryLevel: entry.masteryLevel,
      source: entry.source,
      sourceSessionId: entry.sourceSessionId,
      solutionSteps: entry.solutionSteps,
      hints: entry.hints,
      errorExplanation: entry.errorExplanation,
    }));

    return apiSuccess({
      userId,
      generatedAt: Date.now(),
      mistakes,
      mistakeTotal: total,
      review: {
        dueToday: reviewSchedule.today?.items ?? [],
        dueCount: reviewSchedule.today?.count ?? 0,
        upcoming: reviewSchedule.upcoming,
        overdue: reviewSchedule.overdue,
        completed: reviewSchedule.completed,
        total: reviewSchedule.total,
        progress: masteryProgress,
      },
      learningStats,
      profile,
      dataSources: {
        mistakes: 'server',
        review: 'server',
        learningStats: learningStats ? 'server' : 'unavailable',
        profile: profile ? 'server' : 'unavailable',
      },
    });
  } catch (error) {
    log.error('Workshop snapshot error:', error);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '天梯工坊数据加载失败');
  }
}
