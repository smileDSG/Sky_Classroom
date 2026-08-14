import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/storage/dao/users', () => ({
  createUserDAO: vi.fn(),
}));

vi.mock('@/lib/server/auth', () => ({
  hashPassword: vi.fn(),
}));

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: logError }),
}));

import { createUserDAO } from '@/lib/storage/dao/users';
import { hashPassword } from '@/lib/server/auth';
import { ensureDemoUser, isDemoAccountEnabled } from '@/lib/server/demo-user';

const mockCreateUserDAO = vi.mocked(createUserDAO);
const mockHashPassword = vi.mocked(hashPassword);

function mockDAO(existing: unknown = null) {
  const getByUsername = vi.fn().mockResolvedValue(existing);
  const create = vi.fn().mockResolvedValue({ id: 'demo-default' });
  const update = vi.fn();
  mockCreateUserDAO.mockResolvedValue({ getByUsername, create, update } as never);
  return { getByUsername, create, update };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('demo account availability', () => {
  it('is enabled outside production', () => {
    expect(isDemoAccountEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isDemoAccountEnabled({ NODE_ENV: 'test' })).toBe(true);
  });

  it('requires an explicit production opt-in', () => {
    expect(isDemoAccountEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(isDemoAccountEnabled({ NODE_ENV: 'production', ENABLE_DEMO_ACCOUNT: 'true' })).toBe(
      true,
    );
    expect(isDemoAccountEnabled({ NODE_ENV: 'production', ENABLE_DEMO_ACCOUNT: 'TRUE' })).toBe(
      false,
    );
  });
});

describe('ensureDemoUser', () => {
  it('creates a pending ordinary user with the documented credentials', async () => {
    const { getByUsername, create } = mockDAO();
    mockHashPassword.mockResolvedValue('hashed-demo-password');

    await ensureDemoUser();

    expect(getByUsername).toHaveBeenCalledWith('demo');
    expect(mockHashPassword).toHaveBeenCalledWith('SkyClassroom123!');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'demo-default',
        username: 'demo',
        passwordHash: 'hashed-demo-password',
        role: 'user',
        status: 'active',
        planType: 'free',
        learningOnboarding: null,
        emailVerified: true,
      }),
    );
  });

  it('does not create or reset an existing account', async () => {
    const existing = { id: 'existing-demo', username: 'demo', passwordHash: 'custom-hash' };
    const { create, update } = mockDAO(existing);

    await ensureDemoUser();

    expect(mockHashPassword).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not access storage when production opt-in is absent', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_DEMO_ACCOUNT', 'false');

    await ensureDemoUser();

    expect(mockCreateUserDAO).not.toHaveBeenCalled();
  });

  it('contains seed failures without throwing into login', async () => {
    mockCreateUserDAO.mockRejectedValue(new Error('storage unavailable'));

    await expect(ensureDemoUser()).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith('ensureDemoUser failed:', 'storage unavailable');
  });
});
