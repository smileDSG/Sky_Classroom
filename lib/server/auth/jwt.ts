/**
 * JWT utilities for user authentication.
 *
 * Uses jose library for Edge-compatible JWT signing/verification.
 */

import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

/** Cookie max-age in seconds — kept in sync with token lifetimes above. */
export const ACCESS_COOKIE_MAX_AGE = 15 * 60; // 15 minutes
export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function getSecret(): Uint8Array {
  // In production a strong secret MUST be configured — otherwise anyone could
  // forge access tokens with the well-known default value.
  if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return new TextEncoder().encode(JWT_SECRET || 'change-me-in-production');
}

let secret: Uint8Array | null = null;
function secretKey(): Uint8Array {
  if (!secret) secret = getSecret();
  return secret;
}

export interface JwtPayload {
  sub: string; // user id
  email?: string;
  role: 'guest' | 'user' | 'admin';
}

export interface RefreshPayload {
  sub: string;
  jti: string; // session id
}

/** Sign a short-lived access token */
export async function signAccessToken(user: {
  id: string;
  email?: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ role: user.role, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRES_IN)
    .sign(secretKey());
}

/** Sign a long-lived refresh token */
export async function signRefreshToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ jti: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRES_IN)
    .sign(secretKey());
}

/** Verify and decode an access token */
export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      // A token without a role claim is treated as the least-privileged role.
      role: (payload.role as 'guest' | 'user' | 'admin') || 'guest',
    };
  } catch {
    return null;
  }
}

/** Verify and decode a refresh token */
export async function verifyRefreshToken(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      sub: payload.sub as string,
      jti: payload.jti as string,
    };
  } catch {
    return null;
  }
}
