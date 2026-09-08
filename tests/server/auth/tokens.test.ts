/**
 * Tests for lib/server/auth/tokens.ts
 */

import { describe, it, expect } from 'vitest';
import {
  generateVerifyToken,
  generateResetToken,
  isResetTokenExpired,
} from '@/lib/server/auth/tokens';

describe('generateVerifyToken', () => {
  it('returns a valid UUID string', () => {
    const token = generateVerifyToken();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('returns unique tokens on each call', () => {
    const t1 = generateVerifyToken();
    const t2 = generateResetToken().token;
    expect(t1).not.toBe(t2);
  });
});

describe('generateResetToken', () => {
  it('returns an object with token and expiry', () => {
    const result = generateResetToken();
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('expiry');
  });

  it('token is a valid UUID', () => {
    const { token } = generateResetToken();
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('expiry is approximately 1 hour from now', () => {
    const before = Date.now() + 60 * 60 * 1000;
    const { expiry } = generateResetToken();
    const after = Date.now() + 60 * 60 * 1000;
    expect(expiry).toBeGreaterThanOrEqual(before - 1000);
    expect(expiry).toBeLessThanOrEqual(after + 1000);
  });
});

describe('isResetTokenExpired', () => {
  it('returns true when expiry is null', () => {
    expect(isResetTokenExpired(null)).toBe(true);
  });

  it('returns true when expiry is in the past', () => {
    expect(isResetTokenExpired(Date.now() - 1000)).toBe(true);
  });

  it('returns false when expiry is in the future', () => {
    expect(isResetTokenExpired(Date.now() + 60_000)).toBe(false);
  });
});
