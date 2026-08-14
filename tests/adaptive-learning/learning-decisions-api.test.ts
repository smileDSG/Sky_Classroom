import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';

const boundary = vi.hoisted(() => ({
  userId: 'user-decision',
  storage: null as StorageProvider | null,
  optionalBehaviorSignals: true,
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
      return { privacy: { optionalBehaviorSignals: boundary.optionalBehaviorSignals } };
    }
  },
}));

vi.mock('server-only', () => ({}));

import { POST } from '@/app/api/learning-decisions/route';
import { createInterventionDecisionDAO } from '@/lib/adaptive-learning/data/intervention-decisions';

const storage = new MemoryStorageProvider();
boundary.storage = storage;

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/learning-decisions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  boundary.optionalBehaviorSignals = true;
  await storage.clear('intervention_decisions');
  await storage.clear('learning_events');
});

describe('/api/learning-decisions', () => {
  it('creates a baseline decision and returns correlation context', async () => {
    const response = await POST(
      request({
        sessionId: 'quiz:session-1',
        action: 'quiz',
        topic: '函数',
        difficulty: 'medium',
        source: 'test',
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, recorded: true });
    expect(body.decision).toMatchObject({
      userId: 'user-decision',
      sessionId: 'quiz:session-1',
      selectedPlan: { action: 'quiz', topic: '函数' },
    });
    await expect(createInterventionDecisionDAO(storage).listByUser('user-decision')).resolves.toHaveLength(1);
  });

  it('skips decision persistence when optional behavior signals are disabled', async () => {
    boundary.optionalBehaviorSignals = false;
    const response = await POST(
      request({
        sessionId: 'memory:session-1',
        action: 'review',
        topic: '极限',
        source: 'test',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, recorded: false, decision: null });
    await expect(createInterventionDecisionDAO(storage).listByUser('user-decision')).resolves.toHaveLength(0);
  });

  it('rejects malformed payloads', async () => {
    const response = await POST(request({ action: 'quiz' }));
    expect(response.status).toBe(400);
  });
});
