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

const mockModel = { model: {}, modelId: 'deepseek-chat', provider: 'deepseek' };

beforeEach(() => {
  vi.resetAllMocks();
  (getModel as any).mockReturnValue(mockModel);
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
      knowledgePoints: [
        { name: '一元一次方程', description: '基础代数', difficulty: 'easy' as const },
      ],
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

  test('defaults confidence to 0.5 when missing', () => {
    const result = parseSolutionResponse('{"solution":"x","answer":"y"}');
    expect(result?.confidence).toBe(0.5);
  });
});

describe('solveWithAgentNode', () => {
  function makeState(route?: string): SolveGraphState {
    return {
      problemText: '2+2=?',
      problemImage: null,
      userAnswer: null,
      agentId: 'universal',
      selectedAgentId: route ?? 'universal',
      agentRoute: (route as any) ?? 'universal',
      solution: null,
      gradeResult: null,
      votingResults: [],
      fourPartOutput: null,
      fromQuestionBank: false,
      fromSolveCache: false,
      error: null,
    };
  }

  test('calls LLM and returns solution update', async () => {
    const mockSolution = {
      solution: '详细的解题过程，包含完整的推理步骤和计算步骤',
      answer: '正确答案',
      confidence: 0.9,
      steps: [
        { label: 'step1', content: '第一步' },
        { label: 'step2', content: '第二步' },
        { label: 'step3', content: '第三步' },
      ],
      knowledgePoints: [{ name: '知识点', description: '说明', difficulty: 'easy' as const }],
      similarQuestions: [],
    };
    (parseJsonResponse as any).mockReturnValue(mockSolution);
    (callLLM as any).mockResolvedValue({ text: JSON.stringify(mockSolution) });

    const result = await solveWithAgentNode(makeState(), {} as any);
    expect(result.solution).toBe('详细的解题过程，包含完整的推理步骤和计算步骤');
    // 1 solve call + 1 similar-question generation (mock returns none)
    expect(callLLM).toHaveBeenCalledTimes(2);
  });

  test('sets error on LLM failure', async () => {
    (callLLM as any).mockRejectedValue(new Error('API timeout'));

    const result = await solveWithAgentNode(makeState(), {} as any);
    expect(result.error).toContain('API timeout');
  });

  test('triggers fallback when primary confidence is low', async () => {
    // Primary: minimal response — validated confidence ~0.35 (answer 'b' is 1 char = +0.05, base 0.3)
    const lowConf = {
      solution: '',
      answer: 'b',
      confidence: 0.5,
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
    };
    // Secondary: full response — validated confidence ~0.85
    const highConf = {
      solution: '详细的解题过程和完整的推理步骤',
      answer: '正确答案',
      confidence: 0.85,
      steps: [
        { label: 's', content: '步骤' },
        { label: 's2', content: 'c2' },
        { label: 's3', content: 'c3' },
      ],
      knowledgePoints: [{ name: 'k', description: 'd', difficulty: 'easy' as const }],
      similarQuestions: [],
    };

    (parseJsonResponse as any)
      .mockReturnValueOnce(lowConf) // primary returns low confidence
      .mockReturnValueOnce(highConf); // secondary returns high confidence
    (callLLM as any)
      .mockResolvedValueOnce({ text: JSON.stringify(lowConf) })
      .mockResolvedValueOnce({ text: JSON.stringify(highConf) });

    const result = await solveWithAgentNode(makeState('universal'), {} as any);
    // 2 solve calls + 1 similar-question generation
    expect(callLLM).toHaveBeenCalledTimes(3);
    expect(result.solution).toBe('详细的解题过程和完整的推理步骤');
  });

  test('falls through to tertiary when both primary and secondary are low', async () => {
    // All three have empty/short responses (low validated confidence)
    const lowConf1 = {
      solution: '',
      answer: 'a',
      confidence: 0.3,
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
    };
    const lowConf2 = {
      solution: '',
      answer: 'b',
      confidence: 0.4,
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
    };
    // Tertiary has full response
    const highConf3 = {
      solution: '完整解答',
      answer: '最终答案',
      confidence: 0.75,
      steps: [
        { label: 's', content: '步骤' },
        { label: 's2', content: 'c2' },
        { label: 's3', content: 'c3' },
      ],
      knowledgePoints: [{ name: 'k', description: 'd', difficulty: 'easy' as const }],
      similarQuestions: [],
    };

    (parseJsonResponse as any)
      .mockReturnValueOnce(lowConf1)
      .mockReturnValueOnce(lowConf2)
      .mockReturnValueOnce(highConf3);
    (callLLM as any)
      .mockResolvedValueOnce({ text: JSON.stringify(lowConf1) })
      .mockResolvedValueOnce({ text: JSON.stringify(lowConf2) })
      .mockResolvedValueOnce({ text: JSON.stringify(highConf3) });

    const result = await solveWithAgentNode(makeState('universal'), {} as any);
    // 3 solve calls + 1 similar-question generation
    expect(callLLM).toHaveBeenCalledTimes(4);
    expect(result.solution).toBe('完整解答');
  });

  test('returns salvaged prose when all agents fail', async () => {
    (callLLM as any).mockResolvedValue({ text: 'not json' });

    const result = await solveWithAgentNode(makeState(), {} as any);
    // 'not json' is genuine prose (not JSON-shaped), so each agent's response
    // is salvaged; the validator rejects it, so all three agents run and the
    // tertiary accepts the salvage as a last resort. Knowledge-point and
    // similar-question generation fill in the missing report sections.
    expect(callLLM).toHaveBeenCalledTimes(4);
    expect(result.solution).not.toBe('');
  });
});
