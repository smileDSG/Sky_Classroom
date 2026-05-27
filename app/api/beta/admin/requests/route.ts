/**
 * GET /api/beta/admin/requests — List beta access requests
 */

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createBetaRequestDAO } from '@/lib/server/beta/dao/beta-requests';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const dao = await createBetaRequestDAO();
    const requests = await dao.list(status ? { status } : undefined);

    return apiSuccess({
      requests: requests.map((r) => ({
        id: r.id,
        email: r.email,
        reason: r.reason,
        status: r.status,
        appliedAt: r.appliedAt.toISOString(),
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to list beta requests');
  }
}
