import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import { createProfileSignalDAO } from '@/lib/student/profile-signals';

vi.mock('server-only', () => ({}));

const storage = new MemoryStorageProvider();

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: async () => storage,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

describe('profile conversation route', () => {
  it('persists extracted profile signals for the demo user when no userId is provided', async () => {
    const { POST } = await import('@/app/api/sky/student/profile/conversation/route');
    const req = new Request('http://localhost/api/sky/student/profile/conversation', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'profile-onboarding-test',
        message:
          '我想两周内补机器学习，过拟合和模型评估总是搞不懂，希望多用代码案例和图解讲。',
        stage: 'onboarding',
      }),
    });

    const response = await POST(req as unknown as NextRequest);
    const payload = await response.json();
    const signals = await createProfileSignalDAO(storage).listByUser('default-user');

    expect(payload.success).toBe(true);
    expect(payload.data.profileSignals.length).toBeGreaterThan(0);
    expect(payload.data.conversationProfile).toBeDefined();
    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'default-user',
          source: 'onboarding_chat',
        }),
      ]),
    );
  });
});
