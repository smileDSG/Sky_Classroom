/**
 * Solve Cache — in-memory LRU cache for solved problems.
 *
 * This sits between the question bank (persistent, high threshold 0.85)
 * and the LLM solver. It catches near-match problems (threshold 0.70)
 * that were recently solved, avoiding redundant LLM calls.
 *
 * Storage: in-memory Map (server-side only, ephemeral).
 * Similarity: reuses textSimilarity from question-bank.ts at 0.70 threshold.
 */

import { hashProblemText, textSimilarity } from './question-bank-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('SolveCache');

const SOLVE_CACHE_THRESHOLD = 0.8;
const MAX_CACHE_ENTRIES = 500;

export interface SolveCacheEntry {
  problemText: string;
  problemHash: string;
  solution: string;
  /** Concise final answer, separate from the full solution. */
  answer?: string;
  /** Knowledge points (cached to avoid LLM call on cache hit fast path). */
  knowledgePoints?: { name: string; description: string; difficulty: string }[];
  agentId: string;
  solvedAt: number;
}

// ── In-memory LRU cache (server-side) ──

const memCache = new Map<string, SolveCacheEntry>();
const hashIndex = new Map<string, SolveCacheEntry>();

function evictIfNeeded() {
  if (memCache.size <= MAX_CACHE_ENTRIES) return;
  const entries = [...memCache.entries()];
  entries.sort((a, b) => a[1].solvedAt - b[1].solvedAt);
  const toRemove = entries.slice(0, memCache.size - MAX_CACHE_ENTRIES);
  for (const [key, entry] of toRemove) {
    memCache.delete(key);
    hashIndex.delete(entry.problemHash);
  }
}

/**
 * Find cache matches — first tries O(1) hash exact match,
 * then falls back to O(n) similarity scan.
 */
export async function findSolveCacheMatches(
  problemText: string,
  threshold: number = SOLVE_CACHE_THRESHOLD,
): Promise<SolveCacheEntry[]> {
  try {
    if (memCache.size === 0) return [];

    // Fast path: hash exact match O(1)
    const hash = hashProblemText(problemText);
    const exactHit = hashIndex.get(hash);
    if (exactHit) {
      log.info(`[SolveCache] Hash exact match: ${hash}`);
      return [exactHit];
    }

    // Slow path: similarity scan O(n)
    const allEntries = Array.from(memCache.values());
    const matches = allEntries
      .map((entry) => ({
        entry,
        score: textSimilarity(problemText, entry.problemText),
      }))
      .filter((m) => m.score >= threshold)
      .sort((a, b) => b.score - a.score);

    if (matches.length > 0) {
      log.info(
        `[SolveCache] Found ${matches.length} matches (best=${matches[0].score.toFixed(2)})`,
      );
    }
    return matches.map((m) => m.entry);
  } catch (error) {
    log.error('[SolveCache] findSolveCacheMatches failed:', error);
    return [];
  }
}

export async function saveToSolveCache(entry: SolveCacheEntry): Promise<void> {
  try {
    memCache.set(entry.problemHash, entry);
    hashIndex.set(entry.problemHash, entry);
    evictIfNeeded();
    log.info(`[SolveCache] Saved: ${entry.problemHash.slice(0, 20)}...`);
  } catch (error) {
    log.error('[SolveCache] saveToSolveCache failed:', error);
  }
}

export async function solveCacheCount(): Promise<number> {
  return memCache.size;
}

export async function clearSolveCache(): Promise<void> {
  memCache.clear();
  hashIndex.clear();
  log.info('[SolveCache] Cleared');
}
