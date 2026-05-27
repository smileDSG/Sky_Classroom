/**
 * POST /api/beta/request
 * Submit a beta access application.
 */

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createBetaRequestDAO } from '@/lib/server/beta/dao/beta-requests';

const RequestSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  reason: z.string().max(500, '申请理由不能超过500字').optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 400, 'Invalid request', parsed.error.issues[0].message);
    }

    const { email, reason } = parsed.data;
    const dao = await createBetaRequestDAO();

    // Check for duplicate
    const existing = await dao.getByEmail(email);
    if (existing) {
      return apiError('BETA_REQUEST_DUPLICATE', 409, '你已经提交过申请，请耐心等待审核结果');
    }

    const betaRequest = await dao.create({ email, reason });

    return apiSuccess({ message: '申请已提交，我们会尽快审核', id: betaRequest.id }, 201);
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to submit application');
  }
}
