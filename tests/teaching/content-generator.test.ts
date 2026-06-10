/**
 * D-005 Content Generator — Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateLessonContent } from '@/lib/teaching/content-generator';
import type { LessonPlan } from '@/lib/teaching/lesson-types';

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock-model' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn((text: string) => JSON.parse(text)),
}));

const mockPlan: LessonPlan = {
  title: '二次函数专题',
  sections: [
    {
      id: 's1',
      title: '基础讲解',
      contentType: 'explanation',
      depth: 'basic',
      knowledgePoints: ['二次函数'],
      estimatedDuration: 10,
      hasQuiz: true,
    },
    {
      id: 's2',
      title: '例题讲解',
      contentType: 'example',
      depth: 'intermediate',
      knowledgePoints: ['二次函数'],
      estimatedDuration: 10,
      hasQuiz: false,
    },
  ],
  estimatedDuration: 20,
  focusPoints: ['二次函数'],
};

describe('generateLessonContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates content for each section', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValue({
      text: JSON.stringify({
        chunks: [
          { type: 'text', content: '讲解内容', order: 1 },
          { type: 'formula', content: '\\(y = x^2\\)', order: 2 },
        ],
      }),
    } as any);

    const sections = await generateLessonContent(mockPlan);

    expect(sections.length).toBe(2);
    expect(sections[0].section.id).toBe('s1');
    expect(sections[0].chunks.length).toBe(2);
    expect(sections[0].chunks[1].type).toBe('formula');
  });

  it('returns fallback content when LLM fails', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockRejectedValue(new Error('LLM unavailable'));

    const sections = await generateLessonContent(mockPlan);

    expect(sections.length).toBe(2);
    expect(sections[0].chunks.length).toBe(1);
    expect(sections[0].chunks[0].content).toContain('基础讲解');
  });

  it('returns fallback content when LLM returns invalid JSON', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValue({ text: 'bad json' } as any);

    const sections = await generateLessonContent(mockPlan);

    expect(sections.length).toBe(2);
    expect(sections[0].chunks.length).toBe(1);
  });

  it('filters out empty content chunks', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValue({
      text: JSON.stringify({
        chunks: [
          { type: 'text', content: 'valid content', order: 1 },
          { type: 'text', content: '', order: 2 },
        ],
      }),
    } as any);

    const sections = await generateLessonContent(mockPlan);

    expect(sections[0].chunks.length).toBe(1);
  });
});
