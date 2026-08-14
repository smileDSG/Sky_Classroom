/**
 * Learner profile integration for /api/chat
 *
 * Verifies that the stateless chat endpoint loads the authenticated user's
 * learner preferences, builds a teaching projection, and passes it to the
 * orchestration layer. No real LLM calls are made.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import type { LearnerPreferences } from '@/lib/adaptive-learning/contracts';

const chatBoundary = vi.hoisted(() => ({
  userId: 'user-chat',
  storage: null as StorageProvider | null,
}));

const statelessGenerateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/billing/require-quota', () => ({
  requireQuota: vi.fn(async () => ({ userId: chatBoundary.userId, planType: 'free' })),
  recordUsage: vi.fn(async () => {}),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(async () => chatBoundary.storage),
  getRequiredServerStorage: vi.fn(async () => chatBoundary.storage),
}));

vi.mock('@/lib/server/resolve-model', () => ({
  resolveModel: vi.fn(async () => ({
    model: { id: 'mock-model' },
    providerId: 'mock',
    apiKey: 'mock-key',
  })),
}));

vi.mock('@/lib/ai/providers', () => ({
  isProviderKeyRequired: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/orchestration/stateless-generate', () => ({
  statelessGenerate: statelessGenerateMock,
}));

vi.mock('server-only', () => ({}));

import { POST } from '@/app/api/chat/route';

const storage = new MemoryStorageProvider();
chatBoundary.storage = storage;

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
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  chatBoundary.userId = 'user-chat';
  await storage.clear('learner-preference-versions');
  await storage.clear('learning-events');
  await storage.clear('knowledge-state');
  statelessGenerateMock.mockReset();
  statelessGenerateMock.mockImplementation(async function* () {
    yield {
      type: 'done',
      data: {
        totalActions: 0,
        totalAgents: 0,
        agentHadContent: false,
        directorState: { turnCount: 0, agentResponses: [], whiteboardLedger: [] },
      },
    };
  });
});

describe('POST /api/chat learner profile integration', () => {
  it('returns PROFILE_NOT_FOUND when learner profile is missing', async () => {
    const req = makeRequest({
      messages: [{ role: 'user', content: 'hi' }],
      storeState: {
        stage: null,
        scenes: [],
        currentSceneId: null,
        mode: 'playback',
        whiteboardOpen: false,
      },
      config: { agentIds: ['default-1'] },
      apiKey: 'mock-key',
    });

    const res = await POST(req);
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('builds and passes a teaching projection to statelessGenerate', async () => {
    await seedPreferences(chatBoundary.userId);

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hi' }],
      storeState: {
        stage: null,
        scenes: [],
        currentSceneId: null,
        mode: 'playback',
        whiteboardOpen: false,
      },
      config: { agentIds: ['default-1'] },
      apiKey: 'mock-key',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const callArg = statelessGenerateMock.mock.calls[0]?.[0];
    expect(callArg).toBeDefined();
    expect(callArg.teachingProjection).toContain('学习者画像');
    expect(callArg.teachingProjection).toContain('小云');
    expect(callArg.teachingProjection).toContain('讲解深度：详细');
    expect(callArg.teachingProjection).toContain('语气：鼓励引导');
  });

  it('injects Bayesian growth areas into orchestration context', async () => {
    await seedPreferences(chatBoundary.userId);
    await createKnowledgeStateDAO(storage).set(chatBoundary.userId, {
      userId: chatBoundary.userId,
      nodeId: 'functions-basic',
      alpha: 2,
      beta: 3,
      mastery: 0.4,
      confidence: 0.6,
      retention: 1,
      reviewStabilityDays: 7,
      repeatedErrorCount: 2,
      evidenceCount: 3,
      version: 3,
    });

    const res = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'help with functions' }],
        storeState: {
          stage: null,
          scenes: [],
          currentSceneId: null,
          mode: 'playback',
          whiteboardOpen: false,
        },
        config: { agentIds: ['default-1'] },
        apiKey: 'mock-key',
      }),
    );

    expect(res.status).toBe(200);
    expect(statelessGenerateMock.mock.calls[0]?.[0].teachingProjection).toContain(
      'functions-basic',
    );
    expect(statelessGenerateMock.mock.calls[0]?.[0].teachingProjection).toContain(
      '建议动作：teach',
    );
    expect(statelessGenerateMock.mock.calls[0]?.[0].teachingProjection).toContain(
      '原因码：low-mastery、repeated-errors',
    );
    expect(statelessGenerateMock.mock.calls[0]?.[0].teachingProjection).toContain(
      '用户明确提出的问题和主题优先',
    );
  });

  it('does not accept client-provided teachingProjection as authoritative', async () => {
    await seedPreferences(chatBoundary.userId);

    const req = makeRequest({
      messages: [{ role: 'user', content: 'hi' }],
      storeState: {
        stage: null,
        scenes: [],
        currentSceneId: null,
        mode: 'playback',
        whiteboardOpen: false,
      },
      config: { agentIds: ['default-1'] },
      apiKey: 'mock-key',
      teachingProjection: 'CLIENT_PROJECTION_OVERRIDE',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const callArg = statelessGenerateMock.mock.calls[0]?.[0];
    expect(callArg.teachingProjection).toContain('学习者画像');
    expect(callArg.teachingProjection).not.toContain('CLIENT_PROJECTION_OVERRIDE');
  });

  it('streams a decision context for downstream behavior correlation', async () => {
    await seedPreferences(chatBoundary.userId);

    const res = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'hi' }],
        sessionId: 'session-1',
        storeState: {
          stage: null,
          scenes: [],
          currentSceneId: null,
          mode: 'playback',
          whiteboardOpen: false,
        },
        config: { agentIds: ['default-1'] },
        apiKey: 'mock-key',
      }),
    );

    const body = await res.text();
    expect(body).toContain('"type":"decision_context"');
    expect(body).toContain('"sessionId":"session-1"');
  });
});
