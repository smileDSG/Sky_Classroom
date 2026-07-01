import { describe, expect, it } from 'vitest';
import { mergeSparseSlideOutlines } from '@/lib/generation/outline-generator';
import type { SceneOutline } from '@/lib/types/generation';

function slide(partial: Partial<SceneOutline>): SceneOutline {
  return {
    id: partial.id || `outline-${partial.order || 1}`,
    type: partial.type || 'slide',
    title: partial.title || 'Concept',
    description: partial.description || 'Short description',
    keyPoints: partial.keyPoints || ['Point A'],
    order: partial.order || 1,
    ...partial,
  };
}

describe('mergeSparseSlideOutlines', () => {
  it('merges adjacent sparse slide outlines and reorders the deck', () => {
    const outlines = [
      slide({
        id: 's1',
        title: 'Definition',
        description: 'Introduce the core definition.',
        keyPoints: ['Definition', 'Basic form'],
        order: 1,
      }),
      slide({
        id: 's2',
        title: 'Example',
        description: 'Show a compact example.',
        keyPoints: ['Example', 'Observation'],
        order: 2,
      }),
      slide({
        id: 's3',
        title: 'Practice',
        description: 'Try one question.',
        keyPoints: ['Practice'],
        order: 3,
      }),
    ];

    const merged = mergeSparseSlideOutlines(outlines);

    expect(merged).toHaveLength(2);
    expect(merged[0].title).toBe('Definition / Example');
    expect(merged[0].keyPoints).toEqual(['Definition', 'Basic form', 'Example', 'Observation']);
    expect(merged.map((outline) => outline.order)).toEqual([1, 2]);
  });

  it('does not merge across non-slide scenes', () => {
    const outlines = [
      slide({ id: 's1', title: 'Concept', keyPoints: ['A'], order: 1 }),
      slide({
        id: 'q1',
        type: 'quiz',
        title: 'Quiz',
        description: 'Check understanding.',
        keyPoints: ['Question'],
        order: 2,
        quizConfig: {
          questionCount: 1,
          difficulty: 'easy',
          questionTypes: ['single'],
        },
      }),
      slide({ id: 's2', title: 'Summary', keyPoints: ['B'], order: 3 }),
    ];

    const merged = mergeSparseSlideOutlines(outlines);

    expect(merged).toHaveLength(3);
    expect(merged.map((outline) => outline.id)).toEqual(['s1', 'q1', 's2']);
    expect(merged.map((outline) => outline.order)).toEqual([1, 2, 3]);
  });

  it('keeps media-bound sparse slides separate', () => {
    const outlines = [
      slide({
        id: 's1',
        title: 'Image Reading',
        keyPoints: ['Look at the graph'],
        suggestedImageIds: ['img_1'],
        order: 1,
      }),
      slide({ id: 's2', title: 'Text Note', keyPoints: ['A note'], order: 2 }),
    ];

    const merged = mergeSparseSlideOutlines(outlines);

    expect(merged).toHaveLength(2);
    expect(merged.map((outline) => outline.id)).toEqual(['s1', 's2']);
  });

  it('does not merge slides once the combined page would become too dense', () => {
    const longPoint = 'This point contains enough detail to make the generated page substantial.';
    const outlines = [
      slide({
        id: 's1',
        title: 'Dense A',
        description: `${longPoint} ${longPoint}`,
        keyPoints: [longPoint, `${longPoint} A`, `${longPoint} B`],
        order: 1,
      }),
      slide({
        id: 's2',
        title: 'Dense B',
        description: `${longPoint} ${longPoint}`,
        keyPoints: [longPoint, `${longPoint} C`, `${longPoint} D`],
        order: 2,
      }),
    ];

    const merged = mergeSparseSlideOutlines(outlines);

    expect(merged).toHaveLength(2);
    expect(merged.map((outline) => outline.id)).toEqual(['s1', 's2']);
  });
});
