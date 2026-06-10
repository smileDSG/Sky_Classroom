// tests/solve/agents/correct-agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { correctAnswer } from '@/lib/solve/agents/correct-agent';

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock-model' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn((text: string) => JSON.parse(text)),
}));

describe('correctAnswer', () => {
  it('returns corrected steps and answer', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        steps: [{ label: '修正', content: '重新计算...', keyPoints: [] }],
        answer: '4',
      }),
    } as any);

    const result = await correctAnswer('求2+2', '3', '4', '算错了');
    expect(result).not.toBeNull();
    expect(result!.steps).toHaveLength(1);
    expect(result!.steps[0]!.label).toBe('修正');
    expect(result!.answer).toBe('4');
  });

  it('returns null when JSON is missing answer field', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        steps: [{ label: '修正', content: 'step' }],
        // answer field missing
      }),
    } as any);

    const result = await correctAnswer('problem', 'wrong', 'right', 'reason');
    expect(result).toBeNull();
  });

  it('returns null when JSON is missing steps field', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        answer: '5',
        // steps field missing
      }),
    } as any);

    const result = await correctAnswer('problem', 'wrong', 'right', 'reason');
    expect(result).toBeNull();
  });

  it('returns null on failure', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('fail'));

    const result = await correctAnswer('problem', 'wrong', 'right', 'reason');
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON from LLM', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({ text: 'not json at all' } as any);

    const { parseJsonResponse } = await import('@/lib/generation/json-repair');
    vi.mocked(parseJsonResponse).mockReturnValueOnce(null);

    const result = await correctAnswer('problem', 'wrong', 'right', 'reason');
    expect(result).toBeNull();
  });
});
