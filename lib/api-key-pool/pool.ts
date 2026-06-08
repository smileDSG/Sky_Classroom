/**
 * API Key Pool — Round-Robin Selector
 *
 * Maintains an in-memory cache per provider for fast key selection.
 * Call pick() to get the next available key in round-robin order.
 */

import type { ApiKeyEntry, PickResult } from './types';
import { NoAvailableKeyError } from './types';
import {
  getActiveKeys,
  incrementUsage,
  incrementError,
  markRateLimited,
  getKeyById,
} from '@/lib/storage/dao/api-key-pool';
import { createLogger } from '@/lib/logger';

const log = createLogger('ApiKeyPool');

interface ProviderCache {
  keys: ApiKeyEntry[];
  lastIndex: number;
  loadedAt: number;
}

const CACHE_TTL_MS = 60_000; // refresh cache every 60s

const cache = new Map<string, ProviderCache>();

async function ensureLoaded(provider: string): Promise<ProviderCache> {
  const cached = cache.get(provider);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached;
  }
  const keys = await getActiveKeys(provider);
  const entry: ProviderCache = { keys, lastIndex: 0, loadedAt: Date.now() };
  cache.set(provider, entry);
  return entry;
}

/** Get the next available key for a provider (round-robin) */
export async function pickKey(provider: string): Promise<PickResult> {
  const c = await ensureLoaded(provider);

  if (c.keys.length === 0) {
    throw new NoAvailableKeyError(provider);
  }

  // Round-robin: try each key starting from lastIndex+1
  const len = c.keys.length;
  for (let i = 0; i < len; i++) {
    const idx = (c.lastIndex + i) % len;
    const key = c.keys[idx];
    if (key.isActive && (!key.rateLimitedUntil || key.rateLimitedUntil <= new Date())) {
      c.lastIndex = (idx + 1) % len;
      return { key, index: idx };
    }
  }

  throw new NoAvailableKeyError(provider);
}

/** Report a successful request */
export async function reportSuccess(keyId: string): Promise<void> {
  await incrementUsage(keyId);
}

/** Report an error (auto rate-limit on 429) */
export async function reportError(keyId: string, statusCode: number): Promise<void> {
  await incrementError(keyId);

  if (statusCode === 429) {
    // Rate-limited: disable for 60 seconds
    const until = new Date(Date.now() + 60_000);
    await markRateLimited(keyId, until);
    log.warn(`Key ${keyId} rate-limited until ${until.toISOString()}`);

    // Update cache: mark the key as rate-limited
    for (const [, c] of cache) {
      const k = c.keys.find((k) => k.id === keyId);
      if (k) {
        k.rateLimitedUntil = until;
        break;
      }
    }
  }
}

/** Force refresh the cache for a provider (call after key CRUD) */
export async function refreshCache(provider?: string): Promise<void> {
  if (provider) {
    cache.delete(provider);
  } else {
    cache.clear();
  }
}
