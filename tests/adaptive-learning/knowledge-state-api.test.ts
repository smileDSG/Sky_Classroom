/**
 * API tests for /api/user/knowledge-state
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';

const ksBoundary = vi.hoisted(() => ({
  userId: 'user-ks',
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: ksBoundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getRequiredServerStorage: vi.fn(async () => ksBoundary.storage),
}));

vi.mock('server-only', () => ({}));

import { GET, POST } from '@/app/api/user/knowledge-state/route';

const storage = new MemoryStorageProvider();
ksBoundary.storage = storage;

function makeState(nodeId: string = 'math-abc123def4567890'): KnowledgeState {
  return {
    userId: ksBoundary.userId,
    nodeId,
    alpha: 1,
    beta: 1,
    mastery: 0.5,
    confidence: 0.6,
    retention: 0.7,
    reviewStabilityDays: 7,
    repeatedErrorCount: 0,
    evidenceCount: 1,
    version: 1,
  };
}

beforeEach(async () => {
  ksBoundary.userId = 'user-ks';
  await storage.clear('knowledge-state');
});

describe('/api/user/knowledge-state', () => {
  it('GET returns empty list initially', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.states).toEqual([]);
  });

  it('POST creates a knowledge state and GET returns it', async () => {
    const state = makeState();

    const postRes = await POST(
      new NextRequest('http://localhost:3000/api/user/knowledge-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      }),
    );
    expect(postRes.status).toBe(200);

    const getRes = await GET();
    const json = await getRes.json();
    expect(json.states).toHaveLength(1);
    expect(json.states[0].nodeId).toBe('math-abc123def4567890');
  });

  it('POST overrides client-provided userId with authenticated userId', async () => {
    const state = { ...makeState(), userId: 'attacker' };

    const postRes = await POST(
      new NextRequest('http://localhost:3000/api/user/knowledge-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      }),
    );
    expect(postRes.status).toBe(200);

    const getRes = await GET();
    const json = await getRes.json();
    expect(json.states[0].userId).toBe('user-ks');
  });

  it('POST rejects invalid knowledge state', async () => {
    const res = await POST(
      new NextRequest('http://localhost:3000/api/user/knowledge-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: 'bad-id' }),
      }),
    );
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
