/**
 * Token generation utilities for email verification and password reset.
 */

import crypto from 'crypto';

/** Generate a secure random token for email verification */
export function generateVerifyToken(): string {
  return crypto.randomUUID();
}

/** Generate a reset token with expiry (default 1 hour) */
export function generateResetToken(): { token: string; expiry: number } {
  return {
    token: crypto.randomUUID(),
    expiry: Date.now() + 60 * 60 * 1000, // 1 hour
  };
}

/** Check if a reset token has expired */
export function isResetTokenExpired(expiry: number | null): boolean {
  if (!expiry) return true;
  return Date.now() > expiry;
}
