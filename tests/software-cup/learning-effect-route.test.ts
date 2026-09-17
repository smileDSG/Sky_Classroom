import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { createProfileSignalDAO } from '@/lib/student/profile-signals';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

vi.mock('server-only', () => ({}));

const storage = new MemoryStorageProvider();

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: async () => storage,
}));

vi.mock('next/headers', () => ({
  cookies: async () => new Map(),
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: async () => ({
    user: {
      id: 'student-1',
      email: 'student@example.com',
      username: 'student',
      passwordHash: null,
      role: 'student',
      status: 'active',
      guestId: null,
      planType: 'free',
    },
  }),
}));

describe('learning effect evaluate route', () => {
  it('persists profile signals for the evaluated practice result', async () => {
    const { POST } = await import('@/app/api/sky/learning-effect/evaluate/route');
    const req = new Request('http://localhost/api/sky/learning-effect/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'student-1',
        input: 'Please evaluate my RAG practice',
        results: [
          {
            questionId: 'q1',
            knowledgePoint: 'vector retrieval',
            correct: false,
            errorTag: 'concept boundary',
          },
        ],
      }),
    });

    const response = await POST(req as unknown as NextRequest);
    const payload = await response.json();
    const signals = await createProfileSignalDAO(storage).listByUser('student-1');

    expect(payload.success).toBe(true);
    expect(payload.data.profileSignals).toHaveLength(3);
    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'student-1',
          dimension: 'knowledgeBase',
        }),
        expect.objectContaining({
          userId: 'student-1',
          dimension: 'currentLearningState',
        }),
      ]),
    );
  });
});
