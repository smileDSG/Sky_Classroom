/**
 * POST /api/billing/orders
 * Create a new payment order.
 *
 * GET /api/billing/orders
 * List user's orders.
 */

import { cookies } from 'next/headers';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { createUserDAO } from '@/lib/storage/dao/users';
import { createBillingDAO } from '@/lib/storage/dao/billing';
import { PLANS, type PlanType } from '@/lib/server/billing/plans';

const PAYMENT_METHODS = new Set(['mock', 'wechat', 'alipay', 'card']);

export async function POST(request: Request) {
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

    const body = await request.json();
    const planType = body.planType as PlanType;
    if (!PLANS[planType]) {
      return apiError('INVALID_REQUEST', 400, 'Invalid plan type');
    }

    const userDao = await createUserDAO();
    const user = await userDao.getById(payload.sub);
    if (!user) {
      return apiError('UNAUTHORIZED', 401, 'User not found');
    }

    const plan = PLANS[planType];
    const requestedMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : 'mock';
    const paymentMethod = PAYMENT_METHODS.has(requestedMethod) ? requestedMethod : 'mock';
    const dao = await createBillingDAO();
    const orderId = crypto.randomUUID();
    const outTradeNo = `MAIC${Date.now()}${orderId.slice(0, 8).toUpperCase()}`;

    await dao.create({
      id: orderId,
      userId: user.id,
      planType,
      amount: plan.price,
      currency: 'CNY',
      status: 'pending',
      paymentMethod,
      outTradeNo,
    });

    return apiSuccess({
      orderId,
      outTradeNo,
      amount: plan.price,
      currency: 'CNY',
      planName: plan.name,
      status: 'pending',
      // Mock payment URL for testing
      mockPayUrl: `/api/billing/webhook/mock?orderId=${orderId}`,
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to create order');
  }
}

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

    const dao = await createBillingDAO();
    const orders = await dao.getByUserId(payload.sub);

    return apiSuccess({
      orders: orders.map((o) => ({
        id: o.id,
        planType: o.planType,
        amount: o.amount,
        status: o.status,
        createdAt: o.createdAt,
        paymentMethod: o.paymentMethod,
      })),
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to fetch orders');
  }
}
