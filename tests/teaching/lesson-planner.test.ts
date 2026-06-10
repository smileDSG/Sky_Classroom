/**
 * D-005 Lesson Planner — Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planLesson } from '@/lib/teaching/lesson-planner';
import type { StudentProfile } from '@/lib/student/profile-types';

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock-model' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn((text: string) => JSON.parse(text)),
}));

const mockProfile: StudentProfile = {
  userId: 'test-user',
  masteryBySubject: {
    math: 60,
    physics: 40,
    chemistry: 70,
    biology: 50,
    chinese: 80,
    english: 75,
    history: 65,
    geography: 55,
    politics: 60,
    unknown: 0,
  },
  masteryByKnowledge: { 二次函数: 20, 方程: 25, 几何: 85 },
  weakPoints: ['二次函数', '方程'],
  strongPoints: ['几何'],
  errorPatterns: [],
  totalQuestions: 10,
  totalCorrect: 6,
  lastUpdated: new Date(),
};

describe('planLesson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates plan from LLM response', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
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
            title: '例题',
            contentType: 'example',
            depth: 'intermediate',
            knowledgePoints: ['二次函数'],
            estimatedDuration: 10,
            hasQuiz: false,
          },
          {
            id: 's3',
            title: '随堂测',
            contentType: 'quiz',
            depth: 'basic',
            knowledgePoints: ['二次函数'],
            estimatedDuration: 5,
            hasQuiz: true,
          },
        ],
        focusPoints: ['二次函数', '方程'],
      }),
    } as any);

    const plan = await planLesson(mockProfile, '二次函数');

    expect(plan.title).toBe('二次函数专题');
    expect(plan.sections.length).toBe(3);
    expect(plan.sections[0].depth).toBe('basic');
    expect(plan.estimatedDuration).toBe(25);
  });

  it('returns fallback plan when LLM fails', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('LLM unavailable'));

    const plan = await planLesson(mockProfile, '二次函数');

    expect(plan.title).toContain('二次函数');
    expect(plan.sections.length).toBeGreaterThanOrEqual(3);
    expect(plan.sections[0].depth).toBe('basic');
  });

  it('returns fallback plan when LLM returns invalid JSON', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({ text: 'not json' } as any);

    const plan = await planLesson(mockProfile, '二次函数');

    expect(plan.title).toContain('二次函数');
    expect(plan.sections.length).toBeGreaterThanOrEqual(3);
  });

  it('weak points get basic depth in fallback', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('LLM unavailable'));

    const plan = await planLesson(mockProfile, '二次函数');

    const weakSection = plan.sections.find((s) => s.depth === 'basic');
    expect(weakSection).toBeDefined();
  });
});
