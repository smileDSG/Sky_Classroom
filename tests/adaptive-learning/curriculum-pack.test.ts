import { describe, expect, it } from 'vitest';
import { curriculumPackSchema } from '@/lib/adaptive-learning/contracts';
import {
  GAOKAO_MATH_PACK_V1,
  getCurriculumPack,
  validateCurriculumPack,
} from '@/lib/adaptive-learning/curriculum/registry';

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

    expect(() => validateCurriculumPack(missingReference)).toThrow(/missing-node/);
    expect(() => validateCurriculumPack(prerequisiteCycle)).toThrow(/cycle/i);
    expect(() => validateCurriculumPack(aliasCollision)).toThrow(/alias/i);
    expect(() => validateCurriculumPack(badTotalWeight)).toThrow(/sum to 1/i);
  });

  it('rejects unknown curriculum pack ids without a fallback', () => {
    expect(() => getCurriculumPack('gaokao-math-2099.1')).toThrow(/Unknown curriculum pack/);
  });

  it('is accepted by the strict curriculum pack schema', () => {
    const result = curriculumPackSchema.safeParse(GAOKAO_MATH_PACK_V1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(GAOKAO_MATH_PACK_V1);
    }
  });
});
