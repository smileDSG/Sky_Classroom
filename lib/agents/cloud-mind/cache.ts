interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  touchedAt: number;
}

interface CacheOptions {
  ttlMs?: number;
  maxEntries?: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;

const cache = new Map<string, CacheEntry<unknown>>();

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function evictExpired(now = Date.now()): void {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

function evictOverflow(maxEntries: number): void {
  if (cache.size <= maxEntries) return;

  const entries = [...cache.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt);
  for (const [key] of entries.slice(0, cache.size - maxEntries)) {
    cache.delete(key);
  }
}

export function buildCloudMindCacheKey(namespace: string, payload: unknown): string {
  return `${namespace}:${hashString(stableStringify(payload))}`;
}

export function getCloudMindCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }

  entry.touchedAt = Date.now();
  return cloneJsonValue(entry.value as T);
}

export function setCloudMindCache<T>(key: string, value: T, options: CacheOptions = {}): void {
  const now = Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;

  evictExpired(now);
  cache.set(key, {
    value: cloneJsonValue(value),
    expiresAt: now + ttlMs,
    touchedAt: now,
  });
  evictOverflow(maxEntries);
}

export function clearCloudMindCache(): void {
  cache.clear();
}

export function getCloudMindCacheStats(): { entries: number } {
  evictExpired();
  return { entries: cache.size };
}
