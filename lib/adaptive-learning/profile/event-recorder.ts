import { z } from 'zod';
import {
  learningEventSchema,
  learningEventTypeSchema,
  learningEvidenceQualitySchema,
  nodeIdSchema,
  type LearningEvent,
} from '@/lib/adaptive-learning/contracts';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { applyLearningEvent } from '@/lib/adaptive-learning/profile/knowledge-state-engine';
import { recordFixedItemAbilityAnswer } from '@/lib/adaptive-learning/profile/ability-state-repository';
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import { createLogger } from '@/lib/logger';
import type { StorageProvider } from '@/lib/storage/storage-types';

const log = createLogger('EventRecorder');

const fixedItemAbilityPayloadSchema = z
  .object({
    correct: z.boolean(),
    itemId: z.string().min(1),
    itemVersion: z.string().min(1),
    itemDifficulty: z.number().finite(),
    dimensionId: z.string().min(1),
    contentHash: z.string().min(1),
    generatorVersion: z.string().min(1),
  })
  .passthrough();

async function recordAbilityWhenEligible(
  event: LearningEvent,
  storage: StorageProvider,
): Promise<void> {
  if (event.type !== 'answer-submitted' || event.evidenceQuality !== 'verified') return;
  const payload = fixedItemAbilityPayloadSchema.safeParse(event.payload);
  if (!payload.success) return;

  await recordFixedItemAbilityAnswer(storage, {
    userId: event.userId,
    itemId: payload.data.itemId,
    itemVersion: payload.data.itemVersion,
    contentHash: payload.data.contentHash,
    generatorVersion: payload.data.generatorVersion,
    dimensionId: payload.data.dimensionId,
    nodeIds: event.nodeIds,
    difficulty: payload.data.itemDifficulty,
    correct: payload.data.correct,
    occurredAt: event.occurredAt,
  });
}

/**
 * Client-provided event shape. The recorder assigns eventId, occurredAt and
 * schemaVersion so callers never have to repeat that boilerplate.
 *
 * Defined manually because Zod 4 does not allow .omit() on refined schemas.
 */
export const learningEventInputSchema = z
  .object({
    userId: z.string().min(1),
    type: learningEventTypeSchema,
    source: z.string().min(1),
    nodeIds: z.array(nodeIdSchema).optional(),
    evidenceQuality: learningEvidenceQualitySchema,
    payload: z.record(z.string(), z.unknown()),
    correlationId: z.string().min(1).optional(),
  })
  .strict();

export type LearningEventInput = z.infer<typeof learningEventInputSchema>;

export interface RecordLearningEventOptions {
  /** Storage instance used to persist the event. */
  storage: StorageProvider;
  /** When true, skip invalidating the student profile cache. Defaults to false. */
  skipCacheInvalidation?: boolean;
}

/**
 * Persist a learning event and invalidate the student profile cache.
 *
 * Failures are logged and swallowed: event recording is an observability/
 * profiling concern and must not break the primary user action.
 */
export async function recordLearningEvent(
  input: LearningEventInput,
  options: RecordLearningEventOptions,
): Promise<LearningEvent | null> {
  try {
    const event = learningEventSchema.parse({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      schemaVersion: '1.0.0' as const,
      nodeIds: input.nodeIds ?? [],
    });

    const repository = new LearnerProfileRepository(options.storage);
    await repository.appendLearningEvent(event);

    // Apply the event to per-node knowledge states in real time. Failures are
    // swallowed so that the primary action is never blocked by profiling.
    await applyLearningEvent(input.userId, event, options.storage);

    // θ uses only verified responses whose question identity and fixed
    // difficulty are complete. It must never be inferred from behaviour.
    await recordAbilityWhenEligible(event, options.storage).catch((err) => {
      log.warn('Failed to update ability state after answer:', err);
    });

    if (!options.skipCacheInvalidation) {
      await invalidateProfileCache(input.userId).catch((err) => {
        log.warn('Failed to invalidate profile cache after event:', err);
      });
    }

    return event;
  } catch (err) {
    log.warn('Failed to record learning event:', err);
    return null;
  }
}

/** Convenience helper for an answer-submitted event. */
export function recordAnswerSubmitted(
  options: RecordLearningEventOptions & {
    userId: string;
    source: string;
    correct: boolean;
    nodeIds?: string[];
    knowledgePoints?: string[];
    item?: {
      itemId: string;
      itemVersion: string;
      itemDifficulty: number;
      dimensionId: string;
      contentHash: string;
      generatorVersion: string;
    };
    correlationId?: string;
  },
): Promise<LearningEvent | null> {
  return recordLearningEvent(
    {
      userId: options.userId,
      type: 'answer-submitted',
      source: options.source,
      nodeIds: options.nodeIds ?? [],
      evidenceQuality: 'verified',
      payload: {
        correct: options.correct,
        knowledgePoints: options.knowledgePoints ?? [],
        ...(options.item ?? {}),
      },
      correlationId: options.correlationId,
    },
    { storage: options.storage },
  );
}

/** Convenience helper for a review-completed event. */
export function recordReviewCompleted(
  options: RecordLearningEventOptions & {
    userId: string;
    source: string;
    rating: 'recalled' | 'forgotten' | 'easy' | 'good' | 'hard';
    nodeIds?: string[];
    knowledgePoints?: string[];
    correlationId?: string;
  },
): Promise<LearningEvent | null> {
  return recordLearningEvent(
    {
      userId: options.userId,
      type: 'review-completed',
      source: options.source,
      nodeIds: options.nodeIds ?? [],
      evidenceQuality: 'verified',
      payload: {
        rating: options.rating,
        knowledgePoints: options.knowledgePoints ?? [],
      },
      correlationId: options.correlationId,
    },
    { storage: options.storage },
  );
}

/** Record selected intervention; does not affect knowledge state. */
export function recordInterventionSelected(
  options: RecordLearningEventOptions & {
    userId: string;
    source: string;
    decisionId: string;
    planId: string;
    action: 'teach' | 'review' | 'quiz' | 'diagnostic';
    topic: string | null;
    correlationId: string;
  },
): Promise<LearningEvent | null> {
  return recordLearningEvent(
    {
      userId: options.userId,
      type: 'intervention-selected',
      source: options.source,
      evidenceQuality: 'inferred',
      correlationId: options.correlationId,
      payload: {
        decisionId: options.decisionId,
        planId: options.planId,
        action: options.action,
        topic: options.topic,
      },
    },
    { storage: options.storage },
  );
}

/** Record generated intervention candidates; does not affect knowledge state. */
export function recordInterventionPlanned(
  options: RecordLearningEventOptions & {
    userId: string;
    source: string;
    decisionId: string;
    sessionId: string;
    candidatePlanIds: string[];
    fallbackUsed: boolean;
    correlationId: string;
  },
): Promise<LearningEvent | null> {
  return recordLearningEvent(
    {
      userId: options.userId,
      type: 'intervention-planned',
      source: options.source,
      evidenceQuality: 'inferred',
      correlationId: options.correlationId,
      payload: {
        decisionId: options.decisionId,
        sessionId: options.sessionId,
        candidatePlanIds: options.candidatePlanIds,
        fallbackUsed: options.fallbackUsed,
      },
    },
    { storage: options.storage },
  );
}

export interface ShadowDecisionComparisonInput {
  baselineTargetTool: 'solve' | 'slides' | 'quiz' | 'memory' | 'teaching' | null;
  newTargetTool: 'solve' | 'slides' | 'quiz' | 'memory' | 'teaching' | null;
  baselineHref: string | null;
  newHref: string | null;
  changed: boolean;
  topic: string | null;
  action: 'diagnostic' | 'teach' | 'review' | 'quiz' | null;
  profileVersion: number;
  reasonCodes: string[];
}

/** Record a read-only old-vs-new decision comparison once per profile version. */
export async function recordShadowDecision(options: RecordLearningEventOptions & {
  userId: string;
  source: string;
  comparison: ShadowDecisionComparisonInput;
  existingEvents?: LearningEvent[];
}): Promise<LearningEvent | null> {
  const comparison = options.comparison;
  const correlationId = [
    'shadow-decision',
    comparison.profileVersion,
    comparison.topic ?? 'none',
    comparison.action ?? 'none',
    comparison.baselineTargetTool ?? 'none',
    comparison.newTargetTool ?? 'none',
    comparison.changed ? 'changed' : 'same',
  ]
    .map((part) => encodeURIComponent(String(part)))
    .join(':');

  if (
    options.existingEvents?.some(
      (event) => event.type === 'shadow-decision-recorded' && event.correlationId === correlationId,
    )
  ) {
    return null;
  }

  return recordLearningEvent(
    {
      userId: options.userId,
      type: 'shadow-decision-recorded',
      source: options.source,
      evidenceQuality: 'inferred',
      payload: { ...comparison },
      correlationId,
    },
    { storage: options.storage, skipCacheInvalidation: options.skipCacheInvalidation },
  );
}
