import { describe, expect, it } from 'vitest';

import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { recordQuizAttemptEvidence } from '@/lib/adaptive-learning/profile/quiz-evidence-recorder';
import { recordMappedAnswerEvidence } from '@/lib/adaptive-learning/profile/quiz-evidence-recorder';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { getAbilityState } from '@/lib/adaptive-learning/profile/ability-state-repository';
import type { QuizAttempt } from '@/lib/student/quiz-attempts';

describe('recordQuizAttemptEvidence', () => {
  it('maps curriculum aliases and persists both event and knowledge state', async () => {
    const storage = new MemoryStorageProvider();
    const attempt: QuizAttempt = {
      id: 'attempt-1',
      userId: 'student-1',
      subject: 'math',
      difficulty: 'medium',
      topic: 'function',
      source: 'ai',
      total: 1,
      correct: 1,
      accuracy: 100,
      questions: [
        {
          question: 'What is a function?',
          options: ['A', 'B'],
          answer: 0,
          userAnswer: 0,
          isCorrect: true,
          knowledgePoints: ['function'],
        },
      ],
      createdAt: Date.parse('2026-07-30T08:00:00.000Z'),
    };

    const result = await recordQuizAttemptEvidence(storage, attempt);
    const events = await new LearnerProfileRepository(storage).listLearningEvents('student-1');
    const state = await createKnowledgeStateDAO(storage).get('student-1', 'functions-basic');
    const ability = await getAbilityState(storage, 'student-1', 'math');

    expect(result).toEqual({ recordedEvents: 1, updatedStates: 1, skippedQuestions: 0 });
    expect(events[0]?.nodeIds).toEqual(['functions-basic']);
    expect(events[0]?.payload).toMatchObject({
      itemId: expect.stringContaining('quiz:ai:'),
      itemDifficulty: 0,
      dimensionId: 'math',
    });
    expect(state?.mastery).toBeGreaterThan(0.5);
    expect(ability).toMatchObject({ answerCount: 1 });
  });

  it('does not update knowledge state twice for the same event id', async () => {
    const storage = new MemoryStorageProvider();
    const input = {
      eventId: 'stable-event-id',
      userId: 'student-1',
      source: 'test',
      labels: ['function'],
      correct: true,
      occurredAt: '2026-07-30T08:00:00.000Z',
      evidenceQuality: 'verified' as const,
    };

    const first = await recordMappedAnswerEvidence(storage, input);
    const second = await recordMappedAnswerEvidence(storage, input);
    const state = await createKnowledgeStateDAO(storage).get('student-1', 'functions-basic');

    expect(first).toMatchObject({ recordedEvent: true, updatedStates: 1 });
    expect(second).toMatchObject({
      matchedNodes: true,
      recordedEvent: false,
      duplicateEvent: true,
      updatedStates: 0,
    });
    expect(state?.evidenceCount).toBe(1);
  });
});
