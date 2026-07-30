import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';

const boundary = vi.hoisted(() => ({
  userId: 'user-legacy',
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: boundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(async () => boundary.storage),
  getRequiredServerStorage: vi.fn(async () => boundary.storage),
}));

import { GET, PATCH } from '@/app/api/user/personalization/route';

const storage = new MemoryStorageProvider();
boundary.storage = storage;

beforeEach(async () => {
  boundary.userId = 'user-legacy';
  await storage.clear('learner-preference-versions');
  await storage.clear('users');
});

function makeUserEntry(personalization: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: boundary.userId,
    email: 'test@example.com',
    username: 'legacy',
    passwordHash: null,
    role: 'user',
    status: 'active',
    guestId: null,
    planType: 'free',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastLoginAt: null,
    avatar: null,
    nickname: null,
    bio: null,
    educationLevel: null,
    grade: null,
    favoriteSubjects: null,
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
    emailVerified: false,
    emailVerifyToken: null,
    resetToken: null,
    resetTokenExpiry: null,
    ...personalization,
  };
}

describe('GET /api/user/personalization (deprecated)', () => {
  it('returns 404 when no learner profile or legacy personalization exists', async () => {
    await storage.set('users', { id: boundary.userId, data: makeUserEntry(), createdAt: Date.now(), updatedAt: Date.now() });

    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('migrates legacy user personalization to learner preferences when learner profile is missing', async () => {
    await storage.set('users', {
      id: boundary.userId,
      data: makeUserEntry({
        detailLevel: 'detailed',
        aiName: '小智',
        aiPersonality: 'encouraging',
        preferredLanguage: 'zh',
        showStepByStep: true,
        enableMemory: true,
        enableRAG: false,
      }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.personalization.explanationDepth).toBe('detailed');
    expect(json.personalization.assistantName).toBe('小智');
    expect(json.personalization.interactionTone).toBe('encouraging');
    expect(json.deprecation).toBe(true);
  });

  it('returns existing learner preferences when already migrated', async () => {
    await storage.set('users', {
      id: boundary.userId,
      data: makeUserEntry({ detailLevel: 'concise', aiName: '旧小智' }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Pre-seed learner preferences
    const { LearnerProfileRepository } = await import('@/lib/adaptive-learning/profile/repository');
    const repository = new LearnerProfileRepository(storage);
    await repository.insertPreferences({
      userId: boundary.userId,
      preferredLanguage: 'zh-CN',
      contentFormatPreferences: ['text'],
      explanationDepth: 'comprehensive',
      learningPace: 'slow',
      stepByStepMode: 'hints-first',
      interactionTone: 'strict',
      assistantName: '新小智',
      preferenceNotes: '',
      privacy: { conversationMemory: 'off', optionalBehaviorSignals: false, privateKnowledgeRetrieval: true },
      version: 1,
      schemaVersion: '1.0.0',
      updatedAt: '2026-07-29T00:00:00.000Z',
      updatedBy: 'user',
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.personalization.explanationDepth).toBe('comprehensive');
    expect(json.personalization.assistantName).toBe('新小智');
  });
});

describe('PATCH /api/user/personalization (deprecated)', () => {
  it('proxies update to the new learner profile service', async () => {
    const res = await PATCH(
      new NextRequest('http://localhost/api/user/personalization', {
        method: 'PATCH',
        body: JSON.stringify({
          personalization: {
            preferredLanguage: 'zh-CN',
            contentFormatPreferences: ['text'],
            explanationDepth: 'detailed',
            learningPace: 'standard',
            stepByStepMode: 'when-needed',
            interactionTone: 'friendly',
            assistantName: '小云',
            preferenceNotes: '',
            privacy: { conversationMemory: 'session', optionalBehaviorSignals: false, privateKnowledgeRetrieval: false },
          },
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.personalization.explanationDepth).toBe('detailed');
    expect(json.personalization.version).toBe(1);
    expect(json.deprecation).toBe(true);
  });

  it('returns 400 for invalid personalization payload', async () => {
    const res = await PATCH(
      new NextRequest('http://localhost/api/user/personalization', {
        method: 'PATCH',
        body: JSON.stringify({ personalization: {} }),
      }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
