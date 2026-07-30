import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorageEntry } from '@/lib/storage/storage-types';

const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseBoundary = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
}));

function createQueryBuilder() {
  const filters: Record<string, unknown> = {};
  const builder = {
    async insert(row: Record<string, unknown>) {
      const key = `${String(row.table_name)}:${String(row.id)}`;
      if (supabaseBoundary.rows.has(key)) {
        return { data: null, error: { code: '23505', message: 'duplicate key' } };
      }
      supabaseBoundary.rows.set(key, row);
      return { data: null, error: null };
    },
    select() {
      return builder;
    },
    eq(field: string, value: unknown) {
      filters[field] = value;
      return builder;
    },
    async single() {
      const key = `${String(filters.table_name)}:${String(filters.id)}`;
      const row = supabaseBoundary.rows.get(key);
      return row
        ? { data: row, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'not found' } };
    },
  };
  return builder;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => createQueryBuilder()),
  })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

function makeEntry(id: string, data: unknown): StorageEntry {
  return { id, data, createdAt: 1000, updatedAt: 1000 };
}

describe('SupabaseStorageProvider insert', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    supabaseBoundary.rows.clear();
    vi.resetModules();
  });

  afterEach(() => {
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    vi.resetModules();
  });

  it('rejects a duplicate entry without changing the original data', async () => {
    const [{ SupabaseStorageProvider }, { StorageEntryAlreadyExistsError }] = await Promise.all([
      import('@/lib/storage/supabase-provider'),
      import('@/lib/storage/storage-errors'),
    ]);
    const provider = new SupabaseStorageProvider();
    const original = makeEntry('1', { name: 'Alice' });
    const duplicate = makeEntry('1', { name: 'Bob' });

    await provider.insert('learner-profile-snapshots', original);

    await expect(provider.insert('learner-profile-snapshots', duplicate)).rejects.toBeInstanceOf(
      StorageEntryAlreadyExistsError,
    );
    expect((await provider.get('learner-profile-snapshots', '1'))?.data).toEqual(original.data);
  });
});
