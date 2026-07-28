import { describe, expect, it } from 'vitest';

import { GAOKAO_MATH_PACK_V1 } from '@/lib/adaptive-learning/curriculum/registry';
import type { CrawledMathDocument } from '@/lib/adaptive-learning/resources/crawled-document';
import { normalizeComparableText } from '@/lib/adaptive-learning/resources/crawled-document';
import { detectDuplicateDecisions } from '@/lib/adaptive-learning/resources/duplicate-detector';
import { mapDocumentToCurriculum } from '@/lib/adaptive-learning/resources/mapper';

function document(
  overrides: Partial<CrawledMathDocument> & Pick<CrawledMathDocument, 'sourcePath'>,
): CrawledMathDocument {
  const title = overrides.title ?? 'General mathematics notes';
  const body = overrides.body ?? 'A broad senior high mathematics overview for classroom study.';

  return {
    sourcePath: overrides.sourcePath,
    title,
    sourceUrl: overrides.sourceUrl ?? 'https://publisher.example/math',
    canonicalUrl: overrides.canonicalUrl ?? `https://example.com/${overrides.sourcePath}`,
    course: 'math',
    tags: overrides.tags ?? ['math'],
    declaredWordCount: overrides.declaredWordCount ?? 100,
    depth: overrides.depth ?? 1,
    crawledAt: overrides.crawledAt ?? '2026-07-28T08:00:00.000Z',
    body,
    normalizedTitle: overrides.normalizedTitle ?? normalizeComparableText(title),
    normalizedBody: overrides.normalizedBody ?? normalizeComparableText(body),
    language: overrides.language ?? 'en',
    contentHash: overrides.contentHash ?? 'a'.repeat(64),
  };
}

describe('deterministic curriculum mapping', () => {
  it('maps a clearly titled derivative resource independent of curriculum node order', () => {
    const resource = document({
      sourcePath: 'data/crawled/math/derivative.md',
      title: 'Derivative: slope at a point',
      body: 'The instantaneous rate of change is developed from a limiting secant slope.',
    });
    const reversedPack = {
      ...GAOKAO_MATH_PACK_V1,
      nodes: [...GAOKAO_MATH_PACK_V1.nodes].reverse(),
    };

    const expected = {
      ambiguous: false,
      candidates: [
        {
          nodeId: 'derivative-concept',
          score: 12,
          matchedAliases: ['derivative', 'instantaneous rate of change', 'slope at a point'],
        },
      ],
    };

    expect(mapDocumentToCurriculum(resource, GAOKAO_MATH_PACK_V1)).toEqual(expected);
    expect(mapDocumentToCurriculum(resource, reversedPack)).toEqual(expected);
  });

  it('keeps weak general-math and body-only matches ambiguous with no candidates', () => {
    const general = document({
      sourcePath: 'data/crawled/math/general.md',
      title: 'General mathematics study guide',
      body: 'A broad senior high mathematics overview with mixed classroom examples.',
    });
    const bodyOnly = document({
      sourcePath: 'data/crawled/math/calculus-overview.md',
      title: 'Calculus overview',
      body: 'This lesson briefly introduces the derivative before later study.',
    });

    expect(mapDocumentToCurriculum(general, GAOKAO_MATH_PACK_V1)).toEqual({
      ambiguous: true,
      candidates: [],
    });
    expect(mapDocumentToCurriculum(bodyOnly, GAOKAO_MATH_PACK_V1)).toEqual({
      ambiguous: true,
      candidates: [],
    });
  });
});

describe('deterministic duplicate decisions', () => {
  it('chooses URL and hash keepers by word count, then source-path ties, independent of input order', () => {
    const documents = [
      document({
        sourcePath: 'data/url-copy.md',
        canonicalUrl: 'https://example.com/shared-url',
        contentHash: '1'.repeat(64),
        declaredWordCount: 120,
      }),
      document({
        sourcePath: 'data/url-keeper.md',
        canonicalUrl: 'https://example.com/shared-url',
        contentHash: '2'.repeat(64),
        declaredWordCount: 240,
      }),
      document({
        sourcePath: 'data/z-hash-copy.md',
        canonicalUrl: 'https://example.com/hash-copy',
        contentHash: '3'.repeat(64),
        declaredWordCount: 180,
      }),
      document({
        sourcePath: 'data/a-hash-keeper.md',
        canonicalUrl: 'https://example.com/hash-keeper',
        contentHash: '3'.repeat(64),
        declaredWordCount: 180,
      }),
    ];
    const expectedHardDuplicates = new Map([
      [
        'data/url-copy.md',
        {
          keeperSourcePath: 'data/url-keeper.md',
          reason: 'duplicate_canonical_url' as const,
        },
      ],
      [
        'data/z-hash-copy.md',
        {
          keeperSourcePath: 'data/a-hash-keeper.md',
          reason: 'duplicate_content_hash' as const,
        },
      ],
    ]);

    expect(detectDuplicateDecisions(documents).hardDuplicates).toEqual(expectedHardDuplicates);
    expect(detectDuplicateDecisions([...documents].reverse()).hardDuplicates).toEqual(
      expectedHardDuplicates,
    );
  });

  it('preserves canonical-URL precedence when the same pair also shares a content hash', () => {
    const result = detectDuplicateDecisions([
      document({
        sourcePath: 'data/keeper.md',
        canonicalUrl: 'https://example.com/overlap',
        contentHash: '4'.repeat(64),
        declaredWordCount: 200,
      }),
      document({
        sourcePath: 'data/copy.md',
        canonicalUrl: 'https://example.com/overlap',
        contentHash: '4'.repeat(64),
        declaredWordCount: 100,
      }),
    ]);

    expect(result.hardDuplicates.get('data/copy.md')).toEqual({
      keeperSourcePath: 'data/keeper.md',
      reason: 'duplicate_canonical_url',
    });
  });

  it('reports equal normalized titles as symmetric review collisions without hard rejection', () => {
    const documents = ['c', 'a', 'b'].map((name, index) =>
      document({
        sourcePath: `data/${name}.md`,
        title: index === 0 ? 'Derivative Practice!' : 'derivative practice',
        canonicalUrl: `https://example.com/${name}`,
        contentHash: String(index + 5).repeat(64),
      }),
    );

    const result = detectDuplicateDecisions(documents);

    expect(result.hardDuplicates).toEqual(new Map());
    expect(result.titleCollisions).toEqual(
      new Map([
        ['data/a.md', ['data/b.md', 'data/c.md']],
        ['data/b.md', ['data/a.md', 'data/c.md']],
        ['data/c.md', ['data/a.md', 'data/b.md']],
      ]),
    );
  });
});
