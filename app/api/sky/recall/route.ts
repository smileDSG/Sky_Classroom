/**
 * GET /api/sky/recall
 *
 * 召回钩子决策（T05 / FR-12）。**只读、不推送**：
 * 客户端进入应用时调用一次，服务端只回答"今天该不该提醒、为什么"。
 * 是否已提醒过由客户端在 localStorage 记（lastNotifiedDate），
 * 这样服务端保持无状态，也避免额外的写表。
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { LearningStreakService } from '@/lib/retention/streak';
import { evaluateRecall, describeRecall, AUTO_SILENCE_DAYS } from '@/lib/retention/recall-hook';
import { toLocalDateStr } from '@/lib/retention/date';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:Recall');

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token');
    if (!token) return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Not authenticated');
    const payload = await verifyAccessToken(token.value);
    if (!payload) return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Invalid token');

    const url = new URL(req.url);
    // 客户端把自己的偏好传上来（enabled 默认 true；lastNotifiedDate 默认空=从未提醒）
    const enabledParam = url.searchParams.get('enabled');
    const lastNotifiedDate = url.searchParams.get('lastNotifiedDate') ?? '';

    const today = toLocalDateStr();
    const storage = await getServerStorage();
    const service = new LearningStreakService(storage);
    const streak = await service.getStreak(payload.sub);

    const decision = evaluateRecall(
      streak,
      {
        enabled: enabledParam !== 'false',
        lastNotifiedDate,
      },
      today,
    );

    return apiSuccess({
      decision,
      // 附带一句人话理由，便于界面直接显示而不用再写映射
      reasonText: describeRecall(decision.reason),
      streak,
      today,
      autoSilenceDays: AUTO_SILENCE_DAYS,
    });
  } catch (err) {
    log.error('recall GET failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '查询失败');
  }
}
