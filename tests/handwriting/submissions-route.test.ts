import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

vi.mock('server-only', () => ({}));

const authState = vi.hoisted(() => ({ token: 'token-user-1' as string | undefined }));
const storage = new MemoryStorageProvider();

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

function postRequest(body: unknown): NextRequest {
  return new NextRequest(BASE, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/sky/handwriting/submissions', () => {
  beforeEach(async () => {
    authState.token = 'token-user-1';
    await storage.clear('handwriting_submissions');
  });

  it('creates a draft for the authenticated user', async () => {
    const { POST } = await import('@/app/api/sky/handwriting/submissions/route');

    const response = await POST(postRequest({ subject: 'math', title: '函数练习' }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.submission).toEqual(
      expect.objectContaining({ userId: 'user-1', subject: 'math', status: 'draft' }),
    );
  });

  it('returns only the authenticated user submissions', async () => {
    const { GET, POST } = await import('@/app/api/sky/handwriting/submissions/route');
    await POST(postRequest({ subject: 'math' }));
    authState.token = 'token-user-2';
    await POST(postRequest({ subject: 'physics' }));

    authState.token = 'token-user-1';
    const response = await GET(new NextRequest(BASE));
    const payload = await response.json();

    expect(payload.total).toBe(1);
    expect(payload.items[0].userId).toBe('user-1');
  });

  it('rejects unauthenticated requests', async () => {
    const { POST } = await import('@/app/api/sky/handwriting/submissions/route');
    authState.token = undefined;

    const response = await POST(postRequest({ subject: 'math' }));

    expect(response.status).toBe(401);
    expect((await response.json()).errorCode).toBe('UNAUTHORIZED');
  });

  it('rejects unsupported subjects', async () => {
    const { POST } = await import('@/app/api/sky/handwriting/submissions/route');

    const response = await POST(postRequest({ subject: 'chemistry' }));

    expect(response.status).toBe(400);
    expect((await response.json()).errorCode).toBe('INVALID_REQUEST');
  });
});
