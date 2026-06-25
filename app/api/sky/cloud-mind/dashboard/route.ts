import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { createQuizAttemptDAO } from '@/lib/student/quiz-attempts';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { buildCloudMindDashboard, EMPTY_KB_STATS } from '@/lib/cloud-mind/recommendation-engine';
import { createLogger } from '@/lib/logger';
import type { KBStats } from '@/lib/knowledge-base/types';
import type { StudentProfile } from '@/lib/student/profile-types';

const log = createLogger('API:CloudMindDashboard');

async function resolveUserId(req: NextRequest): Promise<string> {
  const url = new URL(req.url);
  const queryUserId = url.searchParams.get('userId');
  if (queryUserId) return queryUserId;

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

async function safeBuildProfile(userId: string): Promise<StudentProfile | null> {
  try {
    return await buildStudentProfile(userId);
  } catch (err) {
    log.warn('Profile unavailable for dashboard:', err);
    return null;
  }
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

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    const storage = await getServerStorage();
    const mistakeDAO = createMistakeBookDAO(storage);
    const quizAttemptDAO = createQuizAttemptDAO(storage);

    const [profile, mistakesResult, dueMistakes, recentAttempts, kbStats] = await Promise.all([
      safeBuildProfile(userId),
      mistakeDAO.list({ page: 1, pageSize: 50 }),
      mistakeDAO.getDueForReview(),
      quizAttemptDAO.list({ userId, recentDays: 14 }),
      safeKnowledgeStats(),
    ]);

    const dashboard = buildCloudMindDashboard({
      userId,
      profile,
      mistakes: mistakesResult.items,
      dueMistakes,
      recentAttempts,
      kbStats,
    });

    return apiSuccess({ data: dashboard });
  } catch (err) {
    log.error('Cloud mind dashboard failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '云端智囊驾驶舱数据加载失败');
  }
}
