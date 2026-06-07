// lib/solve/agents/verify-types.ts

export interface VerifyResult {
  isCorrect: boolean;
  confidence: number;
  suggestedAnswer?: string;
  reasoning: string;
}

/**
 * Default when verification fails/errors.
 * isCorrect=false ensures bad answers are NOT silently passed through.
 */
export const DEFAULT_VERIFY: VerifyResult = {
  isCorrect: false,
  confidence: 0,
  reasoning: 'verify skipped or failed',
};
