'use server';

/**
 * Question Bank — MySQL DAO layer.
 *
 * All operations hit the dedicated `question_bank` table.
 * Uses dynamic mysql2 import so this file can be imported in any context
 * (the pool is created lazily).
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '@/lib/logger';
import { hashProblemText } from '@/lib/solve/question-bank-utils';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  QuestionBankRow,
  QuestionBankInsert,
  QuestionBankUpdate,
  QuestionBankFilter,
  ImportResult,
} from './types';

const log = createLogger('QB:DAO');
const FALLBACK_PATH = path.join(process.cwd(), 'data', 'question-bank-fallback.json');

// ── Connection pool (lazy) ──────────────────────────────────────────

let _pool: Pool | null = null;
let _useFallback = false;

async function getPool(): Promise<Pool> {
  if (_pool) return _pool;
  const mysql = (await import('mysql2/promise')).default;
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

interface QBRow extends RowDataPacket {
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

function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
  return ['ER_ACCESS_DENIED_ERROR', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'].includes(code);
}

function markFallback(err: unknown): void {
  _useFallback = true;
  log.warn('Question bank MySQL unavailable, using local fallback storage:', err);
}

async function readFallbackRows(): Promise<QuestionBankRow[]> {
  try {
    const raw = await fs.readFile(FALLBACK_PATH, 'utf-8');
    const rows = JSON.parse(raw) as QuestionBankRow[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function writeFallbackRows(rows: QuestionBankRow[]): Promise<void> {
  await fs.mkdir(path.dirname(FALLBACK_PATH), { recursive: true });
  await fs.writeFile(FALLBACK_PATH, JSON.stringify(rows, null, 2), 'utf-8');
}

function entryToQuestionBankRow(entry: QuestionBankInsert): QuestionBankRow {
  const now = new Date().toISOString();
  return {
    id: entry.id ?? genId(),
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
    problemHash: hashProblemText(entry.content),
    verified: entry.verified ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

function matchesFilter(row: QuestionBankRow, filter: QuestionBankFilter): boolean {
  if (filter.subject && row.subject !== filter.subject) return false;
  if (filter.grade && row.grade !== filter.grade) return false;
  if (filter.difficulty && row.difficulty !== filter.difficulty) return false;
  if (filter.questionType && row.questionType !== filter.questionType) return false;
  if (filter.verified !== undefined && row.verified !== filter.verified) return false;
  if (filter.keyword) {
    const keyword = filter.keyword.toLowerCase();
    if (!row.content.toLowerCase().includes(keyword) && !row.explanation.toLowerCase().includes(keyword)) return false;
  }
  if (filter.knowledgePoint) {
    const knowledgePoint = filter.knowledgePoint.toLowerCase();
    if (!row.knowledgePoints.some((point) => point.toLowerCase().includes(knowledgePoint))) return false;
  }
  if (filter.tags && filter.tags.length > 0 && !filter.tags.some((tag) => row.tags.includes(tag))) return false;
  return true;
}

async function fallbackInsertOne(entry: QuestionBankInsert): Promise<QuestionBankRow> {
  const rows = await readFallbackRows();
  const row = entryToQuestionBankRow(entry);
  if (rows.some((item) => item.problemHash === row.problemHash)) {
    throw Object.assign(new Error('Duplicate question'), { code: 'ER_DUP_ENTRY' });
  }
  rows.unshift(row);
  await writeFallbackRows(rows);
  return row;
}

async function fallbackInsertBatch(entries: QuestionBankInsert[]): Promise<ImportResult> {
  const rows = await readFallbackRows();
  const hashes = new Set(rows.map((row) => row.problemHash));
  const result: ImportResult = { total: entries.length, inserted: 0, duplicates: 0, errors: [] };
  const nextRows = [...rows];

  entries.forEach((entry, index) => {
    if (!entry.content || !entry.answer) {
      result.errors.push({ row: index + 1, reason: 'Missing content or answer' });
      return;
    }
    const row = entryToQuestionBankRow(entry);
    if (hashes.has(row.problemHash)) {
      result.duplicates += 1;
      return;
    }
    hashes.add(row.problemHash);
    nextRows.unshift(row);
    result.inserted += 1;
  });

  await writeFallbackRows(nextRows);
  return result;
}

async function fallbackSearch(filter: QuestionBankFilter = {}): Promise<QuestionBankRow[]> {
  const rows = await readFallbackRows();
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  return rows
    .filter((row) => matchesFilter(row, filter))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(offset, offset + limit);
}

async function fallbackCount(filter: QuestionBankFilter = {}): Promise<number> {
  const rows = await readFallbackRows();
  return rows.filter((row) => matchesFilter(row, filter)).length;
}

async function fallbackUpdate(id: string, patch: QuestionBankUpdate): Promise<boolean> {
  const rows = await readFallbackRows();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return false;
  const next = { ...rows[index], ...patch, updatedAt: new Date().toISOString() };
  if (patch.content !== undefined) next.problemHash = hashProblemText(patch.content);
  rows[index] = next;
  await writeFallbackRows(rows);
  return true;
}

function escapeLike(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function needsLikeFallback(keyword: string): boolean {
  if (!keyword) return false;
  if (keyword.length <= 2) return true;
  // MySQL boolean-mode special operators break ngram or need escaping
  return /[\+\-\*\(\)"<>@~]/.test(keyword);
}

// ── Ensure table exists ─────────────────────────────────────────────

let _tableEnsured = false;

export async function ensureTable(): Promise<void> {
  if (_tableEnsured || _useFallback) return;
  try {
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
        explanation      TEXT         NOT NULL,
        knowledge_points JSON         NOT NULL,
        image            TEXT,
        options          JSON,
        source           VARCHAR(255),
        tags             JSON         NOT NULL,
        problem_hash     VARCHAR(64)  NOT NULL,
        verified         BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX uq_problem_hash (problem_hash),
        INDEX idx_subject    (subject),
        INDEX idx_difficulty (difficulty),
        INDEX idx_grade      (grade),
        INDEX idx_type       (question_type),
        INDEX idx_verified   (verified)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    _tableEnsured = true;
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    markFallback(err);
  }
}

// ── Generate ID ─────────────────────────────────────────────────────

function genId(): string {
  return `qb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── CRUD ────────────────────────────────────────────────────────────

export async function insertOne(entry: QuestionBankInsert): Promise<QuestionBankRow> {
  await ensureTable();
  if (_useFallback) return fallbackInsertOne(entry);
  const pool = await getPool();

  const id = entry.id ?? genId();
  const problemHash = hashProblemText(entry.content);
  const now = new Date();

  try {
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
        entry.verified ?? true,
        now,
        now,
      ],
    );
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    markFallback(err);
    return fallbackInsertOne(entry);
  }

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
    verified: entry.verified ?? true,
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
  if (_useFallback) return fallbackInsertBatch(entries);
  const pool = await getPool();

  const result: ImportResult = { total: entries.length, inserted: 0, duplicates: 0, errors: [] };

  // Build values in batches of 100 for efficiency
  const BATCH_SIZE = 100;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const values: Array<string | boolean | Date | null> = [];
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
        entry.verified ?? true,
        now,
        now,
      );
    }

    if (placeholders.length === 0) continue;

    try {
      const [res] = await pool.query<ResultSetHeader>(
        `INSERT IGNORE INTO question_bank
          (id, subject, grade, difficulty, question_type, content, answer,
           explanation, knowledge_points, image, options, source, tags,
           problem_hash, verified, created_at, updated_at)
         VALUES ${placeholders.join(', ')}`,
        values,
      );
      const affected = res.affectedRows ?? 0;
      const skipped = placeholders.length - affected;
      result.inserted += affected;
      result.duplicates += skipped;
    } catch (err) {
      if (isConnectionError(err)) {
        markFallback(err);
        return fallbackInsertBatch(entries);
      }
      log.error('Batch insert error:', err);
      const reason = err instanceof Error ? err.message : 'Unknown error';
      for (let j = 0; j < chunk.length; j++) {
        result.errors.push({ row: i + j + 1, reason });
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
  if (_useFallback) {
    const rows = await readFallbackRows();
    return rows.find((row) => row.id === id) ?? null;
  }
  const pool = await getPool();
  try {
    const [rows] = await pool.query<QBRow[]>('SELECT * FROM question_bank WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? toRow(rows[0]) : null;
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    markFallback(err);
    const rows = await readFallbackRows();
    return rows.find((row) => row.id === id) ?? null;
  }
}

export async function findAdjacentIds(
  id: string,
  filter: Pick<QuestionBankFilter, 'subject' | 'grade' | 'difficulty' | 'questionType' | 'verified' | 'keyword'> = {},
): Promise<{ prevId: string | null; nextId: string | null }> {
  await ensureTable();
  const pool = await getPool();

  // Get current row's created_at
  const [curRows] = await pool.query<QBRow[]>('SELECT created_at FROM question_bank WHERE id = ?', [id]);
  if (curRows.length === 0) return { prevId: null, nextId: null };
  const createdAt = curRows[0].created_at;

  const conditions: string[] = [];
  const params: any[] = [];

  if (filter.subject) { conditions.push('subject = ?'); params.push(filter.subject); }
  if (filter.grade) { conditions.push('grade = ?'); params.push(filter.grade); }
  if (filter.difficulty) { conditions.push('difficulty = ?'); params.push(filter.difficulty); }
  if (filter.questionType) { conditions.push('question_type = ?'); params.push(filter.questionType); }
  if (filter.verified !== undefined) { conditions.push('verified = ?'); params.push(filter.verified ? 1 : 0); }
  if (filter.keyword) {
    if (needsLikeFallback(filter.keyword)) {
      const like = `%${escapeLike(filter.keyword)}%`;
      conditions.push('(content LIKE ? ESCAPE \'\\\\\' OR explanation LIKE ? ESCAPE \'\\\\\' OR knowledge_points LIKE ? ESCAPE \'\\\\\')');
      params.push(like, like, like);
    } else {
      conditions.push('MATCH(content, explanation) AGAINST(? IN BOOLEAN MODE)');
      params.push(filter.keyword);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const andWhere = conditions.length > 0 ? 'AND' : 'WHERE';

  // Previous: created_at < current, order by created_at DESC
  const [prevRows] = await pool.query<QBRow[]>(
    `SELECT id FROM question_bank ${where} ${andWhere} created_at < ? ORDER BY created_at DESC LIMIT 1`,
    [...params, createdAt],
  );

  // Next: created_at > current, order by created_at ASC
  const [nextRows] = await pool.query<QBRow[]>(
    `SELECT id FROM question_bank ${where} ${andWhere} created_at > ? ORDER BY created_at ASC LIMIT 1`,
    [...params, createdAt],
  );

  return {
    prevId: prevRows.length > 0 ? prevRows[0].id : null,
    nextId: nextRows.length > 0 ? nextRows[0].id : null,
  };
}

export async function findByHash(problemHash: string): Promise<QuestionBankRow | null> {
  await ensureTable();
  if (_useFallback) {
    const rows = await readFallbackRows();
    return rows.find((row) => row.problemHash === problemHash) ?? null;
  }
  const pool = await getPool();
  try {
    const [rows] = await pool.query<QBRow[]>('SELECT * FROM question_bank WHERE problem_hash = ? LIMIT 1', [
      problemHash,
    ]);
    return rows.length > 0 ? toRow(rows[0]) : null;
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    markFallback(err);
    const rows = await readFallbackRows();
    return rows.find((row) => row.problemHash === problemHash) ?? null;
  }
}

/**
 * Search with optional filters.
 * - keyword: uses LIKE on content + explanation
 * - subject/difficulty/grade/questionType/verified: exact match filters
 * - tags: match any tag in the JSON array
 */
export async function search(filter: QuestionBankFilter = {}): Promise<QuestionBankRow[]> {
  await ensureTable();
  if (_useFallback) return fallbackSearch(filter);
  const pool = await getPool();

  const conditions: string[] = [];
  const params: Array<string | number> = [];

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
  if (filter.ids && filter.ids.length > 0) {
    const placeholders = filter.ids.map(() => '?').join(',');
    conditions.push(`id IN (${placeholders})`);
    params.push(...filter.ids);
  }
  if (filter.keyword) {
    conditions.push('(content LIKE ? OR explanation LIKE ?)');
    params.push(`%${filter.keyword}%`, `%${filter.keyword}%`);
  }
  if (filter.knowledgePoint) {
    conditions.push('JSON_SEARCH(knowledge_points, \'one\', ?) IS NOT NULL');
    params.push(`%${filter.knowledgePoint}%`);
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

  try {
    const [rows] = await pool.query<QBRow[]>(
      `SELECT * FROM question_bank ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return rows.map(toRow);
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    markFallback(err);
    return fallbackSearch(filter);
  }
}

export async function update(id: string, patch: QuestionBankUpdate): Promise<boolean> {
  await ensureTable();
  if (_useFallback) return fallbackUpdate(id, patch);
  const pool = await getPool();

  const sets: string[] = [];
  const params: Array<string | number> = [];

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

  try {
    const [res] = await pool.query<ResultSetHeader>(`UPDATE question_bank SET ${sets.join(', ')} WHERE id = ?`, [
      ...params,
      id,
    ]);
    return (res.affectedRows ?? 0) > 0;
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    markFallback(err);
    return fallbackUpdate(id, patch);
  }
}

export async function deleteById(id: string): Promise<boolean> {
  await ensureTable();
  if (_useFallback) {
    const rows = await readFallbackRows();
    const nextRows = rows.filter((row) => row.id !== id);
    if (nextRows.length === rows.length) return false;
    await writeFallbackRows(nextRows);
    return true;
  }
  const pool = await getPool();
  try {
    const [res] = await pool.query<ResultSetHeader>('DELETE FROM question_bank WHERE id = ?', [id]);
    return (res.affectedRows ?? 0) > 0;
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    markFallback(err);
    const rows = await readFallbackRows();
    const nextRows = rows.filter((row) => row.id !== id);
    if (nextRows.length === rows.length) return false;
    await writeFallbackRows(nextRows);
    return true;
  }
}

export async function count(
  filter: Pick<
    QuestionBankFilter,
    'subject' | 'difficulty' | 'grade' | 'questionType' | 'verified' | 'keyword' | 'knowledgePoint'
  > = {},
): Promise<number> {
  await ensureTable();
  if (_useFallback) return fallbackCount(filter);
  const pool = await getPool();

  const conditions: string[] = [];
  const params: Array<string | number> = [];

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
    conditions.push('(content LIKE ? OR explanation LIKE ?)');
    params.push(`%${filter.keyword}%`, `%${filter.keyword}%`);
  }
  if (filter.knowledgePoint) {
    conditions.push('JSON_SEARCH(knowledge_points, \'one\', ?) IS NOT NULL');
    params.push(`%${filter.knowledgePoint}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const [rows] = await pool.query<Array<RowDataPacket & { cnt: number }>>(
      `SELECT COUNT(*) as cnt FROM question_bank ${where}`,
      params,
    );
    return rows[0]?.cnt ?? 0;
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    markFallback(err);
    return fallbackCount(filter);
  }
}

export async function list(limit: number = 100, offset: number = 0): Promise<QuestionBankRow[]> {
  await ensureTable();
  if (_useFallback) return fallbackSearch({ limit, offset });
  const pool = await getPool();
  try {
    const [rows] = await pool.query<QBRow[]>(
      'SELECT * FROM question_bank ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset],
    );
    return rows.map(toRow);
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    markFallback(err);
    return fallbackSearch({ limit, offset });
  }
}
