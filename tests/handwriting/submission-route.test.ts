import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHandwritingSubmissionDAO } from '@/lib/handwriting';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

vi.mock('server-only', () => ({}));

const authState = vi.hoisted(() => ({ token: 'token-user-1' as string | undefined }));
const storage = new MemoryStorageProvider();
const dao = createHandwritingSubmissionDAO(storage);

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: async () => storage,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (authState.token ? { value: authState.token } : undefined),
  }),
}));

vi.mock('@/lib/server/auth', () => ({
  verifyAccessToken: async (token: string) => {
    if (token === 'token-user-1') return { sub: 'user-1' };
    if (token === 'token-user-2') return { sub: 'user-2' };
    return null;
  },
}));

const BASE = 'http://localhost/api/sky/handwriting/submissions';

function context(submissionId: string) {
  return { params: Promise.resolve({ submissionId }) };
}

function patchRequest(status: string): NextRequest {
  return new NextRequest(`${BASE}/placeholder`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/sky/handwriting/submissions/[submissionId]', () => {
  beforeEach(async () => {
    authState.token = 'token-user-1';
    await storage.clear('handwriting_submissions');
  });

  it('returns an owned submission', async () => {
    const created = await dao.create({ userId: 'user-1', subject: 'math' });
    const { GET } = await import('@/app/api/sky/handwriting/submissions/[submissionId]/route');

    const response = await GET(new NextRequest(`${BASE}/${created.id}`), context(created.id));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.submission.id).toBe(created.id);
  });

  it('hides a submission from another user', async () => {
    const created = await dao.create({ userId: 'user-1', subject: 'math' });
    const { GET } = await import('@/app/api/sky/handwriting/submissions/[submissionId]/route');
    authState.token = 'token-user-2';

    const response = await GET(new NextRequest(`${BASE}/${created.id}`), context(created.id));

    expect(response.status).toBe(404);
  });

  it('allows the owner to close a submission', async () => {
    const created = await dao.create({ userId: 'user-1', subject: 'physics' });
    const { PATCH } = await import('@/app/api/sky/handwriting/submissions/[submissionId]/route');

    const response = await PATCH(patchRequest('closed'), context(created.id));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.submission.status).toBe('closed');
  });

  it('rejects client-driven internal workflow transitions', async () => {
    const created = await dao.create({ userId: 'user-1', subject: 'math' });
    const { PATCH } = await import('@/app/api/sky/handwriting/submissions/[submissionId]/route');

    const response = await PATCH(patchRequest('uploaded'), context(created.id));

    expect(response.status).toBe(403);
    expect((await response.json()).errorCode).toBe('INVALID_REQUEST');
  });

  it('rejects an unknown target status', async () => {
    const created = await dao.create({ userId: 'user-1', subject: 'math' });
    const { PATCH } = await import('@/app/api/sky/handwriting/submissions/[submissionId]/route');

    const response = await PATCH(patchRequest('invented'), context(created.id));

    expect(response.status).toBe(400);
  });
});
