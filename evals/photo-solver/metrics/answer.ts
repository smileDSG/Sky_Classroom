import { normalizeAnswer } from './normalization';

export interface NumericTolerance {
  absolute?: number;
  relative?: number;
}

export interface AnswerEvaluationInput {
  predictedAnswer?: string;
  standardAnswer: string;
  answerAliases?: string[];
  numericTolerance?: NumericTolerance;
  shouldReject?: boolean;
  didReject?: boolean;
  evidence?: string[];
  requiredEvidence?: string[];
  subjective?: boolean;
}

export interface AnswerMetrics {
  normalizedExactMatch: number;
  aliasMatch: number;
  numericMatch: number;
  answerMatch: number;
  rejectionAccuracy: number | undefined;
  requiredEvidenceCoverage: number;
  needsHumanReview: boolean;
}

const parseStrictNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const normalized = normalizeAnswer(value);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const matchesNumericTolerance = (
  predictedAnswer: string | undefined,
  standardAnswer: string,
  tolerance: NumericTolerance | undefined,
): boolean => {
  if (!tolerance) return false;
  const predicted = parseStrictNumber(predictedAnswer);
  const standard = parseStrictNumber(standardAnswer);
  if (predicted === undefined || standard === undefined) return false;
  const difference = Math.abs(predicted - standard);
  const absoluteMatch = tolerance.absolute !== undefined && difference <= tolerance.absolute;
  const relativeMatch =
    tolerance.relative !== undefined && difference <= tolerance.relative * Math.abs(standard);
  return absoluteMatch || relativeMatch;
};

export const evaluateAnswer = (input: AnswerEvaluationInput): AnswerMetrics => {
  const predicted = input.predictedAnswer;
  const standard = normalizeAnswer(input.standardAnswer);
  const exact = predicted !== undefined && normalizeAnswer(predicted) === standard;
  const alias =
    !exact &&
    predicted !== undefined &&
    (input.answerAliases ?? []).some(
      (candidate) => normalizeAnswer(candidate) === normalizeAnswer(predicted),
    );
  const numeric =
    !exact &&
    !alias &&
    matchesNumericTolerance(predicted, input.standardAnswer, input.numericTolerance);
  const required = new Set((input.requiredEvidence ?? []).map(normalizeAnswer));
  const supplied = new Set((input.evidence ?? []).map(normalizeAnswer));
  const covered = [...required].filter((item) => supplied.has(item)).length;

  return {
    normalizedExactMatch: Number(exact),
    aliasMatch: Number(alias),
    numericMatch: Number(numeric),
    answerMatch: Number(!input.subjective && (exact || alias || numeric)),
    rejectionAccuracy:
      input.shouldReject === undefined || input.didReject === undefined
        ? undefined
        : Number(input.shouldReject === input.didReject),
    requiredEvidenceCoverage: required.size === 0 ? 1 : covered / required.size,
    needsHumanReview: Boolean(input.subjective),
  };
};
