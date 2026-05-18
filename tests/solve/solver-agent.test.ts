import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { solveWithAgentNode, parseSolutionResponse } from '@/lib/solve/solver-agent';
import type { SolveGraphState } from '@/lib/solve/solve-graph-state';

// Mock callLLM
vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(),
  PROVIDERS: {
    deepseek: { id: 'deepseek', type: 'openai' },
    glm: { id: 'glm', type: 'openai' },
    qwen: { id: 'qwen', type: 'openai' },
  },
}));

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { getModel } from '@/lib/ai/providers';

const mockModel = { modelId: 'deepseek-chat', provider: 'deepseek' };

beforeEach(() => {
  vi.resetAllMocks();
  (getModel as any).mockReturnValue(mockModel);
  // Default: parseJsonResponse parses JSON normally (identity-like for valid JSON)
  (parseJsonResponse as any).mockImplementation((text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseSolutionResponse', () => {
  test('parses valid solution JSON', () => {
    const input = {
      solution: '解：2x = 4, x = 2',
      answer: 'x = 2',
      confidence: 0.9,
      steps: [{ label: '步骤1', content: '移项', keyPoints: ['等式两边同时减去3'] }],
      knowledgePoints: [{ name: '一元一次方程', description: '基础代数', difficulty: 'easy' as const }],
      similarQuestions: [{ problem: '3x+1=7', difficulty: 0.5, knowledgePoint: '一元一次方程' }],
    };

    const result = parseSolutionResponse(JSON.stringify(input));
    expect(result).not.toBeNull();
    expect(result?.answer).toBe('x = 2');
    expect(result?.confidence).toBe(0.9);
  });

  test('returns null for malformed response', () => {
    const result = parseSolutionResponse('not json');
    expect(result).toBeNull();
  });

  test('returns null for missing required fields', () => {
    const result = parseSolutionResponse('{}');
    expect(result).toBeNull();
  });
});

describe('solveWithAgentNode', () => {
  test('calls LLM and returns solution update', async () => {
    const mockSolution = {
      solution: '解题过程',
      answer: '答案',
      confidence: 0.9,
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
    };
    (parseJsonResponse as any).mockReturnValue(mockSolution);
    (callLLM as any).mockResolvedValue({ text: JSON.stringify(mockSolution) });

    const state: SolveGraphState = {
      problemText: '2+2=?',
      problemImage: null,
      userAnswer: null,
      agentId: 'universal',
      selectedAgentId: 'universal',
      agentRoute: 'universal',
      solution: null,
      gradeResult: null,
      votingResults: [],
      fourPartOutput: null,
      fromQuestionBank: false,
      error: null,
    };

    const result = await solveWithAgentNode(state, {} as any);
    expect(result.solution).toBe('解题过程');
  });

  test('sets error on LLM failure', async () => {
    (callLLM as any).mockRejectedValue(new Error('API timeout'));

    const state: SolveGraphState = {
      problemText: '2+2=?',
      problemImage: null,
      userAnswer: null,
      agentId: 'universal',
      selectedAgentId: 'universal',
      agentRoute: 'universal',
      solution: null,
      gradeResult: null,
      votingResults: [],
      fourPartOutput: null,
      fromQuestionBank: false,
      error: null,
    };

    const result = await solveWithAgentNode(state, {} as any);
    expect(result.error).toContain('API timeout');
  });
});
