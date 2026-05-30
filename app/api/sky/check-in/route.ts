/**
 * POST /api/sky/check-in
 *
 * Record daily check-in, update user_stats, and return streak count.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createUserStatsDAO } from '@/lib/storage/dao/user-stats';
import { createMistakeBookDAO, EBBINGHAUS_INTERVALS } from '@/lib/storage/dao/mistakes';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { StorageEntry } from '@/lib/storage/storage-types';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';

const log = createLogger('API:CheckIn');

const CHECKIN_TABLE = 'user_checkins';

interface CheckInEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterday(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    // Verify user authentication
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
    const todayStr = today();

    const storage = await getServerStorage();
    const statsDAO = createUserStatsDAO(storage);

    // Check if already checked in today
    const todayEntry = await storage.get<CheckInEntry>(CHECKIN_TABLE, `${userId}_${todayStr}`);
    if (todayEntry?.data) {
      // Already checked in, return current streak + stats
      const streak = await calculateStreak(storage, userId);
      const stats = await statsDAO.getOrCreate(userId);
      return apiSuccess({
        checkedIn: true,
        streakDays: streak,
        todayStudySeconds: stats.studySeconds,
        masteryScore: stats.masteryScore,
        message: 'Already checked in today',
      });
    }

    // Record check-in
    await storage.set(CHECKIN_TABLE, {
      id: `${userId}_${todayStr}`,
      data: {
        userId,
        date: todayStr,
        timestamp: Date.now(),
      } as unknown as Record<string, unknown>,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Calculate streak
    const streak = await calculateStreak(storage, userId);

    // Calculate mastery score
    const masteryScore = await calculateMasteryScore(storage, userId);

    // Update user_stats with streak and mastery
    const stats = await statsDAO.update(userId, {
      checkinStreak: streak,
      masteryScore,
    });

    log.info(`User ${userId} checked in, streak: ${streak}, mastery: ${masteryScore}`);

    return apiSuccess({
      checkedIn: true,
      streakDays: streak,
      todayStudySeconds: stats.studySeconds,
      masteryScore,
      message: 'Check-in successful',
    });
  } catch (err) {
    log.error('Check-in error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '打卡失败');
  }
}

async function calculateStreak(storage: Awaited<ReturnType<typeof getServerStorage>>, userId: string): Promise<number> {
  let streak = 0;
  const todayStr = today();
  let checkDate = todayStr;

  // Count backwards from today
  while (true) {
    const entry = await storage.get<CheckInEntry>(CHECKIN_TABLE, `${userId}_${checkDate}`);
    if (entry?.data) {
      streak++;
      checkDate = getYesterday(checkDate);
    } else if (checkDate === todayStr) {
      // If not checked in today, check yesterday
      checkDate = getYesterday(checkDate);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Comprehensive mastery score:
 * - correctRate (0-50): problems correct / attempted
 * - courseProgress (0-30): scenes completed today (capped at 10)
 * - streakBonus (0-20): min(streak, 7) / 7 * 20
 */
async function calculateMasteryScore(storage: Awaited<ReturnType<typeof getServerStorage>>, userId: string): Promise<number> {
  const statsDAO = createUserStatsDAO(storage);
  const stats = await statsDAO.getOrCreate(userId);

  // Correct rate component (0-50)
  const correctRate = stats.problemsAttempted > 0
    ? (stats.problemsCorrect / stats.problemsAttempted) * 50
    : 0;

  // Course progress component (0-30), capped at 10 scenes
  const courseProgress = Math.min(stats.scenesCompleted, 10) / 10 * 30;

  // Streak bonus component (0-20), capped at 7 days
  const streakBonus = Math.min(stats.checkinStreak, 7) / 7 * 20;

  return Math.round(correctRate + courseProgress + streakBonus);
}
