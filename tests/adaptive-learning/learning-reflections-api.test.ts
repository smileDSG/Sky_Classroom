import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import type { LearnerPreferences, LearningEvent } from '@/lib/adaptive-learning/contracts';

const boundary = vi.hoisted(() => ({
  userId: 'reflection-api-user',
  storage: null as StorageProvider | null,
  enabled: true,
  events: [] as LearningEvent[],
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: boundary.userId } })),
}));
vi.mock('@/lib/server/server-storage', () => ({
  getRequiredServerStorage: vi.fn(async () => boundary.storage),
}));
vi.mock('@/lib/adaptive-learning/profile/repository', () => ({
  LearnerProfileRepository: class {
    async getLatestPreferences() {
      return { privacy: { optionalBehaviorSignals: boundary.enabled } } as LearnerPreferences;
    }
    async listLearningEvents() {
      return boundary.events;
    }
  },
}));
vi.mock('server-only', () => ({}));

import { GET, POST } from '@/app/api/learning-reflections/route';

const storage = new MemoryStorageProvider();
boundary.storage = storage;

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/learning-reflections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  boundary.enabled = true;
  boundary.events = [];
  await storage.clear('learner_reflections');
});

describe('/api/learning-reflections', () => {
  it('returns latest reflection and respects privacy', async () => {
    const getResponse = await GET();
    await expect(getResponse.json()).resolves.toMatchObject({ success: true, reflection: null });

    boundary.enabled = false;
    const disabledGetResponse = await GET();
    await expect(disabledGetResponse.json()).resolves.toMatchObject({
      success: true,
      reflection: null,
      reason: 'behavior-signals-disabled',
    });
    const postResponse = await POST(request({ run: true }));
    expect(postResponse.status).toBe(200);
    await expect(postResponse.json()).resolves.toMatchObject({
      success: true,
      recorded: false,
      reason: 'behavior-signals-disabled',
    });
  });
});
