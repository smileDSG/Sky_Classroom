import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  mathResourceQueryResultSchema,
  mathResourceQuerySchema,
  resourceIndexSchema,
  type MathResourceQueryResult,
  type ResourceIndex,
} from '@/lib/adaptive-learning/contracts/resource';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

export const DEFAULT_GAOKAO_MATH_RESOURCE_INDEX = path.join(
  process.cwd(),
  'data',
  'adaptive-learning',
  'gaokao-math',
  'resource-index.v1.json',
);

export interface FileMathResourceRepositoryOptions {
  indexPath: string;
  expectedCurriculumPackId: string;
}

export class FileMathResourceRepository {
  constructor(private readonly options: FileMathResourceRepositoryOptions) {}

  async findVerified(input: unknown): Promise<MathResourceQueryResult> {
    const query = mathResourceQuerySchema.parse(input);
    const index = await this.readIndex();
    const resources = index.resources
      .filter((resource) => resource.status === 'verified')
      .filter((resource) => !query.nodeId || resource.nodeIds.includes(query.nodeId))
      .filter((resource) => !query.resourceType || resource.resourceType === query.resourceType)
      .filter(
        (resource) =>
          query.maxDifficulty === undefined || resource.difficulty <= query.maxDifficulty,
      )
      .sort(
        (left, right) =>
          right.qualityScore - left.qualityScore ||
          left.difficulty - right.difficulty ||
          (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
      )
      .slice(0, query.limit);

    if (resources.length === 0) {
      throw new AdaptiveLearningError({
        code: 'RESOURCE_GAP',
        message: 'No verified math resources match the requested constraints',
        retryable: false,
        stage: 'resource-query',
        details: {
          nodeIds: query.nodeId ? [query.nodeId] : [],
          expectedResourceType: query.resourceType,
          maxDifficulty: query.maxDifficulty,
        },
      });
    }

    return mathResourceQueryResultSchema.parse({
      curriculumPackId: index.curriculumPackId,
      indexVersion: index.indexVersion,
      resources,
    });
  }

  private async readIndex(): Promise<ResourceIndex> {
    let index: ResourceIndex;
    try {
      const bytes = await readFile(this.options.indexPath, 'utf8');
      index = resourceIndexSchema.parse(JSON.parse(bytes));
    } catch (cause) {
      throw new AdaptiveLearningError({
        code: 'RESOURCE_INDEX_UNAVAILABLE',
        message: 'Math resource index could not be read or validated',
        retryable: false,
        stage: 'resource-index-read',
        details: { indexPath: this.options.indexPath },
        cause,
      });
    }

    if (index.curriculumPackId !== this.options.expectedCurriculumPackId) {
      throw new AdaptiveLearningError({
        code: 'CURRICULUM_VERSION_MISMATCH',
        message: 'Math resource index curriculum pack does not match the expected pack',
        retryable: false,
        stage: 'resource-index-read',
        details: {
          indexPath: this.options.indexPath,
          expectedCurriculumPackId: this.options.expectedCurriculumPackId,
          actualCurriculumPackId: index.curriculumPackId,
        },
      });
    }

    return index;
  }
}

export function createGaokaoMathResourceRepository(): FileMathResourceRepository {
  return new FileMathResourceRepository({
    indexPath: DEFAULT_GAOKAO_MATH_RESOURCE_INDEX,
    expectedCurriculumPackId: 'gaokao-math-2026.1',
  });
}
