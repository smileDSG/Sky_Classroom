/**
 * GET /api/beta/status
 * Return current user's beta status.
 */

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createUserDAO } from '@/lib/storage/dao/users';

export async function GET(request: Request) {
  try {
    // Extract user ID from JWT — the middleware already validated this
    const accessToken = request.headers.get('cookie')?.match(/access_token=([^;]+)/)?.[1];
    if (!accessToken) {
      return apiError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me-in-production');
    let payload: { id?: string } = {};
    try {
      const { payload: p } = await jwtVerify(accessToken, secret);
      payload = p as { id?: string };
    } catch {
      return apiError('UNAUTHORIZED', 401, 'Invalid token');
    }

    if (!payload.id) {
      return apiError('UNAUTHORIZED', 401, 'Invalid token');
    }

    const dao = await createUserDAO();
    const user = await dao.getById(payload.id);
    if (!user) {
      return apiError('NOT_FOUND', 404, 'User not found');
    }

    return apiSuccess({
      // Use type assertion — beta_status is added by migration but not yet in User type
      status: (user as any).beta_status || 'none',
      betaInvitedBy: (user as any).beta_invited_by || null,
      betaJoinedAt: (user as any).beta_joined_at || null,
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to get beta status');
  }
}
