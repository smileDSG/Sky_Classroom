import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  governanceReportSchema,
  resourceIndexSchema,
  type GovernanceReport,
  type ManualVerificationManifest,
} from '@/lib/adaptive-learning/contracts/resource';
import { GAOKAO_MATH_PACK_V1 } from '@/lib/adaptive-learning/curriculum/registry';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import type { CrawledMathDocument } from '@/lib/adaptive-learning/resources/crawled-document';
import { normalizeComparableText } from '@/lib/adaptive-learning/resources/crawled-document';
import { governMathResources } from '@/lib/adaptive-learning/resources/governance';

const NOW = '2026-07-28T12:00:00.000Z';
const INDEX_VERSION = '2026-07-28.1';

function document(
  overrides: Partial<CrawledMathDocument> & Pick<CrawledMathDocument, 'sourcePath'>,
): CrawledMathDocument {
  const title = overrides.title ?? 'Derivative concept';
  const body =
    overrides.body ?? 'The derivative describes slope and instantaneous change. '.repeat(3);

  return {
    sourcePath: overrides.sourcePath,
    title,
    sourceUrl: overrides.sourceUrl ?? 'https://publisher.example/math',
    canonicalUrl: overrides.canonicalUrl ?? `https://example.com/${overrides.sourcePath}`,
    course: 'math',
    tags: overrides.tags ?? ['math'],
    declaredWordCount: overrides.declaredWordCount ?? 120,
    depth: overrides.depth ?? 1,
    crawledAt: overrides.crawledAt ?? '2026-07-28T08:00:00.000Z',
    body,
    normalizedTitle: overrides.normalizedTitle ?? normalizeComparableText(title),
    normalizedBody: overrides.normalizedBody ?? normalizeComparableText(body),
    language: overrides.language ?? 'en',
    contentHash:
      overrides.contentHash ?? createHash('sha256').update(overrides.sourcePath).digest('hex'),
  };
}

function manifest(
  entries: ManualVerificationManifest['entries'] = [],
  curriculumPackId = GAOKAO_MATH_PACK_V1.id,
): ManualVerificationManifest {
  return {
    schemaVersion: '1.0.0',
    curriculumPackId,
    entries,
  };
}

function govern(
  documents: CrawledMathDocument[],
  verificationManifest: ManualVerificationManifest = manifest(),
  parseFailures: GovernanceReport['parseFailures'] = [],
) {
  return governMathResources({
    documents,
    manifest: verificationManifest,
    pack: GAOKAO_MATH_PACK_V1,
    indexVersion: INDEX_VERSION,
    now: NOW,
    scanned: documents.length + parseFailures.length,
    parseFailures,
  });
}

function captureGovernanceError(run: () => unknown): AdaptiveLearningError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AdaptiveLearningError);
    const adaptiveError = error as AdaptiveLearningError;
    expect(adaptiveError).toMatchObject({
      code: 'INVALID_SCHEMA',
      retryable: false,
      stage: 'resource-governance',
    });
    return adaptiveError;
  }
  throw new Error('Expected resource-governance INVALID_SCHEMA');
}

describe('math resource governance', () => {
  it('verifies only manually approved resources and emits deterministic strict outputs', () => {
    const approved = document({
      sourcePath: 'data/a-approved.md',
      title: 'Derivative activity',
      canonicalUrl: 'https://www.mathsisfun.com/calculus/derivatives.html',
      declaredWordCount: 350,
      body: `# Derivative activity\n\n${'Detailed derivative explanation and worked steps. '.repeat(10)}`,
    });
    const unreviewed = document({
      sourcePath: 'data/z-unreviewed.md',
      title: 'Derivative review',
    });
    const verificationManifest = manifest([
      {
        sourcePath: approved.sourcePath,
        status: 'verified',
        nodeIds: ['derivative-concept'],
        resourceType: 'worked-example',
        difficulty: 4,
        reviewer: 'reviewer@example.com',
        reviewedAt: '2026-07-28T10:00:00.000Z',
        notes: 'Approved against the source and curriculum.',
      },
    ]);
    const parseFailures = [
      { sourcePath: 'data/broken.md', code: 'INVALID_SCHEMA', message: 'bad front matter' },
    ];

    const first = govern([unreviewed, approved], verificationManifest, parseFailures);
    const second = govern([approved, unreviewed], verificationManifest, parseFailures);

    expect(first).toEqual(second);
    expect(resourceIndexSchema.safeParse(first.index).success).toBe(true);
    expect(governanceReportSchema.safeParse(first.report).success).toBe(true);
    expect(first.index.resources.map((resource) => resource.sourcePath)).toEqual([
      approved.sourcePath,
      unreviewed.sourcePath,
    ]);

    const approvedResource = first.index.resources[0];
    expect(approvedResource).toMatchObject({
      id: `math_${createHash('sha256')
        .update(`${approved.canonicalUrl}\n${approved.contentHash}\n${approved.sourcePath}`)
        .digest('hex')
        .slice(0, 16)}`,
      nodeIds: ['derivative-concept'],
      resourceType: 'worked-example',
      difficulty: 4,
      qualityScore: 1,
      status: 'verified',
      verifiedBy: 'reviewer@example.com',
      verifiedAt: '2026-07-28T10:00:00.000Z',
      rejectionReasons: [],
    });
    expect(approvedResource.excerpt).not.toMatch(/\s{2,}/u);

    expect(first.index.resources[1]).toMatchObject({
      nodeIds: ['derivative-concept'],
      resourceType: 'review',
      difficulty: 3,
      status: 'needs-review',
      rejectionReasons: ['manual_verification_required'],
    });
    expect(first.report).toMatchObject({
      schemaVersion: '1.0.0',
      indexVersion: INDEX_VERSION,
      scanned: 3,
      parsed: 2,
      statusCounts: { verified: 1, needsReview: 1, rejected: 0 },
      reasonCounts: { manual_verification_required: 1 },
      parseFailures,
    });
    expect(first.report.resourceGapNodeIds).not.toContain('derivative-concept');
    expect(first.report.resourceGapNodeIds).toHaveLength(GAOKAO_MATH_PACK_V1.nodes.length - 1);
  });

  it('rejects hard duplicates with their keeper and leaves uncovered nodes as gaps', () => {
    const keeper = document({
      sourcePath: 'data/a-keeper.md',
      canonicalUrl: 'https://example.com/shared',
      contentHash: 'd'.repeat(64),
      declaredWordCount: 400,
    });
    const copy = document({
      sourcePath: 'data/b-copy.md',
      title: 'Derivative exercise',
      canonicalUrl: 'https://example.com/shared',
      contentHash: 'd'.repeat(64),
      declaredWordCount: 100,
    });

    const { index, report } = govern([copy, keeper]);
    const rejected = index.resources.find((resource) => resource.sourcePath === copy.sourcePath);

    expect(rejected).toMatchObject({
      status: 'rejected',
      rejectionReasons: ['duplicate_canonical_url', `keeper:${keeper.sourcePath}`],
    });
    expect(new Set(index.resources.map((resource) => resource.id))).toHaveLength(2);
    expect(report.statusCounts).toEqual({ verified: 0, needsReview: 1, rejected: 1 });
    expect(report.reasonCounts).toEqual({
      duplicate_canonical_url: 1,
      manual_verification_required: 1,
    });
    expect(report.resourceGapNodeIds).toEqual(
      GAOKAO_MATH_PACK_V1.nodes.map((node) => node.id),
    );
  });

  it('adds explicit ambiguous and title-collision review reasons without auto-verification', () => {
    const general = document({
      sourcePath: 'data/general.md',
      title: 'General mathematics guide',
      body: 'Broad classroom study notes without a specific curriculum topic. '.repeat(2),
    });
    const collisionA = document({
      sourcePath: 'data/collision-a.md',
      title: 'Derivative Practice!',
    });
    const collisionB = document({
      sourcePath: 'data/collision-b.md',
      title: 'derivative practice',
    });

    const { index } = govern([general, collisionB, collisionA]);
    const byPath = new Map(index.resources.map((resource) => [resource.sourcePath, resource]));

    expect(byPath.get(general.sourcePath)).toMatchObject({
      status: 'needs-review',
      nodeIds: [],
      rejectionReasons: ['manual_verification_required', 'ambiguous_curriculum_mapping'],
    });
    for (const sourcePath of [collisionA.sourcePath, collisionB.sourcePath]) {
      expect(byPath.get(sourcePath)).toMatchObject({
        status: 'needs-review',
        rejectionReasons: ['manual_verification_required', 'title_collision'],
      });
    }
  });

  it('rejects pack mismatches, missing manifest sources, and unknown verified nodes', () => {
    const source = document({ sourcePath: 'data/source.md' });
    const verifiedEntry: ManualVerificationManifest['entries'][number] = {
      sourcePath: source.sourcePath,
      status: 'verified',
      nodeIds: ['derivative-concept'],
      resourceType: 'concept',
      difficulty: 3,
      reviewer: 'reviewer',
      reviewedAt: NOW,
      notes: 'checked',
    };
    const cases = [
      {
        manifest: manifest([], 'gaokao-math-2026.2'),
        details: {
          curriculumPackId: GAOKAO_MATH_PACK_V1.id,
          manifestCurriculumPackId: 'gaokao-math-2026.2',
        },
      },
      {
        manifest: manifest([{ ...verifiedEntry, sourcePath: 'data/missing.md' }]),
        details: { sourcePath: 'data/missing.md' },
      },
      {
        manifest: manifest([{ ...verifiedEntry, nodeIds: ['missing-node'] }]),
        details: { sourcePath: source.sourcePath, nodeId: 'missing-node' },
      },
    ];

    for (const testCase of cases) {
      const error = captureGovernanceError(() => govern([source], testCase.manifest));
      expect(error.details).toMatchObject(testCase.details);
    }
  });

  it('rejects duplicate manifest source paths regardless of conflicting entry order', () => {
    const source = document({ sourcePath: 'data/duplicate-manifest-source.md' });
    const verified: ManualVerificationManifest['entries'][number] = {
      sourcePath: source.sourcePath,
      status: 'verified',
      nodeIds: ['derivative-concept'],
      resourceType: 'concept',
      difficulty: 3,
      reviewer: 'reviewer',
      reviewedAt: NOW,
      notes: 'approved',
    };
    const rejected: ManualVerificationManifest['entries'][number] = {
      sourcePath: source.sourcePath,
      status: 'rejected',
      reasons: ['source_not_trustworthy'],
      reviewer: 'reviewer',
      reviewedAt: NOW,
      notes: 'rejected',
    };

    for (const entries of [
      [verified, rejected],
      [rejected, verified],
    ]) {
      const error = captureGovernanceError(() => govern([source], manifest(entries)));
      expect(error.details).toMatchObject({ sourcePath: source.sourcePath });
    }
  });

  it('rejects invalid and non-HTTP canonical URLs as structured governance errors', () => {
    for (const [name, canonicalUrl] of [
      ['invalid', 'not a valid URL'],
      ['javascript', 'javascript:alert(1)'],
      ['data', 'data:text/plain,math'],
      ['ftp', 'ftp://example.com/math'],
    ]) {
      const source = document({
        sourcePath: `data/${name}-url.md`,
        canonicalUrl,
      });

      const error = captureGovernanceError(() => govern([source]));
      expect(error.details).toMatchObject({
        sourcePath: source.sourcePath,
        canonicalUrl: source.canonicalUrl,
      });
    }
  });

  it('counts manual keeper-like rejection reasons without counting duplicate keeper metadata', () => {
    const source = document({ sourcePath: 'data/manual-rejection.md' });
    const verificationManifest = manifest([
      {
        sourcePath: source.sourcePath,
        status: 'rejected',
        reasons: ['keeper:manual-policy'],
        reviewer: 'reviewer',
        reviewedAt: NOW,
        notes: 'Policy rejection with a keeper-like reason.',
      },
    ]);

    const { report } = govern([source], verificationManifest);

    expect(report.reasonCounts).toEqual({ 'keeper:manual-policy': 1 });
  });

  it('refuses to manually verify a document rejected as a hard duplicate', () => {
    const keeper = document({
      sourcePath: 'data/keeper.md',
      canonicalUrl: 'https://example.com/shared',
      declaredWordCount: 300,
    });
    const duplicate = document({
      sourcePath: 'data/duplicate.md',
      canonicalUrl: 'https://example.com/shared',
      declaredWordCount: 100,
    });
    const verificationManifest = manifest([
      {
        sourcePath: duplicate.sourcePath,
        status: 'verified',
        nodeIds: ['derivative-concept'],
        resourceType: 'concept',
        difficulty: 3,
        reviewer: 'reviewer',
        reviewedAt: NOW,
        notes: 'incorrect approval',
      },
    ]);

    const error = captureGovernanceError(() => govern([keeper, duplicate], verificationManifest));
    expect(error.details).toMatchObject({
      sourcePath: duplicate.sourcePath,
      keeperSourcePath: keeper.sourcePath,
    });
  });
});
