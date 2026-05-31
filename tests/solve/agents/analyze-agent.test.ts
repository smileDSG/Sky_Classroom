import { describe, it, expect, vi } from 'vitest';
import { analyzeProblem } from '@/lib/solve/agents/analyze-agent';
import { DEFAULT_ANALYSIS } from '@/lib/solve/agents/analyze-types';

// Mock the LLM layer
vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock-model' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn((text: string) => JSON.parse(text)),
}));

describe('analyzeProblem', () => {
  it('returns parsed analysis for valid LLM response', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        subject: '数学',
        knowledgePoints: ['二次函数', '顶点坐标'],
        difficulty: 'medium',
        questionType: 'solve',
        confidence: 0.9,
      }),
    } as any);

    const result = await analyzeProblem('已知二次函数y=x²-2x+3，求顶点坐标');
    expect(result.subject).toBe('数学');
    expect(result.knowledgePoints).toContain('二次函数');
    expect(result.difficulty).toBe('medium');
    expect(result.questionType).toBe('solve');
    expect(result.confidence).toBe(0.9);
  });

  it('returns DEFAULT_ANALYSIS on LLM failure', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('timeout'));

    const result = await analyzeProblem('some problem');
    expect(result).toEqual(DEFAULT_ANALYSIS);
  });

  it('returns DEFAULT_ANALYSIS on invalid JSON', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({ text: 'not json' } as any);

    const { parseJsonResponse } = await import('@/lib/generation/json-repair');
    vi.mocked(parseJsonResponse).mockReturnValueOnce(null);

    const result = await analyzeProblem('some problem');
    expect(result).toEqual(DEFAULT_ANALYSIS);
  });
});
