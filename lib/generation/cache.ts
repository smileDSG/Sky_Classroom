/**
 * Generation cache.
 *
 * Caches scene content and actions by hashed outline + options to avoid
 * redundant AI calls for similar or identical requests.
 */

import type { SceneOutline } from '@/lib/types/generation';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  maxSize: number;
}

const DEFAULT_MAX_SIZE = 100;

function orderedStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(orderedStringify).join(',') + ']';
  }
  const keys = Object.keys(value as object).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + orderedStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

function hashInput(input: unknown): string {
  const json = orderedStringify(input);
  // djb2a hash with murmur3 finalizer for better distribution
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash) ^ json.charCodeAt(i); // hash * 33 ^ char
  }
  return String((hash >>> 0) ^ ((hash * 0x1b873593) >>> 0));
}

export class GenerationCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  buildKey(outline: SceneOutline, options?: Record<string, unknown>): string {
    const { id, order, ...outlineData } = outline;
    return hashInput({ outline: outlineData, options: options ?? {} });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry) {
      entry.hits++;
      this.hits++;
      return entry.value as T;
    }
    this.misses++;
    return undefined;
  }

  set<T>(key: string, value: T): void {
    if (this.store.size >= this.maxSize) {
      const oldest = [...this.store.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.store.delete(oldest[0]);
    }
    this.store.set(key, {
      value,
      timestamp: Date.now(),
      hits: 1,
    });
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): CacheStats {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      maxSize: this.maxSize,
    };
  }

  hitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
}

/** Shared global cache instance */
export const generationCache = new GenerationCache();
