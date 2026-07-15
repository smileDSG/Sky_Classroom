import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { createProfileSignalDAO } from '@/lib/student/profile-signals';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

vi.mock('server-only', () => ({}));

const storage = new MemoryStorageProvider();

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: async () => storage,
}));

describe('profile corrections route', () => {
  it('persists a high-confidence manual correction and returns the merged profile', async () => {
    await createProfileSignalDAO(storage).add({
      userId: 'student-1',
      dimension: 'resourcePreference',
      value: ['video'],
      source: 'behavior',
      confidence: 0.75,
      evidence: ['watched a video'],
      createdAt: 1000,
    });

    const { POST } = await import('@/app/api/sky/student/profile/corrections/route');
    const req = new Request('http://localhost/api/sky/student/profile/corrections', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'student-1',
        dimension: 'resourcePreference',
        value: ['code cases', 'diagrams'],
        evidence: 'student corrected the profile panel',
      }),
    });

    const response = await POST(req as unknown as NextRequest);
    const payload = await response.json();
    const signals = await createProfileSignalDAO(storage).listByUser('student-1');

    expect(payload.success).toBe(true);
    expect(payload.data.profileSignal).toMatchObject({
      source: 'manual_correction',
      confidence: 0.98,
    });
    expect(payload.data.conversationProfile.resourcePreference.value).toEqual([
      'code cases',
      'diagrams',
    ]);
    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'student-1',
          source: 'manual_correction',
        }),
      ]),
    );
  });
});
