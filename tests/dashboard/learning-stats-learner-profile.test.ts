/**
 * Learner profile integration for /api/sky/learning-stats
 *
 * Verifies that the dashboard loads the authenticated user's preferences
 * and returns them alongside learning statistics.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import type { LearnerPreferences } from '@/lib/adaptive-learning/contracts';

const dashBoundary = vi.hoisted(() => ({
  userId: 'user-dash',
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/auth', () => ({
  verifyAccessToken: vi.fn(async (token: string) => {
    if (token === 'valid-token') return { sub: dashBoundary.userId };
    return null;
  }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => (name === 'access_token' ? { value: 'valid-token' } : undefined)),
  })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(async () => dashBoundary.storage),
}));

vi.mock('server-only', () => ({}));

import { GET } from '@/app/api/sky/learning-stats/route';

const storage = new MemoryStorageProvider();
dashBoundary.storage = storage;

async function seedPreferences(userId: string): Promise<LearnerPreferences> {
  const repository = new LearnerProfileRepository(storage);
  const preferences: LearnerPreferences = {
    userId,
    preferredLanguage: 'zh-CN',
    contentFormatPreferences: ['text', 'worked-example'],
    explanationDepth: 'detailed',
    learningPace: 'standard',
    stepByStepMode: 'when-needed',
    interactionTone: 'encouraging',
    assistantName: '小云',
    preferenceNotes: '',
    privacy: {
      conversationMemory: 'session',
      optionalBehaviorSignals: false,
      privateKnowledgeRetrieval: false,
    },
    version: 1,
    schemaVersion: '1.0.0',
    updatedAt: '2026-07-30T00:00:00.000Z',
    updatedBy: 'user',
  };
  await repository.insertPreferences(preferences);
  return preferences;
}

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/sky/learning-stats', {
    method: 'GET',
    headers: { cookie: 'access_token=valid-token' },
  });
}

beforeEach(async () => {
  dashBoundary.userId = 'user-dash';
  await storage.clear('learner-preference-versions');
  await storage.clear('user_stats');
});

describe('GET /api/sky/learning-stats learner profile integration', () => {
  it('returns default stats when learner profile is missing', async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.learnerProfile).toBeNull();
  });

  it('returns learner profile alongside stats when available', async () => {
    await seedPreferences(dashBoundary.userId);

    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.learnerProfile).toBeDefined();
    expect(json.learnerProfile.preferredLanguage).toBe('zh-CN');
    expect(json.learnerProfile.explanationDepth).toBe('detailed');
    expect(json.learnerProfile.assistantName).toBe('小云');
  });
});
