import type { CurriculumPack } from '@/lib/adaptive-learning/contracts/curriculum';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { GAOKAO_MATH_PACK_V1 } from './gaokao-math-v1';
import { validateCurriculumPack } from './validate-pack';

const validatedGaokaoMathPackV1 = validateCurriculumPack(GAOKAO_MATH_PACK_V1);
const CURRICULUM_PACKS = new Map<string, CurriculumPack>([
  [validatedGaokaoMathPackV1.id, validatedGaokaoMathPackV1],
]);

export { GAOKAO_MATH_PACK_V1, validateCurriculumPack };

export function getCurriculumPack(curriculumPackId: string): CurriculumPack {
  const pack = CURRICULUM_PACKS.get(curriculumPackId);

  if (!pack) {
    throw new AdaptiveLearningError({
      code: 'CURRICULUM_VERSION_MISMATCH',
      message: `Unknown curriculum pack: ${curriculumPackId}`,
      retryable: false,
      stage: 'curriculum-registry',
      details: { curriculumPackId },
    });
  }

  return validateCurriculumPack(structuredClone(pack));
}
