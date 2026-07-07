import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({
    model: 'mock-course-studio-model',
    modelInfo: { id: 'mock-course-studio-model' },
  })),
}));

describe('software cup LLM RAG generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses retrieved course context to replace demo resource content when LLM succeeds', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    const { runSoftwareCupGeneration } = await import('@/lib/software-cup/demo-service');

    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        resources: [
          {
            id: 'lecture-1',
            title: 'LLM RAG lecture',
            content: '# LLM RAG lecture\n\nGenerated from retrieved RAG course evidence.',
            contentPreview: 'Generated from retrieved RAG course evidence.',
            personalizationReason: 'Matched the learner weak point with retrieved RAG evidence.',
            sourceCitations: ['data/course-knowledge/ai-intro/readings.md'],
          },
        ],
        reviewResult: {
          confidence: 0.93,
          issues: [],
          suggestions: ['Keep citations visible.'],
        },
      }),
    } as any);

    const result = await runSoftwareCupGeneration('I need RAG resources for vector retrieval.', {
      enableLlm: true,
      profileSignals: [
        {
          id: 'weak',
          userId: 'student-1',
          dimension: 'knowledgeBase',
          value: { strongPoints: ['Python'], weakPoints: ['RAG'] },
          source: 'onboarding_chat',
          confidence: 0.9,
          evidence: ['RAG is confusing'],
          createdAt: 1000,
        },
      ],
    });

    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(vi.mocked(callLLM).mock.calls[0]?.[1]).toBe('software-cup-course-studio-rag');
    expect(JSON.stringify(vi.mocked(callLLM).mock.calls[0]?.[0])).toContain('RAG');
    expect(result.generationMode).toBe('llm_rag');
    expect(result.resources[0].title).toBe('LLM RAG lecture');
    expect(result.resources[0].content).toContain('Generated from retrieved RAG course evidence');
    expect(result.resources[0].sourceCitations).toContain(
      'data/course-knowledge/ai-intro/readings.md',
    );
    expect(result.reviewResult.suggestions).toContain('Keep citations visible.');
  });

  it('falls back to deterministic demo resources when LLM fails', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    const { runSoftwareCupGeneration } = await import('@/lib/software-cup/demo-service');

    vi.mocked(callLLM).mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await runSoftwareCupGeneration('I need RAG resources.', { enableLlm: true });

    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(result.generationMode).toBe('demo_fallback');
    expect(result.resources.length).toBeGreaterThan(0);
    expect(result.resources[0].content?.length ?? 0).toBeGreaterThan(180);
  });
});
