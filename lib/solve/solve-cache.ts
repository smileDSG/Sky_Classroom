/**
 * Solve Cache — in-memory LRU cache for solved problems.
 *
 * This sits between the question bank (persistent, high threshold 0.85)
 * and the LLM solver. It catches near-match problems (threshold 0.70)
 * that were recently solved, avoiding redundant LLM calls.
 *
 * Storage: in-memory Map (server) or IndexedDB (browser).
 * Similarity: reuses textSimilarity from question-bank.ts at 0.70 threshold.
 */

import { db } from '@/lib/utils/database';
import { hashProblemText, textSimilarity } from './question-bank';
import { createLogger } from '@/lib/logger';

const log = createLogger('SolveCache');

const SOLVE_CACHE_THRESHOLD = 0.70;
const MAX_CACHE_ENTRIES = 500;

export interface SolveCacheEntry {
  problemText: string;
  problemHash: string;
  solution: string;
  agentId: string;
  solvedAt: number;
}

// ── In-memory LRU cache (server-side) ──

const memCache = new Map<string, SolveCacheEntry>();

function isBrowser() {
  return typeof indexedDB !== 'undefined';
}

/**
 * Evict oldest entries from in-memory cache if over limit.
 */
function evictIfNeeded() {
  if (memCache.size <= MAX_CACHE_ENTRIES) return;
  const entries = [...memCache.entries()];
  // Remove oldest entries first
  entries.sort((a, b) => a[1].solvedAt - b[1].solvedAt);
  const toRemove = entries.slice(0, memCache.size - MAX_CACHE_ENTRIES);
  for (const [key] of toRemove) {
    memCache.delete(key);
  }
}

/**
 * Find similar solved problems in the solve cache.
 *
 * @param problemText - The problem text to search for
 * @param threshold - Similarity threshold (0-1), default 0.70
 * @returns Array of matching cache entries sorted by similarity desc
 */
export async function findSolveCacheMatches(
  problemText: string,
  threshold: number = SOLVE_CACHE_THRESHOLD,
): Promise<SolveCacheEntry[]> {
  try {
    const allEntries = isBrowser()
      ? await db.solveCache.toArray()
      : Array.from(memCache.values());

    if (allEntries.length === 0) {
      return [];
    }

    const matches = allEntries
      .map((entry) => ({
        entry,
        score: textSimilarity(problemText, entry.problemText),
      }))
      .filter((m) => m.score >= threshold)
      .sort((a, b) => b.score - a.score);

    if (matches.length > 0) {
      log.info(`[SolveCache] Found ${matches.length} matches (best=${matches[0].score.toFixed(2)})`);
    }
    return matches.map((m) => m.entry);
  } catch (error) {
    log.error('[SolveCache] findSolveCacheMatches failed:', error);
    return [];
  }
}

/**
 * Save a solved problem to the cache.
 * Auto-evicts old entries if over limit.
 */
export async function saveToSolveCache(entry: SolveCacheEntry): Promise<void> {
  try {
    if (isBrowser()) {
      await db.solveCache.put(entry);
    } else {
      memCache.set(entry.problemHash, entry);
      evictIfNeeded();
    }
    log.info(`[SolveCache] Saved: ${entry.problemHash.slice(0, 20)}...`);
  } catch (error) {
    log.error('[SolveCache] saveToSolveCache failed:', error);
  }
}

/**
 * Get the total count of entries in the solve cache.
 */
export async function solveCacheCount(): Promise<number> {
  try {
    return isBrowser()
      ? await db.solveCache.count()
      : memCache.size;
  } catch {
    return 0;
  }
}

/**
 * Clear all entries from the solve cache.
 */
export async function clearSolveCache(): Promise<void> {
  try {
    if (isBrowser()) {
      await db.solveCache.clear();
    } else {
      memCache.clear();
    }
    log.info('[SolveCache] Cleared');
  } catch (error) {
    log.error('[SolveCache] clearSolveCache failed:', error);
  }
}
