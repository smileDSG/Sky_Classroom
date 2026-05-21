/**
 * JWT utilities for user authentication.
 *
 * Uses jose library for Edge-compatible JWT signing/verification.
 */

import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

const secret = new TextEncoder().encode(JWT_SECRET);

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
export async function signAccessToken(user: { id: string; email?: string; role: string }): Promise<string> {
  return new SignJWT({ role: user.role, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRES_IN)
    .sign(secret);
}

/** Sign a long-lived refresh token */
export async function signRefreshToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ jti: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRES_IN)
    .sign(secret);
}

/** Verify and decode an access token */
export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      role: (payload.role as 'guest' | 'user' | 'admin') || 'user',
    };
  } catch {
    return null;
  }
}

/** Verify and decode a refresh token */
export async function verifyRefreshToken(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      jti: payload.jti as string,
    };
  } catch {
    return null;
  }
}
