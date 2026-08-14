/**
 * Learner profile integration for /api/sky/solve/grade
 *
 * Verifies that grading loads the authenticated user's preferences,
 * builds a teaching projection, and passes it to the grader.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import type { LearnerPreferences } from '@/lib/adaptive-learning/contracts';

const gradeBoundary = vi.hoisted(() => ({
  userId: 'user-grade',
  storage: null as StorageProvider | null,
}));

const gradeAnswerMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/solve/grader', () => ({
  gradeAnswer: gradeAnswerMock,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: gradeBoundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getRequiredServerStorage: vi.fn(async () => gradeBoundary.storage),
}));

vi.mock('server-only', () => ({}));

import { POST } from '@/app/api/sky/solve/grade/route';

const storage = new MemoryStorageProvider();
gradeBoundary.storage = storage;

async function seedPreferences(userId: string): Promise<LearnerPreferences> {
  const repository = new LearnerProfileRepository(storage);
  const preferences: LearnerPreferences = {
    userId,
    preferredLanguage: 'zh-CN',
    contentFormatPreferences: ['text', 'worked-example'],
    explanationDepth: 'detailed',
    learningPace: 'standard',
    stepByStepMode: 'when-needed',
    interactionTone: 'encouraging',
    assistantName: '小云',
    preferenceNotes: '',
    privacy: {
      conversationMemory: 'session',
      optionalBehaviorSignals: false,
      privateKnowledgeRetrieval: false,
    },
    version: 1,
    schemaVersion: '1.0.0',
    updatedAt: '2026-07-30T00:00:00.000Z',
    updatedBy: 'user',
  };
  await repository.insertPreferences(preferences);
  return preferences;
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/sky/solve/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  gradeBoundary.userId = 'user-grade';
  await storage.clear('learner-preference-versions');
  await storage.clear('mistake-book');
  await storage.clear('learning-events');
  await storage.clear('knowledge-state');
  gradeAnswerMock.mockReset();
  gradeAnswerMock.mockResolvedValue({
    isCorrect: true,
    score: 100,
    correctAnswer: '4',
    userAnswer: '4',
    errorAnalysis: '正确',
    cause: 'careless',
  });
});

describe('POST /api/sky/solve/grade learner profile integration', () => {
  it('returns PROFILE_NOT_FOUND when learner profile is missing', async () => {
    const req = makeRequest({
      problem: '2+2=?',
      correctAnswer: '4',
      userAnswer: '4',
    });

    const res = await POST(req);
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('passes teaching projection to gradeAnswer', async () => {
    await seedPreferences(gradeBoundary.userId);

    const req = makeRequest({
      problem: '2+2=?',
      correctAnswer: '4',
      userAnswer: '4',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(gradeAnswerMock).toHaveBeenCalledTimes(1);
    const [, , , , teachingProjection] = gradeAnswerMock.mock.calls[0];
    expect(typeof teachingProjection).toBe('string');
    expect(teachingProjection).toContain('学习者画像');
    expect(teachingProjection).toContain('小云');
  });

  it('passes Bayesian growth areas to the grader', async () => {
    await seedPreferences(gradeBoundary.userId);
    await createKnowledgeStateDAO(storage).set(gradeBoundary.userId, {
      userId: gradeBoundary.userId,
      nodeId: 'functions-basic',
      alpha: 2,
      beta: 3,
      mastery: 0.4,
      confidence: 0.6,
      retention: 1,
      reviewStabilityDays: 7,
      repeatedErrorCount: 2,
      evidenceCount: 3,
      version: 3,
    });

    const res = await POST(
      makeRequest({ problem: '2+2=?', correctAnswer: '4', userAnswer: '4' }),
    );

    expect(res.status).toBe(200);
    const [, , , , teachingProjection] = gradeAnswerMock.mock.calls[0];
    expect(teachingProjection).toContain('functions-basic');
  });

  it('records the grading result as Bayesian answer evidence', async () => {
    await seedPreferences(gradeBoundary.userId);

    const res = await POST(
      makeRequest({
        problem: 'What is a function?',
        correctAnswer: 'A mapping',
        userAnswer: 'A mapping',
        knowledgePoints: ['function'],
      }),
    );

    expect(res.status).toBe(200);
    const state = await createKnowledgeStateDAO(storage).get(
      gradeBoundary.userId,
      'functions-basic',
    );
    expect(state?.mastery).toBeGreaterThan(0.5);
  });

  it('does not accept client-provided teachingProjection as authoritative', async () => {
    await seedPreferences(gradeBoundary.userId);

    const req = makeRequest({
      problem: '2+2=?',
      correctAnswer: '4',
      userAnswer: '4',
      teachingProjection: 'CLIENT_OVERRIDE',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const [, , , , teachingProjection] = gradeAnswerMock.mock.calls[0];
    expect(teachingProjection).toContain('学习者画像');
    expect(teachingProjection).not.toContain('CLIENT_OVERRIDE');
  });
});
