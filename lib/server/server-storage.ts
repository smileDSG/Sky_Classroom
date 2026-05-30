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

const log = createLogger('ServerStorage');

let _cached: StorageProvider | null = null;

export async function getServerStorage(): Promise<StorageProvider> {
  if (_cached) return _cached;

  // Try MySQL first
  if (process.env.MYSQL_DATABASE) {
    const provider = new MySQLStorageProvider();
    if (await provider.isAvailable()) {
      log.info('Server storage: using MySQL');
      _cached = provider;
      return provider;
    }
    log.warn('MySQL configured but unavailable');
  }

  // Try Supabase
  if (process.env.SUPABASE_URL) {
    const provider = new SupabaseStorageProvider();
    if (await provider.isAvailable()) {
      log.info('Server storage: using Supabase');
      _cached = provider;
      return provider;
    }
    log.warn('Supabase configured but unavailable');
  }

  log.warn('No persistent storage configured — using in-memory (data will NOT persist across restarts)');
  _cached = new MemoryStorageProvider();
  return _cached;
}
