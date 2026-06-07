/**
 * Storage Provider Factory
 *
 * Creates a storage provider with automatic fallback:
 * IndexedDB → LocalStorage → In-Memory
 */

import type { StorageProvider, StorageConfig, StorageBackend } from './storage-types';
import { DEFAULT_STORAGE_CONFIG } from './storage-types';
import { IndexedDBStorageProvider } from './indexeddb-provider';
import { LocalStorageProvider } from './local-storage-provider';
import { MemoryStorageProvider } from './memory-provider';
import { createLogger } from '@/lib/logger';

const log = createLogger('Storage:Factory');

/**
 * Create a storage provider with automatic backend detection and fallback.
 *
 * Tries the preferred backend first; if unavailable, falls back in order:
 * indexeddb → localstorage → memory
 */
export async function createStorageProvider(
  config: StorageConfig = DEFAULT_STORAGE_CONFIG,
): Promise<StorageProvider> {
  const preferred = config.preferredBackend ?? DEFAULT_STORAGE_CONFIG.preferredBackend!;

  const backends: { type: StorageBackend; factory: () => StorageProvider }[] = [
    {
      type: 'indexeddb',
      factory: () => new IndexedDBStorageProvider(config),
    },
    {
      type: 'localstorage',
      factory: () => new LocalStorageProvider(),
    },
    {
      type: 'memory',
      factory: () => new MemoryStorageProvider(),
    },
  ];

  // Reorder to try preferred first
  const idx = backends.findIndex((b) => b.type === preferred);
  if (idx > 0) {
    const [item] = backends.splice(idx, 1);
    backends.unshift(item);
  }

  for (const backend of backends) {
    try {
      const provider = backend.factory();
      if (await provider.isAvailable()) {
        log.info(`Using storage backend: ${backend.type}`);
        return provider;
      }
    } catch (err) {
      log.warn(`Backend ${backend.type} unavailable:`, err);
    }
  }

  // Should never reach here — memory is always available
  log.warn('All storage backends failed, using memory as last resort');
  return new MemoryStorageProvider();
}

/** Singleton instance — shared across all API routes via globalThis */
const globalForStorage = globalThis as unknown as {
  _storageProvider: StorageProvider | null;
};

export async function getStorageProvider(): Promise<StorageProvider> {
  if (!globalForStorage._storageProvider) {
    globalForStorage._storageProvider = await createStorageProvider();
  }
  return globalForStorage._storageProvider;
}
