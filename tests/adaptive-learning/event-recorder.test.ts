import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import {
  recordLearningEvent,
  recordAnswerSubmitted,
  recordReviewCompleted,
  recordShadowDecision,
  learningEventInputSchema,
} from '@/lib/adaptive-learning/profile/event-recorder';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { getAbilityState } from '@/lib/adaptive-learning/profile/ability-state-repository';

vi.mock('@/lib/student/profile-builder', () => ({
  invalidateProfileCache: vi.fn(async () => {}),
}));

describe('EventRecorder', () => {
  let storage: MemoryStorageProvider;

  beforeEach(() => {
    storage = new MemoryStorageProvider();
  });

  it('records a valid learning event and assigns missing metadata', async () => {
    const event = await recordLearningEvent(
      {
        userId: 'user-1',
        type: 'answer-submitted',
        source: 'quiz',
        evidenceQuality: 'verified',
        payload: { correct: true },
      },
      { storage },
    );

    expect(event).not.toBeNull();
    expect(event?.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(event?.schemaVersion).toBe('1.0.0');
    expect(event?.nodeIds).toEqual([]);
    expect(event?.type).toBe('answer-submitted');

    const repository = new LearnerProfileRepository(storage);
    const events = await repository.listLearningEvents('user-1');
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toEqual({ correct: true });
  });

  it('records answer-submitted with knowledge points', async () => {
    const event = await recordAnswerSubmitted({
      storage,
      userId: 'user-1',
      source: 'solve-grade',
      correct: false,
      knowledgePoints: ['三角形', '相似三角形'],
    });

    expect(event).not.toBeNull();
    expect(event?.payload).toEqual({
      correct: false,
      knowledgePoints: ['三角形', '相似三角形'],
    });
  });

  it('records review-completed events', async () => {
    const event = await recordReviewCompleted({
      storage,
      userId: 'user-1',
      source: 'mistake-review',
      rating: 'recalled',
      knowledgePoints: ['一元二次方程'],
    });

    expect(event).not.toBeNull();
    expect(event?.type).toBe('review-completed');
    expect(event?.payload).toEqual({
      rating: 'recalled',
      knowledgePoints: ['一元二次方程'],
    });
  });

  it('swallows invalid events instead of throwing', async () => {
    const event = await recordLearningEvent(
      {
        userId: 'user-1',
        type: 'answer-submitted',
        source: 'quiz',
        evidenceQuality: 'verified',
        payload: { wrongKey: true } as unknown as Record<string, unknown>,
      },
      { storage },
    );

    expect(event).toBeNull();
    const repository = new LearnerProfileRepository(storage);
    await expect(repository.listLearningEvents('user-1')).resolves.toHaveLength(0);
  });

  it('accepts a valid learning event input schema without metadata', () => {
    const input = {
      userId: 'user-1',
      type: 'answer-submitted' as const,
      source: 'quiz',
      evidenceQuality: 'verified' as const,
      payload: { correct: true },
    };

    const parsed = learningEventInputSchema.parse(input);
    expect(parsed).toEqual(input);
  });

  it('updates knowledge state after recording an event with knowledge points', async () => {
    await recordAnswerSubmitted({
      storage,
      userId: 'user-1',
      source: 'solve-grade',
      correct: false,
      knowledgePoints: ['一元二次方程'],
    });

    const dao = createKnowledgeStateDAO(storage);
    const states = await dao.list('user-1');
    expect(states).toHaveLength(1);
    expect(states[0]?.mastery).toBeLessThan(0.5);
    expect(states[0]?.evidenceCount).toBe(1);
  });

  it('updates theta only for a verified answer with a complete fixed-item identity', async () => {
    await recordLearningEvent(
      {
        userId: 'user-1',
        type: 'answer-submitted',
        source: 'course-quiz',
        nodeIds: ['multi-agent-orchestration'],
        evidenceQuality: 'verified',
        payload: {
          correct: true,
          itemId: 'ai-10-010',
          itemVersion: 'v0.1.0',
          itemDifficulty: 0.7,
          dimensionId: 'ai-intro',
          contentHash: 'sha256:ai-10-010',
          generatorVersion: 'course-bank-v0.1.0',
        },
      },
      { storage },
    );

    await expect(getAbilityState(storage, 'user-1', 'ai-intro')).resolves.toMatchObject({
      answerCount: 1,
    });
  });

  it('records shadow decisions once without changing knowledge state', async () => {
    const comparison = {
      baselineTargetTool: 'quiz' as const,
      newTargetTool: 'teaching' as const,
      baselineHref: '/sky/cloud-mind/quiz?topic=函数基础',
      newHref: '/sky/cloud-mind/teaching?topic=函数基础',
      changed: true,
      topic: '函数基础',
      action: 'teach' as const,
      profileVersion: 4,
      reasonCodes: ['low-mastery'],
    };

    const first = await recordShadowDecision({
      storage,
      userId: 'user-1',
      source: 'cloud-mind-personalization',
      comparison,
    });
    expect(first?.type).toBe('shadow-decision-recorded');

    const events = await new LearnerProfileRepository(storage).listLearningEvents('user-1');
    const second = await recordShadowDecision({
      storage,
      userId: 'user-1',
      source: 'cloud-mind-personalization',
      comparison,
      existingEvents: events,
    });

    expect(second).toBeNull();
    expect(events).toHaveLength(1);
    await expect(createKnowledgeStateDAO(storage).list('user-1')).resolves.toEqual([]);
  });

  it('records intervention lifecycle events with one correlation id', async () => {
    const planned = await recordLearningEvent(
      {
        userId: 'user-1',
        type: 'intervention-planned',
        source: 'director',
        evidenceQuality: 'inferred',
        correlationId: 'decision-1',
        payload: {
          decisionId: 'decision-1',
          sessionId: 'session-1',
          candidatePlanIds: ['teach-first', 'quiz-first'],
          fallbackUsed: false,
        },
      },
      { storage },
    );

    const outcome = await recordLearningEvent(
      {
        userId: 'user-1',
        type: 'session-completed',
        source: 'quiz',
        evidenceQuality: 'verified',
        correlationId: 'decision-1',
        payload: {
          decisionId: 'decision-1',
          durationSeconds: 420,
          questionCount: 4,
          correctCount: 3,
        },
      },
      { storage },
    );

    expect(planned?.type).toBe('intervention-planned');
    expect(outcome?.correlationId).toBe('decision-1');
    await expect(new LearnerProfileRepository(storage).listLearningEvents('user-1')).resolves.toHaveLength(2);
  });
});
