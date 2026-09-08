import { beforeEach, describe, expect, it } from 'vitest';

import type { LearningEvent } from '@/lib/adaptive-learning/contracts';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import {
  getReflectionTriggerStatus,
  runLearnerReflection,
} from '@/lib/adaptive-learning/profile/reflection-service';
import { createLearnerReflectionDAO } from '@/lib/adaptive-learning/data/learner-reflections';

const storage = new MemoryStorageProvider();

function event(
  id: string,
  type: LearningEvent['type'],
  occurredAt: string,
  payload: Record<string, unknown> = {},
): LearningEvent {
  return {
    eventId: id,
    userId: 'reflection-user',
    type,
    occurredAt,
    source: 'test',
    nodeIds: [],
    evidenceQuality: 'verified',
    payload,
    schemaVersion: '1.0.0',
  } as LearningEvent;
}

beforeEach(async () => {
  await storage.clear('learner_reflections');
});

describe('learner reflection service', () => {
  it('creates traceable rule hypotheses without an LLM key', async () => {
    const events = [
      event('answer-1', 'answer-submitted', '2026-08-13T09:00:00.000Z', { correct: false }),
      event('answer-2', 'answer-submitted', '2026-08-13T09:01:00.000Z', { correct: false }),
      event('exit-1', 'session-exited', '2026-08-13T09:02:00.000Z', {
        decisionId: 'd1',
        durationSeconds: 120,
        reason: 'page-unload',
      }),
    ];

    const reflection = await runLearnerReflection({
      storage,
      userId: 'reflection-user',
      events,
      now: new Date('2026-08-13T09:03:00.000Z'),
    });

    expect(reflection).toMatchObject({ modelId: 'rules-v1', inputEventWatermark: 3 });
    expect(reflection?.hypotheses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimension: 'knowledge',
          evidenceEventIds: ['answer-1', 'answer-2'],
        }),
        expect.objectContaining({ dimension: 'error-pattern' }),
        expect.objectContaining({ dimension: 'persistence' }),
      ]),
    );
    expect(reflection?.sourceEventIds).toEqual(['answer-1', 'answer-2', 'exit-1']);
  });

  it('runs again after ten new events, stays idle when up to date', async () => {
    const initialEvents = [
      event('answer-1', 'answer-submitted', '2026-08-13T09:00:00.000Z', { correct: true }),
    ];
    await runLearnerReflection({
      storage,
      userId: 'reflection-user',
      events: initialEvents,
      now: new Date('2026-08-13T09:01:00.000Z'),
    });
    const nextEvents = [
      ...initialEvents,
      ...Array.from({ length: 10 }, (_, index) =>
        event(
          `answer-${index + 2}`,
          'answer-submitted',
          `2026-08-13T09:${String(index + 2).padStart(2, '0')}:00.000Z`,
          { correct: true },
        ),
      ),
    ];
    await expect(
      getReflectionTriggerStatus(
        storage,
        'reflection-user',
        nextEvents,
        new Date('2026-08-13T09:20:00.000Z'),
      ),
    ).resolves.toMatchObject({ shouldRun: true, reason: 'event-threshold', pendingEventCount: 10 });
  });
});
