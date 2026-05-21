/**
 * GET /api/usage/check
 * Return current user's usage vs limits.
 */

import { cookies } from 'next/headers';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { createUserDAO } from '@/lib/storage/dao/users';
import { createUsageTracker } from '@/lib/server/billing/usage-tracker';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    if (!accessToken) {
      return apiError('UNAUTHORIZED', 401, 'Not authenticated');
    }

    const payload = await verifyAccessToken(accessToken.value);
    if (!payload) {
      return apiError('UNAUTHORIZED', 401, 'Invalid token');
    }

    const userDao = await createUserDAO();
    const user = await userDao.getById(payload.sub);
    if (!user) {
      return apiError('UNAUTHORIZED', 401, 'User not found');
    }

    const tracker = await createUsageTracker();
    const [llmResult, genResult, dailyUsage] = await Promise.all([
      tracker.checkUsageLimit(user.id, user.planType, 'llmCalls'),
      tracker.checkUsageLimit(user.id, user.planType, 'generationCount'),
      tracker.getDailyUsage(user.id),
    ]);

    // Calculate midnight reset timestamp
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const resetAt = tomorrow.getTime();

    return apiSuccess({
      planType: user.planType,
      llmCalls: llmResult,
      generationCount: genResult,
      storageUsed: dailyUsage.storageUsed,
      resetAt,
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to fetch usage data');
  }
}
