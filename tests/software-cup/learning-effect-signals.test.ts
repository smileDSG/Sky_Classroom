import { describe, expect, it } from 'vitest';

import { learningEffectToProfileSignals } from '@/lib/software-cup/learning-effect';

describe('learning effect profile signals', () => {
  it('turns practice results into profile signals for weak points and current state', () => {
    const signals = learningEffectToProfileSignals({
      userId: 'student-1',
      now: 1000,
      results: [
        {
          questionId: 'q1',
          knowledgePoint: 'vector retrieval',
          correct: false,
          errorTag: 'concept boundary',
        },
        {
          questionId: 'q2',
          knowledgePoint: 'RAG workflow',
          correct: true,
        },
      ],
    });

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'student-1',
          dimension: 'knowledgeBase',
          source: 'quiz',
          value: {
            strongPoints: ['RAG workflow'],
            weakPoints: ['vector retrieval'],
          },
        }),
        expect.objectContaining({
          dimension: 'errorPatternPreference',
          value: ['concept boundary'],
          source: 'quiz',
        }),
        expect.objectContaining({
          dimension: 'currentLearningState',
          source: 'quiz',
        }),
      ]),
    );
    expect(signals.find((signal) => signal.dimension === 'currentLearningState')?.value).toContain(
      'vector retrieval',
    );
  });
});
