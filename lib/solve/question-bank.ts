/**
 * Question Bank — self-improvement cache for solved problems.
 *
 * Workflow:
 *   1. Before solving, call findSimilarQuestions(problemText)
 *   2. If a match is found (similarity >= threshold), return it
 *   3. After solving, call saveToQuestionBank(entry) to cache
 *
 * Storage: IndexedDB via Dexie (browser) or in-memory Map (server).
 * Similarity: text-based Jaccard similarity (embedding reserved for future).
 */

import { db } from '@/lib/utils/database';
import type { QuestionBankEntry } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('QuestionBank');

function isBrowser() {
  return typeof indexedDB !== 'undefined';
}

// ── In-memory fallback (server-side) ─────────────────────────────────

const MAX_MEM_BANK_SIZE = 500;
const memBank = new Map<string, QuestionBankEntry & { problemHash: string }>();

function evictOldest() {
  if (memBank.size > MAX_MEM_BANK_SIZE) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, entry] of memBank) {
      if (entry.solvedAt < oldestTime) { oldestTime = entry.solvedAt; oldestKey = key; }
    }
    if (oldestKey) memBank.delete(oldestKey);
  }
}

// ── Hashing ──────────────────────────────────────────────────────────

/**
 * Deterministic hash of problem text for dedup.
 * Normalizes whitespace and case before hashing.
 */
export function hashProblemText(text: string): string {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[，。！？、；：""''（）【】《》\s]/g, '');
  return stableHash(normalized);
}

function stableHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return `qb_${(h >>> 0).toString(36)}`;
}

// ── Bigram cache (avoids recomputing bigrams on each similarity scan) ─

const bigramCache = new Map<string, Set<string>>();

function getCachedBigrams(text: string, hash: string): Set<string> {
  const cached = bigramCache.get(hash);
  if (cached) return cached;
  const grams = bigrams(text);
  bigramCache.set(hash, grams);
  return grams;
}

// ── Similarity ──────────────────────────────────────────────────────

/**
 * Jaccard similarity between two Chinese text strings.
 * Uses character-level bigram overlap for better semantic matching.
 * Returns 0-1 score.
 */
export function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const aGrams = bigrams(a);
  const bGrams = bigrams(b);

  const intersection = new Set([...aGrams].filter((x) => bGrams.has(x)));
  const union = new Set([...aGrams, ...bGrams]);

  return intersection.size / union.size;
}

function bigrams(text: string): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) {
    grams.add(text.slice(i, i + 2));
  }
  return grams;
}

// ── Core operations ─────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 0.85;

/**
 * Find similar questions in the question bank.
 *
 * @param problemText - The problem text to search for
 * @param threshold - Similarity threshold (0-1), default 0.85
 * @returns Array of matching entries sorted by similarity desc
 */
export async function findSimilarQuestions(
  problemText: string,
  threshold: number = DEFAULT_THRESHOLD,
): Promise<QuestionBankEntry[]> {
  try {
    const allEntries = isBrowser()
      ? await db.questionBank.toArray()
      : Array.from(memBank.values());

    if (allEntries.length === 0) {
      log.info('[QuestionBank] Empty, no matches');
      return [];
    }

    const queryGrams = bigrams(problemText);

    const matches = allEntries
      .map((entry) => {
        const entryGrams = isBrowser()
          ? bigrams(entry.problemText)
          : getCachedBigrams(entry.problemText, entry.problemHash);
        const score = jaccardFromSets(queryGrams, entryGrams);
        return { entry, score };
      })
      .filter((m) => m.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .map((m) => ({
        ...m.entry,
        _similarity: m.score,
      }));

    log.info(`[QuestionBank] Found ${matches.length} matches (threshold=${threshold})`);
    return matches as QuestionBankEntry[];
  } catch (error) {
    log.error('[QuestionBank] findSimilarQuestions failed:', error);
    return [];
  }
}

/** Jaccard similarity from pre-computed bigram sets */
function jaccardFromSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Save a question to the bank.
 * Auto-deduplicates by problemHash — existing entries are overwritten.
 *
 * @returns The saved entry
 */
export async function saveToQuestionBank(
  entry: Omit<QuestionBankEntry, 'id' | 'problemHash'> & { problemHash?: string },
): Promise<QuestionBankEntry> {
  try {
    const problemHash = entry.problemHash ?? hashProblemText(entry.problemText);
    const id = `qb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const record = {
      id,
      problemHash,
      problemText: entry.problemText,
      problemImage: entry.problemImage ?? undefined,
      answer: entry.answer,
      steps: entry.steps,
      knowledgePoints: entry.knowledgePoints,
      agentId: entry.agentId,
      solvedAt: entry.solvedAt ?? Date.now(),
      verified: entry.verified ?? false,
    };

    if (isBrowser()) {
      await db.questionBank.put(record);
    } else {
      memBank.set(id, record);
      evictOldest();
    }

    log.info(`[QuestionBank] Saved entry: ${id} (hash: ${problemHash})`);

    return record;
  } catch (error) {
    log.error('[QuestionBank] saveToQuestionBank failed:', error);
    throw error;
  }
}

/**
 * Delete an entry from the question bank.
 */
export async function deleteQuestionBankEntry(id: string): Promise<void> {
  try {
    if (isBrowser()) {
      await db.questionBank.delete(id);
    } else {
      const entry = memBank.get(id);
      if (entry) bigramCache.delete(entry.problemHash);
      memBank.delete(id);
    }
    log.info(`[QuestionBank] Deleted entry: ${id}`);
  } catch (error) {
    log.error('[QuestionBank] deleteQuestionBankEntry failed:', error);
    throw error;
  }
}

/**
 * List all entries, sorted by most recent first.
 * Returns a limited set to avoid loading the entire bank.
 */
export async function listQuestionBankEntries(
  limit: number = 100,
): Promise<QuestionBankEntry[]> {
  try {
    if (isBrowser()) {
      return db.questionBank
        .orderBy('solvedAt')
        .reverse()
        .limit(limit)
        .toArray() as unknown as QuestionBankEntry[];
    }
    return Array.from(memBank.values())
      .sort((a, b) => b.solvedAt - a.solvedAt)
      .slice(0, limit);
  } catch (error) {
    log.error('[QuestionBank] listQuestionBankEntries failed:', error);
    return [];
  }
}

/**
 * Get the total count of entries in the question bank.
 */
export async function questionBankCount(): Promise<number> {
  try {
    if (isBrowser()) {
      return db.questionBank.count();
    }
    return memBank.size;
  } catch {
    return 0;
  }
}

/**
 * Clear all entries from the question bank.
 */
export async function clearQuestionBank(): Promise<void> {
  try {
    if (isBrowser()) {
      await db.questionBank.clear();
    } else {
      memBank.clear();
      bigramCache.clear();
    }
    log.info('[QuestionBank] Cleared all entries');
  } catch (error) {
    log.error('[QuestionBank] clearQuestionBank failed:', error);
    throw error;
  }
}

/**
 * Check if a problem is already in the question bank (exact match by hash).
 */
export async function isProblemInBank(problemText: string): Promise<boolean> {
  try {
    const hash = hashProblemText(problemText);
    if (isBrowser()) {
      const entries = await db.questionBank.where('problemHash').equals(hash).toArray();
      return entries.length > 0;
    }
    for (const entry of memBank.values()) {
      if (entry.problemHash === hash) return true;
    }
    return false;
  } catch {
    return false;
  }
}
