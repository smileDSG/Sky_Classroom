/**
 * Billing system tests — require-quota middleware, usage tracker, and plan definitions.
 *
 * Tests cover:
 * - Auth extraction + quota check + usage recording
 * - Unlimited plan bypass (0 = unlimited)
 * - 429 error when daily limit exceeded
 * - Plan definitions and limit calculation
 * - Usage tracker increment / reset
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock next/headers cookies() ───
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// ─── Mock JWT ───
vi.mock('@/lib/server/auth/jwt', () => ({
  verifyAccessToken: vi.fn(),
}));

// ─── Mock User DAO ───
vi.mock('@/lib/storage/dao/users', () => ({
  createUserDAO: vi.fn(),
}));

// ─── Mock server storage used by quota and usage tracker ───
vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(),
}));

// ─── Mock next/server for apiError → NextResponse.json ───
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: Record<string, unknown>, init?: { status?: number }) => ({
      __isMock: true,
      body,
      status: init?.status ?? 200,
    }),
  },
}));

import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth/jwt';
import { createUserDAO } from '@/lib/storage/dao/users';
import { getServerStorage } from '@/lib/server/server-storage';
import { PLANS, getPlanLimits } from '@/lib/server/billing/plans';
import type { PlanType } from '@/lib/server/billing/plans';
import type { StorageProvider } from '@/lib/storage/storage-types';

const mockCookies = vi.mocked(cookies);
const mockVerify = vi.mocked(verifyAccessToken);
const mockCreateDAO = vi.mocked(createUserDAO);
const mockGetServerStorage = vi.mocked(getServerStorage);

const fakeUser = (planType: PlanType) => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: 'hash',
  role: 'user' as const,
  status: 'active' as const,
  guestId: null,
  planType,
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
});

function mockAuth(planType: PlanType = 'free') {
  mockCookies.mockResolvedValue({
    get: () => ({ name: 'access_token', value: 'valid-token' }),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
  mockVerify.mockResolvedValue({
    sub: 'user-123',
    email: 'test@example.com',
    role: 'user',
  });
  mockCreateDAO.mockResolvedValue({
    getById: vi.fn().mockResolvedValue(fakeUser(planType)),
  } as unknown as Awaited<ReturnType<typeof createUserDAO>>);
}

/** Build an in-memory StorageProvider for testing the usage tracker */
function makeMemoryStorage(initialData: Record<string, Record<string, unknown>> = {}): StorageProvider {
  const store = new Map<string, Record<string, unknown>>();
  for (const [key, value] of Object.entries(initialData)) {
    store.set(key, value);
  }

  return {
    isAvailable: async () => true,
    set: async (_table: string, entry: { id: string; data: Record<string, unknown>; createdAt: number; updatedAt: number }) => {
      store.set(entry.id, entry.data);
    },
    get: async <T>(_table: string, id: string): Promise<{ id: string; data: T; createdAt: number; updatedAt: number } | null> => {
      const data = store.get(id);
      return data ? { id, data: data as T, createdAt: Date.now(), updatedAt: Date.now() } : null;
    },
    getAll: async <T>(_table: string): Promise<{ id: string; data: T; createdAt: number; updatedAt: number }[]> => {
      return Array.from(store.entries()).map(([id, data]) => ({
        id,
        data: data as T,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    },
    delete: async (_table: string, id: string): Promise<boolean> => store.delete(id),
    clear: async (_table: string): Promise<void> => { store.clear(); },
    count: async (_table: string): Promise<number> => store.size,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// ─── Plan Definitions ───

describe('PLANS — plan definitions', () => {
  it('has all four plan tiers', () => {
    expect(PLANS.free).toBeDefined();
    expect(PLANS.basic).toBeDefined();
    expect(PLANS.pro).toBeDefined();
    expect(PLANS.enterprise).toBeDefined();
  });

  it('free plan has daily limits', () => {
    expect(PLANS.free.llmCallsPerDay).toBe(100);
    expect(PLANS.free.generationsPerDay).toBe(5);
    expect(PLANS.free.storageLimit).toBe(1_073_741_824); // 1 GB
    expect(PLANS.free.price).toBe(0);
  });

  it('basic plan has higher limits and costs 29 CNY', () => {
    expect(PLANS.basic.llmCallsPerDay).toBe(500);
    expect(PLANS.basic.generationsPerDay).toBe(20);
    expect(PLANS.basic.storageLimit).toBe(10_737_418_240); // 10 GB
    expect(PLANS.basic.price).toBe(29);
  });

  it('pro plan has unlimited LLM calls', () => {
    expect(PLANS.pro.llmCallsPerDay).toBe(0); // 0 = unlimited
    expect(PLANS.pro.generationsPerDay).toBe(100);
    expect(PLANS.pro.price).toBe(99);
  });

  it('enterprise plan is fully unlimited', () => {
    expect(PLANS.enterprise.llmCallsPerDay).toBe(0);
    expect(PLANS.enterprise.generationsPerDay).toBe(0);
    expect(PLANS.enterprise.storageLimit).toBe(0);
    expect(PLANS.enterprise.price).toBe(299);
  });

  it('enterprise includes all pro features', () => {
    expect(PLANS.enterprise.features).toContain('包含专业版全部功能');
    expect(PLANS.enterprise.features).toContain('全部不限量');
    expect(PLANS.enterprise.features).toContain('专属客服支持');
    expect(PLANS.enterprise.features).toContain('自定义集成');
  });
});

describe('getPlanLimits', () => {
  it('returns correct limits for free plan', () => {
    const limits = getPlanLimits('free');
    expect(limits.llmCallsPerDay).toBe(100);
    expect(limits.generationsPerDay).toBe(5);
    expect(limits.storageLimit).toBe(1_073_741_824);
  });

  it('returns correct limits for basic plan', () => {
    const limits = getPlanLimits('basic');
    expect(limits.llmCallsPerDay).toBe(500);
    expect(limits.generationsPerDay).toBe(20);
    expect(limits.storageLimit).toBe(10_737_418_240);
  });

  it('returns zero (unlimited) for enterprise plan', () => {
    const limits = getPlanLimits('enterprise');
    expect(limits.llmCallsPerDay).toBe(0);
    expect(limits.generationsPerDay).toBe(0);
    expect(limits.storageLimit).toBe(0);
  });
});

// ─── Usage Tracker ───

describe('createUsageTracker', () => {
  it('increments LLM call counter', async () => {
    const provider = makeMemoryStorage();
    const { createUsageTracker } = await import('@/lib/server/billing/usage-tracker');
    const tracker = await createUsageTracker(provider as unknown as StorageProvider);

    const today = new Date().toISOString().split('T')[0];

    await tracker.increment('u1', 'free', 'llmCalls');
    await tracker.increment('u1', 'free', 'llmCalls');

    const usage = await tracker.getDailyUsage('u1');
    expect(usage.userId).toBe('u1');
    expect(usage.llmCalls).toBe(2);
    expect(usage.date).toBe(today);
  });

  it('increments generation counter separately from LLM calls', async () => {
    const provider = makeMemoryStorage();
    const { createUsageTracker } = await import('@/lib/server/billing/usage-tracker');
    const tracker = await createUsageTracker(provider as unknown as StorageProvider);

    await tracker.increment('u2', 'free', 'llmCalls', 10);
    await tracker.increment('u2', 'free', 'generationCount', 3);

    const usage = await tracker.getDailyUsage('u2');
    expect(usage.llmCalls).toBe(10);
    expect(usage.generationCount).toBe(3);
  });

  it('tracks storage usage', async () => {
    const provider = makeMemoryStorage();
    const { createUsageTracker } = await import('@/lib/server/billing/usage-tracker');
    const tracker = await createUsageTracker(provider as unknown as StorageProvider);

    await tracker.increment('u3', 'free', 'storageUsed', 5_000_000);
    await tracker.increment('u3', 'free', 'storageUsed', 3_000_000);

    const usage = await tracker.getDailyUsage('u3');
    expect(usage.storageUsed).toBe(8_000_000);
  });

  it('returns withinLimit=true when under limit', async () => {
    const provider = makeMemoryStorage();
    const { createUsageTracker } = await import('@/lib/server/billing/usage-tracker');
    const tracker = await createUsageTracker(provider as unknown as StorageProvider);

    await tracker.increment('u4', 'free', 'generationCount', 3);

    const result = await tracker.checkUsageLimit('u4', 'free', 'generationCount');
    expect(result.withinLimit).toBe(true);
    expect(result.current).toBe(3);
    expect(result.limit).toBe(5);
  });

  it('returns withinLimit=false when limit reached', async () => {
    const provider = makeMemoryStorage();
    const { createUsageTracker } = await import('@/lib/server/billing/usage-tracker');
    const tracker = await createUsageTracker(provider as unknown as StorageProvider);

    await tracker.increment('u5', 'free', 'generationCount', 5);

    const result = await tracker.checkUsageLimit('u5', 'free', 'generationCount');
    expect(result.withinLimit).toBe(false);
    expect(result.current).toBe(5);
    expect(result.limit).toBe(5);
  });

  it('returns withinLimit=true always for unlimited plans (0 = unlimited)', async () => {
    const provider = makeMemoryStorage();
    const { createUsageTracker } = await import('@/lib/server/billing/usage-tracker');
    const tracker = await createUsageTracker(provider as unknown as StorageProvider);

    await tracker.increment('u6', 'enterprise', 'generationCount', 9999);

    const result = await tracker.checkUsageLimit('u6', 'enterprise', 'generationCount');
    expect(result.withinLimit).toBe(true);
    expect(result.limit).toBe(0);
  });

  it('resets usage for a user', async () => {
    const provider = makeMemoryStorage();
    const { createUsageTracker } = await import('@/lib/server/billing/usage-tracker');
    const tracker = await createUsageTracker(provider as unknown as StorageProvider);

    await tracker.increment('u7', 'free', 'llmCalls', 50);
    expect((await tracker.getDailyUsage('u7')).llmCalls).toBe(50);

    await tracker.resetUsage('u7');
    const after = await tracker.getDailyUsage('u7');
    expect(after.llmCalls).toBe(0);
    expect(after.generationCount).toBe(0);
  });
});

// ─── requireQuota Middleware ───

describe('requireQuota', () => {
  it('returns error when no access token', async () => {
    mockCookies.mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const { requireQuota } = await import('@/lib/server/billing/require-quota');
    const result = await requireQuota('generationCount');

    expect(result).toHaveProperty('error');
    const errBody = (result as { error: { __isMock: true; body: { errorCode: string }; status: number } }).error;
    expect(errBody.body.errorCode).toBe('UNAUTHORIZED');
    expect(errBody.status).toBe(401);
  });

  it('returns error when token verification fails', async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ name: 'access_token', value: 'bad-token' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    mockVerify.mockResolvedValue(null);

    const { requireQuota } = await import('@/lib/server/billing/require-quota');
    const result = await requireQuota('generationCount');

    expect(result).toHaveProperty('error');
    const errBody = (result as { error: { __isMock: true; body: { errorCode: string }; status: number } }).error;
    expect(errBody.body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns error when user not found', async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ name: 'access_token', value: 'valid-token' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    mockVerify.mockResolvedValue({ sub: 'ghost', email: '', role: 'user' });
    mockCreateDAO.mockResolvedValue({
      getById: vi.fn().mockResolvedValue(null),
    } as unknown as Awaited<ReturnType<typeof createUserDAO>>);

    const { requireQuota } = await import('@/lib/server/billing/require-quota');
    const result = await requireQuota('generationCount');

    expect(result).toHaveProperty('error');
    const errBody = (result as { error: { __isMock: true; body: { errorCode: string }; status: number } }).error;
    expect(errBody.body.errorCode).toBe('UNAUTHORIZED');
  });

  it('bypasses limit check for enterprise (unlimited)', async () => {
    mockAuth('enterprise');

    const { requireQuota } = await import('@/lib/server/billing/require-quota');
    const result = await requireQuota('generationCount');

    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('userId', 'user-123');
    expect(result).toHaveProperty('planType', 'enterprise');
  });

  it('bypasses limit check for pro LLM calls (unlimited)', async () => {
    mockAuth('pro');

    const { requireQuota } = await import('@/lib/server/billing/require-quota');
    const result = await requireQuota('llmCalls');

    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('userId', 'user-123');
    expect(result).toHaveProperty('planType', 'pro');
  });

  it('passes when free user is under limit', async () => {
    mockAuth('free');
    mockGetServerStorage.mockResolvedValue(makeMemoryStorage() as unknown as StorageProvider);

    const { requireQuota } = await import('@/lib/server/billing/require-quota');
    const result = await requireQuota('generationCount');

    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('userId', 'user-123');
  });

  it('returns 429 when free user exceeds generation limit', async () => {
    mockAuth('free');
    const today = new Date().toISOString().split('T')[0];
    const provider = makeMemoryStorage({
      [`user-123_${today}`]: {
        id: `user-123_${today}`,
        userId: 'user-123',
        date: today,
        llmCalls: 50,
        generationCount: 5,
        storageUsed: 0,
      },
    });
    mockGetServerStorage.mockResolvedValue(provider as unknown as StorageProvider);

    const { requireQuota } = await import('@/lib/server/billing/require-quota');
    const result = await requireQuota('generationCount');

    expect(result).toHaveProperty('error');
    const errBody = (result as { error: { __isMock: true; body: { errorCode: string }; status: number } }).error;
    expect(errBody.body.errorCode).toBe('USAGE_LIMIT_EXCEEDED');
    expect(errBody.status).toBe(429);
  });

  it('returns 429 when free user exceeds LLM call limit', async () => {
    mockAuth('free');
    const today = new Date().toISOString().split('T')[0];
    const provider = makeMemoryStorage({
      [`user-123_${today}`]: {
        id: `user-123_${today}`,
        userId: 'user-123',
        date: today,
        llmCalls: 100,
        generationCount: 2,
        storageUsed: 0,
      },
    });
    mockGetServerStorage.mockResolvedValue(provider as unknown as StorageProvider);

    const { requireQuota } = await import('@/lib/server/billing/require-quota');
    const result = await requireQuota('llmCalls');

    expect(result).toHaveProperty('error');
    const errBody = (result as { error: { __isMock: true; body: { errorCode: string }; status: number } }).error;
    expect(errBody.body.errorCode).toBe('USAGE_LIMIT_EXCEEDED');
    expect(errBody.status).toBe(429);
  });

  it('passes for basic user with 400 LLM calls (limit is 500)', async () => {
    mockAuth('basic');
    const today = new Date().toISOString().split('T')[0];
    const provider = makeMemoryStorage({
      [`user-123_${today}`]: {
        id: `user-123_${today}`,
        userId: 'user-123',
        date: today,
        llmCalls: 400,
        generationCount: 10,
        storageUsed: 0,
      },
    });
    mockGetServerStorage.mockResolvedValue(provider as unknown as StorageProvider);

    const { requireQuota } = await import('@/lib/server/billing/require-quota');
    const result = await requireQuota('llmCalls');

    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('userId', 'user-123');
  });
});

// ─── recordUsage ───

describe('recordUsage', () => {
  it('increments usage counter without throwing', async () => {
    const provider = makeMemoryStorage();
    mockGetServerStorage.mockResolvedValue(provider as unknown as StorageProvider);

    const { recordUsage } = await import('@/lib/server/billing/require-quota');
    await recordUsage('user-X', 'free', 'llmCalls');

    // Verify by reading back via the same provider
    const { createUsageTracker } = await import('@/lib/server/billing/usage-tracker');
    const tracker = await createUsageTracker(provider as unknown as StorageProvider);
    const usage = await tracker.getDailyUsage('user-X');
    expect(usage.llmCalls).toBe(1);
  });

  it('swallows errors silently (non-critical)', async () => {
    mockGetServerStorage.mockRejectedValue(new Error('DB down'));

    const { recordUsage } = await import('@/lib/server/billing/require-quota');

    await expect(recordUsage('user-X', 'free', 'llmCalls')).resolves.toBeUndefined();
  });
});
