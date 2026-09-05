import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import { createProfileSignalDAO } from '@/lib/student/profile-signals';

vi.mock('server-only', () => ({}));

const storage = new MemoryStorageProvider();

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: async () => storage,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

const resolveModelFromRequestMock = vi.fn();

vi.mock('@/lib/server/resolve-model', () => ({
  resolveModelFromRequest: (...args: unknown[]) => resolveModelFromRequestMock(...args),
}));

const callLLMMock = vi.fn();

vi.mock('@/lib/ai/llm', () => ({
  callLLM: (...args: unknown[]) => callLLMMock(...args),
}));

const VALID_LLM_JSON = {
  learningGoal: {
    value: '考前补完数据结构的链表与树',
    confidence: 0.9,
    evidence: ['下周要考数据结构'],
  },
  knowledgeBase: {
    strongPoints: [],
    weakPoints: ['链表'],
    confidence: 0.86,
    evidence: ['链表老是写错'],
  },
  nextQuestion: '我先按这个画像来：目标是考前补完数据结构。对吗？',
  needsConfirmation: true,
};

async function postMessage(message: string, stage?: string) {
  const { POST } = await import('@/app/api/sky/student/profile/conversation/route');
  const req = new Request('http://localhost/api/sky/student/profile/conversation', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: 'profile-onboarding-test',
      message,
      ...(stage ? { stage } : {}),
    }),
  });
  const response = await POST(req as unknown as NextRequest);
  return response.json();
}

describe('profile conversation route', () => {
  beforeEach(() => {
    resolveModelFromRequestMock.mockReset();
    callLLMMock.mockReset();
    resolveModelFromRequestMock.mockRejectedValue(new Error('no model configured'));
  });

  it('persists extracted profile signals for the demo user when no userId is provided', async () => {
    const payload = await postMessage(
      '我想两周内补机器学习，过拟合和模型评估总是搞不懂，希望多用代码案例和图解讲。',
      'onboarding',
    );
    const signals = await createProfileSignalDAO(storage).listByUser('default-user');

    expect(payload.success).toBe(true);
    expect(payload.data.extractionSource).toBe('rules');
    expect(payload.data.profileSignals.length).toBeGreaterThan(0);
    expect(payload.data.conversationProfile).toBeDefined();
    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'default-user',
          source: 'onboarding_chat',
        }),
      ]),
    );
  });

  it('uses LLM extraction and persists its patch when a model resolves', async () => {
    resolveModelFromRequestMock.mockResolvedValue({
      model: { modelId: 'test-model' },
      thinkingConfig: undefined,
    });
    callLLMMock.mockResolvedValue({ text: JSON.stringify(VALID_LLM_JSON) });

    const payload = await postMessage(
      '我下周要考数据结构，链表老是写错，多给点代码案例。',
      'onboarding',
    );
    const signals = await createProfileSignalDAO(storage).listByUser('default-user');

    expect(payload.success).toBe(true);
    expect(payload.data.extractionSource).toBe('llm');
    expect(payload.data.profilePatch.learningGoal.value).toBe('考前补完数据结构的链表与树');
    expect(payload.data.profileSignals.length).toBeGreaterThan(0);
    expect(signals.length).toBeGreaterThan(0);
  });

  it('falls back to rules and still persists when callLLM fails after a model resolves', async () => {
    resolveModelFromRequestMock.mockResolvedValue({
      model: { modelId: 'test-model' },
      thinkingConfig: undefined,
    });
    callLLMMock.mockRejectedValue(new Error('provider auth failed'));

    const payload = await postMessage('我想两周内补机器学习，过拟合总是搞不懂。', 'onboarding');
    const signals = await createProfileSignalDAO(storage).listByUser('default-user');

    expect(payload.data.extractionSource).toBe('rules');
    expect(payload.data.profileSignals.length).toBeGreaterThan(0);
    expect(signals.length).toBeGreaterThan(0);
  });

  it('skips LLM extraction entirely when no stage is provided', async () => {
    resolveModelFromRequestMock.mockResolvedValue({
      model: { modelId: 'test-model' },
      thinkingConfig: undefined,
    });

    const payload = await postMessage('生成一份软件杯画像展示');

    expect(payload.data.extractionSource).toBe('rules');
    expect(resolveModelFromRequestMock).not.toHaveBeenCalled();
    expect(payload.data.profile).toBeDefined();
  });
});
