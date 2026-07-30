import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';

const apiBoundary = vi.hoisted(() => ({
  userId: 'user-1',
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: apiBoundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getRequiredServerStorage: vi.fn(async () => apiBoundary.storage),
}));

const preferenceInput = {
  preferredLanguage: 'zh-CN',
  contentFormatPreferences: ['worked-example', 'diagram'],
  explanationDepth: 'detailed',
  learningPace: 'standard',
  stepByStepMode: 'always',
  interactionTone: 'encouraging',
  assistantName: '小智',
  preferenceNotes: '讲解时优先给出例题。',
  privacy: {
    conversationMemory: 'persistent',
    optionalBehaviorSignals: true,
    privateKnowledgeRetrieval: false,
  },
};

describe('learner profile API', () => {
  beforeEach(() => {
    apiBoundary.userId = 'user-1';
    apiBoundary.storage = new MemoryStorageProvider();
    vi.resetModules();
  });

  it('reports PROFILE_NOT_FOUND instead of returning default preferences', async () => {
    const { GET } = await import('@/app/api/user/learner-profile/route');

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({
      success: false,
      errorCode: 'PROFILE_NOT_FOUND',
    });
  });

  it('creates preferences for the authenticated user with a server-owned version', async () => {
    const { GET, PUT } = await import('@/app/api/user/learner-profile/route');
    const request = new Request('http://localhost/api/user/learner-profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 0,
        preferences: preferenceInput,
      }),
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.preferences).toMatchObject({ userId: 'user-1', version: 1 });

    const loaded = await GET();
    await expect(loaded.json()).resolves.toMatchObject({
      success: true,
      preferences: { userId: 'user-1', version: 1 },
    });
  });

  it('returns PROFILE_VERSION_CONFLICT for a stale preference update', async () => {
    const { PUT } = await import('@/app/api/user/learner-profile/route');
    const requestBody = JSON.stringify({
      expectedVersion: 0,
      preferences: preferenceInput,
    });

    const first = await PUT(
      new Request('http://localhost/api/user/learner-profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: requestBody,
      }),
    );
    expect(first.status).toBe(200);

    const stale = await PUT(
      new Request('http://localhost/api/user/learner-profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: requestBody,
      }),
    );
    const payload = await stale.json();

    expect(stale.status).toBe(409);
    expect(payload.errorCode).toBe('PROFILE_VERSION_CONFLICT');
  });
});
