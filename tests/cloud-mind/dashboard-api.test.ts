/**
 * API tests for /api/sky/cloud-mind/dashboard
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';

const dashboardBoundary = vi.hoisted(() => ({
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(async () => dashboardBoundary.storage),
}));

vi.mock('server-only', () => ({}));

import { GET } from '@/app/api/sky/cloud-mind/dashboard/route';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';

const storage = new MemoryStorageProvider();
dashboardBoundary.storage = storage;

function makeKnowledgeState(
  userId: string,
  nodeId: string,
  mastery: number,
  displayName?: string,
): KnowledgeState {
  return {
    userId,
    nodeId,
    displayName,
    alpha: 2,
    beta: 2,
    mastery,
    confidence: 0.5,
    retention: 1,
    reviewStabilityDays: 7,
    repeatedErrorCount: 0,
    evidenceCount: 1,
    version: 1,
  };
}

describe('GET /api/sky/cloud-mind/dashboard', () => {
  beforeEach(async () => {
    await storage.clear('knowledge-state');
  });

  it('returns dashboard with knowledge state weak points', async () => {
    const dao = createKnowledgeStateDAO(storage);
    await dao.set('user-dash', makeKnowledgeState('user-dash', 'kp-0135ff99', 0.25, '三角形'));

    const res = await GET(
      new NextRequest('http://localhost:3000/api/sky/cloud-mind/dashboard?userId=user-dash'),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.hasLearningData).toBe(true);
    expect(json.data.weakPoints).toHaveLength(1);
    expect(json.data.weakPoints[0].knowledgePoint).toBe('三角形');
    expect(json.data.weakPoints[0].mastery).toBe(25);
  });

  it('returns onboarding recommendation when no data exists', async () => {
    const res = await GET(
      new NextRequest('http://localhost:3000/api/sky/cloud-mind/dashboard?userId=user-empty'),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.hasLearningData).toBe(false);
    expect(json.data.recommendations[0].actionType).toBe('practice_quiz');
  });
});
