import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  mathResourceQueryResultSchema,
  type MathResource,
  type ResourceIndex,
} from '@/lib/adaptive-learning/contracts/resource';
import {
  DEFAULT_GAOKAO_MATH_RESOURCE_INDEX,
  FileMathResourceRepository,
  createGaokaoMathResourceRepository,
} from '@/lib/adaptive-learning/resources/repository';

function resource(overrides: Partial<MathResource> = {}): MathResource {
  return {
    id: 'math_0000000000000001',
    sourcePath: 'data/crawled/math/functions.md',
    canonicalUrl: 'https://example.com/math/functions',
    title: 'Functions worked example',
    language: 'zh-CN',
    subject: 'math',
    stage: 'senior-high',
    examSystem: 'gaokao',
    nodeIds: ['functions'],
    resourceType: 'worked-example',
    difficulty: 3,
    qualityScore: 0.9,
    contentHash: 'a'.repeat(64),
    excerpt: 'A verified worked example about functions.',
    status: 'verified',
    verifiedBy: 'reviewer-1',
    verifiedAt: '2026-07-28T00:00:00.000Z',
    rejectionReasons: [],
    ...overrides,
  };
}

async function writeRawIndex(value: unknown) {
  const root = await mkdtemp(path.join(tmpdir(), 'math-resource-repository-'));
  const indexPath = path.join(root, 'resource-index.json');
  const bytes = typeof value === 'string' ? value : `${JSON.stringify(value)}\n`;
  await writeFile(indexPath, bytes, 'utf8');
  return indexPath;
}

async function writeIndex(resources: MathResource[], overrides: Partial<ResourceIndex> = {}) {
  const index: ResourceIndex = {
    schemaVersion: '1.0.0',
    indexVersion: '2026-07-28.1',
    curriculumPackId: 'gaokao-math-2026.1',
    generatedAt: '2026-07-28T00:00:00.000Z',
    resources,
    ...overrides,
  };
  return writeRawIndex(index);
}

describe('FileMathResourceRepository', () => {
  it('returns only verified resources matching every strict filter', async () => {
    const exactMatch = resource();
    const indexPath = await writeIndex([
      exactMatch,
      resource({ id: 'math_0000000000000002', status: 'needs-review' }),
      resource({ id: 'math_0000000000000003', nodeIds: ['derivatives'] }),
      resource({ id: 'math_0000000000000004', resourceType: 'concept' }),
      resource({ id: 'math_0000000000000005', difficulty: 4 }),
    ]);
    const repository = new FileMathResourceRepository({
      indexPath,
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    });

    await expect(
      repository.findVerified({
        nodeId: 'functions',
        resourceType: 'worked-example',
        maxDifficulty: 3,
      }),
    ).resolves.toEqual({
      curriculumPackId: 'gaokao-math-2026.1',
      indexVersion: '2026-07-28.1',
      resources: [exactMatch],
    });
  });

  it('reports a resource gap without widening node, type, difficulty, or review state', async () => {
    const indexPath = await writeIndex([
      resource({ id: 'math_0000000000000002', status: 'needs-review' }),
      resource({ id: 'math_0000000000000003', nodeIds: ['derivatives'] }),
      resource({ id: 'math_0000000000000004', resourceType: 'concept' }),
      resource({ id: 'math_0000000000000005', difficulty: 4 }),
    ]);
    const repository = new FileMathResourceRepository({
      indexPath,
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    });

    await expect(
      repository.findVerified({
        nodeId: 'functions',
        resourceType: 'worked-example',
        maxDifficulty: 3,
      }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_GAP',
      retryable: false,
      stage: 'resource-query',
      details: {
        nodeIds: ['functions'],
        expectedResourceType: 'worked-example',
        maxDifficulty: 3,
      },
    });
  });

  it('strictly rejects invalid query keys before reading the index', async () => {
    const repository = new FileMathResourceRepository({
      indexPath: path.join(tmpdir(), 'must-not-be-read.json'),
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    });

    await expect(repository.findVerified({ limit: 1, widenSearch: true })).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: 'unrecognized_keys' })],
    });
  });

  it('sorts deterministically by quality, difficulty, and id before applying limit', async () => {
    const indexPath = await writeIndex([
      resource({ id: 'math_0000000000000001', qualityScore: 0.8, difficulty: 1 }),
      resource({ id: 'math_0000000000000002', qualityScore: 0.9, difficulty: 4 }),
      resource({ id: 'math_0000000000000004', qualityScore: 0.9, difficulty: 2 }),
      resource({ id: 'math_0000000000000003', qualityScore: 0.9, difficulty: 2 }),
    ]);
    const repository = new FileMathResourceRepository({
      indexPath,
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    });

    const result = await repository.findVerified({ limit: 3 });

    expect(result.resources.map(({ id }) => id)).toEqual([
      'math_0000000000000003',
      'math_0000000000000004',
      'math_0000000000000002',
    ]);
  });

  it('reports read, JSON, and schema failures as an unavailable index with the cause', async () => {
    const missingPath = path.join(
      await mkdtemp(path.join(tmpdir(), 'math-resource-repository-missing-')),
      'missing.json',
    );
    const malformedPath = await writeRawIndex('{not json');
    const invalidSchemaPath = await writeRawIndex({ schemaVersion: '1.0.0' });

    for (const indexPath of [missingPath, malformedPath, invalidSchemaPath]) {
      const repository = new FileMathResourceRepository({
        indexPath,
        expectedCurriculumPackId: 'gaokao-math-2026.1',
      });

      await expect(repository.findVerified({})).rejects.toMatchObject({
        code: 'RESOURCE_INDEX_UNAVAILABLE',
        retryable: false,
        stage: 'resource-index-read',
        details: { indexPath },
        cause: expect.anything(),
      });
    }
  });

  it('reports a curriculum pack mismatch explicitly', async () => {
    const indexPath = await writeIndex([resource()], {
      curriculumPackId: 'gaokao-math-2027.1',
    });
    const repository = new FileMathResourceRepository({
      indexPath,
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    });

    await expect(repository.findVerified({})).rejects.toMatchObject({
      code: 'CURRICULUM_VERSION_MISMATCH',
      retryable: false,
      stage: 'resource-index-read',
      details: {
        indexPath,
        expectedCurriculumPackId: 'gaokao-math-2026.1',
        actualCurriculumPackId: 'gaokao-math-2027.1',
      },
    });
  });

  it('rejects non-verified resources in the strict query result contract', () => {
    const result = mathResourceQueryResultSchema.safeParse({
      curriculumPackId: 'gaokao-math-2026.1',
      indexVersion: '2026-07-28.1',
      resources: [resource({ status: 'needs-review' })],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['resources', 0, 'status'],
          message: 'resource query results must contain only verified resources',
        }),
      );
    }
  });

  it('exposes the fixed Gaokao math factory and default index path', () => {
    expect(DEFAULT_GAOKAO_MATH_RESOURCE_INDEX).toBe(
      path.join(
        process.cwd(),
        'data',
        'adaptive-learning',
        'gaokao-math',
        'resource-index.v1.json',
      ),
    );
    expect(createGaokaoMathResourceRepository()).toBeInstanceOf(FileMathResourceRepository);
  });
});
