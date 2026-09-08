/**
 * Cache Recovery — validation and self-healing for browser storage.
 *
 * Provides centralized helpers to detect and recover from corrupted
 * localStorage / IndexedDB data. Used by stores, hooks, and persistence
 * modules throughout the app.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('CacheRecovery');

// ── Safe JSON Parse ─────────────────────────────────────────────────

/**
 * Parse JSON with automatic corruption detection.
 * If parsing fails, removes the corrupted key from localStorage and
 * returns the provided fallback.
 */
export function safeParseJSON<T>(key: string, fallback: T, storage: Storage = localStorage): T {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    log.warn(`Corrupted cache entry "${key}" — clearing:`, error);
    try {
      storage.removeItem(key);
    } catch {
      // ignore — storage might be unavailable
    }
    return fallback;
  }
}

/**
 * Parse JSON and validate with a type guard.
 * If parsing succeeds but validation fails, clears the entry and returns fallback.
 */
export function safeParseAndValidate<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
  storage: Storage = localStorage,
): T {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;

    const parsed = JSON.parse(raw);
    if (isValid(parsed)) return parsed;

    log.warn(`Cache entry "${key}" failed validation — clearing`);
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
    return fallback;
  } catch (error) {
    log.warn(`Corrupted cache entry "${key}" — clearing:`, error);
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
    return fallback;
  }
}

// ── Cache Health Check ──────────────────────────────────────────────

export interface CacheHealthReport {
  totalKeys: number;
  corruptedKeys: string[];
  clearedKeys: string[];
  healthy: boolean;
}

/**
 * Scan all localStorage keys for corrupted JSON entries.
 * Optionally auto-clears them.
 */
export function checkCacheHealth(autoClear = false): CacheHealthReport {
  const report: CacheHealthReport = {
    totalKeys: 0,
    corruptedKeys: [],
    clearedKeys: [],
    healthy: true,
  };

  if (typeof window === 'undefined') return report;

  try {
    report.totalKeys = localStorage.length;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      // Only check keys that look like JSON (start with { or [)
      const trimmed = raw.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;

      try {
        JSON.parse(raw);
      } catch {
        report.corruptedKeys.push(key);
        report.healthy = false;

        if (autoClear) {
          try {
            localStorage.removeItem(key);
            report.clearedKeys.push(key);
            log.warn(`Auto-cleared corrupted key: "${key}"`);
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (error) {
    log.error('Cache health check failed:', error);
  }

  if (report.corruptedKeys.length > 0) {
    log.warn(
      `Cache health: ${report.corruptedKeys.length} corrupted keys found`,
      report.corruptedKeys,
    );
  }

  return report;
}

// ── Manual Cache Reset ──────────────────────────────────────────────

const CACHE_KEY_PREFIXES = [
  'settings-storage',
  'quizDraft:',
  'quizAnswers:',
  'quizResults:',
] as const;

/**
 * Reset all app cache data (localStorage + IndexedDB).
 * Use this as a "nuclear option" when the app is broken due to cache corruption.
 *
 * @param options Which caches to clear
 * @returns Summary of what was cleared
 */
export async function resetAllCache(options?: {
  localStorage?: boolean;
  indexedDB?: boolean;
  keepSettings?: boolean;
}): Promise<{ localStorageCleared: boolean; indexedDBCleared: boolean }> {
  const {
    localStorage: clearLS = true,
    indexedDB: clearIDB = true,
    keepSettings = false,
  } = options ?? {};
  const result = { localStorageCleared: false, indexedDBCleared: false };

  // Clear localStorage
  if (clearLS && typeof window !== 'undefined') {
    try {
      if (keepSettings) {
        // Only clear non-settings keys
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !key.startsWith('settings-')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } else {
        localStorage.clear();
      }
      result.localStorageCleared = true;
      log.info('localStorage cleared' + (keepSettings ? ' (settings preserved)' : ''));
    } catch (error) {
      log.error('Failed to clear localStorage:', error);
    }
  }

  // Clear IndexedDB
  if (clearIDB && typeof window !== 'undefined') {
    try {
      const { db } = await import('@/lib/utils/database');
      await db.delete();
      result.indexedDBCleared = true;
      log.info('IndexedDB (MAIC-Database) cleared');
    } catch (error) {
      log.error('Failed to clear IndexedDB:', error);
    }
  }

  return result;
}

// ── Auto-heal on module load ────────────────────────────────────────

/**
 * Run a quick health check on app startup.
 * Clears corrupted JSON entries automatically.
 * Called lazily on first import.
 */
let _startupCheckDone = false;
export function runStartupCacheCheck(): void {
  if (_startupCheckDone) return;
  _startupCheckDone = true;

  if (typeof window === 'undefined') return;

  // Run async to not block app startup
  setTimeout(() => {
    const report = checkCacheHealth(true); // auto-clear corrupted entries
    if (!report.healthy) {
      log.warn(
        `Startup cache check: cleared ${report.clearedKeys.length} corrupted entries`,
        report.clearedKeys,
      );
    }
  }, 1000);
}
