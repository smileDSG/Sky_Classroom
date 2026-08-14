import { describe, expect, it } from 'vitest';

import { applyTeachingGenerationPolicy } from '@/lib/teaching/personalization-policy';
import type { LessonPlan } from '@/lib/teaching/lesson-types';

const plan: LessonPlan = {
  title: '函数授课计划',
  estimatedDuration: 30,
  focusPoints: ['函数'],
  sections: [
    {
      id: 's1',
      title: '概念',
      contentType: 'explanation',
      depth: 'intermediate',
      knowledgePoints: ['函数'],
      estimatedDuration: 10,
      hasQuiz: false,
    },
    {
      id: 's2',
      title: '例题',
      contentType: 'example',
      depth: 'intermediate',
      knowledgePoints: ['函数'],
      estimatedDuration: 10,
      hasQuiz: false,
    },
    {
      id: 's3',
      title: '总结',
      contentType: 'explanation',
      depth: 'intermediate',
      knowledgePoints: ['函数'],
      estimatedDuration: 10,
      hasQuiz: false,
    },
  ],
};

describe('applyTeachingGenerationPolicy', () => {
  it('turns low-mastery policy into basic, slower, visual teaching', () => {
    const personalized = applyTeachingGenerationPolicy(plan, {
      difficulty: 'easy',
      explanationStyle: 'example_first',
      resourceFormats: ['diagram', 'practice'],
      pacing: 'remedial',
      reasonCodes: ['low-mastery'],
      profileVersion: 3,
    });

    expect(personalized.sections.every((section) => section.depth === 'basic')).toBe(true);
    expect(personalized.sections[0].contentType).toBe('example');
    expect(personalized.sections.some((section) => section.contentType === 'diagram')).toBe(true);
    expect(personalized.sections.some((section) => section.contentType === 'quiz')).toBe(true);
    expect(personalized.estimatedDuration).toBeGreaterThan(plan.estimatedDuration);
  });

  it('keeps the original plan when no policy exists', () => {
    expect(applyTeachingGenerationPolicy(plan)).toBe(plan);
  });
});
