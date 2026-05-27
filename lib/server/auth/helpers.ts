/**
 * Auth helper utilities for API routes.
 * Extracts common auth logic from individual route handlers.
 */

import { cookies } from 'next/headers';
import { verifyAccessToken, type JwtPayload } from './jwt';
import { createUserDAO, type UserEntry } from '@/lib/storage/dao/users';
import { apiError } from '@/lib/server/api-response';
import type { NextResponse } from 'next/server';

/**
 * Get the current authenticated user from the request cookies.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<UserEntry | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token');
  if (!accessToken?.value) return null;

  const payload = await verifyAccessToken(accessToken.value);
  if (!payload) return null;

  const dao = await createUserDAO();
  return dao.getById(payload.sub);
}

/**
 * Require authentication. Returns the user or an error response.
 */
export async function requireAuth(): Promise<{ user: UserEntry } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: apiError('UNAUTHORIZED', 401, 'Not authenticated') };
  }
  return { user };
}

/**
 * Get the JWT payload from the current request.
 * Returns null if not authenticated or token is invalid.
 */
export async function getJwtPayload(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token');
  if (!accessToken?.value) return null;
  return verifyAccessToken(accessToken.value);
}
