/**
 * Tests for lib/server/auth/helpers.ts
 *
 * These are integration-style tests that verify behavior through public interfaces.
 * We mock the cookie store and JWT verification to test the auth helper logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers cookies()
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// Mock the JWT module
vi.mock('@/lib/server/auth/jwt', () => ({
  verifyAccessToken: vi.fn(),
}));

// Mock the users DAO
vi.mock('@/lib/storage/dao/users', () => ({
  createUserDAO: vi.fn(),
}));

import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth/jwt';
import { createUserDAO } from '@/lib/storage/dao/users';
import { getCurrentUser, requireAuth } from '@/lib/server/auth/helpers';

const mockCookies = vi.mocked(cookies);
const mockVerify = vi.mocked(verifyAccessToken);
const mockCreateDAO = vi.mocked(createUserDAO);

const fakeUser = {
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: 'hash',
  role: 'user' as const,
  status: 'active' as const,
  guestId: null,
  planType: 'free' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastLoginAt: null,
  avatar: null,
  nickname: null,
  bio: null,
  emailVerified: true,
  emailVerifyToken: null,
  resetToken: null,
  resetTokenExpiry: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCurrentUser', () => {
  it('returns null when no access_token cookie exists', async () => {
    mockCookies.mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it('returns null when token verification fails', async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ name: 'access_token', value: 'bad-token' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    mockVerify.mockResolvedValue(null);

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it('returns the user when token is valid', async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ name: 'access_token', value: 'valid-token' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    mockVerify.mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'user',
    });
    mockCreateDAO.mockResolvedValue({
      getById: vi.fn().mockResolvedValue(fakeUser),
    } as unknown as Awaited<ReturnType<typeof createUserDAO>>);

    const user = await getCurrentUser();
    expect(user).toEqual(fakeUser);
  });
});

describe('requireAuth', () => {
  it('returns error response when not authenticated', async () => {
    mockCookies.mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await requireAuth();
    expect(result).toHaveProperty('error');
    expect(result).not.toHaveProperty('user');
  });

  it('returns user when authenticated', async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ name: 'access_token', value: 'valid-token' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    mockVerify.mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'user',
    });
    mockCreateDAO.mockResolvedValue({
      getById: vi.fn().mockResolvedValue(fakeUser),
    } as unknown as Awaited<ReturnType<typeof createUserDAO>>);

    const result = await requireAuth();
    expect(result).toHaveProperty('user', fakeUser);
    expect(result).not.toHaveProperty('error');
  });
});
