/**
 * Server-side storage helper.
 *
 * Returns a persistent storage provider for API routes.
 * Tries MySQL first, then Supabase, then in-memory (with a warning).
 */
import { MySQLStorageProvider } from '@/lib/storage/mysql-provider';
import { SupabaseStorageProvider } from '@/lib/storage/supabase-provider';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import { createLogger } from '@/lib/logger';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

const log = createLogger('ServerStorage');

const globalForServerStorage = globalThis as unknown as {
  _serverStorageProvider?: StorageProvider | null;
  _requiredServerStorageProvider?: StorageProvider | null;
};

function persistentStorageUnavailable(
  message: string,
  details: Record<string, unknown>,
): AdaptiveLearningError {
  return new AdaptiveLearningError({
    code: 'PERSISTENT_STORAGE_UNAVAILABLE',
    message,
    retryable: true,
    stage: 'server-storage',
    details,
  });
}

export async function getRequiredServerStorage(): Promise<StorageProvider> {
  if (globalForServerStorage._requiredServerStorageProvider) {
    return globalForServerStorage._requiredServerStorageProvider;
  }

  if (process.env.MYSQL_DATABASE) {
    const provider = new MySQLStorageProvider();
    if (await provider.isAvailable()) {
      log.info('Required server storage: using MySQL');
      globalForServerStorage._requiredServerStorageProvider = provider;
      return provider;
    }

    throw persistentStorageUnavailable('Configured MySQL storage is unavailable', {
      backend: 'mysql',
      database: process.env.MYSQL_DATABASE,
    });
  }

  if (process.env.SUPABASE_URL) {
    const provider = new SupabaseStorageProvider();
    if (await provider.isAvailable()) {
      log.info('Required server storage: using Supabase');
      globalForServerStorage._requiredServerStorageProvider = provider;
      return provider;
    }

    throw persistentStorageUnavailable('Configured Supabase storage is unavailable', {
      backend: 'supabase',
    });
  }

  throw persistentStorageUnavailable('No persistent server storage is configured', {
    backend: null,
  });
}

export async function getServerStorage(): Promise<StorageProvider> {
  if (globalForServerStorage._serverStorageProvider) {
    return globalForServerStorage._serverStorageProvider;
  }

  // Try MySQL first
  if (process.env.MYSQL_DATABASE) {
    const provider = new MySQLStorageProvider();
    if (await provider.isAvailable()) {
      log.info('Server storage: using MySQL');
      globalForServerStorage._serverStorageProvider = provider;
      return provider;
    }
    log.error(
      `MySQL configured (database: ${process.env.MYSQL_DATABASE}) but connection failed. ` +
        `Check: MySQL is running, host=${process.env.MYSQL_HOST || 'localhost'}:${process.env.MYSQL_PORT || 3306}, ` +
        `user=${process.env.MYSQL_USER || 'root'}. Falling back to next provider.`,
    );
  }

  // Try Supabase
  if (process.env.SUPABASE_URL) {
    const provider = new SupabaseStorageProvider();
    if (await provider.isAvailable()) {
      log.info('Server storage: using Supabase');
      globalForServerStorage._serverStorageProvider = provider;
      return provider;
    }
    log.error('Supabase configured but unavailable');
  }

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_STORAGE !== 'true') {
    throw persistentStorageUnavailable(
      'Production requires MySQL or Supabase; refusing in-memory storage',
      { backend: null, allowInMemoryStorage: false },
    );
  }

  log.error(
    '!!! NO PERSISTENT STORAGE AVAILABLE — falling back to in-memory. ' +
      'Data (check-ins, mistakes, etc.) will be LOST on server restart. ' +
      'Fix: Start MySQL and ensure it is accessible, or configure SUPABASE_URL.',
  );
  globalForServerStorage._serverStorageProvider = new MemoryStorageProvider();
  return globalForServerStorage._serverStorageProvider;
}
