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
import type { MemoryReviewRecord } from '@/lib/cloud-mind/types';
import type { MistakeCause } from '@/lib/solve/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SkyWorkshop');
const MEMORY_REVIEWS_TABLE = 'cloud_mind_memory_reviews';

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

function toTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function buildMemoryProgress(memoryReviews: MemoryReviewRecord[]) {
  const deckIds = new Set(memoryReviews.map((review) => review.deckId).filter(Boolean));
  const lastStudied = memoryReviews.reduce<number | null>((latest, review) => {
    const reviewedAt = toTimestamp(review.lastReviewedAt);
    if (reviewedAt === null) return latest;
    return latest === null ? reviewedAt : Math.max(latest, reviewedAt);
  }, null);

  return {
    totalFlipped: memoryReviews.reduce(
      (total, review) => total + Math.max(1, review.reviewCount ?? 1),
      0,
    ),
    topicCount: deckIds.size,
    lastStudied,
  };
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

    const [{ items: mistakeEntries, total }, learningStats, profile, memoryReviewEntries] =
      await Promise.all([
        mistakeDAO.list(userId, { pageSize: 9999 }),
        getLearningStats(userId).catch((error) => {
          log.warn('Learning stats unavailable:', error);
          return null;
        }),
        buildStudentProfile(userId).catch((error) => {
          log.warn('Student profile unavailable:', error);
          return null;
        }),
        storage
          .getAll<MemoryReviewRecord>(MEMORY_REVIEWS_TABLE, (entry) => entry.data.userId === userId)
          .catch((error) => {
            log.warn('Memory reviews unavailable:', error);
            return [];
          }),
      ]);

    const reviewSchedule = buildReviewSchedule(mistakeEntries);
    const masteryProgress = getMasteryProgress(mistakeEntries);
    const memoryProgress = buildMemoryProgress(memoryReviewEntries.map((entry) => entry.data));
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
      memoryProgress,
      dataSources: {
        mistakes: 'server',
        review: 'server',
        learningStats: learningStats ? 'server' : 'unavailable',
        profile: profile ? 'server' : 'unavailable',
        memoryProgress: memoryReviewEntries.length > 0 ? 'server' : 'empty',
      },
    });
  } catch (error) {
    log.error('Workshop snapshot error:', error);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '天梯工坊数据加载失败');
  }
}
