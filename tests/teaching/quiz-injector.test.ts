/**
 * D-005 Quiz Injector — Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { injectQuizzes } from '@/lib/teaching/quiz-injector';

vi.mock('@/lib/solve/question-bank', () => ({
  findSimilarQuestions: vi.fn(),
}));

describe('injectQuizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns questions from question bank', async () => {
    const { findSimilarQuestions } = await import('@/lib/solve/question-bank');
    vi.mocked(findSimilarQuestions).mockResolvedValueOnce([
      {
        id: 'qb1',
        problemHash: 'h1',
        problemText: '求解方程 x+1=3',
        answer: 'x=2',
        knowledgePoints: [{ name: '方程', description: '', difficulty: 'easy' }],
        agentId: 'universal' as const,
        solvedAt: Date.now(),
        verified: true,
      },
      {
        id: 'qb2',
        problemHash: 'h2',
        problemText: '求解方程 2x=6',
        answer: 'x=3',
        knowledgePoints: [{ name: '方程', description: '', difficulty: 'easy' }],
        agentId: 'universal' as const,
        solvedAt: Date.now(),
        verified: true,
      },
    ]);

    const quizzes = await injectQuizzes(['方程']);

    expect(quizzes.length).toBe(2);
    expect(quizzes[0].fromBank).toBe(true);
    expect(quizzes[0].knowledgePoint).toBe('方程');
  });

  it('generates fallback question when bank is empty', async () => {
    const { findSimilarQuestions } = await import('@/lib/solve/question-bank');
    vi.mocked(findSimilarQuestions).mockResolvedValueOnce([]);

    const quizzes = await injectQuizzes(['二次函数']);

    expect(quizzes.length).toBe(1);
    expect(quizzes[0].fromBank).toBe(false);
    expect(quizzes[0].knowledgePoint).toBe('二次函数');
    expect(quizzes[0].problem).toContain('二次函数');
  });

  it('adjusts difficulty based on mastery', async () => {
    const { findSimilarQuestions } = await import('@/lib/solve/question-bank');
    vi.mocked(findSimilarQuestions).mockResolvedValueOnce([
      {
        id: 'qb1',
        problemHash: 'h1',
        problemText: '题目',
        answer: '答案',
        knowledgePoints: [{ name: '低掌握', description: '', difficulty: 'easy' }],
        agentId: 'universal' as const,
        solvedAt: Date.now(),
        verified: true,
      },
    ]);

    const quizzes = await injectQuizzes(['低掌握'], { 低掌握: 15 });

    expect(quizzes[0].difficulty).toBeLessThan(0.4);
  });

  it('sets higher difficulty for mastered topics', async () => {
    const { findSimilarQuestions } = await import('@/lib/solve/question-bank');
    vi.mocked(findSimilarQuestions).mockResolvedValueOnce([
      {
        id: 'qb1',
        problemHash: 'h1',
        problemText: '题目',
        answer: '答案',
        knowledgePoints: [{ name: '高掌握', description: '', difficulty: 'hard' }],
        agentId: 'universal' as const,
        solvedAt: Date.now(),
        verified: true,
      },
    ]);

    const quizzes = await injectQuizzes(['高掌握'], { 高掌握: 90 });

    expect(quizzes[0].difficulty).toBeGreaterThan(0.7);
  });
});
