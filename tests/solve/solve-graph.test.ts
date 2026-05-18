import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing graph
vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      solution: '解题过程',
      answer: '答案',
      confidence: 0.9,
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
    }),
  }),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn().mockImplementation((text: string) => {
    try { return JSON.parse(text); } catch { return null; }
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

import { createSolveGraph, buildSolveInitialState, afterCheckBank, afterSolve } from '@/lib/solve/solve-graph';

describe('buildSolveInitialState', () => {
  test('builds state from problem input', () => {
    const state = buildSolveInitialState('2+2=?');
    expect(state.problemText).toBe('2+2=?');
    expect(state.problemImage).toBeNull();
    expect(state.fromQuestionBank).toBe(false);
  });

  test('includes image when provided', () => {
    const state = buildSolveInitialState('看图解题', 'data:image/png;base64,abc');
    expect(state.problemImage).toBe('data:image/png;base64,abc');
  });

  test('includes user answer for grade mode', () => {
    const state = buildSolveInitialState('2+2=?', null, '5');
    expect(state.userAnswer).toBe('5');
  });
});

describe('createSolveGraph', () => {
  test('returns a compiled graph', () => {
    const graph = createSolveGraph();
    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe('function');
  });
});

describe('conditional edges', () => {
  describe('afterCheckBank', () => {
    test('routes to generateOutput when question bank hit', () => {
      const state = buildSolveInitialState('test');
      state.fromQuestionBank = true;
      expect(afterCheckBank(state)).toBe('generateOutput');
    });

    test('routes to routeToAgent when question bank miss', () => {
      const state = buildSolveInitialState('test');
      expect(afterCheckBank(state)).toBe('routeToAgent');
    });
  });

  describe('afterSolve', () => {
    test('routes to generateOutput when error is set', () => {
      const state = buildSolveInitialState('test');
      state.error = 'something went wrong';
      expect(afterSolve(state)).toBe('generateOutput');
    });

    test('routes to gradeAnswer when no error', () => {
      const state = buildSolveInitialState('test');
      expect(afterSolve(state)).toBe('gradeAnswer');
    });
  });
});
