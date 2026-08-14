import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';

const boundary = vi.hoisted(() => ({
  authenticated: true,
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () =>
    boundary.authenticated
      ? { user: { id: 'virtual-api-user' } }
      : { error: new Response(JSON.stringify({ success: false }), { status: 401 }) },
  ),
}));
vi.mock('@/lib/server/server-storage', () => ({
  getRequiredServerStorage: vi.fn(async () => boundary.storage),
}));
vi.mock('server-only', () => ({}));

import { GET, POST } from '@/app/api/virtual-students/route';

const storage = new MemoryStorageProvider();
boundary.storage = storage;

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/virtual-students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  boundary.authenticated = true;
  await storage.clear('virtual_student_simulations');
});

describe('/api/virtual-students', () => {
  it('lists profiles and persisted simulation runs', async () => {
    const empty = await GET();
    const emptyBody = await empty.json();
    expect(empty.status).toBe(200);
    expect(emptyBody.profiles).toHaveLength(6);
    expect(emptyBody.runs).toEqual([]);

    const created = await POST(request({ profileId: 'questioner', topic: 'functions', seed: 1 }));
    expect(created.status).toBe(201);

    const listed = await GET();
    const listedBody = await listed.json();
    expect(listedBody.runs).toHaveLength(1);
    expect(listedBody.runs[0]).toMatchObject({ profileId: 'questioner', source: 'simulation' });
  });

  it('rejects malformed and unknown profiles', async () => {
    expect((await POST(request({ topic: 'functions' }))).status).toBe(400);
    expect((await POST(request({ profileId: 'missing', topic: 'functions' }))).status).toBe(404);
    expect((await POST(request({ profileId: 'cold-start', topic: '' }))).status).toBe(400);
    expect(await storage.count('virtual_student_simulations')).toBe(0);
  });

  it('requires authentication for reads and writes', async () => {
    boundary.authenticated = false;

    expect((await GET()).status).toBe(401);
    expect((await POST(request({ profileId: 'cold-start', topic: 'functions' }))).status).toBe(401);
    expect(await storage.count('virtual_student_simulations')).toBe(0);
  });
});
