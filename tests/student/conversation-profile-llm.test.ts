import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedModel } from '@/lib/server/resolve-model';

const callLLMMock = vi.fn();

vi.mock('@/lib/ai/llm', () => ({
  callLLM: (...args: unknown[]) => callLLMMock(...args),
}));

const fakeModel = {
  model: { modelId: 'test-model' },
  modelInfo: {},
  modelString: 'openai/gpt-test',
  providerId: 'openai',
  modelId: 'gpt-test',
  apiKey: 'sk-test',
  keyPool: ['sk-test'],
} as unknown as ResolvedModel;

const VALID_LLM_JSON = {
  learningGoal: {
    value: '两周内补完机器学习',
    confidence: 0.9,
    evidence: ['两周内补机器学习'],
  },
  knowledgeBase: {
    strongPoints: [],
    weakPoints: ['过拟合', '模型评估'],
    confidence: 0.88,
    evidence: ['过拟合和模型评估总是搞不懂'],
  },
  resourcePreference: {
    value: ['代码案例', '图解'],
    confidence: 0.85,
    evidence: ['代码案例和图解'],
  },
  nextQuestion: '我先按这个画像来：目标是两周内补完机器学习。对吗？',
  needsConfirmation: true,
};

describe('extractConversationProfileWithLLM', () => {
  beforeEach(() => {
    callLLMMock.mockReset();
  });

  it('parses a valid LLM JSON payload into an extraction result', async () => {
    callLLMMock.mockResolvedValue({ text: JSON.stringify(VALID_LLM_JSON) });
    const { extractConversationProfileWithLLM } =
      await import('@/lib/student/conversation-profile-llm');

    const result = await extractConversationProfileWithLLM({
      message: '我想两周内补机器学习，过拟合和模型评估总是搞不懂，希望多用代码案例和图解讲。',
      stage: 'onboarding',
      model: fakeModel,
    });

    expect(result.stage).toBe('onboarding');
    expect(result.profilePatch.learningGoal?.value).toBe('两周内补完机器学习');
    expect(result.profilePatch.knowledgeBase?.weakPoints).toEqual(['过拟合', '模型评估']);
    expect(result.profilePatch.resourcePreference?.value).toEqual(['代码案例', '图解']);
    expect(result.evidence).toContain('过拟合和模型评估总是搞不懂');
    expect(result.nextQuestion).toContain('对吗');
    expect(result.needsConfirmation).toBe(true);

    expect(callLLMMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: fakeModel.model, system: expect.any(String) }),
      'student-profile-conversation',
      expect.objectContaining({ retries: 1, timeoutMs: 25_000 }),
      undefined,
    );
  });

  it('throws when the LLM replies with invalid JSON', async () => {
    callLLMMock.mockResolvedValue({ text: '这不是 JSON' });
    const { extractConversationProfileWithLLM } =
      await import('@/lib/student/conversation-profile-llm');

    await expect(
      extractConversationProfileWithLLM({
        message: '随便聊聊',
        stage: 'onboarding',
        model: fakeModel,
      }),
    ).rejects.toThrow();
  });

  it('throws when the payload fails schema validation', async () => {
    callLLMMock.mockResolvedValue({
      text: JSON.stringify({
        learningGoal: { value: '补数学', confidence: 'high', evidence: [] },
        nextQuestion: '下一步？',
        needsConfirmation: false,
      }),
    });
    const { extractConversationProfileWithLLM } =
      await import('@/lib/student/conversation-profile-llm');

    await expect(
      extractConversationProfileWithLLM({
        message: '我想补数学',
        stage: 'onboarding',
        model: fakeModel,
      }),
    ).rejects.toThrow();
  });

  it('drops empty dimensions and keeps only whitelisted resource labels', async () => {
    callLLMMock.mockResolvedValue({
      text: JSON.stringify({
        resourcePreference: { value: ['图解', '随便什么'], confidence: 0.9, evidence: [] },
        knowledgeBase: {
          strongPoints: [],
          weakPoints: [],
          confidence: 0.8,
          evidence: [],
        },
        errorPatternPreference: { value: [], confidence: 0.7, evidence: [] },
        nextQuestion: '你现在卡在哪里？',
        needsConfirmation: false,
      }),
    });
    const { extractConversationProfileWithLLM } =
      await import('@/lib/student/conversation-profile-llm');

    const result = await extractConversationProfileWithLLM({
      message: '我喜欢图解。',
      stage: 'onboarding',
      model: fakeModel,
    });

    expect(result.profilePatch.resourcePreference?.value).toEqual(['图解']);
    expect(result.profilePatch.knowledgeBase).toBeUndefined();
    expect(result.profilePatch.errorPatternPreference).toBeUndefined();
  });

  it('returns an empty patch when the LLM extracts nothing', async () => {
    callLLMMock.mockResolvedValue({
      text: JSON.stringify({
        nextQuestion: '你最近最想提升什么？',
        needsConfirmation: false,
      }),
    });
    const { extractConversationProfileWithLLM } =
      await import('@/lib/student/conversation-profile-llm');

    const result = await extractConversationProfileWithLLM({
      message: '你好',
      stage: 'onboarding',
      model: fakeModel,
    });

    expect(result.profilePatch).toEqual({});
    expect(result.evidence).toEqual([]);
  });
});
