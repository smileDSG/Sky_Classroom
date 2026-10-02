/**
 * POST/GET /api/sky/learning-streak
 *
 * 学习证据写入点的连续天数触发 + 查询（T01 / FR-03）。
 * POST 记录当日活跃（幂等）并顺带写入真实成长快照；GET 返回 StreakState。
 * 鉴权复用 /api/sky/check-in 的同款 access_token 校验。
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { LearningStreakService } from '@/lib/retention/streak';
import { getServerGrowthHistory, computeSnapshotFromMistakes } from '@/lib/retention/growth-history';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:LearningStreak');

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token');
    if (!token) return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Not authenticated');
    const payload = await verifyAccessToken(token.value);
    if (!payload) return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Invalid token');

    const userId = payload.sub;
    const storage = await getServerStorage();
    const service = new LearningStreakService(storage);
    const streak = await service.recordActivity(userId);

    // 顺带记录当日真实成长快照（无插值）；失败不影响连续天数主流程
    try {
      const history = await getServerGrowthHistory();
      const snap = await computeSnapshotFromMistakes(userId, storage);
      await history.recordSnapshot(userId, snap);
    } catch (err) {
      log.warn('growth snapshot skipped:', err instanceof Error ? err.message : err);
    }

    return apiSuccess({ streak });
  } catch (err) {
    log.error('learning-streak POST failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '记录失败');
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token');
    if (!token) return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Not authenticated');
    const payload = await verifyAccessToken(token.value);
    if (!payload) return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Invalid token');

    const storage = await getServerStorage();
    const service = new LearningStreakService(storage);
    const streak = await service.getStreak(payload.sub);

    return apiSuccess({ streak });
  } catch (err) {
    log.error('learning-streak GET failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '查询失败');
  }
}
