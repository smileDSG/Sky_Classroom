/**
 * POST /api/billing/webhook/mock
 * Simulate payment completion for testing.
 * ?orderId=xxx
 */

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createBillingDAO } from '@/lib/storage/dao/billing';
import { createUserDAO } from '@/lib/storage/dao/users';
import type { PlanType } from '@/lib/server/billing/plans';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return apiError('NOT_FOUND', 404, 'Not found');
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId');

  if (!orderId) {
    return apiError('INVALID_REQUEST', 400, 'Missing orderId');
  }

  try {
    const dao = await createBillingDAO();
    const order = await dao.getById(orderId);
    if (!order) {
      return apiError('ORDER_NOT_FOUND', 404, 'Order not found');
    }

    // Simulate payment success
    const updated = await dao.update(orderId, {
      status: 'paid',
      paidAt: Date.now(),
    });

    if (!updated) {
      return apiError('PAYMENT_FAILED', 502, 'Failed to update order');
    }

    // Upgrade user's plan
    const userDao = await createUserDAO();
    await userDao.update(order.userId, { planType: order.planType as PlanType });

    return apiSuccess({ orderId, status: 'paid', planType: order.planType });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Webhook processing failed');
  }
}

/** GET for testing: simulate payment success */
export async function GET(request: Request) {
  return POST(request);
}
