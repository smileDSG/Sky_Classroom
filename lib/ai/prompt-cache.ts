/**
 * Prompt Cache — Token Reduction via Cached System Prompts
 *
 * Caches rendered system prompts by template+variables hash.
 * When the same prompt configuration is reused, returns the cached
 * version instead of re-rendering, saving token computation time.
 *
 * Combined with the Vercel AI SDK prompt caching feature, this
 * reduces both compute time and token costs.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('PromptCache');

interface CacheEntry {
  renderedPrompt: string;
  tokenCount: number;
  lastAccessed: number;
  hitCount: number;
}

interface PromptCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
}

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class PromptCache {
  private entries: Map<string, CacheEntry>;
  private maxEntries: number;
  private ttlMs: number;
  private totalHits = 0;
  private totalMisses = 0;

  constructor(options: PromptCacheOptions = {}) {
    this.entries = new Map();
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  /**
   * Generate a cache key from template ID and variables.
   */
  static makeKey(templateId: string, variables: Record<string, unknown>): string {
    const varHash = JSON.stringify(variables, Object.keys(variables).sort());
    return `${templateId}:${varHash}`;
  }

  /**
   * Estimate token count for a string (rough approximation).
   */
  static estimateTokens(text: string): number {
    const chineseChars = (text.match(/[一-鿿]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * Get a cached prompt if available and not expired.
   */
  get(key: string): string | null {
    const entry = this.entries.get(key);
    if (!entry) {
      this.totalMisses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.lastAccessed > this.ttlMs) {
      this.entries.delete(key);
      this.totalMisses++;
      return null;
    }

    entry.lastAccessed = Date.now();
    entry.hitCount++;
    this.totalHits++;
    log.debug(`Prompt cache hit: ${key.slice(0, 60)}... (hit #${entry.hitCount})`);
    return entry.renderedPrompt;
  }

  /**
   * Store a rendered prompt in the cache.
   */
  set(key: string, renderedPrompt: string): void {
    // Evict if at capacity
    if (this.entries.size >= this.maxEntries) {
      this.evict();
    }

    this.entries.set(key, {
      renderedPrompt,
      tokenCount: PromptCache.estimateTokens(renderedPrompt),
      lastAccessed: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Evict the least-recently-accessed entry.
   */
  private evict(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.entries.delete(oldestKey);
      log.debug(`Prompt cache evicted: ${oldestKey.slice(0, 60)}...`);
    }
  }

  /**
   * Invalidate entries matching a prefix pattern.
   */
  invalidate(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /**
   * Get cache statistics.
   */
  getStats() {
    const total = this.totalHits + this.totalMisses;
    return {
      size: this.entries.size,
      maxEntries: this.maxEntries,
      hits: this.totalHits,
      misses: this.totalMisses,
      hitRate: total > 0 ? this.totalHits / total : 0,
      totalTokensCached: Array.from(this.entries.values()).reduce(
        (sum, e) => sum + e.tokenCount,
        0,
      ),
    };
  }
}

// Singleton instance
let _instance: PromptCache | null = null;

export function getPromptCache(): PromptCache {
  if (!_instance) {
    _instance = new PromptCache();
  }
  return _instance;
}

export function resetPromptCache(): void {
  _instance?.clear();
  _instance = null;
}
