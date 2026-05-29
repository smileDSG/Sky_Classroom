/**
 * Question Bank — backed by the Knowledge Base system (MySQL).
 *
 * Workflow:
 *   1. Before solving, call findSimilarQuestions(problemText)
 *   2. If a match is found (similarity >= threshold), return it
 *   3. After solving, call saveToQuestionBank(entry) to cache
 *
 * Storage: MySQL via kb-manager. All operations are server-side only.
 * Similarity: text-based Jaccard bigram + KB TF-IDF retrieval.
 */

import type { QuestionBankEntry } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('QuestionBank');

// ── Hashing ──────────────────────────────────────────────────────────

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

// ── Similarity ──────────────────────────────────────────────────────

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

export async function findSimilarQuestions(
  problemText: string,
  threshold: number = DEFAULT_THRESHOLD,
): Promise<QuestionBankEntry[]> {
  try {
    const { search } = await import('@/lib/knowledge-base/kb-manager');
    const results = await search({
      kbType: 'solve',
      query: problemText,
      topK: 10,
      threshold: 0.01, // low threshold for TF-IDF, we'll filter with Jaccard below
    });

    if (results.length === 0) {
      log.info('[QuestionBank] Empty KB, no matches');
      return [];
    }

    // Parse the stored content back to QuestionBankEntry and apply Jaccard similarity
    const matches: QuestionBankEntry[] = [];
    for (const result of results) {
      try {
        const entry = JSON.parse(result.chunk.content) as QuestionBankEntry;
        const score = textSimilarity(problemText, entry.problemText);
        if (score >= threshold) {
          matches.push({ ...entry, _similarity: score });
        }
      } catch {
        // skip malformed chunks
      }
    }

    matches.sort((a, b) => ((b as any)._similarity || 0) - ((a as any)._similarity || 0));
    log.info(`[QuestionBank] Found ${matches.length} matches (threshold=${threshold})`);
    return matches;
  } catch (error) {
    log.error('[QuestionBank] findSimilarQuestions failed:', error);
    return [];
  }
}

export async function saveToQuestionBank(
  entry: Omit<QuestionBankEntry, 'id' | 'problemHash'> & { problemHash?: string },
): Promise<QuestionBankEntry> {
  try {
    const problemHash = entry.problemHash ?? hashProblemText(entry.problemText);
    const id = `qb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const record: QuestionBankEntry = {
      id,
      problemHash,
      problemText: entry.problemText,
      problemImage: entry.problemImage ?? undefined,
      answer: entry.answer,
      steps: entry.steps,
      knowledgePoints: entry.knowledgePoints,
      similarQuestions: entry.similarQuestions ?? [],
      agentId: entry.agentId,
      solvedAt: entry.solvedAt ?? Date.now(),
      verified: entry.verified ?? false,
    };

    const { write, hasSource } = await import('@/lib/knowledge-base/kb-manager');

    // Deduplicate by problemHash
    const exists = await hasSource(problemHash);
    if (exists) {
      log.info(`[QuestionBank] Duplicate hash: ${problemHash}, skipping`);
      return record;
    }

    await write({
      kbType: 'solve',
      title: `题解: ${entry.problemText.slice(0, 60)}`,
      content: JSON.stringify(record),
      tags: [entry.agentId, ...record.knowledgePoints.map((k) => k.name)],
      sourceId: problemHash,
      verified: record.verified,
    });

    log.info(`[QuestionBank] Saved entry: ${id} (hash: ${problemHash})`);
    return record;
  } catch (error) {
    log.error('[QuestionBank] saveToQuestionBank failed:', error);
    throw error;
  }
}

export async function deleteQuestionBankEntry(id: string): Promise<void> {
  try {
    const { removeDocument } = await import('@/lib/knowledge-base/kb-manager');
    await removeDocument(id);
    log.info(`[QuestionBank] Deleted entry: ${id}`);
  } catch (error) {
    log.error('[QuestionBank] deleteQuestionBankEntry failed:', error);
    throw error;
  }
}

export async function listQuestionBankEntries(
  limit: number = 100,
): Promise<QuestionBankEntry[]> {
  try {
    const { search } = await import('@/lib/knowledge-base/kb-manager');
    // Search with empty query to get all solve entries, sorted by recency
    const results = await search({
      kbType: 'solve',
      query: ' ', // minimal query to trigger retrieval
      topK: limit,
      threshold: 0,
    });

    const entries: QuestionBankEntry[] = [];
    for (const result of results) {
      try {
        entries.push(JSON.parse(result.chunk.content));
      } catch {
        // skip malformed
      }
    }

    // Sort by solvedAt descending
    entries.sort((a, b) => b.solvedAt - a.solvedAt);
    return entries.slice(0, limit);
  } catch (error) {
    log.error('[QuestionBank] listQuestionBankEntries failed:', error);
    return [];
  }
}

export async function questionBankCount(): Promise<number> {
  try {
    const { stats } = await import('@/lib/knowledge-base/kb-manager');
    const s = await stats();
    return s.byType?.solve?.documents || 0;
  } catch {
    return 0;
  }
}

export async function clearQuestionBank(): Promise<void> {
  try {
    const { clearType } = await import('@/lib/knowledge-base/kb-manager');
    await clearType('solve');
    log.info('[QuestionBank] Cleared all entries');
  } catch (error) {
    log.error('[QuestionBank] clearQuestionBank failed:', error);
    throw error;
  }
}

export async function isProblemInBank(problemText: string): Promise<boolean> {
  try {
    const hash = hashProblemText(problemText);
    const { hasSource } = await import('@/lib/knowledge-base/kb-manager');
    return hasSource(hash);
  } catch {
    return false;
  }
}
