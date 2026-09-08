import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Shared mock state (vi.hoisted ensures it runs before vi.mock factories)
const mocks = vi.hoisted(() => ({
  llmResult: {
    text: JSON.stringify({
      solution: '解：2x = 6, x = 3',
      answer: 'x = 3',
      confidence: 0.9,
      steps: [{ label: '移项', content: '2x = 6', keyPoints: ['等式两边同时除以2'] }],
      knowledgePoints: [
        { name: '一元一次方程', description: '基础代数', difficulty: 'easy' as const },
      ],
      similarQuestions: [
        { problem: '3x + 2 = 8', difficulty: 0.4, knowledgePoint: '一元一次方程' },
      ],
    }),
  },
  llmError: null as Error | null,
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn().mockImplementation(async () => {
    if (mocks.llmError) throw mocks.llmError;
    return mocks.llmResult;
  }),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn().mockImplementation((text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue({ model: {}, modelId: 'test', provider: 'deepseek' }),
  PROVIDERS: {
    deepseek: { id: 'deepseek', type: 'openai' },
    glm: { id: 'glm', type: 'openai' },
    qwen: { id: 'qwen', type: 'openai' },
  },
}));

vi.mock('@/lib/solve/question-bank', () => ({
  findSimilarQuestions: vi.fn().mockImplementation(async (problemText: string) => {
    if (problemText === '1+1=?') {
      return [
        {
          id: 'qb_hit',
          problemHash: 'hash',
          problemText: '1+1=?',
          answer: '2',
          steps: ['直接计算'],
          knowledgePoints: ['加法'],
          agentId: 'universal',
          solvedAt: Date.now(),
          verified: true,
          _similarity: 1,
        },
      ];
    }
    return [];
  }),
}));

import { createSolveGraph, buildSolveInitialState } from '@/lib/solve/solve-graph';

beforeEach(() => {
  mocks.llmError = null;
});

afterEach(() => {
  mocks.llmError = null;
});

describe('solve graph integration', () => {
  test('full pipeline: START → checkQuestionBank → routeToAgent → solveWithAgent → gradeAnswer → generateOutput → END', async () => {
    const graph = createSolveGraph();
    const state = buildSolveInitialState('解方程: 2x + 3 = 9');

    const result = await graph.invoke(state);

    expect(result.problemText).toBe('解方程: 2x + 3 = 9');
    expect(result.solution).toBe('解：2x = 6, x = 3');
    expect(result.fourPartOutput).not.toBeNull();
    expect(result.fourPartOutput?.answer).toBe('解：2$x = 6$, $x = 3$');
    expect(result.agentRoute).toBe('science'); // 方程 is a science keyword
  });

  test('question bank hit skips solving', async () => {
    const graph = createSolveGraph();
    const state = buildSolveInitialState('1+1=?');

    const result = await graph.invoke(state);

    expect(result.problemText).toBe('1+1=?');
    expect(result.fromQuestionBank).toBe(true);
    expect(result.solution).toBe('2');
    expect(result.fourPartOutput).not.toBeNull();
  });

  test('humanities keyword routing', async () => {
    const graph = createSolveGraph();
    const state = buildSolveInitialState('分析《红楼梦》的主题思想');

    const result = await graph.invoke(state);

    expect(result.agentRoute).toBe('humanities');
    expect(result.solution).toBe('解：2x = 6, x = 3');
  });

  test('universal fallback when no keywords match', async () => {
    const graph = createSolveGraph();
    const state = buildSolveInitialState('Hello, what is 2+2?');

    const result = await graph.invoke(state);

    expect(result.agentRoute).toBe('universal');
  });

  test('error path: LLM failure skips grading', async () => {
    mocks.llmError = new Error('API timeout');

    const graph = createSolveGraph();
    const state = buildSolveInitialState('解方程: x = 0');

    const result = await graph.invoke(state);

    expect(result.error).toContain('API timeout');
    expect(result.fourPartOutput).not.toBeNull();
  });

  test('user answer included in state', async () => {
    const graph = createSolveGraph();
    const state = buildSolveInitialState('2+2=?', null, '5');

    const result = await graph.invoke(state);

    expect(result.userAnswer).toBe('5');
    expect(result.gradeResult).not.toBeNull();
  });

  test('no user answer skips grading', async () => {
    const graph = createSolveGraph();
    const state = buildSolveInitialState('2+2=?');

    const result = await graph.invoke(state);

    expect(result.userAnswer).toBeNull();
    expect(result.gradeResult).toBeNull();
  });
});
