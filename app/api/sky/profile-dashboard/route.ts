/**
 * GET /api/sky/profile-dashboard
 *
 * Aggregated dashboard endpoint that returns all data needed by the learner
 * profile dashboard in a single request:
 *  - stats: learning statistics + learner preferences
 *  - cloudMind: cloud-mind dashboard (weak points, recommendations, activity)
 *  - learningPath: active learning path
 *
 * Replaces the three separate calls the frontend previously made to
 * /api/sky/learning-stats, /api/sky/cloud-mind/dashboard, /api/sky/learning-path.
 */
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { getServerStorage } from '@/lib/server/server-storage';
import { getLearningStats } from '@/lib/server/learning-stats';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { createQuizAttemptDAO } from '@/lib/student/quiz-attempts';
import { createLearningPathDAO } from '@/lib/storage/dao/learning-paths';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { buildCloudMindDashboard, EMPTY_KB_STATS } from '@/lib/cloud-mind/recommendation-engine';
import { createLogger } from '@/lib/logger';
import type { KBStats } from '@/lib/knowledge-base/types';
import type { ProfileCacheEntry, StudentProfile } from '@/lib/student/profile-types';

const log = createLogger('API:ProfileDashboard');
const DEMO_PROFILE_USER_ID = 'default-user';
const DEMO_FALLBACK_USER_IDS = new Set(['admin-default']);

async function safeKnowledgeStats(): Promise<KBStats> {
  if (!process.env.MYSQL_DATABASE) return EMPTY_KB_STATS;
  try {
    const { stats } = await import('@/lib/knowledge-base/kb-manager');
    return await stats();
  } catch (err) {
    log.warn('Persistent KB stats unavailable:', err);
    return EMPTY_KB_STATS;
  }
}

function hasProfileLearningData(profile: StudentProfile | null): boolean {
  return (
    (profile?.totalQuestions ?? 0) > 0 ||
    Object.keys(profile?.masteryByKnowledge ?? {}).length > 0 ||
    (profile?.errorPatterns.length ?? 0) > 0
  );
}

function hydrateProfileDates(profile: StudentProfile): StudentProfile {
  return {
    ...profile,
    lastUpdated: new Date(profile.lastUpdated),
    errorPatterns: profile.errorPatterns.map((pattern) => ({
      ...pattern,
      lastOccurrence: new Date(pattern.lastOccurrence),
    })),
  };
}

async function readCachedDemoProfile(): Promise<StudentProfile | null> {
  try {
    const cachePath = path.join(
      process.cwd(),
      'data',
      'student-profiles',
      `${DEMO_PROFILE_USER_ID}.json`,
    );
    const raw = await fs.readFile(cachePath, 'utf-8');
    const entry = JSON.parse(raw) as ProfileCacheEntry;
    return hydrateProfileDates(entry.profile);
  } catch {
    return null;
  }
}

async function resolveDashboardProfile(userId: string): Promise<StudentProfile | null> {
  const profile = await buildStudentProfile(userId).catch((err) => {
    log.warn('Profile unavailable for dashboard:', err);
    return null;
  });

  if (hasProfileLearningData(profile) || !DEMO_FALLBACK_USER_IDS.has(userId)) {
    return profile;
  }

  const demoProfile = await readCachedDemoProfile();
  if (!demoProfile || !hasProfileLearningData(demoProfile)) return profile;

  return { ...demoProfile, userId };
}

export async function GET(req: NextRequest) {
  try {
    // ── Auth ──
    const url = new URL(req.url);
    const queryUserId = url.searchParams.get('userId');

    let userId: string | null = queryUserId;

    if (!userId) {
      const cookieStore = await cookies();
      const accessToken = cookieStore.get('access_token');
      if (accessToken) {
        const payload = await verifyAccessToken(accessToken.value);
        if (payload) userId = payload.sub;
      }
    }

    // Unauthenticated fallback — return empty shell so the dashboard can render.
    if (!userId) {
      return apiSuccess({
        data: {
          stats: {
            todayStudyMinutes: 0,
            streakDays: 0,
            masteryPercent: 0,
            checkedInToday: false,
            problemsAttempted: 0,
            problemsCorrect: 0,
            scenesCompleted: 0,
            learnerProfile: null,
          },
          cloudMind: null,
          learningPath: { path: null },
        },
      });
    }

    // ── Parallel data fetching ──
    const storage = await getServerStorage();
    const profileRepository = new LearnerProfileRepository(storage);
    const mistakeDAO = createMistakeBookDAO(storage);
    const knowledgeStateDAO = createKnowledgeStateDAO(storage);
    const quizAttemptDAO = createQuizAttemptDAO(storage);
    const learningPathDAO = createLearningPathDAO(storage);

    const [
      learningStats,
      preferences,
      profile,
      mistakesResult,
      dueMistakes,
      recentAttempts,
      knowledgeStates,
      kbStats,
      activePath,
    ] = await Promise.all([
      getLearningStats(userId),
      profileRepository.getLatestPreferences(userId),
      resolveDashboardProfile(userId),
      mistakeDAO.list(userId, { page: 1, pageSize: 50 }),
      mistakeDAO.getDueForReview(userId),
      quizAttemptDAO.list({ userId, recentDays: 14 }),
      knowledgeStateDAO.list(userId),
      safeKnowledgeStats(),
      learningPathDAO.getActiveByUser(userId),
    ]);

    const cloudMind = buildCloudMindDashboard({
      userId,
      profile,
      mistakes: mistakesResult.items,
      dueMistakes,
      recentAttempts,
      kbStats,
      knowledgeStates,
    });

    return apiSuccess({
      data: {
        stats: { ...learningStats, learnerProfile: preferences ?? null },
        cloudMind,
        learningPath: { path: activePath },
      },
    });
  } catch (err) {
    log.error('Profile dashboard aggregation failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '画像数据大屏聚合查询失败');
  }
}
