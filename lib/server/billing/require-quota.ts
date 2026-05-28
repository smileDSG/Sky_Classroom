/**
 * Shared billing middleware — auth + quota check + usage recording.
 *
 * Usage:
 *   const auth = await requireQuota(req, 'generationCount');
 *   if (auth.error) return auth.error;
 *   // ... do expensive work ...
 *   await recordUsage(auth.userId, auth.planType, 'generationCount');
 */

import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth/jwt';
import { createUserDAO } from '@/lib/storage/dao/users';
import { createUsageTracker } from '@/lib/server/billing/usage-tracker';
import { getPlanLimits, type PlanType } from './plans';
import { apiError } from '@/lib/server/api-response';

/**
 * Require auth + check daily quota before expensive work.
 * Returns either the user context or a 401/429 error response.
 */
export async function requireQuota(
  metric: 'llmCalls' | 'generationCount',
): Promise<
  | { userId: string; planType: PlanType }
  | { error: ReturnType<typeof apiError> }
> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token');
  if (!accessToken) {
    return { error: apiError('UNAUTHORIZED', 401, 'Not authenticated') };
  }

  const payload = await verifyAccessToken(accessToken.value);
  if (!payload) {
    return { error: apiError('UNAUTHORIZED', 401, 'Invalid token') };
  }

  const userDao = await createUserDAO();
  const user = await userDao.getById(payload.sub);
  if (!user) {
    return { error: apiError('UNAUTHORIZED', 401, 'User not found') };
  }

  // 0 = unlimited in plan definitions
  const limits = getPlanLimits(user.planType);
  const limit = metric === 'llmCalls' ? limits.llmCallsPerDay : limits.generationsPerDay;
  if (limit === 0) {
    return { userId: user.id, planType: user.planType };
  }

  const tracker = await createUsageTracker();
  const check = await tracker.checkUsageLimit(user.id, user.planType, metric);
  if (!check.withinLimit) {
    return {
      error: apiError(
        'USAGE_LIMIT_EXCEEDED',
        429,
        `Daily ${metric === 'llmCalls' ? 'AI call' : 'generation'} limit reached. Upgrade your plan.`,
      ),
    };
  }

  return { userId: user.id, planType: user.planType };
}

/**
 * Record one unit of usage after successful work completion.
 * Safe to call — never throws; failures are silently logged.
 */
export async function recordUsage(
  userId: string,
  planType: PlanType,
  metric: 'llmCalls' | 'generationCount' | 'storageUsed',
  count = 1,
): Promise<void> {
  try {
    const tracker = await createUsageTracker();
    await tracker.increment(userId, planType, metric, count);
  } catch {
    // Non-critical — don't fail the request if usage tracking breaks
  }
}
