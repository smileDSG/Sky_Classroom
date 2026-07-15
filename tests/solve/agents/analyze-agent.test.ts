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
    expect(result.subject).toBe('math');  // Chinese '数学' mapped to 'math'
    expect(result.knowledgePoints).toContain('二次函数');
    expect(result.difficulty).toBe('medium');
    expect(result.questionType).toBe('solve');
    expect(result.confidence).toBe(0.9);
  });

  it('maps English subject names correctly', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        subject: 'physics',
        knowledgePoints: ['力学', '牛顿定律'],
        difficulty: 'hard',
        questionType: 'choice',
        confidence: 0.85,
      }),
    } as any);

    const result = await analyzeProblem('一个物体以10m/s速度运动');
    expect(result.subject).toBe('physics');
    expect(result.questionType).toBe('choice');
  });

  it('falls back to unknown for unrecognized subject', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        subject: 'music',
        knowledgePoints: ['音阶'],
        difficulty: 'easy',
        questionType: 'fill',
        confidence: 0.7,
      }),
    } as any);

    const result = await analyzeProblem('some music problem');
    expect(result.subject).toBe('unknown');
  });

  it('falls back to defaults for invalid difficulty/questionType', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        subject: 'math',
        knowledgePoints: ['代数'],
        difficulty: 'impossible',
        questionType: 'essay',
        confidence: 0.5,
      }),
    } as any);

    const result = await analyzeProblem('problem');
    expect(result.difficulty).toBe('medium');  // default fallback
    expect(result.questionType).toBe('solve');  // default fallback
  });

  it('clamps confidence to 0-1 range', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        subject: 'math',
        knowledgePoints: ['概率'],
        difficulty: 'medium',
        questionType: 'solve',
        confidence: 1.5,  // > 1, should clamp
      }),
    } as any);

    const result = await analyzeProblem('problem');
    expect(result.confidence).toBe(1);
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
