import { describe, expect, it } from 'vitest';

import {
  QUIZ_PRESETS,
  buildKnowledgeSuggestions,
  buildQuizConfigSignature,
  normalizeQuizGoal,
  parseStoredQuizConfig,
} from '@/lib/cloud-mind/quiz-experience';

describe('quiz experience configuration', () => {
  it('normalizes unsupported goals to practice', () => {
    expect(normalizeQuizGoal('diagnose')).toBe('diagnose');
    expect(normalizeQuizGoal('mock')).toBe('mock');
    expect(normalizeQuizGoal('unexpected')).toBe('practice');
    expect(normalizeQuizGoal(null)).toBe('practice');
  });

  it('defines complete one-click trial presets', () => {
    expect(QUIZ_PRESETS).toEqual([
      expect.objectContaining({
        id: 'foundation',
        difficulty: 'easy',
        count: 5,
        questionType: 'choice',
        goal: 'practice',
      }),
      expect.objectContaining({
        id: 'exam',
        difficulty: 'medium',
        count: 10,
        questionType: 'choice',
        goal: 'mock',
      }),
      expect.objectContaining({
        id: 'review',
        difficulty: 'easy',
        count: 5,
        questionType: 'fill',
        goal: 'diagnose',
      }),
      expect.objectContaining({
        id: 'challenge',
        difficulty: 'hard',
        count: 5,
        questionType: 'choice',
        goal: 'diagnose',
      }),
    ]);
  });

  it('accepts only valid stored configurations', () => {
    const valid = JSON.stringify({
      mode: 'ai',
      subject: 'math',
      topic: '二次函数',
      difficulty: 'medium',
      count: 10,
      questionType: 'choice',
      goal: 'mock',
    });

    expect(parseStoredQuizConfig(valid)).toEqual(JSON.parse(valid));
    expect(parseStoredQuizConfig('{broken')).toBeNull();
    expect(parseStoredQuizConfig(JSON.stringify({ ...JSON.parse(valid), count: 7 }))).toBeNull();
    expect(
      parseStoredQuizConfig(JSON.stringify({ ...JSON.parse(valid), questionType: 'essay' })),
    ).toBeNull();
  });

  it('changes the preview signature when any generation field changes', () => {
    const base = {
      subject: 'math',
      topic: '二次函数',
      difficulty: 'easy' as const,
      questionType: 'choice' as const,
      goal: 'practice' as const,
    };
    const signature = buildQuizConfigSignature(base);

    expect(buildQuizConfigSignature({ ...base, topic: '函数图像' })).not.toBe(signature);
    expect(buildQuizConfigSignature({ ...base, difficulty: 'hard' })).not.toBe(signature);
    expect(buildQuizConfigSignature({ ...base, questionType: 'fill' })).not.toBe(signature);
    expect(buildQuizConfigSignature({ ...base, goal: 'diagnose' })).not.toBe(signature);
    expect(buildQuizConfigSignature({ ...base, topic: '  二次函数  ' })).toBe(signature);
  });

  it('merges, deduplicates, filters, and limits knowledge suggestions', () => {
    expect(
      buildKnowledgeSuggestions({
        query: '二',
        personalized: ['二次函数', '二元一次方程', '二次函数'],
        common: ['二次函数', '导数', '二次根式'],
        limit: 3,
      }),
    ).toEqual(['二次函数', '二元一次方程', '二次根式']);
  });
});
