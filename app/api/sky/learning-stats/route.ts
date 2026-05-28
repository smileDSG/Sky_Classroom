/**
 * GET /api/sky/learning-stats
 *
 * Returns aggregated learning metrics:
 *  - todayStudyMinutes: estimated study time today (based on mistake count × ~3 min)
 *  - streakDays: consecutive days with at least one mistake
 *  - masteryPercent: average mastery level across all mistakes (0-100)
 *  - checkedInToday: whether user has checked in today
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO, EBBINGHAUS_INTERVALS } from '@/lib/storage/dao/mistakes';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { StorageEntry } from '@/lib/storage/storage-types';
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

/**
 * Extract the creation timestamp from a storage-wrapped mistake entry.
 * The DAO wraps MistakeBookEntry in StorageEntry which carries createdAt.
 */
function getCreatedAt(entry: StorageEntry<MistakeBookEntry>): number {
  return entry.createdAt ?? 0;
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
    const dao = createMistakeBookDAO(storage);

    // Fetch all mistakes
    const result = await dao.list({ pageSize: 9999 });
    const entries = result.items as unknown as StorageEntry<MistakeBookEntry>[];

    // If the result is plain MistakeBookEntry[] (no wrapper), fall back gracefully
    const isWrapped = entries.length > 0 && 'createdAt' in (entries[0] as unknown as Record<string, unknown>);

    const mistakes: MistakeBookEntry[] = isWrapped
      ? entries.map((e: StorageEntry<MistakeBookEntry>) => e.data)
      : (entries as unknown as MistakeBookEntry[]);

    const timestamps: number[] = isWrapped
      ? entries.map((e: StorageEntry<MistakeBookEntry>) => getCreatedAt(e))
      : mistakes.map(() => Date.now()); // fallback: no timestamp available

    // ── Today study minutes ──
    // Estimate from number of mistakes today × average solve time (~3 min each)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const todayCount = timestamps.filter((ts) => ts >= todayStartMs).length;
    const todayStudyMinutes = Math.round(todayCount * 3 * 10) / 10;

    // ── Streak days (from check-in records) ──
    let streakDays = 0;
    if (userId) {
      const todayStr = today();
      let checkDate = todayStr;
      for (let i = 0; i < 365; i++) {
        const entry = await storage.get<CheckInEntry>(CHECKIN_TABLE, `${userId}_${checkDate}`);
        if (entry?.data) {
          streakDays++;
          const d = new Date(checkDate);
          d.setDate(d.getDate() - 1);
          checkDate = d.toISOString().split('T')[0];
        } else if (checkDate === todayStr) {
          // Today not checked in yet, check yesterday
          const d = new Date(checkDate);
          d.setDate(d.getDate() - 1);
          checkDate = d.toISOString().split('T')[0];
        } else {
          break;
        }
      }
    }

    // ── Mastery percent ──
    // Average masteryLevel (0..6) mapped to 0..100
    let masteryPercent = 0;
    if (mistakes.length > 0) {
      const avgLevel = mistakes.reduce((sum, m) => sum + m.masteryLevel, 0) / mistakes.length;
      masteryPercent = Math.round((avgLevel / EBBINGHAUS_INTERVALS.length) * 100);
    }

    // ── Checked in today ──
    let checkedInToday = false;
    if (userId) {
      const todayStr = getTodayStr();
      const checkInEntry = await storage.get<CheckInEntry>(CHECKIN_TABLE, `${userId}_${todayStr}`);
      checkedInToday = !!checkInEntry?.data;
    }

    return apiSuccess({
      todayStudyMinutes,
      streakDays,
      masteryPercent,
      checkedInToday,
      todayMistakeCount: todayCount,
      totalMistakes: mistakes.length,
    });
  } catch (err) {
    log.error('Learning stats error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '学习统计查询失败');
  }
}
