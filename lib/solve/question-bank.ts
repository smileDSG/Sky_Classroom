'use server';

/**
 * Question Bank — server-side operations backed by MySQL (Knowledge Base).
 *
 * All functions here use dynamic imports for kb-manager so they only
 * load server-side code when actually called.
 */

import 'server-only';
import type { QuestionBankEntry } from './types';
import { hashProblemText, textSimilarity } from './question-bank-utils';
import { createLogger } from '@/lib/logger';
import type { QuestionBankRow } from '@/lib/question-bank/types';

const log = createLogger('QuestionBank');

export { hashProblemText, textSimilarity };

// ── Thresholds ────────────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 0.85;

// ── Dedicated bank helpers ────────────────────────────────────────────

/**
 * Convert a QuestionBankRow (MySQL dedicated table) to QuestionBankEntry
 * (knowledge-base format used by the solve pipeline).
 */
function rowToEntry(row: QuestionBankRow): QuestionBankEntry {
  return {
    id: row.id,
    problemHash: row.problemHash,
    problemText: row.content,
    problemImage: row.image ?? undefined,
    answer: row.answer,
    solution: '',
    knowledgePoints: (row.knowledgePoints ?? []).map((name) => ({
      name,
      description: row.explanation ? `${name} — 参见题目解析` : '',
      difficulty: row.difficulty,
    })),
    similarQuestions: row.similarQuestions ?? [],
    agentId: 'universal', // dedicated-bank entries are treated as universal solver
    solvedAt: new Date(row.createdAt).getTime(),
    verified: row.verified,
    questionType: row.questionType,
    options: row.options ?? undefined,
    steps: row.steps ?? undefined,
  };
}

/**
 * Search the dedicated MySQL question_bank table via FULLTEXT.
 * Returns candidates that are then similarity-scored by the caller.
 */
async function searchDedicatedBank(
  problemText: string,
  limit: number = 20,
): Promise<QuestionBankRow[]> {
  try {
    const { search } = await import('@/lib/question-bank/dao');
    return await search({ keyword: problemText, limit });
  } catch (error) {
    log.error('[QuestionBank] searchDedicatedBank failed:', error);
    return [];
  }
}

// ── Core operations ─────────────────────────────────────────────────

export async function findSimilarQuestions(
  problemText: string,
  threshold: number = DEFAULT_THRESHOLD,
): Promise<QuestionBankEntry[]> {
  // Parallel search: knowledge-base + dedicated MySQL table
  const [kbMatches, bankRows] = await Promise.all([
    findSimilarFromKB(problemText, threshold),
    searchDedicatedBank(problemText, 20),
  ]);

  // Score dedicated-bank candidates with bigram Jaccard (same metric as threshold)
  const bankMatches: QuestionBankEntry[] = [];
  for (const row of bankRows) {
    const score = textSimilarity(problemText, row.content);
    if (score >= threshold) {
      const entry = rowToEntry(row);
      (entry as any)._similarity = score;
      bankMatches.push(entry);
    }
  }
  bankMatches.sort((a, b) => ((b as any)._similarity || 0) - ((a as any)._similarity || 0));

  // Merge & dedupe by problemHash (knowledge-base entries take priority)
  const seen = new Set<string>();
  const merged: QuestionBankEntry[] = [];

  for (const entry of kbMatches) {
    if (!seen.has(entry.problemHash)) {
      seen.add(entry.problemHash);
      merged.push(entry);
    }
  }
  for (const entry of bankMatches) {
    if (!seen.has(entry.problemHash)) {
      seen.add(entry.problemHash);
      merged.push(entry);
    }
  }

  log.info(
    `[QuestionBank] findSimilarQuestions: ${kbMatches.length} KB + ${bankMatches.length} Bank = ${merged.length} total (threshold=${threshold})`,
  );
  return merged;
}

/** Internal: search only the knowledge base. */
async function findSimilarFromKB(
  problemText: string,
  threshold: number,
): Promise<QuestionBankEntry[]> {
  try {
    const { search } = await import('@/lib/knowledge-base/kb-manager');
    const results = await search({
      kbType: 'solve',
      query: problemText,
      topK: 10,
      threshold: 0.01,
    });

    if (results.length === 0) return [];

    // KB uses TF-IDF cosine — map bigram Jaccard threshold to cosine space
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
    log.error('[QuestionBank] findSimilarFromKB failed:', error);
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
      steps: entry.steps ?? [],
    };

    const { write, hasSource } = await import('@/lib/knowledge-base/kb-manager');

    const exists = await hasSource(problemHash);
    if (exists) {
      log.info(`[QuestionBank] Duplicate hash: ${problemHash}, skipping KB write`);
    } else {
      await write({
        kbType: 'solve',
        title: `题解: ${entry.problemText.slice(0, 60)}`,
        content: JSON.stringify(record),
        tags: [entry.agentId, ...record.knowledgePoints.map((k) => k.name)],
        sourceId: problemHash,
        verified: record.verified,
      });
      log.info(`[QuestionBank] Saved entry to KB: ${id} (hash: ${problemHash})`);
    }

    // Also save to dedicated MySQL table
    try {
      const { insertOne, findByHash } = await import('@/lib/question-bank/dao');
      const alreadyInMySQL = await findByHash(problemHash);
      if (!alreadyInMySQL) {
        await insertOne({
          subject: '未知学科',
          grade: '',
          difficulty:
            (entry.knowledgePoints?.[0]?.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
          questionType: entry.questionType ?? 'solve',
          content: entry.problemText,
          answer: entry.answer,
          explanation: entry.knowledgePoints?.map((k) => k.description).join('\n') ?? '',
          knowledgePoints: entry.knowledgePoints?.map((k) => k.name) ?? [],
          image: entry.problemImage ?? undefined,
          options: entry.options,
          steps: entry.steps ?? [],
          similarQuestions: entry.similarQuestions ?? [],
          tags: [],
          verified: entry.verified ?? false,
        });
        log.info(`[QuestionBank] Saved entry to MySQL: ${id} (hash: ${problemHash})`);
      } else {
        log.info(`[QuestionBank] Duplicate hash in MySQL: ${problemHash}, skipping`);
      }
    } catch (mysqlErr) {
      log.error('[QuestionBank] MySQL save failed:', mysqlErr);
      // Don't throw — KB save is the primary path
    }

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
  const hash = hashProblemText(problemText);

  // Check knowledge base
  try {
    const { hasSource } = await import('@/lib/knowledge-base/kb-manager');
    if (await hasSource(hash)) return true;
  } catch {
    // ignore
  }

  // Check dedicated MySQL table
  try {
    const { findByHash } = await import('@/lib/question-bank/dao');
    const row = await findByHash(hash);
    if (row) return true;
  } catch {
    // ignore
  }

  return false;
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

  const currentKpNames = new Set(knowledgePoints.map((k) => k.name));

  // Parallel search: knowledge-base + dedicated MySQL table
  const [kbCandidates, bankRows] = await Promise.all([
    searchKBByKnowledgePoints(currentProblemText, currentKpNames, excludeHash, limit),
    searchBankByKnowledgePoints(currentKpNames, excludeHash, limit * 2),
  ]);

  // Merge & dedupe by problem text (simplified key)
  const seen = new Set<string>();
  const merged: { problem: string; difficulty: number; knowledgePoint: string; answer: string }[] =
    [];

  for (const c of kbCandidates) {
    const key = hashProblemText(c.problem);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }
  for (const c of bankRows) {
    const key = hashProblemText(c.problem);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }

  log.info(
    `[QuestionBank] findSimilarByKnowledgePoints: ${kbCandidates.length} KB + ${bankRows.length} Bank = ${merged.length} total`,
  );
  return merged.slice(0, limit);
}

/** Internal: search knowledge base by knowledge-point overlap. */
async function searchKBByKnowledgePoints(
  currentProblemText: string,
  currentKpNames: Set<string>,
  excludeHash: string,
  limit: number,
): Promise<{ problem: string; difficulty: number; knowledgePoint: string; answer: string }[]> {
  try {
    const { search } = await import('@/lib/knowledge-base/kb-manager');
    const query = `${currentProblemText} ${Array.from(currentKpNames).join(' ')}`;
    const results = await search({
      kbType: 'solve',
      query,
      topK: 20,
      threshold: 0.01,
    });

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
        if (entry.problemHash === excludeHash) continue;
        if (seen.has(entry.problemHash)) continue;
        seen.add(entry.problemHash);

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
      `[QuestionBank] findSimilarByKnowledgePoints: ${candidates.length} results for KPs [${currentKpNames}]`,
    );
    return candidates;
  } catch (error) {
    log.error('[QuestionBank] searchKBByKnowledgePoints failed:', error);
    return [];
  }
}

/** Internal: search dedicated MySQL table by knowledge-point overlap. */
async function searchBankByKnowledgePoints(
  currentKpNames: Set<string>,
  excludeHash: string,
  limit: number,
): Promise<{ problem: string; difficulty: number; knowledgePoint: string; answer: string }[]> {
  try {
    const { search } = await import('@/lib/question-bank/dao');
    // Use the first knowledge point as a tag filter; if no match, fall back to keyword search
    const tags = Array.from(currentKpNames).slice(0, 3);
    const rows = await search({ tags, limit: limit * 2 });

    const candidates: {
      problem: string;
      difficulty: number;
      knowledgePoint: string;
      answer: string;
    }[] = [];

    for (const row of rows) {
      if (row.problemHash === excludeHash) continue;

      const rowKps = row.knowledgePoints ?? [];
      const overlap = rowKps.filter((name) => currentKpNames.has(name));
      if (overlap.length === 0) continue;

      const difficultyMap: Record<string, number> = { easy: 3, medium: 5, hard: 7 };
      candidates.push({
        problem: row.content,
        difficulty: difficultyMap[row.difficulty] ?? 5,
        knowledgePoint: overlap[0],
        answer: row.answer,
      });

      if (candidates.length >= limit) break;
    }
    return candidates;
  } catch (error) {
    log.error('[QuestionBank] searchBankByKnowledgePoints failed:', error);
    return [];
  }
}
