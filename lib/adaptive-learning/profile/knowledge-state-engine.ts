/**
 * KnowledgeStateEngine
 *
 * Applies learning events to per-user, per-node knowledge states using a
 * Beta(alpha, beta) Bayesian model. The engine is intentionally defensive:
 * failures are logged and swallowed so that event recording never breaks the
 * primary user action.
 */

import {
  learningEvidenceQualitySchema,
  knowledgeStateSchema,
  type EvidenceQuality,
  type KnowledgeState,
  type LearningEvent,
} from '@/lib/adaptive-learning/contracts';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import type { StorageProvider } from '@/lib/storage/storage-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('KnowledgeStateEngine');

const INITIAL_ALPHA = 2;
const INITIAL_BETA = 2;
const INITIAL_STABILITY_DAYS = 7;

const QUALITY_WEIGHTS: Record<EvidenceQuality, number> = {
  verified: 1.0,
  'teacher-verified': 1.2,
  'self-reported': 0.6,
  inferred: 0.4,
  unverified: 0.2,
};

const REVIEW_RATING_WEIGHTS: Record<string, { alpha: number; beta: number }> = {
  easy: { alpha: 1.0, beta: 0 },
  recalled: { alpha: 0.8, beta: 0 },
  good: { alpha: 0.5, beta: 0 },
  hard: { alpha: 0.2, beta: 0.3 },
  forgotten: { alpha: 0, beta: 0.8 },
};

const STABILITY_SUCCESS_MULTIPLIER = 1.25;
const STABILITY_FAILURE_MULTIPLIER = 0.75;
const MAX_STABILITY_DAYS = 365;
const MIN_STABILITY_DAYS = 1;

function getQualityWeight(quality: string): number {
  const parsed = learningEvidenceQualitySchema.safeParse(quality);
  return parsed.success ? QUALITY_WEIGHTS[parsed.data] : QUALITY_WEIGHTS.unverified;
}

function stableNodeId(input: string): string {
  const trimmed = input.trim().toLowerCase();

  // Try to build a readable kebab ID from ASCII/Latin characters.
  const slug = trimmed.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return `kp-${slug}`;
  }

  // Fallback to a deterministic hex hash for non-ASCII names (e.g. CJK).
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    hash = (hash << 5) - hash + code;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `kp-${hex}`;
}

function eventTargetNodeIds(event: LearningEvent): string[] {
  const fromNodes = event.nodeIds ?? [];
  const fromPayload = (event.payload?.knowledgePoints as string[] | undefined) ?? [];
  const fromKnowledgePoints = fromPayload.map(stableNodeId);
  return Array.from(new Set([...fromNodes, ...fromKnowledgePoints]));
}

function computeMastery(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

function computeConfidence(alpha: number, beta: number): number {
  // Confidence grows with total evidence; starts near 0 and approaches 1.
  const total = alpha + beta;
  return Math.max(0, Math.min(1, 1 - 2 / (total + 2)));
}

function computeRetention(
  lastEvidenceAt: string | undefined,
  stabilityDays: number,
  now: Date,
): number {
  if (!lastEvidenceAt) return 1;
  const elapsedMs = now.getTime() - new Date(lastEvidenceAt).getTime();
  const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24));
  return Math.exp(-elapsedDays / stabilityDays);
}

function createInitialState(userId: string, nodeId: string): KnowledgeState {
  return {
    userId,
    nodeId,
    alpha: INITIAL_ALPHA,
    beta: INITIAL_BETA,
    mastery: computeMastery(INITIAL_ALPHA, INITIAL_BETA),
    confidence: computeConfidence(INITIAL_ALPHA, INITIAL_BETA),
    retention: 1,
    reviewStabilityDays: INITIAL_STABILITY_DAYS,
    repeatedErrorCount: 0,
    evidenceCount: 0,
    version: 1,
  };
}

function clampStability(days: number): number {
  return Math.max(MIN_STABILITY_DAYS, Math.min(MAX_STABILITY_DAYS, days));
}

export function applyAnswerEvent(state: KnowledgeState, event: LearningEvent): KnowledgeState {
  const correct = Boolean(event.payload.correct);
  const weight = getQualityWeight(event.evidenceQuality);
  const now = event.occurredAt;

  let alpha = state.alpha;
  let beta = state.beta;
  let repeatedErrorCount = state.repeatedErrorCount;
  let stabilityDays = state.reviewStabilityDays;

  if (correct) {
    alpha += weight;
    stabilityDays *= STABILITY_SUCCESS_MULTIPLIER;
  } else {
    beta += weight;
    repeatedErrorCount += 1;
    stabilityDays *= STABILITY_FAILURE_MULTIPLIER;
  }

  return {
    ...state,
    alpha,
    beta,
    mastery: computeMastery(alpha, beta),
    confidence: computeConfidence(alpha, beta),
    retention: computeRetention(state.lastReviewedAt, stabilityDays, new Date(now)),
    reviewStabilityDays: clampStability(stabilityDays),
    repeatedErrorCount,
    lastEvidenceAt: now,
    evidenceCount: state.evidenceCount + 1,
    version: state.version + 1,
  };
}

export function applyReviewEvent(state: KnowledgeState, event: LearningEvent): KnowledgeState {
  const rating = String(event.payload.rating ?? 'good');
  const weights = REVIEW_RATING_WEIGHTS[rating] ?? REVIEW_RATING_WEIGHTS.good;
  const weight = getQualityWeight(event.evidenceQuality);
  const now = event.occurredAt;

  let alpha = state.alpha + weights.alpha * weight;
  let beta = state.beta + weights.beta * weight;
  let stabilityDays = state.reviewStabilityDays;

  if (weights.beta > 0) {
    // Forgetting / hard review shortens stability.
    stabilityDays *= STABILITY_FAILURE_MULTIPLIER;
  } else if (weights.alpha > 0) {
    // Successful recall lengthens stability.
    stabilityDays *= STABILITY_SUCCESS_MULTIPLIER;
  }

  return {
    ...state,
    alpha,
    beta,
    mastery: computeMastery(alpha, beta),
    confidence: computeConfidence(alpha, beta),
    retention: 1,
    reviewStabilityDays: clampStability(stabilityDays),
    lastReviewedAt: now,
    lastEvidenceAt: now,
    evidenceCount: state.evidenceCount + 1,
    version: state.version + 1,
  };
}

export function applyEventToState(state: KnowledgeState, event: LearningEvent): KnowledgeState {
  switch (event.type) {
    case 'answer-submitted':
      return applyAnswerEvent(state, event);
    case 'review-completed':
      return applyReviewEvent(state, event);
    default:
      // Other event types do not yet affect knowledge state.
      return state;
  }
}

export async function applyLearningEvent(
  userId: string,
  event: LearningEvent,
  storage: StorageProvider,
): Promise<void> {
  try {
    const nodeIds = eventTargetNodeIds(event);
    if (nodeIds.length === 0) return;

    const dao = createKnowledgeStateDAO(storage);
    const now = new Date().toISOString();

    for (const nodeId of nodeIds) {
      let state = (await dao.get(userId, nodeId)) ?? createInitialState(userId, nodeId);
      state = applyEventToState(state, event);
      const validated = knowledgeStateSchema.parse(state);
      await dao.set(userId, validated);
    }

    log.info(`Applied ${event.type} to ${nodeIds.length} node(s) for ${userId}`, {
      eventId: event.eventId,
      nodeIds,
      occurredAt: now,
    });
  } catch (err) {
    log.warn('Failed to apply learning event to knowledge state:', err);
  }
}
