/**
 * GET /api/auth/me
 * Return current authenticated user profile.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/auth';
import { createUserDAO } from '@/lib/storage/dao/users';

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('access_token');

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

    if (user.status === 'suspended') {
      return apiError('ACCOUNT_SUSPENDED', 403, 'Account is suspended');
    }

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        planType: user.planType,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to fetch user');
  }
}
