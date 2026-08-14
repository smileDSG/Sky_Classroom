/**
 * Unit tests for KnowledgeStateEngine
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import {
  applyAnswerEvent,
  applyReviewEvent,
  applyEventToState,
  applyLearningEvent,
} from '@/lib/adaptive-learning/profile/knowledge-state-engine';
import type { KnowledgeState, LearningEvent } from '@/lib/adaptive-learning/contracts';

function makeEvent(
  type: LearningEvent['type'],
  payload: Record<string, unknown>,
  overrides: Partial<LearningEvent> = {},
): LearningEvent {
  return {
    eventId: 'evt-1',
    userId: 'user-1',
    type,
    occurredAt: new Date().toISOString(),
    source: 'test',
    nodeIds: overrides.nodeIds ?? [],
    evidenceQuality: overrides.evidenceQuality ?? 'verified',
    payload,
    schemaVersion: '1.0.0',
    correlationId: overrides.correlationId,
    ...overrides,
  } as LearningEvent;
}

function makeState(overrides: Partial<KnowledgeState> = {}): KnowledgeState {
  return {
    userId: 'user-1',
    nodeId: 'node-a',
    alpha: 2,
    beta: 2,
    mastery: 0.5,
    confidence: 0,
    retention: 1,
    reviewStabilityDays: 7,
    repeatedErrorCount: 0,
    evidenceCount: 0,
    version: 1,
    ...overrides,
  };
}

describe('applyAnswerEvent', () => {
  it('increases alpha and mastery on correct answer', () => {
    const event = makeEvent('answer-submitted', { correct: true });
    const next = applyAnswerEvent(makeState(), event);

    expect(next.alpha).toBeGreaterThan(2);
    expect(next.beta).toBe(2);
    expect(next.mastery).toBeGreaterThan(0.5);
    expect(next.evidenceCount).toBe(1);
    expect(next.confidence).toBeLessThan(0.4);
    expect(next.lastEvidenceAt).toBe(event.occurredAt);
  });

  it('increases beta and decreases mastery on incorrect answer', () => {
    const event = makeEvent('answer-submitted', { correct: false });
    const next = applyAnswerEvent(makeState(), event);

    expect(next.alpha).toBe(2);
    expect(next.beta).toBeGreaterThan(2);
    expect(next.mastery).toBeLessThan(0.5);
    expect(next.repeatedErrorCount).toBe(1);
  });

  it('uses evidence quality weight', () => {
    const verified = makeEvent(
      'answer-submitted',
      { correct: true },
      { evidenceQuality: 'verified' },
    );
    const unverified = makeEvent(
      'answer-submitted',
      { correct: true },
      { evidenceQuality: 'unverified' },
    );

    const verifiedState = applyAnswerEvent(makeState(), verified);
    const unverifiedState = applyAnswerEvent(makeState(), unverified);

    expect(verifiedState.alpha).toBeGreaterThan(unverifiedState.alpha);
  });
});

describe('applyReviewEvent', () => {
  it('increases mastery on recalled review', () => {
    const event = makeEvent('review-completed', { rating: 'recalled' });
    const next = applyReviewEvent(makeState(), event);

    expect(next.mastery).toBeGreaterThan(0.5);
    expect(next.retention).toBe(1);
    expect(next.lastReviewedAt).toBe(event.occurredAt);
  });

  it('decreases mastery on forgotten review', () => {
    const event = makeEvent('review-completed', { rating: 'forgotten' });
    const next = applyReviewEvent(makeState(), event);

    expect(next.mastery).toBeLessThan(0.5);
    expect(next.beta).toBeGreaterThan(2);
  });

  it('adjusts stability based on rating', () => {
    const easy = applyReviewEvent(makeState(), makeEvent('review-completed', { rating: 'easy' }));
    const forgotten = applyReviewEvent(
      makeState(),
      makeEvent('review-completed', { rating: 'forgotten' }),
    );

    expect(easy.reviewStabilityDays).toBeGreaterThan(7);
    expect(forgotten.reviewStabilityDays).toBeLessThan(7);
  });
});

describe('applyEventToState', () => {
  it('ignores unsupported event types', () => {
    const event = makeEvent('task-started', {});
    const next = applyEventToState(makeState(), event);

    expect(next).toEqual(makeState());
  });
});

describe('applyLearningEvent', () => {
  let storage: MemoryStorageProvider;

  beforeEach(() => {
    storage = new MemoryStorageProvider();
  });

  it('creates initial knowledge state when none exists', async () => {
    const event = makeEvent(
      'answer-submitted',
      { correct: true },
      {
        nodeIds: ['node-a'],
      },
    );

    await applyLearningEvent('user-1', event, storage);

    const dao = createKnowledgeStateDAO(storage);
    const state = await dao.get('user-1', 'node-a');
    expect(state).not.toBeNull();
    expect(state?.mastery).toBeGreaterThan(0.5);
    expect(state?.evidenceCount).toBe(1);
  });

  it('maps knowledge points to stable node ids and preserves display names', async () => {
    const event = makeEvent(
      'answer-submitted',
      { correct: false },
      {
        payload: { correct: false, knowledgePoints: ['三角形', 'Algebra'] },
      },
    );

    await applyLearningEvent('user-1', event, storage);

    const dao = createKnowledgeStateDAO(storage);
    const states = await dao.list('user-1');
    expect(states).toHaveLength(2);

    const algebra = states.find((s) => s.nodeId === 'kp-algebra');
    const triangle = states.find((s) => s.nodeId !== 'kp-algebra');

    expect(algebra?.displayName).toBe('Algebra');
    expect(triangle?.displayName).toBe('三角形');
  });

  it('updates existing state across multiple events', async () => {
    const dao = createKnowledgeStateDAO(storage);
    await dao.set('user-1', makeState({ nodeId: 'node-a' }));

    const event = makeEvent(
      'answer-submitted',
      { correct: true },
      {
        nodeIds: ['node-a'],
      },
    );
    await applyLearningEvent('user-1', event, storage);
    await applyLearningEvent('user-1', event, storage);

    const state = await dao.get('user-1', 'node-a');
    expect(state?.evidenceCount).toBe(2);
    expect(state?.version).toBe(3);
    expect(state?.mastery).toBeGreaterThan(0.5);
  });

  it('does nothing when event has no target nodes', async () => {
    const event = makeEvent('answer-submitted', { correct: true });
    await applyLearningEvent('user-1', event, storage);

    const dao = createKnowledgeStateDAO(storage);
    expect(await dao.count('user-1')).toBe(0);
  });

  it('isolates users when applying events', async () => {
    const event = makeEvent(
      'answer-submitted',
      { correct: true },
      {
        nodeIds: ['node-a'],
      },
    );

    await applyLearningEvent('alice', event, storage);
    await applyLearningEvent('bob', event, storage);

    const dao = createKnowledgeStateDAO(storage);
    expect(await dao.count('alice')).toBe(1);
    expect(await dao.count('bob')).toBe(1);
    expect((await dao.get('alice', 'node-a'))?.userId).toBe('alice');
  });
});
