/**
 * P6-001: Solve Flow Integration Tests
 *
 * Full pipeline: solve → fourPartOutput → mistakes sync
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Shared mock state ──────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  llmResult: {
    text: JSON.stringify({
      solution: 'x = 3',
      answer: '3',
      confidence: 0.95,
      steps: [
        { label: '移项', content: '2x = 6', keyPoints: ['等式两边同时减去3'] },
        { label: '计算', content: 'x = 3', keyPoints: ['等式两边同时除以2'] },
      ],
      knowledgePoints: [
        { name: '一元一次方程', description: '基础代数', difficulty: 'easy' },
      ],
      similarQuestions: [
        { problem: '3x + 6 = 15', difficulty: 0.4, knowledgePoint: '一元一次方程' },
      ],
    }),
  },
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn().mockResolvedValue(mocks.llmResult),
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

vi.mock('@/lib/solve/question-bank', () => ({
  findSimilarQuestions: vi.fn().mockResolvedValue([]),
  saveToQuestionBank: vi.fn().mockResolvedValue({
    id: 'qb_new',
    problemHash: 'hash',
    problemText: '',
    answer: '3',
    steps: [],
    knowledgePoints: [],
    agentId: 'science',
    verified: false,
  }),
}));

vi.mock('@/lib/utils/database', () => ({
  db: {
    questionBank: {
      toArray: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

import { createSolveGraph, buildSolveInitialState } from '@/lib/solve/solve-graph';
import { analyzeMistakeCause } from '@/lib/mistakes/cause-analyzer';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import type { MistakeRecord, MistakeCause } from '@/lib/mistakes/types';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────

describe('P6-001: solve flow integration', () => {
  test('full pipeline: solve → fourPartOutput', async () => {
    const graph = createSolveGraph();
    const state = buildSolveInitialState('解方程: 2x + 3 = 9');

    const result = await graph.invoke(state);

    expect(result.solution).not.toBeNull();
    expect(result.fourPartOutput).not.toBeNull();
    expect(result.fourPartOutput?.answer).toContain('x = 3');
    expect(result.fourPartOutput?.steps).toBeDefined();
    expect(result.fourPartOutput?.knowledgePoints).toBeDefined();
    expect(result.fourPartOutput?.similarQuestions.length).toBeGreaterThanOrEqual(0);
  });

  test('question bank hit skips solving and goes straight to output', async () => {
    const { findSimilarQuestions } = await import('@/lib/solve/question-bank');
    (findSimilarQuestions as any).mockResolvedValueOnce([{
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
    }]);

    const graph = createSolveGraph();
    const state = buildSolveInitialState('1+1=?');
    const result = await graph.invoke(state);

    expect(result.fromQuestionBank).toBe(true);
    expect(result.solution).toBe('2');
    expect(result.fourPartOutput).not.toBeNull();
  });

  test('no user answer skips grading, still produces fourPartOutput', async () => {
    const graph = createSolveGraph();
    const state = buildSolveInitialState('解方程: x = 1');

    const result = await graph.invoke(state);

    expect(result.gradeResult).toBeNull();
    expect(result.fourPartOutput).not.toBeNull();
  });

  test('agent routing works for different problem types', async () => {
    const graph = createSolveGraph();

    const mathResult = await graph.invoke(buildSolveInitialState('解方程: 2x = 4'));
    expect(mathResult.agentRoute).toBe('science');

    const litResult = await graph.invoke(buildSolveInitialState('分析《红楼梦》主题'));
    expect(litResult.agentRoute).toBe('humanities');

    const generalResult = await graph.invoke(buildSolveInitialState('Hello world'));
    expect(generalResult.agentRoute).toBe('universal');
  });

  test('error in solve produces fallback fourPartOutput', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    (callLLM as any).mockRejectedValueOnce(new Error('API timeout'));

    const graph = createSolveGraph();
    const state = buildSolveInitialState('解方程: x + 1 = 2');
    const result = await graph.invoke(state);

    expect(result.error).toContain('API timeout');
    expect(result.fourPartOutput).not.toBeNull();
    expect(result.fourPartOutput?.answer).toContain('解题失败');
  });
});

describe('P6-001: solve → mistakes pipeline', () => {
  test('wrong answer produces mistake cause', () => {
    const problem = '解方程: 2x + 3 = 9';
    const correctAnswer = 'x = 3';
    const userAnswer = 'x = 5';

    const cause = analyzeMistakeCause(problem, correctAnswer, userAnswer);

    const validCauses: MistakeCause[] = ['concept-unclear', 'calculation-error', 'misreading', 'method-wrong', 'careless', 'format-error'];
    expect(validCauses).toContain(cause);
  });

  test('mistake record structure is valid for knowledge graph', () => {
    const mistake: MistakeRecord = {
      id: 'test-mistake-1',
      problem: '计算三角形面积',
      userAnswer: '底×高',
      correctAnswer: '底×高÷2',
      cause: 'calculation-error',
      solvedAt: new Date(),
      reviewed: false,
      reviewCount: 0,
      knowledgePoints: ['几何', '面积'],
    };

    const graph = buildKnowledgeGraph([mistake]);

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.nodes.some((n) => n.mistakeCount > 0)).toBe(true);
  });

  test('solve + analyze + graph full chain', async () => {
    const graph = createSolveGraph();
    const state = buildSolveInitialState('解方程: 2x = 6');

    const solveResult = await graph.invoke(state);

    expect(solveResult.solution).not.toBeNull();
    expect(solveResult.fourPartOutput).not.toBeNull();

    // Use the solution as correct answer to create a mistake record
    const cause = analyzeMistakeCause(state.problemText, solveResult.solution!, 'x = 999');
    expect(cause).toBeDefined();

    const mistake: MistakeRecord = {
      id: 'chain-test-1',
      problem: state.problemText,
      userAnswer: 'x = 999',
      correctAnswer: solveResult.solution!,
      cause,
      solvedAt: new Date(),
      reviewed: false,
      reviewCount: 0,
      knowledgePoints: ['代数'],
    };

    const knowledgeGraph = buildKnowledgeGraph([mistake]);
    expect(knowledgeGraph.nodes.length).toBeGreaterThan(0);
    expect(knowledgeGraph.nodes[0].mistakeCount).toBe(1);
  });
});
