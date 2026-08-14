import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { UserEntry } from '@/lib/storage/dao/users';
import type { CompleteUniversalOnboardingInput } from '@/lib/onboarding/types';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

const storageBoundary = vi.hoisted(() => ({
  storage: null as MemoryStorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/storage/dao/users', () => ({
  createUserDAO: vi.fn(),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(async () => storageBoundary.storage),
}));

import { requireAuth } from '@/lib/server/auth/helpers';
import { createUserDAO } from '@/lib/storage/dao/users';
import { GET, PUT } from '@/app/api/user/learning-onboarding/route';
import { POST as SKIP } from '@/app/api/user/learning-onboarding/skip/route';

const mockRequireAuth = vi.mocked(requireAuth);
const mockCreateUserDAO = vi.mocked(createUserDAO);
const storage = new MemoryStorageProvider();
storageBoundary.storage = storage;

const learnerProfile: CompleteUniversalOnboardingInput['profiles']['learner'] = {
  identity: 'learner',
  context: {
    stage: 'middle',
    learningDomains: [{ domain: { source: 'catalog', id: 'math', name: '数学' } }],
    supportDomains: [{ source: 'catalog', id: 'physics', name: '物理' }],
  },
  goals: [{ source: 'catalog', id: 'build-foundations', label: '巩固基础' }],
  roleNeeds: ['identify-gaps'],
  preferences: { explanationStyle: 'step-by-step' },
  detail: '补齐代数基础',
};

const completionPayload: CompleteUniversalOnboardingInput = {
  version: 2,
  identities: ['learner'],
  primaryIdentity: 'learner',
  profiles: { learner: learnerProfile },
};

function makeUser(overrides: Partial<UserEntry> = {}): UserEntry {
  return {
    id: 'user-1',
    email: 'student@example.com',
    username: 'student',
    passwordHash: null,
    role: 'user',
    status: 'active',
    guestId: null,
    planType: 'free',
    createdAt: 1,
    updatedAt: 1,
    lastLoginAt: null,
    avatar: null,
    nickname: null,
    bio: null,
    educationLevel: 'middle',
    grade: '初二',
    favoriteSubjects: [{ id: 'math', name: '数学', enabled: true }],
    learningOnboarding: null,
    learningStyle: null,
    detailLevel: null,
    preferredLanguage: null,
    aiPersonality: null,
    aiName: null,
    customInstructions: null,
    autoGenerateQuiz: null,
    showStepByStep: null,
    enableMemory: null,
    enableRAG: null,
    emailVerified: true,
    emailVerifyToken: null,
    resetToken: null,
    resetTokenExpiry: null,
    ...overrides,
  };
}

function putRequest(body: unknown): Request {
  return new Request('http://localhost/api/user/learning-onboarding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockUpdate() {
  const update = vi
    .fn()
    .mockImplementation(async (id, values) => makeUser({ id, ...values, updatedAt: 2 }));
  const getById = vi.fn().mockImplementation(async () => {
    const auth = await mockRequireAuth();
    return 'user' in auth ? auth.user : null;
  });
  mockCreateUserDAO.mockResolvedValue({ getById, update } as never);
  return update;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await storage.clear('learner-preference-versions');
  await storage.clear('profile_signals');
  mockRequireAuth.mockResolvedValue({ user: makeUser() });
});

describe('learning onboarding API', () => {
  it('returns 401 without an authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({
      error: NextResponse.json({ success: false }, { status: 401 }),
    });

    expect((await GET()).status).toBe(401);
  });

  it('returns pending without fabricating a profile', async () => {
    expect(await (await GET()).json()).toEqual({
      success: true,
      status: 'pending',
      onboarding: null,
      initialProfile: null,
    });
  });

  it('returns a normalized v2 view for a completed v1 record without writing it', async () => {
    const update = mockUpdate();
    mockRequireAuth.mockResolvedValue({
      user: makeUser({
        learningOnboarding: {
          version: 1,
          status: 'completed',
          weakSubjects: ['physics'],
          learningGoal: 'build-foundations',
          teachingPreference: 'step-by-step',
          completedAt: 100,
        },
      }),
    });

    const body = await (await GET()).json();

    expect(body).toMatchObject({
      success: true,
      status: 'completed',
      onboarding: {
        version: 2,
        status: 'completed',
        migratedFromVersion: 1,
        primaryIdentity: 'learner',
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('stores a completed v2 profile and synchronizes legacy profile columns', async () => {
    const update = mockUpdate();

    const response = await PUT(putRequest(completionPayload));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        learningOnboarding: expect.objectContaining({
          version: 2,
          status: 'completed',
          primaryIdentity: 'learner',
          completedAt: expect.any(Number),
          profiles: {
            learner: expect.objectContaining({
              identity: 'learner',
              completedAt: expect.any(Number),
            }),
          },
        }),
        educationLevel: 'middle',
        grade: expect.any(String),
        favoriteSubjects: expect.arrayContaining([
          expect.objectContaining({ id: 'math', enabled: true }),
          expect.objectContaining({ id: 'physics', enabled: true }),
        ]),
        learningStyle: 'reading',
        showStepByStep: true,
      }),
    );
  });

  it('preserves selected completed secondary profiles during primary identity edits', async () => {
    const existingLearner = { ...learnerProfile, completedAt: 10 };
    mockRequireAuth.mockResolvedValue({
      user: makeUser({
        learningOnboarding: {
          version: 2,
          status: 'completed',
          identities: ['learner', 'educator'],
          primaryIdentity: 'learner',
          profiles: { learner: existingLearner },
          completedAt: 10,
        },
      }),
    });
    const update = mockUpdate();
    const educatorPayload: CompleteUniversalOnboardingInput = {
      version: 2,
      identities: ['learner', 'educator'],
      primaryIdentity: 'educator',
      profiles: {
        educator: {
          identity: 'educator',
          contexts: [
            {
              stage: 'high',
              teachingDomains: [{ domain: { source: 'catalog', id: 'math', name: '数学' } }],
            },
          ],
          goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
          roleNeeds: ['question-design'],
          preferences: { primarySupport: 'lesson-plan-structure' },
        },
      },
    };

    await PUT(putRequest(educatorPayload));

    const stored = update.mock.calls[0][1].learningOnboarding;
    expect(stored).toMatchObject({
      identities: ['learner', 'educator'],
      primaryIdentity: 'educator',
      profiles: {
        learner: existingLearner,
        educator: expect.objectContaining({ identity: 'educator' }),
      },
    });
  });

  it('removes profiles for identities explicitly removed from the identity set', async () => {
    mockRequireAuth.mockResolvedValue({
      user: makeUser({
        learningOnboarding: {
          version: 2,
          status: 'completed',
          identities: ['learner', 'educator'],
          primaryIdentity: 'educator',
          profiles: {
            learner: { ...learnerProfile, completedAt: 10 },
            educator: {
              identity: 'educator',
              contexts: [],
              goals: [],
              roleNeeds: [],
              preferences: { primarySupport: 'balanced' },
              completedAt: 10,
            },
          },
          completedAt: 10,
        },
      }),
    });
    const update = mockUpdate();

    await PUT(putRequest(completionPayload));

    expect(update.mock.calls[0][1].learningOnboarding.profiles).toEqual({
      learner: expect.any(Object),
    });
  });

  it('allows an administrator to save only their own profile', async () => {
    mockRequireAuth.mockResolvedValue({ user: makeUser({ role: 'admin', id: 'admin-1' }) });
    const update = mockUpdate();

    expect((await PUT(putRequest(completionPayload))).status).toBe(200);
    expect(update).toHaveBeenCalledWith('admin-1', expect.any(Object));
  });

  it('rejects invalid stage-domain pairs and forged migration markers', async () => {
    const update = mockUpdate();
    const invalidDomain = structuredClone(completionPayload);
    invalidDomain.profiles.learner!.context.learningDomains = [
      { domain: { source: 'catalog', id: 'general-technology', name: '通用技术' } },
    ];

    expect((await PUT(putRequest(invalidDomain))).status).toBe(400);
    expect((await PUT(putRequest({ ...completionPayload, migratedFromVersion: 1 }))).status).toBe(
      400,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('records version 2 skipped without fabricating answers', async () => {
    const update = mockUpdate();

    const response = await SKIP();

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('user-1', {
      learningOnboarding: {
        version: 2,
        status: 'skipped',
        skippedAt: expect.any(Number),
      },
    });
    expect(update.mock.calls[0][1]).not.toHaveProperty('educationLevel');
  });

  it('allows the same completion payload to be retried', async () => {
    const update = mockUpdate();

    expect((await PUT(putRequest(completionPayload))).status).toBe(200);
    expect((await PUT(putRequest(completionPayload))).status).toBe(200);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
