/**
 * Classroom Complete Summary — Tests
 */

import { describe, it, expect } from 'vitest';
import { summarizeScenes } from '@/lib/classroom/complete-summary';
import type { Scene, QuizContent } from '@/lib/types/stage';

function makeQuizScene(id: string, questions: QuizContent['questions'], knowledgePoints?: string[]): Scene {
  return {
    id,
    type: 'quiz',
    name: 'Quiz',
    content: {
      type: 'quiz',
      questions,
      knowledgePoints,
    } as QuizContent,
  };
}

function makeSlideScene(id: string): Scene {
  return {
    id,
    type: 'slide',
    name: 'Slide',
    content: { type: 'slide', blocks: [] },
  };
}

describe('summarizeScenes', () => {
  it('returns empty summary for no scenes', () => {
    const summary = summarizeScenes([], () => ({}));
    expect(summary.countsByType).toEqual({});
    expect(summary.quiz).toBeNull();
    expect(summary.quizDetails).toEqual([]);
    expect(summary.allQuizResults).toEqual([]);
  });

  it('counts scene types correctly', () => {
    const scenes = [makeSlideScene('s1'), makeSlideScene('s2'), makeQuizScene('q1', [])];
    const summary = summarizeScenes(scenes, () => ({}));
    expect(summary.countsByType).toEqual({ slide: 2, quiz: 1 });
  });

  it('records correct answers only in allQuizResults, not quizDetails', () => {
    const questions: QuizContent['questions'] = [
      {
        id: 'q1',
        type: 'single',
        question: '2+2=?',
        options: [{ label: '3', value: 'A' }, { label: '4', value: 'B' }],
        answer: ['B'],
      },
    ];
    const scenes = [makeQuizScene('s1', questions, ['算术'])];
    const summary = summarizeScenes(scenes, () => ({ q1: 'B' }));

    expect(summary.quiz).toEqual({ correct: 1, total: 1, pct: 100 });
    expect(summary.quizDetails).toEqual([]);
    expect(summary.allQuizResults).toHaveLength(1);
    expect(summary.allQuizResults[0].isCorrect).toBe(true);
    expect(summary.allQuizResults[0].knowledgePoints).toEqual(['算术']);
  });

  it('records wrong answers in both quizDetails and allQuizResults', () => {
    const questions: QuizContent['questions'] = [
      {
        id: 'q1',
        type: 'single',
        question: '2+2=?',
        options: [{ label: '3', value: 'A' }, { label: '4', value: 'B' }],
        answer: ['B'],
      },
    ];
    const scenes = [makeQuizScene('s1', questions)];
    const summary = summarizeScenes(scenes, () => ({ q1: 'A' }));

    expect(summary.quiz).toEqual({ correct: 0, total: 1, pct: 0 });
    expect(summary.quizDetails).toHaveLength(1);
    expect(summary.allQuizResults).toHaveLength(1);
    expect(summary.allQuizResults[0].isCorrect).toBe(false);
  });

  it('maps options to string labels', () => {
    const questions: QuizContent['questions'] = [
      {
        id: 'q1',
        type: 'single',
        question: 'What is the capital of France?',
        options: [{ label: 'Paris', value: 'A' }, { label: 'London', value: 'B' }],
        answer: ['A'],
      },
    ];
    const scenes = [makeQuizScene('s1', questions)];
    const summary = summarizeScenes(scenes, () => ({ q1: 'A' }));

    expect(summary.allQuizResults[0].options).toEqual(['Paris', 'London']);
  });

  it('calculates accuracy percentage', () => {
    const questions: QuizContent['questions'] = [
      { id: 'q1', type: 'single', question: 'Q1', options: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }], answer: ['A'] },
      { id: 'q2', type: 'single', question: 'Q2', options: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }], answer: ['B'] },
      { id: 'q3', type: 'single', question: 'Q3', options: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }], answer: ['A'] },
    ];
    const scenes = [makeQuizScene('s1', questions)];
    const summary = summarizeScenes(scenes, () => ({ q1: 'A', q2: 'A', q3: 'A' }));

    expect(summary.quiz).toEqual({ correct: 2, total: 3, pct: 67 });
  });
});
