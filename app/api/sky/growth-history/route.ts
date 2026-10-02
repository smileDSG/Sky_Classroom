/**
 * GET /api/sky/growth-history
 *
 * 返回用户真实成长历史：掌握度曲线（GrowthSnapshot[]）+ 错题减少趋势（MistakeTrendPoint[]）。
 * 所有数值来自真实快照，无插值（R-2）。
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerGrowthHistory } from '@/lib/retention/growth-history';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:GrowthHistory');

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token');
    if (!token) return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Not authenticated');
    const payload = await verifyAccessToken(token.value);
    if (!payload) return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Invalid token');

    const history = await getServerGrowthHistory();
    const [curve, trend] = await Promise.all([
      history.getMasteryCurve(payload.sub),
      history.getMistakeTrend(payload.sub),
    ]);

    return apiSuccess({ curve, trend });
  } catch (err) {
    log.error('growth-history GET failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '查询失败');
  }
}
