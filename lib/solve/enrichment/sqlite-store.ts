/**
 * SQLite store — scalable replacement for local-store.ts.
 *
 * Uses better-sqlite3 with WAL mode to handle 5000+ enrichment questions
 * without the memory and concurrency issues of the JSON-file approach.
 *
 * All functions are synchronous (better-sqlite3 is sync by design).
 *
 * Dedup strategy: INSERT OR IGNORE on UNIQUE problem_hash column.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { createLogger } from '@/lib/logger';
import type { SolverAgentType, QuestionBankEntry } from '../types';
import { hashProblemText } from '../question-bank-utils';

// Re-export for convenience so consumers import from one place
export type { QuestionBankEntry } from '../types';

const log = createLogger('Enrichment:SqliteStore');

const DB_PATH = '.data/enrichment.db';
const DB_DIR = '.data';

// ── Lazy-initialised singleton ────────────────────────────────────────

let db: Database.Database | null = null;

/** Shape of a row returned by better-sqlite3 queries. */
interface DbRow {
  id: string;
  problem_hash: string;
  problem_text: string;
  answer: string;
  solution: string;
  subject: string;
  grade_level: string;
  question_type: string;
  knowledge_points: string;
  agent_id: string;
  confidence: number;
  source_url: string;
  verified: number;
  created_at: number;
}

// ── Prepared statements (populated once at init) ──────────────────────

let stInsert: Database.Statement | null = null;
let stCount: Database.Statement | null = null;
let stBySubject: Database.Statement | null = null;
let stRecent: Database.Statement | null = null;
let stHasProblem: Database.Statement | null = null;
let stAllForStats: Database.Statement | null = null;
let stFindByHash: Database.Statement | null = null;

function ensureDb(): Database.Database {
  if (db) return db;

  // Auto-create .data directory
  try {
    mkdirSync(DB_DIR, { recursive: true });
  } catch {
    /* directory already exists */
  }

  db = new Database(DB_PATH);

  // ── Performance pragmas ───────────────────────────────────────────
  db.pragma('journal_mode = WAL');
  // 64 MB page cache — generous for 5000+ rows with JSON blobs
  db.pragma('cache_size = -64000');
  // Synchronous NORMAL is safe with WAL and much faster than FULL
  db.pragma('synchronous = NORMAL');

  // ── Schema ────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrichment_questions (
      id TEXT PRIMARY KEY,
      problem_hash TEXT UNIQUE NOT NULL,
      problem_text TEXT NOT NULL,
      answer TEXT NOT NULL,
      solution TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL,
      grade_level TEXT NOT NULL,
      question_type TEXT NOT NULL DEFAULT 'solve',
      knowledge_points TEXT NOT NULL DEFAULT '[]',
      agent_id TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      source_url TEXT NOT NULL DEFAULT '',
      verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subject ON enrichment_questions(subject);
    CREATE INDEX IF NOT EXISTS idx_created_at ON enrichment_questions(created_at);
    CREATE INDEX IF NOT EXISTS idx_problem_hash ON enrichment_questions(problem_hash);
  `);

  // ── Prepared statements ───────────────────────────────────────────
  stInsert = db.prepare(`
    INSERT OR IGNORE INTO enrichment_questions
      (id, problem_hash, problem_text, answer, solution, subject, grade_level,
       question_type, knowledge_points, agent_id, confidence, source_url, verified, created_at)
    VALUES
      (@id, @problem_hash, @problem_text, @answer, @solution, @subject, @grade_level,
       @question_type, @knowledge_points, @agent_id, @confidence, @source_url, @verified, @created_at)
  `);

  stCount = db.prepare('SELECT COUNT(*) AS count FROM enrichment_questions');
  stBySubject = db.prepare('SELECT * FROM enrichment_questions WHERE subject = ?');
  stRecent = db.prepare('SELECT * FROM enrichment_questions ORDER BY created_at DESC LIMIT ?');
  stHasProblem = db.prepare('SELECT 1 FROM enrichment_questions WHERE problem_hash = ? LIMIT 1');
  stAllForStats = db.prepare('SELECT subject, confidence FROM enrichment_questions');
  stFindByHash = db.prepare('SELECT * FROM enrichment_questions WHERE problem_hash = ?');

  log.info(`[SqliteStore] Initialised database at ${DB_PATH}`);
  return db;
}

// ── Row → QuestionBankEntry mapping ───────────────────────────────────

function rowToEntry(row: DbRow): QuestionBankEntry {
  let knowledgePoints: { name: string; description: string; difficulty: string }[] = [];
  try {
    if (row.knowledge_points) {
      knowledgePoints = JSON.parse(row.knowledge_points);
    }
  } catch {
    log.warn(`[SqliteStore] Failed to parse knowledge_points JSON for row ${row.id}`);
  }

  return {
    id: row.id,
    problemHash: row.problem_hash,
    problemText: row.problem_text,
    answer: row.answer,
    knowledgePoints,
    similarQuestions: [],
    agentId: row.agent_id as SolverAgentType,
    solvedAt: row.created_at,
    verified: row.verified !== 0,
  };
}

// ── Public types ──────────────────────────────────────────────────────

export interface SqliteStoreEntry {
  problemText: string;
  answer: string;
  solution: string;
  knowledgePoints: { name: string; description: string; difficulty: string }[];
  subject: string;
  gradeLevel: string;
  agentId: string;
  confidence: number;
  sourceUrl: string;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Save a solved question to the SQLite store.
 *
 * Dedup: if a row with the same `problem_hash` already exists, the insert
 * is silently ignored and the existing `QuestionBankEntry` is returned.
 */
export function saveQuestion(entry: SqliteStoreEntry): QuestionBankEntry {
  const problemHash = hashProblemText(entry.problemText);
  const now = Date.now();
  const id = `sqlite_${now}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    ensureDb();

    const result = stInsert!.run({
      id,
      problem_hash: problemHash,
      problem_text: entry.problemText,
      answer: entry.answer,
      solution: entry.solution,
      subject: entry.subject,
      grade_level: entry.gradeLevel,
      question_type: 'solve',
      knowledge_points: JSON.stringify(entry.knowledgePoints),
      agent_id: entry.agentId,
      confidence: entry.confidence,
      source_url: entry.sourceUrl,
      verified: entry.confidence >= 0.7 ? 1 : 0,
      created_at: now,
    });

    // INSERT OR IGNORE skipped the row — it already exists; return the existing one.
    if (result.changes === 0) {
      const existing = stFindByHash!.get(problemHash) as DbRow | undefined;
      if (existing) {
        log.info(`[SqliteStore] Duplicate skipped: "${entry.problemText.slice(0, 40)}..."`);
        return rowToEntry(existing);
      }
      // Edge case: row vanished between INSERT and SELECT (extremely unlikely)
    }
  } catch (error) {
    log.warn('[SqliteStore] saveQuestion failed:', error);
  }

  // Build the entry inline so callers that ignore the return don't crash
  return {
    id,
    problemHash,
    problemText: entry.problemText,
    answer: entry.answer,
    knowledgePoints: entry.knowledgePoints.map((k) => ({
      name: k.name,
      description: k.description,
      difficulty: k.difficulty,
    })),
    similarQuestions: [],
    agentId: entry.agentId as SolverAgentType,
    solvedAt: now,
    verified: entry.confidence >= 0.7,
  };
}

/** Return the total number of stored questions. */
export function getCount(): number {
  try {
    ensureDb();
    const row = stCount!.get() as { count: number };
    return row.count;
  } catch (error) {
    log.warn('[SqliteStore] getCount failed:', error);
    return 0;
  }
}

/** Return all stored questions for the given subject. */
export function getBySubject(subject: string): QuestionBankEntry[] {
  try {
    ensureDb();
    const rows = stBySubject!.all(subject) as DbRow[];
    return rows.map(rowToEntry);
  } catch (error) {
    log.warn('[SqliteStore] getBySubject failed:', error);
    return [];
  }
}

/** Return the most recently stored questions. Defaults to 20. */
export function getRecent(limit: number = 20): QuestionBankEntry[] {
  try {
    ensureDb();
    const rows = stRecent!.all(limit) as DbRow[];
    return rows.map(rowToEntry);
  } catch (error) {
    log.warn('[SqliteStore] getRecent failed:', error);
    return [];
  }
}

/** Check whether a problem with the given text already exists (by hash). */
export function hasProblem(problemText: string): boolean {
  try {
    ensureDb();
    const problemHash = hashProblemText(problemText);
    const row = stHasProblem!.get(problemHash);
    return row !== undefined;
  } catch (error) {
    log.warn('[SqliteStore] hasProblem failed:', error);
    return false;
  }
}

/**
 * Return aggregate statistics.
 *
 * Computed via a single lightweight query (subject + confidence only) so it
 * scales well past 5000 rows.
 */
export function getStats(): {
  total: number;
  bySubject: Record<string, number>;
  avgConfidence: number;
} {
  try {
    ensureDb();
    const rows = stAllForStats!.all() as { subject: string; confidence: number }[];

    const bySubject: Record<string, number> = {};
    let totalConfidence = 0;

    for (const row of rows) {
      bySubject[row.subject] = (bySubject[row.subject] || 0) + 1;
      totalConfidence += row.confidence;
    }

    return {
      total: rows.length,
      bySubject,
      avgConfidence: rows.length > 0 ? totalConfidence / rows.length : 0,
    };
  } catch (error) {
    log.warn('[SqliteStore] getStats failed:', error);
    return { total: 0, bySubject: {}, avgConfidence: 0 };
  }
}

/** Close the database connection. Safe to call multiple times. */
export function close(): void {
  try {
    if (db) {
      db.close();
      db = null;
      stInsert = null;
      stCount = null;
      stBySubject = null;
      stRecent = null;
      stHasProblem = null;
      stAllForStats = null;
      stFindByHash = null;
      log.info('[SqliteStore] Database closed');
    }
  } catch (error) {
    log.warn('[SqliteStore] close failed:', error);
  }
}
