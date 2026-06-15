/**
 * Question Bank — server-side operations backed by MySQL (Knowledge Base).
 *
 * All functions here use dynamic imports for kb-manager so they only
 * load server-side code when actually called.
 */

import 'server-only';
import type { QuestionBankEntry } from './types';
import { hashProblemText } from './question-bank-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('QuestionBank');

export { hashProblemText };

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
      threshold: 0.01,
    });

    if (results.length === 0) {
      log.info('[QuestionBank] Empty KB, no matches');
      return [];
    }

    // Use the vector search score directly instead of computing textSimilarity again.
    // The KB uses TF-IDF cosine similarity — adjust threshold accordingly.
    // Old bigram Jaccard threshold 0.85 ≈ cosine threshold ~0.60 for TF-IDF.
    const vectorThreshold = Math.max(threshold - 0.25, 0.3);
    const matches: QuestionBankEntry[] = [];
    for (const result of results) {
      if (result.score < vectorThreshold) continue;
      try {
        const entry = JSON.parse(result.chunk.content) as QuestionBankEntry;
        matches.push({ ...entry, _similarity: result.score });
      } catch {
        // skip malformed chunks
      }
    }

    matches.sort((a, b) => ((b as any)._similarity || 0) - ((a as any)._similarity || 0));
    log.info(
      `[QuestionBank] Found ${matches.length} matches (vectorThreshold=${vectorThreshold.toFixed(2)})`,
    );
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
      solution: 'solution' in entry ? ((entry as any).solution ?? '') : '',
      answer: entry.answer,
      knowledgePoints: entry.knowledgePoints,
      similarQuestions: entry.similarQuestions ?? [],
      agentId: entry.agentId,
      solvedAt: entry.solvedAt ?? Date.now(),
      verified: entry.verified ?? true,
    };

    const { write, hasSource } = await import('@/lib/knowledge-base/kb-manager');

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

export async function listQuestionBankEntries(limit: number = 100): Promise<QuestionBankEntry[]> {
  try {
    const { search } = await import('@/lib/knowledge-base/kb-manager');
    const results = await search({
      kbType: 'solve',
      query: ' ',
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

/**
 * Find similar questions by knowledge point overlap.
 *
 * Searches the question bank for entries that share at least one knowledge
 * point with the current problem. Returns real questions with answers.
 *
 * @param currentProblemText - The current problem (used as search query + exclusion)
 * @param knowledgePoints - Knowledge points from the current problem's solution
 * @param excludeHash - Hash of the current problem to exclude from results
 * @param limit - Max number of similar questions to return
 */
export async function findSimilarByKnowledgePoints(
  currentProblemText: string,
  knowledgePoints: { name: string }[],
  excludeHash: string,
  limit: number = 3,
): Promise<{ problem: string; difficulty: number; knowledgePoint: string; answer: string }[]> {
  if (knowledgePoints.length === 0) return [];

  try {
    const { search } = await import('@/lib/knowledge-base/kb-manager');

    // Build a query that combines problem text + knowledge point names for better recall
    const kpNames = knowledgePoints.map((k) => k.name).join(' ');
    const query = `${currentProblemText} ${kpNames}`;

    const results = await search({
      kbType: 'solve',
      query,
      topK: 20,
      threshold: 0.01,
    });

    if (results.length === 0) return [];

    const currentKpNames = new Set(knowledgePoints.map((k) => k.name));
    const seen = new Set<string>();
    const candidates: {
      problem: string;
      difficulty: number;
      knowledgePoint: string;
      answer: string;
    }[] = [];

    for (const result of results) {
      try {
        const entry = JSON.parse(result.chunk.content) as QuestionBankEntry;

        // Skip the current problem itself
        if (entry.problemHash === excludeHash) continue;
        if (seen.has(entry.problemHash)) continue;
        seen.add(entry.problemHash);

        // Check knowledge point overlap
        const entryKpNames = (entry.knowledgePoints || []).map((k) => k.name);
        const overlap = entryKpNames.filter((name) => currentKpNames.has(name));
        if (overlap.length === 0) continue;

        candidates.push({
          problem: entry.problemText,
          // Estimate difficulty from knowledge points if available, otherwise default
          difficulty:
            entry.knowledgePoints?.[0]?.difficulty === 'easy'
              ? 3
              : entry.knowledgePoints?.[0]?.difficulty === 'hard'
                ? 7
                : 5,
          knowledgePoint: overlap[0], // Use the first overlapping knowledge point
          answer: entry.answer,
        });

        if (candidates.length >= limit) break;
      } catch {
        // skip malformed
      }
    }

    log.info(
      `[QuestionBank] findSimilarByKnowledgePoints: ${candidates.length} results for KPs [${kpNames}]`,
    );
    return candidates;
  } catch (error) {
    log.error('[QuestionBank] findSimilarByKnowledgePoints failed:', error);
    return [];
  }
}
