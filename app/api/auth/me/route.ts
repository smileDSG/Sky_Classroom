/**
 * GET /api/auth/me
 * Return current authenticated user profile.
 */

import { cookies } from 'next/headers';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { createUserDAO } from '@/lib/storage/dao/users';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');

    if (!accessToken) {
      return apiError('UNAUTHORIZED', 401, 'Not authenticated');
    }

    const payload = await verifyAccessToken(accessToken.value);
    if (!payload) {
      return apiError('UNAUTHORIZED', 401, 'Invalid or expired token');
    }

    const dao = await createUserDAO();
    const user = await dao.getById(payload.sub);
    if (!user) {
      return apiError('UNAUTHORIZED', 401, 'User not found');
    }

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        planType: user.planType,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to fetch user');
  }
}
