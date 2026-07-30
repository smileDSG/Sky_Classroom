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
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import { createLogger } from '@/lib/logger';
import type { StorageProvider } from '@/lib/storage/storage-types';

const log = createLogger('EventRecorder');

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
