/**
 * POST /api/auth/refresh
 * Refresh access token using a valid refresh token.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api-response';
import { signAccessToken, verifyRefreshToken } from '@/lib/server/auth';
import { createUserDAO } from '@/lib/storage/dao/users';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token');

    if (!refreshToken) {
      return apiError('UNAUTHORIZED', 401, 'No refresh token');
    }

    const payload = await verifyRefreshToken(refreshToken.value);
    if (!payload) {
      return apiError('UNAUTHORIZED', 401, 'Invalid or expired refresh token');
    }

    const dao = await createUserDAO();
    const user = await dao.getById(payload.sub);
    if (!user) {
      return apiError('UNAUTHORIZED', 401, 'User not found');
    }

    if (user.status === 'suspended') {
      return apiError('ACCOUNT_SUSPENDED', 403, 'Account is suspended');
    }

    const newAccessToken = await signAccessToken({ id: user.id, email: user.email ?? undefined, role: user.role });

    const response = NextResponse.json({ success: true });
    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60,
    });
    return response;
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Token refresh failed');
  }
}
