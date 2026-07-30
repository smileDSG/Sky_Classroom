import { afterEach, describe, expect, it, vi } from 'vitest';

const providerState = vi.hoisted(() => ({
  mysqlAvailable: false,
  supabaseAvailable: true,
  mysqlConstructed: 0,
  supabaseConstructed: 0,
}));

vi.mock('@/lib/storage/mysql-provider', () => ({
  MySQLStorageProvider: class {
    constructor() {
      providerState.mysqlConstructed += 1;
    }

    async isAvailable(): Promise<boolean> {
      return providerState.mysqlAvailable;
    }
  },
}));

vi.mock('@/lib/storage/supabase-provider', () => ({
  SupabaseStorageProvider: class {
    constructor() {
      providerState.supabaseConstructed += 1;
    }

    async isAvailable(): Promise<boolean> {
      return providerState.supabaseAvailable;
    }
  },
}));

const originalMySqlDatabase = process.env.MYSQL_DATABASE;
const originalSupabaseUrl = process.env.SUPABASE_URL;

function restoreEnvironment(): void {
  if (originalMySqlDatabase === undefined) delete process.env.MYSQL_DATABASE;
  else process.env.MYSQL_DATABASE = originalMySqlDatabase;

  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;
}

describe('required server storage', () => {
  afterEach(() => {
    restoreEnvironment();
    providerState.mysqlAvailable = false;
    providerState.supabaseAvailable = true;
    providerState.mysqlConstructed = 0;
    providerState.supabaseConstructed = 0;
    vi.resetModules();
  });

  it('reports a typed error when no persistent storage is configured', async () => {
    delete process.env.MYSQL_DATABASE;
    delete process.env.SUPABASE_URL;
    vi.resetModules();

    const { getRequiredServerStorage } = await import('@/lib/server/server-storage');

    await expect(getRequiredServerStorage()).rejects.toMatchObject({
      code: 'PERSISTENT_STORAGE_UNAVAILABLE',
      retryable: true,
      stage: 'server-storage',
    });
  });

  it('does not switch to Supabase when configured MySQL is unavailable', async () => {
    process.env.MYSQL_DATABASE = 'learner-profile';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    providerState.mysqlAvailable = false;
    providerState.supabaseAvailable = true;
    vi.resetModules();

    const { getRequiredServerStorage } = await import('@/lib/server/server-storage');

    await expect(getRequiredServerStorage()).rejects.toMatchObject({
      code: 'PERSISTENT_STORAGE_UNAVAILABLE',
      details: { backend: 'mysql' },
    });
    expect(providerState.mysqlConstructed).toBe(1);
    expect(providerState.supabaseConstructed).toBe(0);
  });
});
