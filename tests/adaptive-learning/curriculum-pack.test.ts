import { describe, expect, it } from 'vitest';
import { curriculumPackSchema } from '@/lib/adaptive-learning/contracts';
import {
  GAOKAO_MATH_PACK_V1,
  getCurriculumPack,
  validateCurriculumPack,
} from '@/lib/adaptive-learning/curriculum/registry';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

function captureAdaptiveLearningError(action: () => unknown): AdaptiveLearningError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(AdaptiveLearningError);
    return error as AdaptiveLearningError;
  }

  throw new Error('Expected an AdaptiveLearningError');
}

describe('Gaokao math curriculum pack', () => {
  it('publishes a validated 12-node pack with normalized exam weights', () => {
    const validatedPack = validateCurriculumPack(GAOKAO_MATH_PACK_V1);
    const totalExamWeight = validatedPack.nodes.reduce((total, node) => total + node.examWeight, 0);

    expect(validatedPack).toEqual(GAOKAO_MATH_PACK_V1);
    expect(validatedPack.nodes).toHaveLength(12);
    expect(totalExamWeight).toBeCloseTo(1, 12);
    expect(getCurriculumPack('gaokao-math-2026.1')).toEqual(GAOKAO_MATH_PACK_V1);
  });

  it('preserves the functions-to-derivatives prerequisite chain', () => {
    const nodesById = new Map(GAOKAO_MATH_PACK_V1.nodes.map((node) => [node.id, node]));

    expect(nodesById.get('functions-properties')?.prerequisiteIds).toContain('functions-basic');
    expect(nodesById.get('derivative-concept')?.prerequisiteIds).toContain('functions-properties');
    expect(nodesById.get('derivative-applications')?.prerequisiteIds).toContain(
      'derivative-concept',
    );
  });

  it('rejects broken references, cycles, cross-node aliases, and bad weights', () => {
    const missingReference = structuredClone(GAOKAO_MATH_PACK_V1);
    missingReference.nodes[0].relatedIds.push('missing-node');

    const prerequisiteCycle = structuredClone(GAOKAO_MATH_PACK_V1);
    prerequisiteCycle.nodes[0].prerequisiteIds.push('derivative-applications');

    const aliasCollision = structuredClone(GAOKAO_MATH_PACK_V1);
    aliasCollision.nodes[1].aliases.push(' ＦＵＮＣＴＩＯＮ ');

    const badTotalWeight = structuredClone(GAOKAO_MATH_PACK_V1);
    badTotalWeight.nodes[0].examWeight += 0.01;

    const missingReferenceError = captureAdaptiveLearningError(() =>
      validateCurriculumPack(missingReference),
    );

    expect(missingReferenceError).toMatchObject({
      code: 'INVALID_SCHEMA',
      retryable: false,
      stage: 'curriculum-validation',
      details: {
        nodeId: 'functions-basic',
        field: 'relatedIds',
        referencedNodeId: 'missing-node',
      },
    });
    expect(missingReferenceError.message).toMatch(/missing-node/);
    expect(() => validateCurriculumPack(prerequisiteCycle)).toThrow(/cycle/i);
    expect(() => validateCurriculumPack(aliasCollision)).toThrow(/alias/i);
    expect(() => validateCurriculumPack(badTotalWeight)).toThrow(/sum to 1/i);
  });

  it('rejects unknown curriculum pack versions without falling back', () => {
    const unknownVersion = 'gaokao-math-2026.2';
    const error = captureAdaptiveLearningError(() => getCurriculumPack(unknownVersion));

    expect(error).toMatchObject({
      code: 'CURRICULUM_VERSION_MISMATCH',
      retryable: false,
      stage: 'curriculum-registry',
      details: { curriculumPackId: unknownVersion },
    });
    expect(error.message).toMatch(/Unknown curriculum pack/);
  });

  it('is accepted by the strict curriculum pack schema', () => {
    const result = curriculumPackSchema.safeParse(GAOKAO_MATH_PACK_V1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(GAOKAO_MATH_PACK_V1);
    }
  });

  it('rejects incoherent pack identities, exam years, and node versions', () => {
    const idMismatch = structuredClone(GAOKAO_MATH_PACK_V1);
    idMismatch.id = 'gaokao-math-2026.2';

    const examYearMismatch = structuredClone(GAOKAO_MATH_PACK_V1);
    examYearMismatch.examYear = 2027;

    const nodeVersionMismatch = structuredClone(GAOKAO_MATH_PACK_V1);
    nodeVersionMismatch.nodes[0].version = '2026.2';

    const cases = [
      {
        pack: idMismatch,
        path: ['id'],
        message: 'curriculum pack id must match its version',
      },
      {
        pack: examYearMismatch,
        path: ['examYear'],
        message: 'curriculum pack version year must match examYear',
      },
      {
        pack: nodeVersionMismatch,
        path: ['nodes', 0, 'version'],
        message: 'curriculum node version must match pack version',
      },
    ];

    for (const testCase of cases) {
      const error = captureAdaptiveLearningError(() => validateCurriculumPack(testCase.pack));

      expect(error).toMatchObject({
        code: 'INVALID_SCHEMA',
        retryable: false,
        stage: 'curriculum-validation',
        details: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              path: testCase.path,
              message: testCase.message,
            }),
          ]),
        },
      });
    }
  });

  it('isolates later registry reads from caller mutations', () => {
    const firstRead = getCurriculumPack('gaokao-math-2026.1');
    const originalName = firstRead.nodes[0].name;

    try {
      firstRead.nodes[0].name = 'poisoned by caller';
      const laterRead = getCurriculumPack('gaokao-math-2026.1');

      expect(laterRead.nodes[0].name).toBe(originalName);
      expect(laterRead).toEqual(GAOKAO_MATH_PACK_V1);
      expect(laterRead).not.toBe(firstRead);
    } finally {
      firstRead.nodes[0].name = originalName;
    }
  });
});
