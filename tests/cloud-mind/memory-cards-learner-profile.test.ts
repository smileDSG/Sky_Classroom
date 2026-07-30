/**
 * Learner profile integration for /api/sky/cloud-mind/memory-cards
 *
 * Verifies that memory card generation loads the authenticated user's
 * preferences and passes a teaching projection to the agent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import type { LearnerPreferences } from '@/lib/adaptive-learning/contracts';

const mcBoundary = vi.hoisted(() => ({
  userId: 'user-mc',
  storage: null as StorageProvider | null,
}));

const generateMemoryCardsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/agents/cloud-mind/memory-cards-agent', () => ({
  generateMemoryCards: generateMemoryCardsMock,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: mcBoundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getRequiredServerStorage: vi.fn(async () => mcBoundary.storage),
}));

vi.mock('server-only', () => ({}));

import { POST } from '@/app/api/sky/cloud-mind/memory-cards/route';

const storage = new MemoryStorageProvider();
mcBoundary.storage = storage;

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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/sky/cloud-mind/memory-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  mcBoundary.userId = 'user-mc';
  await storage.clear('learner-preference-versions');
  generateMemoryCardsMock.mockReset();
  generateMemoryCardsMock.mockResolvedValue({
    topic: 'test',
    description: 'test',
    cards: [],
    studyTips: '',
    reviewIntervals: [1, 2, 4],
  });
});

describe('POST /api/sky/cloud-mind/memory-cards learner profile integration', () => {
  it('returns PROFILE_NOT_FOUND when learner profile is missing', async () => {
    const req = makeRequest({ content: '光合作用' });

    const res = await POST(req);
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('passes teaching projection to generateMemoryCards', async () => {
    await seedPreferences(mcBoundary.userId);

    const req = makeRequest({ content: '光合作用' });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(generateMemoryCardsMock).toHaveBeenCalledTimes(1);
    const [, , , teachingProjection] = generateMemoryCardsMock.mock.calls[0];
    expect(typeof teachingProjection).toBe('string');
    expect(teachingProjection).toContain('学习者画像');
    expect(teachingProjection).toContain('小云');
  });

  it('does not accept client-provided teachingProjection as authoritative', async () => {
    await seedPreferences(mcBoundary.userId);

    const req = makeRequest({ content: '光合作用', teachingProjection: 'CLIENT_OVERRIDE' });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const [, , , teachingProjection] = generateMemoryCardsMock.mock.calls[0];
    expect(teachingProjection).toContain('学习者画像');
    expect(teachingProjection).not.toContain('CLIENT_OVERRIDE');
  });
});
