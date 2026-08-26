import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { getCurrentUser } from '@/lib/server/auth/helpers';
import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { createQuizAttemptDAO } from '@/lib/student/quiz-attempts';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { buildCloudMindDashboard, EMPTY_KB_STATS } from '@/lib/cloud-mind/recommendation-engine';
import { createLogger } from '@/lib/logger';
import type { KBStats } from '@/lib/knowledge-base/types';
import {
  STUDENT_PROFILE_CACHE_VERSION,
  type ProfileCacheEntry,
  type StudentProfile,
} from '@/lib/student/profile-types';

const log = createLogger('API:CloudMindDashboard');
const DEMO_PROFILE_USER_ID = 'default-user';
const DEMO_FALLBACK_USER_IDS = new Set(['admin-default']);

async function resolveUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user?.id ?? 'default-user';
}

async function safeBuildProfile(userId: string): Promise<StudentProfile | null> {
  try {
    return await buildStudentProfile(userId);
  } catch (err) {
    log.warn('Profile unavailable for dashboard:', err);
    return null;
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
    if (entry.cacheVersion !== STUDENT_PROFILE_CACHE_VERSION) return null;
    return hydrateProfileDates(entry.profile);
  } catch (err) {
    log.warn('Demo profile unavailable for cloud mind dashboard:', err);
    return null;
  }
}

async function resolveDashboardProfile(userId: string): Promise<StudentProfile | null> {
  const profile = await safeBuildProfile(userId);
  if (hasProfileLearningData(profile) || !DEMO_FALLBACK_USER_IDS.has(userId)) {
    return profile;
  }

  const demoProfile = await readCachedDemoProfile();
  if (!demoProfile || !hasProfileLearningData(demoProfile)) return profile;

  return {
    ...demoProfile,
    userId,
  };
}

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

export async function GET() {
  try {
    const userId = await resolveUserId();
    const storage = await getServerStorage();
    const mistakeDAO = createMistakeBookDAO(storage);
    const knowledgeStateDAO = createKnowledgeStateDAO(storage);
    const quizAttemptDAO = createQuizAttemptDAO(storage);

    const [profile, mistakesResult, dueMistakes, recentAttempts, kbStats, knowledgeStates] =
      await Promise.all([
        resolveDashboardProfile(userId),
        mistakeDAO.list(userId, { page: 1, pageSize: 50 }),
        mistakeDAO.getDueForReview(userId),
        quizAttemptDAO.list({ userId, recentDays: 14 }),
        safeKnowledgeStats(),
        knowledgeStateDAO.list(userId),
      ]);

    const dashboard = buildCloudMindDashboard({
      userId,
      profile,
      mistakes: mistakesResult.items,
      dueMistakes,
      recentAttempts,
      kbStats,
      knowledgeStates,
    });

    return apiSuccess({ data: dashboard });
  } catch (err) {
    log.error('Cloud mind dashboard failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '云端智囊驾驶舱数据加载失败');
  }
}
