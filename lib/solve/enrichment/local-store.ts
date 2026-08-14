/**
 * Local JSON file store — zero-dependency storage for enrichment results.
 *
 * Stores solved questions as a JSON array at `.data/enrichment-questions.json`.
 * No MySQL or external services needed.
 */

import { createLogger } from '@/lib/logger';
import type { QuestionBankEntry } from '../types';
import { hashProblemText } from '../question-bank-utils';

const log = createLogger('Enrichment:LocalStore');

// ── In-memory cache ──────────────────────────────────────────────────

let cache: QuestionBankEntry[] | null = null;

function getStorePath(): string {
  // Use project root relative path
  return '.data/enrichment-questions.json';
}

// ── Read/write ───────────────────────────────────────────────────────

async function readStore(): Promise<QuestionBankEntry[]> {
  if (cache) return cache;

  try {
    const fs = await import('fs/promises');
    const path = getStorePath();

    // Ensure directory exists
    const dir = '.data';
    try { await fs.mkdir(dir); } catch { /* exists */ }

    try {
      const data = await fs.readFile(path, 'utf-8');
      cache = JSON.parse(data) as QuestionBankEntry[];
      log.info(`[LocalStore] Loaded ${cache.length} entries from ${path}`);
    } catch {
      // File doesn't exist yet — start empty
      cache = [];
      await fs.writeFile(path, '[]', 'utf-8');
    }

    return cache;
  } catch {
    log.warn('[LocalStore] fs not available (browser?), using memory-only');
    if (!cache) cache = [];
    return cache;
  }
}

async function writeStore(entries: QuestionBankEntry[]): Promise<void> {
  cache = entries;

  try {
    const fs = await import('fs/promises');
    const dir = '.data';
    try { await fs.mkdir(dir); } catch { /* exists */ }
    await fs.writeFile(getStorePath(), JSON.stringify(entries, null, 2), 'utf-8');
    log.info(`[LocalStore] Wrote ${entries.length} entries`);
  } catch {
    // Degrade gracefully — in-memory only
  }
}

// ── Write mutex (serialises concurrent reads + writes) ─────────────

let writeMutex: Promise<void> = Promise.resolve();

/**
 * Acquire the write lock. Returns a release function — always call
 * `release()` in a finally block so the next writer can proceed.
 */
async function acquireWriteLock(): Promise<() => void> {
  let release: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  const prev = writeMutex;
  writeMutex = writeMutex.then(() => next);
  await prev;
  return release!;
}

// ── Public API ───────────────────────────────────────────────────────

export interface LocalStoreEntry {
  problemText: string;
  problemHash: string;
  answer: string;
  solution: string;
  knowledgePoints: { name: string; description: string; difficulty: string }[];
  subject: string;
  gradeLevel: string;
  agentId: string;
  confidence: number;
  storedAt: number;
  sourceUrl: string;
}

/**
 * Save a solved question to the local store.
 */
export async function saveToLocalStore(
  entry: Omit<LocalStoreEntry, 'problemHash' | 'storedAt'>,
): Promise<QuestionBankEntry> {
  const problemHash = hashProblemText(entry.problemText);

  const record: QuestionBankEntry = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    problemHash,
    problemText: entry.problemText,
    answer: entry.answer,
    solution: '',
    knowledgePoints: entry.knowledgePoints.map((k) => ({
      name: k.name,
      description: k.description,
      difficulty: k.difficulty,
    })),
    similarQuestions: [],
    agentId: entry.agentId as any,
    solvedAt: Date.now(),
    verified: entry.confidence >= 0.7,
  };

  const release = await acquireWriteLock();
  try {
    const all = await readStore();
    all.push(record);
    await writeStore(all);
  } finally {
    release();
  }

  log.info(`[LocalStore] Saved: ${entry.problemText.slice(0, 40)}...`);
  return record;
}

/**
 * Get total count of stored questions.
 */
export async function getLocalStoreCount(): Promise<number> {
  const all = await readStore();
  return all.length;
}

/**
 * Find similar questions in the local store.
 */
export async function searchLocalStore(
  query: string,
  limit: number = 10,
): Promise<QuestionBankEntry[]> {
  const all = await readStore();
  const queryLower = query.toLowerCase();

  // Simple substring match — production would use vector search
  const scored = all
    .map((entry) => {
      const text = entry.problemText.toLowerCase();
      let score = 0;
      if (text === queryLower) score = 1.0;
      else if (text.includes(queryLower) || queryLower.includes(text)) score = 0.5;
      else {
        // Bigram overlap
        const queryBigrams = new Set(bigrams(queryLower));
        const textBigrams = new Set(bigrams(text));
        const intersection = [...queryBigrams].filter((b) => textBigrams.has(b)).length;
        const union = new Set([...queryBigrams, ...textBigrams]).size;
        score = union > 0 ? intersection / union : 0;
      }
      return { entry, score };
    })
    .filter((s) => s.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({ ...s.entry, _similarity: s.score }));

  return scored;
}

function bigrams(s: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    result.push(s.slice(i, i + 2));
  }
  return result;
}
