// tests/solve/agents/verify-agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { verifyAnswer } from '@/lib/solve/agents/verify-agent';
import { DEFAULT_VERIFY } from '@/lib/solve/agents/verify-types';

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock-model' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn((text: string) => JSON.parse(text)),
}));

describe('verifyAnswer', () => {
  it('returns isCorrect=true when LLM confirms', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        yourAnswer: '3',
        confidence: 0.95,
        reasoning: 'Both answers are 3',
      }),
    } as any);

    const result = await verifyAnswer('求x²=9的正根', '3');
    expect(result.isCorrect).toBe(true);
    // answer-matcher returns 1.0 for exact match, overriding LLM confidence
    expect(result.confidence).toBe(1.0);
  });

  it('returns isCorrect=false with suggestedAnswer when mismatch', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        yourAnswer: '4',
        isCorrect: false,
        suggestedAnswer: '4',
        confidence: 0.9,
        reasoning: 'My solution gives 4, not 3',
      }),
    } as any);

    const result = await verifyAnswer('求2+2', '3');
    expect(result.isCorrect).toBe(false);
    expect(result.suggestedAnswer).toBe('4');
  });

  it('returns DEFAULT_VERIFY on failure', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('timeout'));

    const result = await verifyAnswer('problem', 'answer');
    expect(result).toEqual(DEFAULT_VERIFY);
    // Default must be isCorrect=false so bad answers aren't silently accepted
    expect(result.isCorrect).toBe(false);
  });

  it('returns DEFAULT_VERIFY on invalid JSON (parseJsonResponse returns null)', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({ text: 'not json' } as any);

    const { parseJsonResponse } = await import('@/lib/generation/json-repair');
    vi.mocked(parseJsonResponse).mockReturnValueOnce(null);

    const result = await verifyAnswer('problem', 'answer');
    expect(result).toEqual(DEFAULT_VERIFY);
    expect(result.isCorrect).toBe(false);
  });
});

