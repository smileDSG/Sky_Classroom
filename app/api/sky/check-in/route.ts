/**
 * POST /api/sky/check-in
 *
 * Record daily check-in and return streak count.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
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

    // Check if already checked in today
    const todayEntry = await storage.get<CheckInEntry>(CHECKIN_TABLE, `${userId}_${todayStr}`);
    if (todayEntry?.data) {
      // Already checked in, return current streak
      const streak = await calculateStreak(storage, userId);
      return apiSuccess({
        checkedIn: true,
        streakDays: streak,
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

    log.info(`User ${userId} checked in, streak: ${streak}`);

    return apiSuccess({
      checkedIn: true,
      streakDays: streak,
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
