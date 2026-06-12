/**
 * Question Bank — MySQL DAO layer.
 *
 * All operations hit the dedicated `question_bank` table.
 * Uses dynamic mysql2 import so this file can be imported in any context
 * (the pool is created lazily).
 */

import { createLogger } from '@/lib/logger';
import { hashProblemText } from '@/lib/solve/question-bank-utils';
import type {
  QuestionBankRow,
  QuestionBankInsert,
  QuestionBankUpdate,
  QuestionBankFilter,
  ImportResult,
} from './types';

const log = createLogger('QB:DAO');

// ── Connection pool (lazy) ──────────────────────────────────────────

let _pool: any = null;

async function getPool(): Promise<any> {
  if (_pool) return _pool;
  const mysql = await import('mysql2/promise');
  _pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sky_classroom',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  return _pool;
}

// ── Row mapping ─────────────────────────────────────────────────────

interface QBRow {
  id: string;
  subject: string;
  grade: string;
  difficulty: string;
  question_type: string;
  content: string;
  answer: string;
  explanation: string;
  knowledge_points: string; // JSON
  image: string | null;
  options: string | null; // JSON
  source: string | null;
  tags: string; // JSON
  problem_hash: string;
  verified: number;
  created_at: Date;
  updated_at: Date;
}

function toRow(r: QBRow): QuestionBankRow {
  return {
    id: r.id,
    subject: r.subject,
    grade: r.grade,
    difficulty: r.difficulty as QuestionBankRow['difficulty'],
    questionType: r.question_type as QuestionBankRow['questionType'],
    content: r.content,
    answer: r.answer,
    explanation: r.explanation,
    knowledgePoints: safeParseJson<string[]>(r.knowledge_points, []),
    image: r.image,
    options: safeParseJson<string[] | null>(r.options, null),
    source: r.source,
    tags: safeParseJson<string[]>(r.tags, []),
    problemHash: r.problem_hash,
    verified: !!r.verified,
    createdAt: r.created_at?.toISOString?.() ?? String(r.created_at),
    updatedAt: r.updated_at?.toISOString?.() ?? String(r.updated_at),
  };
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── Ensure table exists ─────────────────────────────────────────────

let _tableEnsured = false;

export async function ensureTable(): Promise<void> {
  if (_tableEnsured) return;
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_bank (
      id               VARCHAR(64)  PRIMARY KEY,
      subject          VARCHAR(64)  NOT NULL DEFAULT '',
      grade            VARCHAR(32)  NOT NULL DEFAULT '',
      difficulty       VARCHAR(16)  NOT NULL DEFAULT 'medium',
      question_type    VARCHAR(16)  NOT NULL DEFAULT 'solve',
      content          TEXT         NOT NULL,
      answer           TEXT         NOT NULL,
      explanation      TEXT         NOT NULL DEFAULT '',
      knowledge_points JSON         NOT NULL DEFAULT (JSON_ARRAY()),
      image            TEXT,
      options          JSON,
      source           VARCHAR(255),
      tags             JSON         NOT NULL (JSON_ARRAY()),
      problem_hash     VARCHAR(64)  NOT NULL,
      verified         BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX uq_problem_hash (problem_hash),
      INDEX idx_subject    (subject),
      INDEX idx_difficulty (difficulty),
      INDEX idx_grade      (grade),
      INDEX idx_type       (question_type),
      INDEX idx_verified   (verified),
      FULLTEXT INDEX ft_content (content, explanation) WITH PARSER ngram
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  _tableEnsured = true;
}

// ── Generate ID ─────────────────────────────────────────────────────

function genId(): string {
  return `qb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── CRUD ────────────────────────────────────────────────────────────

export async function insertOne(entry: QuestionBankInsert): Promise<QuestionBankRow> {
  await ensureTable();
  const pool = await getPool();

  const id = entry.id ?? genId();
  const problemHash = hashProblemText(entry.content);
  const now = new Date();

  await pool.query(
    `INSERT INTO question_bank
      (id, subject, grade, difficulty, question_type, content, answer,
       explanation, knowledge_points, image, options, source, tags,
       problem_hash, verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entry.subject ?? '',
      entry.grade ?? '',
      entry.difficulty ?? 'medium',
      entry.questionType ?? 'solve',
      entry.content,
      entry.answer,
      entry.explanation ?? '',
      JSON.stringify(entry.knowledgePoints ?? []),
      entry.image ?? null,
      entry.options ? JSON.stringify(entry.options) : null,
      entry.source ?? null,
      JSON.stringify(entry.tags ?? []),
      problemHash,
      entry.verified ?? false,
      now,
      now,
    ],
  );

  log.info(`Inserted question: ${id} (hash: ${problemHash})`);
  return {
    id,
    subject: entry.subject ?? '',
    grade: entry.grade ?? '',
    difficulty: entry.difficulty ?? 'medium',
    questionType: entry.questionType ?? 'solve',
    content: entry.content,
    answer: entry.answer,
    explanation: entry.explanation ?? '',
    knowledgePoints: entry.knowledgePoints ?? [],
    image: entry.image ?? null,
    options: entry.options ?? null,
    source: entry.source ?? null,
    tags: entry.tags ?? [],
    problemHash,
    verified: entry.verified ?? false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * Batch insert. Skips duplicates (same problem_hash) silently.
 * Returns import result with counts.
 */
export async function insertBatch(entries: QuestionBankInsert[]): Promise<ImportResult> {
  await ensureTable();
  const pool = await getPool();

  const result: ImportResult = { total: entries.length, inserted: 0, duplicates: 0, errors: [] };

  // Build values in batches of 100 for efficiency
  const BATCH_SIZE = 100;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const values: any[] = [];
    const placeholders: string[] = [];
    const now = new Date();

    for (let j = 0; j < chunk.length; j++) {
      const entry = chunk[j];
      if (!entry.content || !entry.answer) {
        result.errors.push({ row: i + j + 1, reason: 'Missing content or answer' });
        continue;
      }

      const id = entry.id ?? genId();
      const problemHash = hashProblemText(entry.content);

      placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      values.push(
        id,
        entry.subject ?? '',
        entry.grade ?? '',
        entry.difficulty ?? 'medium',
        entry.questionType ?? 'solve',
        entry.content,
        entry.answer,
        entry.explanation ?? '',
        JSON.stringify(entry.knowledgePoints ?? []),
        entry.image ?? null,
        entry.options ? JSON.stringify(entry.options) : null,
        entry.source ?? null,
        JSON.stringify(entry.tags ?? []),
        problemHash,
        entry.verified ?? false,
        now,
        now,
      );
    }

    if (placeholders.length === 0) continue;

    try {
      const [res] = await pool.query(
        `INSERT IGNORE INTO question_bank
          (id, subject, grade, difficulty, question_type, content, answer,
           explanation, knowledge_points, image, options, source, tags,
           problem_hash, verified, created_at, updated_at)
         VALUES ${placeholders.join(', ')}`,
        values,
      );
      const affected = (res as any).affectedRows ?? 0;
      const skipped = placeholders.length - affected;
      result.inserted += affected;
      result.duplicates += skipped;
    } catch (err: any) {
      log.error('Batch insert error:', err);
      for (let j = 0; j < chunk.length; j++) {
        result.errors.push({ row: i + j + 1, reason: err.message ?? 'Unknown error' });
      }
    }
  }

  log.info(
    `Batch insert: ${result.inserted} inserted, ${result.duplicates} dupes, ${result.errors.length} errors`,
  );
  return result;
}

export async function findById(id: string): Promise<QuestionBankRow | null> {
  await ensureTable();
  const pool = await getPool();
  const [rows] = await pool.query('SELECT * FROM question_bank WHERE id = ? LIMIT 1', [id]);
  return rows.length > 0 ? toRow(rows[0]) : null;
}

export async function findByHash(problemHash: string): Promise<QuestionBankRow | null> {
  await ensureTable();
  const pool = await getPool();
  const [rows] = await pool.query('SELECT * FROM question_bank WHERE problem_hash = ? LIMIT 1', [
    problemHash,
  ]);
  return rows.length > 0 ? toRow(rows[0]) : null;
}

/**
 * Search with optional filters.
 * - keyword: uses FULLTEXT (ngram) on content + explanation
 * - subject/difficulty/grade/questionType/verified: exact match filters
 * - tags: match any tag in the JSON array
 */
export async function search(filter: QuestionBankFilter = {}): Promise<QuestionBankRow[]> {
  await ensureTable();
  const pool = await getPool();

  const conditions: string[] = [];
  const params: any[] = [];

  if (filter.subject) {
    conditions.push('subject = ?');
    params.push(filter.subject);
  }
  if (filter.grade) {
    conditions.push('grade = ?');
    params.push(filter.grade);
  }
  if (filter.difficulty) {
    conditions.push('difficulty = ?');
    params.push(filter.difficulty);
  }
  if (filter.questionType) {
    conditions.push('question_type = ?');
    params.push(filter.questionType);
  }
  if (filter.verified !== undefined) {
    conditions.push('verified = ?');
    params.push(filter.verified ? 1 : 0);
  }
  if (filter.keyword) {
    conditions.push('MATCH(content, explanation) AGAINST(? IN BOOLEAN MODE)');
    params.push(filter.keyword);
  }
  if (filter.tags && filter.tags.length > 0) {
    // JSON_CONTAINS checks if any of the given tags exist in the JSON array
    const tagConds = filter.tags.map(() => 'JSON_CONTAINS(tags, JSON_QUOTE(?))');
    conditions.push(`(${tagConds.join(' OR ')})`);
    params.push(...filter.tags);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;

  const [rows] = await pool.query(
    `SELECT * FROM question_bank ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return rows.map(toRow);
}

export async function update(id: string, patch: QuestionBankUpdate): Promise<boolean> {
  await ensureTable();
  const pool = await getPool();

  const sets: string[] = [];
  const params: any[] = [];

  if (patch.subject !== undefined) {
    sets.push('subject = ?');
    params.push(patch.subject);
  }
  if (patch.grade !== undefined) {
    sets.push('grade = ?');
    params.push(patch.grade);
  }
  if (patch.difficulty !== undefined) {
    sets.push('difficulty = ?');
    params.push(patch.difficulty);
  }
  if (patch.questionType !== undefined) {
    sets.push('question_type = ?');
    params.push(patch.questionType);
  }
  if (patch.content !== undefined) {
    sets.push('content = ?');
    params.push(patch.content);
    // Re-hash if content changes
    sets.push('problem_hash = ?');
    params.push(hashProblemText(patch.content));
  }
  if (patch.answer !== undefined) {
    sets.push('answer = ?');
    params.push(patch.answer);
  }
  if (patch.explanation !== undefined) {
    sets.push('explanation = ?');
    params.push(patch.explanation);
  }
  if (patch.knowledgePoints !== undefined) {
    sets.push('knowledge_points = ?');
    params.push(JSON.stringify(patch.knowledgePoints));
  }
  if (patch.image !== undefined) {
    sets.push('image = ?');
    params.push(patch.image);
  }
  if (patch.options !== undefined) {
    sets.push('options = ?');
    params.push(JSON.stringify(patch.options));
  }
  if (patch.source !== undefined) {
    sets.push('source = ?');
    params.push(patch.source);
  }
  if (patch.tags !== undefined) {
    sets.push('tags = ?');
    params.push(JSON.stringify(patch.tags));
  }
  if (patch.verified !== undefined) {
    sets.push('verified = ?');
    params.push(patch.verified ? 1 : 0);
  }

  if (sets.length === 0) return false;

  const [res] = await pool.query(`UPDATE question_bank SET ${sets.join(', ')} WHERE id = ?`, [
    ...params,
    id,
  ]);
  return ((res as any).affectedRows ?? 0) > 0;
}

export async function deleteById(id: string): Promise<boolean> {
  await ensureTable();
  const pool = await getPool();
  const [res] = await pool.query('DELETE FROM question_bank WHERE id = ?', [id]);
  return ((res as any).affectedRows ?? 0) > 0;
}

export async function count(
  filter: Pick<
    QuestionBankFilter,
    'subject' | 'difficulty' | 'grade' | 'questionType' | 'verified'
  > = {},
): Promise<number> {
  await ensureTable();
  const pool = await getPool();

  const conditions: string[] = [];
  const params: any[] = [];

  if (filter.subject) {
    conditions.push('subject = ?');
    params.push(filter.subject);
  }
  if (filter.grade) {
    conditions.push('grade = ?');
    params.push(filter.grade);
  }
  if (filter.difficulty) {
    conditions.push('difficulty = ?');
    params.push(filter.difficulty);
  }
  if (filter.questionType) {
    conditions.push('question_type = ?');
    params.push(filter.questionType);
  }
  if (filter.verified !== undefined) {
    conditions.push('verified = ?');
    params.push(filter.verified ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT COUNT(*) as cnt FROM question_bank ${where}`, params);
  return rows[0]?.cnt ?? 0;
}

export async function list(limit: number = 100, offset: number = 0): Promise<QuestionBankRow[]> {
  await ensureTable();
  const pool = await getPool();
  const [rows] = await pool.query(
    'SELECT * FROM question_bank ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset],
  );
  return rows.map(toRow);
}
