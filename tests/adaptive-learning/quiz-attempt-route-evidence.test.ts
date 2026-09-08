import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';

const boundary = vi.hoisted(() => ({
  userId: 'student-authenticated',
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  getJwtPayload: vi.fn(async () => ({ sub: boundary.userId })),
  requireAuth: vi.fn(async () => ({ user: { id: boundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(async () => boundary.storage),
}));

vi.mock('@/lib/student/profile-builder', () => ({
  invalidateProfileCache: vi.fn(async () => undefined),
}));

import { POST } from '@/app/api/sky/cloud-mind/quiz-attempts/route';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { buildAbilityShadowReport } from '@/lib/adaptive-learning/profile/shadow-report-service';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';

const storage = new MemoryStorageProvider();
boundary.storage = storage;

beforeEach(async () => {
  await storage.clear('quiz_attempts');
  await storage.clear('learning-events');
  await storage.clear('knowledge-state');
});

describe('POST /api/sky/cloud-mind/quiz-attempts', () => {
  it('attributes evidence to the authenticated user instead of a client userId', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/sky/cloud-mind/quiz-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'attacker-selected-user',
          subject: 'math',
          difficulty: 'medium',
          topic: 'function',
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
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.decision).toMatchObject({
      action: 'diagnostic',
      topic: '函数基础',
      reasonCodes: ['low-confidence'],
    });
    expect(
      await createKnowledgeStateDAO(storage).get(boundary.userId, 'functions-basic'),
    ).not.toBeNull();
    expect(
      await createKnowledgeStateDAO(storage).get('attacker-selected-user', 'functions-basic'),
    ).toBeNull();

    const events = await new LearnerProfileRepository(storage).listLearningEvents(boundary.userId);
    const shadow = buildAbilityShadowReport(events);
    expect(shadow.eligibleResponses).toBe(1);
    expect(events[0]?.payload).toMatchObject({
      itemVersion: 'quiz-attempt.v1',
      dimensionId: 'math',
    });
  });
});
