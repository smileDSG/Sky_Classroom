import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  governanceReportSchema,
  resourceIndexSchema,
} from '@/lib/adaptive-learning/contracts/resource';
import { FileMathResourceRepository } from '@/lib/adaptive-learning/resources/repository';

const artifactDirectory = path.join(process.cwd(), 'data', 'adaptive-learning', 'gaokao-math');
const indexPath = path.join(artifactDirectory, 'resource-index.v1.json');
const reportPath = path.join(artifactDirectory, 'governance-report.v1.json');

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

const verifiedIndexResources = [
  {
    sourcePath: 'data/crawled/math/Arithmetic-Sequences-and-Sums-58b77756.md',
    nodeIds: ['sequences'],
    verifiedBy: 'project-owner',
    verifiedAt: '2026-07-28T00:00:00.000Z',
  },
  {
    sourcePath: 'data/crawled/math/Conditional-Probability-97b27e03.md',
    nodeIds: ['probability'],
    verifiedBy: 'project-owner',
    verifiedAt: '2026-07-28T00:00:00.000Z',
  },
  {
    sourcePath: 'data/crawled/math/Finding-Maxima-and-Minima-using-Derivatives-8844c91f.md',
    nodeIds: ['derivative-applications'],
    verifiedBy: 'project-owner',
    verifiedAt: '2026-07-28T00:00:00.000Z',
  },
  {
    sourcePath: 'data/crawled/math/Introduction-to-Derivatives-242a8f27.md',
    nodeIds: ['derivative-concept'],
    verifiedBy: 'project-owner',
    verifiedAt: '2026-07-28T00:00:00.000Z',
  },
  {
    sourcePath: 'data/crawled/math/Trigonometric-Identities-500b187f.md',
    nodeIds: ['trigonometry'],
    verifiedBy: 'project-owner',
    verifiedAt: '2026-07-28T00:00:00.000Z',
  },
  {
    sourcePath: 'data/crawled/math/What-is-a-Function-15e6c608.md',
    nodeIds: ['functions-basic'],
    verifiedBy: 'project-owner',
    verifiedAt: '2026-07-28T00:00:00.000Z',
  },
] as const;

describe('trusted math resource flow', () => {
  it('strictly validates the committed index and governance report', async () => {
    const [index, report] = await Promise.all([
      readJson(indexPath).then((value) => resourceIndexSchema.parse(value)),
      readJson(reportPath).then((value) => governanceReportSchema.parse(value)),
    ]);

    expect(index.curriculumPackId).toBe('gaokao-math-2026.1');
    expect(index.indexVersion).toBe('2026-07-28.1');
    expect(index.resources).toHaveLength(915);
    expect(report).toMatchObject({
      scanned: 915,
      parsed: 915,
      parseFailures: [],
      statusCounts: {
        verified: 6,
        needsReview: 884,
        rejected: 25,
      },
    });
    expect(report.resourceGapNodeIds).toEqual([
      'functions-properties',
      'statistics',
      'analytic-geometry',
      'solid-geometry',
      'complex-numbers',
      'inequalities',
    ]);
    expect(
      index.resources
        .filter((resource) => resource.status === 'verified')
        .map(({ sourcePath, nodeIds, verifiedBy, verifiedAt }) => ({
          sourcePath,
          nodeIds,
          verifiedBy,
          verifiedAt,
        })),
    ).toEqual(verifiedIndexResources);
  });

  it('serves only the six verified seeds and reports the statistics gap', async () => {
    const repository = new FileMathResourceRepository({
      indexPath,
      expectedCurriculumPackId: 'gaokao-math-2026.1',
    });

    const result = await repository.findVerified({ limit: 100 });

    expect(result).toMatchObject({
      curriculumPackId: 'gaokao-math-2026.1',
      indexVersion: '2026-07-28.1',
    });
    expect(result.resources.map(({ sourcePath, nodeIds }) => ({ sourcePath, nodeIds }))).toEqual([
      {
        sourcePath: 'data/crawled/math/What-is-a-Function-15e6c608.md',
        nodeIds: ['functions-basic'],
      },
      {
        sourcePath: 'data/crawled/math/Conditional-Probability-97b27e03.md',
        nodeIds: ['probability'],
      },
      {
        sourcePath: 'data/crawled/math/Trigonometric-Identities-500b187f.md',
        nodeIds: ['trigonometry'],
      },
      {
        sourcePath: 'data/crawled/math/Arithmetic-Sequences-and-Sums-58b77756.md',
        nodeIds: ['sequences'],
      },
      {
        sourcePath: 'data/crawled/math/Introduction-to-Derivatives-242a8f27.md',
        nodeIds: ['derivative-concept'],
      },
      {
        sourcePath: 'data/crawled/math/Finding-Maxima-and-Minima-using-Derivatives-8844c91f.md',
        nodeIds: ['derivative-applications'],
      },
    ]);

    await expect(
      repository.findVerified({ nodeId: 'statistics', limit: 100 }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_GAP',
      retryable: false,
      stage: 'resource-query',
      details: { nodeIds: ['statistics'] },
    });
  });
});
