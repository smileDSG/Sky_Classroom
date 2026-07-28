import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { UserEntry } from '@/lib/storage/dao/users';

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/storage/dao/users', () => ({
  createUserDAO: vi.fn(),
}));

import { requireAuth } from '@/lib/server/auth/helpers';
import { createUserDAO } from '@/lib/storage/dao/users';
import { GET, PUT } from '@/app/api/user/learning-onboarding/route';
import { POST as SKIP } from '@/app/api/user/learning-onboarding/skip/route';

const mockRequireAuth = vi.mocked(requireAuth);
const mockCreateUserDAO = vi.mocked(createUserDAO);

const completionPayload = {
  educationLevel: 'middle',
  grade: '初二',
  favoriteSubjects: ['math', 'physics'],
  weakSubjects: ['math'],
  learningGoal: 'build-foundations',
  goalDetail: '补齐代数基础',
  teachingPreference: 'step-by-step',
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
    favoriteSubjects: [
      { id: 'math', name: '数学', enabled: true },
      { id: 'physics', name: '物理', enabled: false },
    ],
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

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: makeUser() });
});

describe('learning onboarding API', () => {
  it('returns 401 without an authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({
      error: NextResponse.json({ success: false }, { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('returns pending plus existing personalization', async () => {
    const response = await GET();

    expect(await response.json()).toEqual({
      success: true,
      status: 'pending',
      onboarding: null,
      educationLevel: 'middle',
      grade: '初二',
      favoriteSubjects: ['math'],
    });
  });

  it('updates existing fields and completed profile in one DAO call', async () => {
    const update = vi
      .fn()
      .mockImplementation(async (_id, values) => makeUser({ ...values, updatedAt: 2 }));
    mockCreateUserDAO.mockResolvedValue({ update } as never);

    const response = await PUT(putRequest(completionPayload));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith('user-1', {
      educationLevel: 'middle',
      grade: '初二',
      favoriteSubjects: expect.arrayContaining([{ id: 'math', name: '数学', enabled: true }]),
      learningOnboarding: expect.objectContaining({
        version: 1,
        status: 'completed',
        weakSubjects: ['math'],
      }),
    });
  });

  it('rejects a stage and grade mismatch', async () => {
    const update = vi.fn();
    mockCreateUserDAO.mockResolvedValue({ update } as never);

    const response = await PUT(putRequest({ ...completionPayload, grade: '高一' }));

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('records skipped without fabricating answers', async () => {
    const update = vi.fn().mockImplementation(async (_id, values) => makeUser(values));
    mockCreateUserDAO.mockResolvedValue({ update } as never);

    const response = await SKIP();

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('user-1', {
      learningOnboarding: expect.objectContaining({
        version: 1,
        status: 'skipped',
        skippedAt: expect.any(Number),
      }),
    });
    expect(update.mock.calls[0][1]).not.toHaveProperty('weakSubjects');
    expect(update.mock.calls[0][1]).not.toHaveProperty('educationLevel');
  });

  it('allows the same completion payload to be retried', async () => {
    const update = vi.fn().mockImplementation(async (_id, values) => makeUser(values));
    mockCreateUserDAO.mockResolvedValue({ update } as never);

    const first = await PUT(putRequest(completionPayload));
    const second = await PUT(putRequest(completionPayload));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
