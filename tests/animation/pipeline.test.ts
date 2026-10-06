import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const planJson = JSON.stringify({
  title: '快速排序的 partition 过程',
  subjectArea: 'algorithm',
  steps: Array.from({ length: 6 }, (_, i) => ({ title: `第${i + 1}步`, intent: `意图${i}` })),
});

const validScriptJson = JSON.stringify({
  id: 'anim-abc',
  title: '快速排序',
  topic: '快排',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675 },
  actors: [{ kind: 'array-cell', id: 'c0', label: '3', w: 90, h: 60, color: '#4f8ef7' }],
  steps: [
    {
      id: 's1',
      title: '初始',
      narration: '数组如下。',
      actorStates: [{ actorId: 'c0', x: 400, y: 300 }],
    },
    {
      id: 's2',
      title: '结束',
      narration: '排序完成。',
      actorStates: [{ actorId: 'c0', x: 400, y: 300 }],
    },
  ],
});

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));
vi.mock('@/lib/prompts/loader', () => ({
  loadPrompt: vi.fn((id: string) => ({ id, systemPrompt: 'sys', userPromptTemplate: 'user' })),
}));

import { callLLM } from '@/lib/ai/llm';
import {
  runAnimationGeneration,
  AnimationGenerationError,
} from '@/lib/animation/generate/pipeline';

const mockedCallLLM = vi.mocked(callLLM);

const defaultImpl = async (_params: unknown, label: string) => ({
  text: label === 'animation-plan' ? planJson : validScriptJson,
});

describe('animation pipeline', () => {
  beforeEach(() => {
    // resolveAnimationModel 读 process.env；与开发者本地 .env.local 解耦，
    // 保证测试环境一定能解析出候选模型（deepseek 在 CANDIDATES 中）。
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockedCallLLM.mockReset();
    mockedCallLLM.mockImplementation(defaultImpl as never);
    // script-agent 校验失败重试的 1s/2s/4s 退避用假时钟跳过
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runAnimationGeneration 报告进度并产出脚本', async () => {
    const progress: string[] = [];
    const result = await runAnimationGeneration('快排', {
      onProgress: (stage, pct) => progress.push(`${stage}:${pct}`),
    });
    expect(result.script.id).toBe('anim-abc');
    expect(result.script.steps).toHaveLength(2);
    expect(progress).toContain('planning:10');
    expect(progress).toContain('done:100');
  });

  it('script 阶段失败时抛出携带 plan 的 AnimationGenerationError（spec §8.1 降级）', async () => {
    mockedCallLLM.mockImplementation(async (_params: unknown, label: string) => {
      if (label === 'animation-plan') return { text: planJson } as never;
      throw new Error('boom');
    });
    // 提前挂上 catch，避免假时钟推进期间出现 unhandled rejection
    const pending = runAnimationGeneration('快排').catch((e) => e);
    // 跳过 script-agent 3 次重试的退避（1s + 2s + 4s = 7s）
    await vi.advanceTimersByTimeAsync(8000);
    const e = await pending;
    expect(e).toBeInstanceOf(AnimationGenerationError);
    const err = e as AnimationGenerationError;
    expect(err.message).toContain('boom');
    expect(err.plan?.steps).toHaveLength(6);
  });
});
