import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/admin-seed', () => ({
  ensureAdminUser: vi.fn(),
}));

vi.mock('@/lib/server/demo-user', () => ({
  ensureDemoUser: vi.fn(),
  isDemoAccountEnabled: vi.fn(),
}));

vi.mock('@/lib/storage/dao/users', () => ({
  createUserDAO: vi.fn(),
}));

vi.mock('@/lib/server/auth', () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyPassword: vi.fn(),
}));

import { GET } from '@/app/api/auth/demo-account/route';
import { POST } from '@/app/api/auth/login/route';
import { ensureAdminUser } from '@/lib/server/admin-seed';
import { ensureDemoUser, isDemoAccountEnabled } from '@/lib/server/demo-user';
import { createUserDAO } from '@/lib/storage/dao/users';
import { signAccessToken, signRefreshToken, verifyPassword } from '@/lib/server/auth';

const mockEnsureAdminUser = vi.mocked(ensureAdminUser);
const mockEnsureDemoUser = vi.mocked(ensureDemoUser);
const mockIsDemoAccountEnabled = vi.mocked(isDemoAccountEnabled);
const mockCreateUserDAO = vi.mocked(createUserDAO);
const mockSignAccessToken = vi.mocked(signAccessToken);
const mockSignRefreshToken = vi.mocked(signRefreshToken);
const mockVerifyPassword = vi.mocked(verifyPassword);

function loginRequest(emailOrUsername: string, password = 'SkyClassroom123!') {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername, password }),
  });
}

function mockLoginUser(username = 'demo') {
  const user = {
    id: `${username}-id`,
    email: null,
    username,
    passwordHash: 'hashed-password',
    role: 'user' as const,
    status: 'active' as const,
  };
  const getByEmail = vi.fn().mockResolvedValue(null);
  const getByUsername = vi.fn().mockResolvedValue(user);
  const update = vi.fn().mockResolvedValue(user);
  mockCreateUserDAO.mockResolvedValue({ getByEmail, getByUsername, update } as never);
  return { getByEmail, getByUsername, update };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsureAdminUser.mockResolvedValue();
  mockEnsureDemoUser.mockResolvedValue();
  mockIsDemoAccountEnabled.mockReturnValue(true);
  mockVerifyPassword.mockResolvedValue(true);
  mockSignAccessToken.mockResolvedValue('access-token');
  mockSignRefreshToken.mockResolvedValue('refresh-token');
  mockLoginUser();
});

describe('GET /api/auth/demo-account', () => {
  it('reports server-side demo account availability', async () => {
    expect(await (await GET()).json()).toEqual({ enabled: true });

    mockIsDemoAccountEnabled.mockReturnValue(false);
    expect(await (await GET()).json()).toEqual({ enabled: false });
  });
});

describe('POST /api/auth/login demo seeding', () => {
  it('seeds before looking up an attempted demo login', async () => {
    const { getByUsername } = mockLoginUser('demo');

    const response = await POST(loginRequest('demo'));

    expect(response.status).toBe(200);
    expect(mockEnsureDemoUser).toHaveBeenCalledTimes(1);
    expect(getByUsername).toHaveBeenCalledWith('demo');
  });

  it('does not seed the demo account for other login attempts', async () => {
    mockLoginUser('alice');

    const response = await POST(loginRequest('alice', 'password123'));

    expect(response.status).toBe(200);
    expect(mockEnsureDemoUser).not.toHaveBeenCalled();
    expect(mockEnsureAdminUser).toHaveBeenCalledTimes(1);
  });
});
