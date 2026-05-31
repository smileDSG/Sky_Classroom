// lib/solve/agents/verify-types.ts

export interface VerifyResult {
  isCorrect: boolean;
  confidence: number;
  suggestedAnswer?: string;
  reasoning: string;
}

export const DEFAULT_VERIFY: VerifyResult = {
  isCorrect: true,
  confidence: 0,
  reasoning: 'verify skipped or failed',
};
