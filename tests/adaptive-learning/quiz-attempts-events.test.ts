import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';

const apiBoundary = vi.hoisted(() => ({
  storage: null as StorageProvider | null,
  userId: 'user-quiz-1',
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: apiBoundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(async () => apiBoundary.storage),
}));

vi.mock('@/lib/student/profile-builder', () => ({
  invalidateProfileCache: vi.fn(async () => {}),
}));

import { POST } from '@/app/api/sky/cloud-mind/quiz-attempts/route';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';

describe('POST /api/sky/cloud-mind/quiz-attempts records learning events', () => {
  beforeEach(() => {
    apiBoundary.storage = new MemoryStorageProvider();
  });

  it('writes one answer-submitted event per question', async () => {
    const response = await POST(
      new Request('http://localhost/api/sky/cloud-mind/quiz-attempts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-quiz-1',
          subject: 'math',
          difficulty: 'medium',
          topic: '三角形',
          source: 'ai',
          questions: [
            {
              question: '1+1=?',
              options: ['1', '2', '3'],
              answer: 1,
              userAnswer: 1,
              isCorrect: true,
              knowledgePoints: ['加法'],
            },
            {
              question: '2+2=?',
              options: ['3', '4', '5'],
              answer: 1,
              userAnswer: 2,
              isCorrect: false,
              knowledgePoints: ['加法', '进位'],
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.attempt.total).toBe(2);

    const repository = new LearnerProfileRepository(apiBoundary.storage!);
    const events = await repository.listLearningEvents('user-quiz-1');
    expect(events).toHaveLength(2);

    const correctEvent = events.find((e) => e.payload.correct === true);
    const wrongEvent = events.find((e) => e.payload.correct === false);

    expect(correctEvent?.type).toBe('answer-submitted');
    expect(correctEvent?.source).toBe('quiz-attempts');
    expect(correctEvent?.payload.knowledgePoints).toEqual(['加法']);
    expect(correctEvent?.payload).toMatchObject({
      itemId: expect.stringContaining('quiz:ai:'),
      itemVersion: 'quiz-attempt.v1',
      itemDifficulty: 0,
      dimensionId: 'math',
      contentHash: expect.stringContaining('fnv1a:'),
      generatorVersion: 'cloud-mind-ai.v1',
    });
    expect(wrongEvent?.payload.knowledgePoints).toEqual(['加法', '进位']);
    expect(wrongEvent?.correlationId).toBe(payload.attempt.id);
  });

  it('still returns success when event recording fails', async () => {
    const storage = apiBoundary.storage!;
    vi.spyOn(storage, 'insert').mockRejectedValueOnce(new Error('storage down'));

    const response = await POST(
      new Request('http://localhost/api/sky/cloud-mind/quiz-attempts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-quiz-2',
          subject: 'math',
          difficulty: 'easy',
          questions: [
            {
              question: '1+1=?',
              options: ['1', '2'],
              answer: 1,
              userAnswer: 1,
              isCorrect: true,
              knowledgePoints: ['加法'],
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
  });
});
