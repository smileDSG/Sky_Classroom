import type { RecognitionResult } from '../types';

import { normalizeFormula, normalizeText } from './normalization';

export interface RecognitionMetrics {
  stageAccuracy: number;
  subjectAccuracy: number;
  questionTypeAccuracy: number;
  stemSimilarity: number;
  formulaRecall: number;
  givenConditionRecall: number;
  optionAccuracy: number;
}

const normalizeContent = (value: string): string =>
  normalizeText(value).replace(/[^\p{L}\p{N}]/gu, '');

const bigrams = (value: string): Set<string> => {
  if (value.length < 2) return new Set(value ? [value] : []);
  return new Set(
    Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)),
  );
};

const similarity = (gold: string | undefined, predicted: string | undefined): number => {
  const left = normalizeContent(gold ?? '');
  const right = normalizeContent(predicted ?? '');
  if (left === right) return 1;
  if (!left || !right) return 0;
  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  const overlap = [...leftPairs].filter((pair) => rightPairs.has(pair)).length;
  return (2 * overlap) / (leftPairs.size + rightPairs.size);
};

const emptyAwareRecall = (
  gold: string[] | undefined,
  predicted: string[] | undefined,
  normalize: (value: string) => string,
): number => {
  const goldSet = new Set((gold ?? []).map(normalize));
  const predictedSet = new Set((predicted ?? []).map(normalize));
  if (goldSet.size === 0) return predictedSet.size === 0 ? 1 : 0;
  const matches = [...goldSet].filter((item) => predictedSet.has(item)).length;
  return matches / goldSet.size;
};

const optionAccuracy = (gold: string[] | undefined, predicted: string[] | undefined): number => {
  const expected = new Set((gold ?? []).map(normalizeContent));
  const actual = new Set((predicted ?? []).map(normalizeContent));
  if (expected.size === 0) return actual.size === 0 ? 1 : 0;
  const matches = [...expected].filter((option) => actual.has(option)).length;
  return matches / Math.max(expected.size, actual.size);
};

const exact = (gold: string | undefined, predicted: string | undefined): number =>
  Number(normalizeText(gold ?? '') === normalizeText(predicted ?? ''));

export const evaluateRecognition = (
  gold: RecognitionResult,
  predicted: RecognitionResult,
): RecognitionMetrics => ({
  stageAccuracy: exact(gold.stage, predicted.stage),
  subjectAccuracy: exact(gold.subject, predicted.subject),
  questionTypeAccuracy: exact(gold.questionType, predicted.questionType),
  stemSimilarity: similarity(gold.stem, predicted.stem),
  formulaRecall: emptyAwareRecall(gold.formulas, predicted.formulas, normalizeFormula),
  givenConditionRecall: emptyAwareRecall(
    gold.givenConditions,
    predicted.givenConditions,
    normalizeContent,
  ),
  optionAccuracy: optionAccuracy(gold.options, predicted.options),
});
