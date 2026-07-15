import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { UserEntry } from '@/lib/storage/dao/users';

const mocks = vi.hoisted(() => ({
  createUserDAO: vi.fn(),
  hashPassword: vi.fn(),
  sendVerificationEmail: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
}));

vi.mock('@/lib/storage/dao/users', () => ({
  createUserDAO: mocks.createUserDAO,
}));

vi.mock('@/lib/server/auth', () => ({
  hashPassword: mocks.hashPassword,
  signAccessToken: mocks.signAccessToken,
  signRefreshToken: mocks.signRefreshToken,
}));

vi.mock('@/lib/server/auth/tokens', () => ({
  generateVerifyToken: () => 'verify-token',
}));

vi.mock('@/lib/server/email', () => ({
  sendVerificationEmail: mocks.sendVerificationEmail,
}));

function getSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const separateHeaders = headers.getSetCookie?.();
  if (separateHeaders && separateHeaders.length > 0) return separateHeaders;

  const combined = response.headers.get('set-cookie');
  return combined ? combined.split(/,\s*(?=[^;]+=)/) : [];
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');

    const dao = {
      getByEmail: vi.fn().mockResolvedValue(null),
      getByUsername: vi.fn().mockResolvedValue(null),
      create: vi.fn(
        async (
          user: Omit<UserEntry, 'createdAt' | 'updatedAt' | 'lastLoginAt'>,
        ): Promise<UserEntry> => ({
          ...user,
          createdAt: 1,
          updatedAt: 1,
          lastLoginAt: null,
        }),
      ),
    };

    mocks.createUserDAO.mockResolvedValue(dao);
    mocks.hashPassword.mockResolvedValue('hashed-password');
    mocks.signAccessToken.mockResolvedValue('access-token');
    mocks.signRefreshToken.mockResolvedValue('refresh-token');
    mocks.sendVerificationEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('sets separate secure auth cookies in production', async () => {
    const { POST } = await import('@/app/api/auth/register/route');

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'student@example.com',
          username: 'student01',
          password: 'strong-password',
        }),
      }),
    );

    expect(response.status).toBe(201);
    const cookies = getSetCookieHeaders(response);
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain('access_token=access-token');
    expect(cookies[0]).toContain('Secure');
    expect(cookies[1]).toContain('refresh_token=refresh-token');
    expect(cookies[1]).toContain('Secure');
  });
});
