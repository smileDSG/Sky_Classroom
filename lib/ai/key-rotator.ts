import { createLogger } from '@/lib/logger';

const log = createLogger('KeyRotator');

interface KeyEntry {
  key: string;
  lastUsedAt: number;
  failureCount: number;
  cooldownUntil: number;
}

const COOLDOWN_429_MS = 60_000;
const COOLDOWN_ESCALATED_MS = 5 * 60_000;
const ESCALATION_THRESHOLD = 3;

export class KeyRotator {
  private pools = new Map<string, KeyEntry[]>();

  register(providerId: string, keys: string[]): void {
    if (keys.length === 0) return;
    const unique = [...new Set(keys)];
    this.pools.set(
      providerId,
      unique.map((key) => ({
        key,
        lastUsedAt: 0,
        failureCount: 0,
        cooldownUntil: 0,
      })),
    );
    log.info(`Registered ${unique.length} key(s) for provider "${providerId}"`);
  }

  getNextKey(providerId: string): string | null {
    const pool = this.pools.get(providerId);
    if (!pool || pool.length === 0) return null;
    const now = Date.now();
    const available = pool.filter((entry) => now >= entry.cooldownUntil);
    if (available.length === 0) {
      log.warn(`All keys for "${providerId}" are in cooldown`);
      return null;
    }
    available.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
    const chosen = available[0];
    chosen.lastUsedAt = now;
    return chosen.key;
  }

  markFailed(key: string, providerId: string): void {
    const pool = this.pools.get(providerId);
    if (!pool) return;
    const entry = pool.find((e) => e.key === key);
    if (!entry) {
      log.warn(`markFailed: key ...${key.slice(-4)} not found in pool for "${providerId}"`);
      return;
    }
    entry.failureCount++;
    const cooldownMs =
      entry.failureCount >= ESCALATION_THRESHOLD ? COOLDOWN_ESCALATED_MS : COOLDOWN_429_MS;
    entry.cooldownUntil = Date.now() + cooldownMs;
    log.warn(
      `Key ...${key.slice(-4)} for "${providerId}" failed (${entry.failureCount}x), cooldown ${cooldownMs / 1000}s`,
    );
  }

  markSuccess(key: string, providerId: string): void {
    const pool = this.pools.get(providerId);
    if (!pool) return;
    const entry = pool.find((e) => e.key === key);
    if (!entry) {
      log.warn(`markSuccess: key ...${key.slice(-4)} not found in pool for "${providerId}"`);
      return;
    }
    entry.failureCount = 0;
    entry.cooldownUntil = 0;
  }

  getState(): Record<
    string,
    Array<{ keySuffix: string; failures: number; cooldownRemaining: number }>
  > {
    const now = Date.now();
    const result: Record<
      string,
      Array<{ keySuffix: string; failures: number; cooldownRemaining: number }>
    > = {};
    for (const [providerId, pool] of this.pools) {
      result[providerId] = pool.map((e) => ({
        keySuffix: `...${e.key.slice(-4)}`,
        failures: e.failureCount,
        cooldownRemaining: Math.max(0, e.cooldownUntil - now),
      }));
    }
    return result;
  }
}

export const keyRotator = new KeyRotator();
