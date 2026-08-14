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
import {
  canonicalizeKnowledgePoint,
  resolveKnowledgePoint,
} from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';

const log = createLogger('KnowledgeStateEngine');

const INITIAL_ALPHA = 1;
const INITIAL_BETA = 1;
const INITIAL_STABILITY_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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
const STABILITY_FAILURE_MULTIPLIER = 0.5;
const MAX_STABILITY_DAYS = 365;
const MIN_STABILITY_DAYS = 1;

function getQualityWeight(quality: string): number {
  const parsed = learningEvidenceQualitySchema.safeParse(quality);
  return parsed.success ? QUALITY_WEIGHTS[parsed.data] : QUALITY_WEIGHTS.unverified;
}

interface KnowledgePointTarget {
  nodeId: string;
  displayName?: string;
}

function buildTarget(input: string): KnowledgePointTarget {
  const point = canonicalizeKnowledgePoint(input);
  return { nodeId: point.id, displayName: point.name };
}

function eventTargets(event: LearningEvent): KnowledgePointTarget[] {
  const fromNodes = (event.nodeIds ?? []).map((nodeId) => {
    const point = resolveKnowledgePoint(nodeId);
    return point ? { nodeId: point.id, displayName: point.name } : { nodeId };
  });
  const fromPayload = (event.payload?.knowledgePoints as string[] | undefined) ?? [];
  const fromKnowledgePoints = fromPayload.map(buildTarget);
  const combined = [...fromNodes, ...fromKnowledgePoints];
  const seen = new Set<string>();
  const targets: KnowledgePointTarget[] = [];
  for (const target of combined) {
    if (seen.has(target.nodeId)) continue;
    seen.add(target.nodeId);
    targets.push(target);
  }
  return targets;
}

function computeMastery(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

function computeConfidence(evidenceCount: number): number {
  // Priors express uncertainty, not evidence. Only observed events raise confidence.
  return Math.max(0, Math.min(1, 1 - Math.exp(-evidenceCount / 4)));
}

function createInitialState(userId: string, nodeId: string, displayName?: string): KnowledgeState {
  return {
    userId,
    nodeId,
    displayName,
    alpha: INITIAL_ALPHA,
    beta: INITIAL_BETA,
    mastery: computeMastery(INITIAL_ALPHA, INITIAL_BETA),
    confidence: computeConfidence(0),
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

export interface AnswerEvidenceInput {
  userId: string;
  nodeId: string;
  displayName?: string;
  correct: boolean;
  evidenceQuality: LearningEvent['evidenceQuality'];
  occurredAt: string;
  defaultStabilityDays: number;
  previous?: KnowledgeState | null;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function retentionAt(previous: KnowledgeState | null | undefined, occurredAt: string): number {
  if (!previous?.lastEvidenceAt) return 1;
  const elapsedDays = Math.max(
    0,
    (new Date(occurredAt).getTime() - new Date(previous.lastEvidenceAt).getTime()) /
      MILLISECONDS_PER_DAY,
  );
  return Math.exp(-elapsedDays / Math.max(1, previous.reviewStabilityDays));
}

export function updateKnowledgeStateFromAnswer(input: AnswerEvidenceInput): KnowledgeState {
  const previous = input.previous;
  const retention = retentionAt(previous, input.occurredAt);
  const weight = getQualityWeight(input.evidenceQuality);
  const previousAlpha = previous?.alpha ?? INITIAL_ALPHA;
  const previousBeta = previous?.beta ?? INITIAL_BETA;
  const alpha =
    INITIAL_ALPHA + (previousAlpha - INITIAL_ALPHA) * retention + (input.correct ? weight : 0);
  const beta =
    INITIAL_BETA + (previousBeta - INITIAL_BETA) * retention + (input.correct ? 0 : weight);
  const evidenceCount = (previous?.evidenceCount ?? 0) + 1;
  const stability = previous?.reviewStabilityDays ?? input.defaultStabilityDays;
  const reviewStabilityDays = input.correct
    ? stability * STABILITY_SUCCESS_MULTIPLIER
    : stability * STABILITY_FAILURE_MULTIPLIER;

  return knowledgeStateSchema.parse({
    userId: input.userId,
    nodeId: input.nodeId,
    ...(previous?.displayName || input.displayName
      ? { displayName: previous?.displayName ?? input.displayName }
      : {}),
    alpha: round(alpha),
    beta: round(beta),
    mastery: round(alpha / (alpha + beta)),
    confidence: round(computeConfidence(evidenceCount)),
    retention: 1,
    reviewStabilityDays: round(clampStability(reviewStabilityDays)),
    repeatedErrorCount: input.correct ? 0 : (previous?.repeatedErrorCount ?? 0) + 1,
    lastEvidenceAt: input.occurredAt,
    ...(previous?.lastReviewedAt ? { lastReviewedAt: previous.lastReviewedAt } : {}),
    evidenceCount,
    version: (previous?.version ?? 0) + 1,
  });
}

export function applyAnswerEvent(state: KnowledgeState, event: LearningEvent): KnowledgeState {
  return updateKnowledgeStateFromAnswer({
    userId: state.userId,
    nodeId: state.nodeId,
    correct: Boolean(event.payload.correct),
    evidenceQuality: event.evidenceQuality,
    occurredAt: event.occurredAt,
    defaultStabilityDays: state.reviewStabilityDays,
    previous: state,
  });
}

export function applyReviewEvent(state: KnowledgeState, event: LearningEvent): KnowledgeState {
  const rating = String(event.payload.rating ?? 'good');
  const weights = REVIEW_RATING_WEIGHTS[rating] ?? REVIEW_RATING_WEIGHTS.good;
  const weight = getQualityWeight(event.evidenceQuality);
  const now = event.occurredAt;

  const alpha = state.alpha + weights.alpha * weight;
  const beta = state.beta + weights.beta * weight;
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
    confidence: computeConfidence(state.evidenceCount + 1),
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
    const targets = eventTargets(event);
    if (targets.length === 0) return;

    const dao = createKnowledgeStateDAO(storage);
    const now = new Date().toISOString();
    let existingStates = await dao.list(userId);

    for (const target of targets) {
      const directState = existingStates.find((state) => state.nodeId === target.nodeId);
      const aliasState = directState
        ? undefined
        : existingStates.find((state) => {
            const label = state.displayName ?? state.nodeId;
            return canonicalizeKnowledgePoint(label).id === target.nodeId;
          });
      const previous = directState ?? aliasState;
      let state =
        event.type === 'answer-submitted'
          ? updateKnowledgeStateFromAnswer({
              userId,
              nodeId: target.nodeId,
              displayName: target.displayName,
              correct: Boolean(event.payload.correct),
              evidenceQuality: event.evidenceQuality,
              occurredAt: event.occurredAt,
              defaultStabilityDays: INITIAL_STABILITY_DAYS,
              previous,
            })
          : applyEventToState(
              previous ?? createInitialState(userId, target.nodeId, target.displayName),
              event,
            );
      state = {
        ...state,
        nodeId: target.nodeId,
        ...(target.displayName ? { displayName: target.displayName } : {}),
      };
      const validated = knowledgeStateSchema.parse(state);
      await dao.set(userId, validated);
      if (aliasState && aliasState.nodeId !== target.nodeId) {
        await dao.delete(userId, aliasState.nodeId);
      }
      existingStates = [
        ...existingStates.filter(
          (existing) =>
            existing.nodeId !== target.nodeId && existing.nodeId !== aliasState?.nodeId,
        ),
        validated,
      ];
    }

    log.info(`Applied ${event.type} to ${targets.length} node(s) for ${userId}`, {
      eventId: event.eventId,
      nodeIds: targets.map((t) => t.nodeId),
      occurredAt: now,
    });
  } catch (err) {
    log.warn('Failed to apply learning event to knowledge state:', err);
  }
}
