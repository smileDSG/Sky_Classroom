/**
 * POST /api/beta/admin/requests/[id]/review
 * Approve or reject a beta access request.
 */

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createBetaRequestDAO } from '@/lib/server/beta/dao/beta-requests';

const ReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = await request.json();
    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 400, 'Invalid request', parsed.error.issues[0].message);
    }

    const { id } = await params;

    // Get reviewer ID from JWT
    const cookieHeader = request.headers.get('cookie') || '';
    const accessToken = cookieHeader.match(/access_token=([^;]+)/)?.[1];
    let reviewerId = 'admin';
    if (accessToken) {
      try {
        const { jwtVerify } = await import('jose');
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me-in-production');
        const { payload } = await jwtVerify(accessToken, secret);
        reviewerId = (payload as any).id || 'admin';
      } catch {}
    }

    const dao = await createBetaRequestDAO();
    const result = await dao.review(id, parsed.data.status, reviewerId);

    return apiSuccess({
      id: result.id,
      status: result.status,
      reviewedAt: result.reviewedAt?.toISOString() ?? null,
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to review beta request');
  }
}
