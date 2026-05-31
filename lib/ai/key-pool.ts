/**
 * API Key Pool — Least-inflight + Round-robin load balancer
 *
 * For providers (like DeepSeek) where multiple API keys can be used
 * concurrently to increase throughput and reliability.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('KeyPool');

interface KeyState {
  key: string;
  inflight: number;
  failCount: number;
  lastFailTime: number;
  healthy: boolean;
}

const HEALTHY_RESET_MS = 60_000; // 1 minute cooldown for failed keys
const MAX_FAIL_COUNT = 3;

export class KeyPool {
  private keys: KeyState[];
  private rrIndex = 0;

  constructor(keys: string[]) {
    this.keys = keys.map((k) => ({
      key: k,
      inflight: 0,
      failCount: 0,
      lastFailTime: 0,
      healthy: true,
    }));
  }

  /** Select the best key: least inflight, round-robin tiebreaker */
  select(): string {
    const now = Date.now();

    // Auto-recover keys after cooldown
    for (const state of this.keys) {
      if (!state.healthy && now - state.lastFailTime > HEALTHY_RESET_MS) {
        state.healthy = true;
        state.failCount = 0;
        log.info(`Key recovered after cooldown: ${this.mask(state.key)}`);
      }
    }

    const healthy = this.keys.filter((k) => k.healthy);
    if (healthy.length === 0) {
      // All keys unhealthy — reset everything and pray
      log.warn('All keys unhealthy, resetting failure counters');
      this.keys.forEach((k) => {
        k.healthy = true;
        k.failCount = 0;
      });
      return this.select();
    }

    const minInflight = Math.min(...healthy.map((k) => k.inflight));
    const candidates = healthy.filter((k) => k.inflight === minInflight);
    const selected = candidates[this.rrIndex++ % candidates.length];
    log.info(
      `Selected key ${this.mask(selected.key)} (inflight=${selected.inflight}, ` +
        `healthy=${this.keys.filter((k) => k.healthy).length}/${this.keys.length})`,
    );
    return selected.key;
  }

  /** Mark key as in-flight */
  acquire(key: string): void {
    const state = this.keys.find((k) => k.key === key);
    if (state) {
      state.inflight++;
      log.info(`Acquire ${this.mask(key)} inflight=${state.inflight}`);
    }
  }

  /** Release key from in-flight */
  release(key: string): void {
    const state = this.keys.find((k) => k.key === key);
    if (state) {
      state.inflight = Math.max(0, state.inflight - 1);
      log.info(`Release ${this.mask(key)} inflight=${state.inflight}`);
    }
  }

  /** Mark key as failed (rate limit, network error, etc.) */
  markFailed(key: string, error?: Error): void {
    const state = this.keys.find((k) => k.key === key);
    if (!state) return;

    state.failCount++;
    state.lastFailTime = Date.now();
    state.inflight = Math.max(0, state.inflight - 1);

    if (state.failCount >= MAX_FAIL_COUNT) {
      state.healthy = false;
      log.error(
        `Key marked unhealthy ${this.mask(key)} after ${state.failCount} failures: ${error?.message || 'unknown'}`,
      );
    } else {
      log.warn(
        `Key failure ${this.mask(key)} (${state.failCount}/${MAX_FAIL_COUNT}): ${error?.message || 'unknown'}`,
      );
    }
  }

  private mask(key: string): string {
    if (key.length <= 12) return '***';
    return key.slice(0, 6) + '...' + key.slice(-4);
  }
}

// ---------------------------------------------------------------------------
// Global pool cache (one pool per provider)
// ---------------------------------------------------------------------------

const pools = new Map<string, KeyPool>();

export function getKeyPool(providerId: string, keys: string[]): KeyPool {
  const existing = pools.get(providerId);
  if (existing) return existing;

  const pool = new KeyPool(keys);
  pools.set(providerId, pool);
  log.info(`Created key pool for ${providerId} with ${keys.length} keys`);
  return pool;
}

/** Reset all pools (useful in tests) */
export function resetKeyPools(): void {
  pools.clear();
}
