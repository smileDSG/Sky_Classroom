import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { createProfileSignalDAO } from '@/lib/student/profile-signals';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

vi.mock('server-only', () => ({}));

const storage = new MemoryStorageProvider();

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: async () => storage,
}));

describe('resource interactions route', () => {
  it('turns implicit resource behavior into profile signals', async () => {
    const { POST } = await import('@/app/api/sky/resource-generation/interactions/route');
    const req = new Request('http://localhost/api/sky/resource-generation/interactions', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'student-1',
        resourceId: 'res-code-1',
        resourceType: 'code_case',
        action: 'favorite',
        completionRate: 1,
        durationSeconds: 320,
      }),
    });

    const response = await POST(req as unknown as NextRequest);
    const payload = await response.json();
    const signals = await createProfileSignalDAO(storage).listByUser('student-1');

    expect(payload.success).toBe(true);
    expect(payload.data.profileSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimension: 'resourcePreference',
          value: ['code cases'],
          source: 'behavior',
        }),
        expect.objectContaining({
          dimension: 'currentLearningState',
          source: 'behavior',
        }),
      ]),
    );
    expect(signals).toHaveLength(2);
  });
});
