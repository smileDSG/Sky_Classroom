import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { memoryInstances } = vi.hoisted(() => ({ memoryInstances: [] as object[] }));

vi.mock('@/lib/storage/mysql-provider', () => ({
  MySQLStorageProvider: class {
    isAvailable = vi.fn().mockResolvedValue(false);
  },
}));

vi.mock('@/lib/storage/supabase-provider', () => ({
  SupabaseStorageProvider: class {
    isAvailable = vi.fn().mockResolvedValue(false);
  },
}));

vi.mock('@/lib/storage/memory-provider', () => ({
  MemoryStorageProvider: class {
    constructor() {
      memoryInstances.push(this);
    }
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}));

const globalStorage = globalThis as typeof globalThis & {
  _serverStorageProvider?: unknown;
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('MYSQL_DATABASE', '');
  vi.stubEnv('SUPABASE_URL', '');
  delete globalStorage._serverStorageProvider;
  memoryInstances.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete globalStorage._serverStorageProvider;
});

describe('getServerStorage', () => {
  it('shares the fallback provider across API route module instances', async () => {
    const firstModule = await import('@/lib/server/server-storage');
    const first = await firstModule.getServerStorage();

    vi.resetModules();
    const secondModule = await import('@/lib/server/server-storage');
    const second = await secondModule.getServerStorage();

    expect(second).toBe(first);
    expect(memoryInstances).toHaveLength(1);
  });
});
