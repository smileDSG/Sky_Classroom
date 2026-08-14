/**
 * Fixed-item Rasch ability estimator.
 *
 * V1 deliberately updates only learner ability. Item difficulty remains part
 * of the immutable item definition until sufficient offline data exists for
 * calibrated item parameters.
 */

import type { AbilityState } from '@/lib/adaptive-learning/contracts';

const INITIAL_THETA = 0;
const INITIAL_LEARNING_RATE = 0.25;
const MIN_LEARNING_RATE = 0.05;

export interface FixedDifficultyItem {
  itemId: string;
  itemVersion: string;
  contentHash: string;
  generatorVersion: string;
  dimensionId: string;
  nodeIds: string[];
  difficulty: number;
}

export interface AbilityAnswerUpdate {
  previous: AbilityState;
  item: FixedDifficultyItem;
  correct: boolean;
  occurredAt: string;
}

export interface AbilityAnswerResult {
  next: AbilityState;
  predictedCorrectness: number;
  itemDifficulty: number;
  learningRate: number;
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function learningRate(answerCount: number): number {
  return Math.max(MIN_LEARNING_RATE, INITIAL_LEARNING_RATE / Math.sqrt(answerCount + 1));
}

export function createInitialAbilityState(input: {
  userId: string;
  dimensionId: string;
}): AbilityState {
  return {
    userId: input.userId,
    dimensionId: input.dimensionId,
    theta: INITIAL_THETA,
    answerCount: 0,
    version: 1,
  };
}

export function updateAbilityFromAnswer(input: AbilityAnswerUpdate): AbilityAnswerResult {
  if (input.previous.dimensionId !== input.item.dimensionId) {
    throw new Error('Ability state and item must use the same dimensionId');
  }

  const predictedCorrectness = sigmoid(input.previous.theta - input.item.difficulty);
  const observed = input.correct ? 1 : 0;
  const rate = learningRate(input.previous.answerCount);
  const theta = input.previous.theta + rate * (observed - predictedCorrectness);

  return {
    next: {
      ...input.previous,
      theta: round(theta),
      answerCount: input.previous.answerCount + 1,
      lastEvidenceAt: input.occurredAt,
      version: input.previous.version + 1,
    },
    predictedCorrectness: round(predictedCorrectness),
    itemDifficulty: input.item.difficulty,
    learningRate: round(rate),
  };
}
