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
    log.error(
      `MySQL configured (database: ${process.env.MYSQL_DATABASE}) but connection failed. ` +
      `Check: MySQL is running, host=${process.env.MYSQL_HOST || 'localhost'}:${process.env.MYSQL_PORT || 3306}, ` +
      `user=${process.env.MYSQL_USER || 'root'}. Falling back to next provider.`
    );
  }

  // Try Supabase
  if (process.env.SUPABASE_URL) {
    const provider = new SupabaseStorageProvider();
    if (await provider.isAvailable()) {
      log.info('Server storage: using Supabase');
      _cached = provider;
      return provider;
    }
    log.error('Supabase configured but unavailable');
  }

  log.error(
    '!!! NO PERSISTENT STORAGE AVAILABLE — falling back to in-memory. ' +
    'Data (check-ins, mistakes, etc.) will be LOST on server restart. ' +
    'Fix: Start MySQL and ensure it is accessible, or configure SUPABASE_URL.'
  );
  _cached = new MemoryStorageProvider();
  return _cached;
}
