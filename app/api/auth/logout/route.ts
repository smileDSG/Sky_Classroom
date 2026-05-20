/**
 * POST /api/auth/logout
 * Clear auth cookies and invalidate sessions.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRefreshToken } from '@/lib/server/auth';
import { createSessionDAO } from '@/lib/storage/dao/sessions';

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token');

  // Invalidate session if refresh token exists
  if (refreshToken) {
    try {
      const payload = await verifyRefreshToken(refreshToken.value);
      if (payload) {
        const dao = await createSessionDAO();
        await dao.delete(payload.jti);
      }
    } catch {
      // Token invalid, just clear cookies
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('access_token', '', { maxAge: 0, path: '/' });
  response.cookies.set('refresh_token', '', { maxAge: 0, path: '/' });

  return response;
}
