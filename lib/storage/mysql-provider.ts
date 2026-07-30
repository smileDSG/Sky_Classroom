/**
 * MySQL Storage Provider
 *
 * Server-side storage using MySQL.
 * Uses dedicated tables for core entities, falls back to storage_entries for others.
 */

import type { StorageProvider, StorageEntry } from './storage-types';
import { StorageEntryAlreadyExistsError } from './storage-errors';
import { createLogger } from '@/lib/logger';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const log = createLogger('Storage:MySQL');

let _pool: Pool | null = null;

async function getPool(): Promise<Pool> {
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

function toDatetime(ts: number): string {
  return new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
}

function toOptionalDatetime(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? toDatetime(value) : null;
}

function toDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

// ── Table name routing ──────────────────────────────────────────────

const DEDICATED_TABLES = new Set(['users', 'user_checkins', 'user_stats', 'mistakes']);

function isDedicatedTable(table: string): boolean {
  return DEDICATED_TABLES.has(table);
}

// ── CREATE TABLE statements ─────────────────────────────────────────

const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS storage_entries (
    id          VARCHAR(255) NOT NULL,
    table_name  VARCHAR(128) NOT NULL,
    data        JSON NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id, table_name),
    INDEX idx_storage_table (table_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS users (
    id                    VARCHAR(255) PRIMARY KEY,
    email                 VARCHAR(255) UNIQUE,
    username              VARCHAR(255) NOT NULL,
    password_hash         VARCHAR(255),
    role                  VARCHAR(20) NOT NULL DEFAULT 'user',
    status                VARCHAR(20) NOT NULL DEFAULT 'active',
    guest_id              VARCHAR(255) UNIQUE,
    plan_type             VARCHAR(20) NOT NULL DEFAULT 'free',
    avatar                TEXT,
    nickname              VARCHAR(255),
    bio                   TEXT,
    education_level       VARCHAR(50),
    grade                 VARCHAR(50),
    learning_style        VARCHAR(50),
    detail_level          VARCHAR(50),
    preferred_language    VARCHAR(20),
    ai_personality        VARCHAR(50),
    ai_name               VARCHAR(100),
    custom_instructions   TEXT,
    auto_generate_quiz    BOOLEAN DEFAULT FALSE,
    show_step_by_step     BOOLEAN DEFAULT TRUE,
    enable_memory         BOOLEAN DEFAULT TRUE,
    enable_rag            BOOLEAN DEFAULT TRUE,
    email_verified        BOOLEAN NOT NULL DEFAULT FALSE,
    email_verify_token    VARCHAR(255),
    reset_token           VARCHAR(255),
    reset_token_expiry    DATETIME,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at         DATETIME,
    INDEX idx_users_email (email),
    INDEX idx_users_username (username)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS user_checkins (
    id            VARCHAR(255) PRIMARY KEY,
    user_id       VARCHAR(255) NOT NULL,
    checkin_date  DATE NOT NULL,
    timestamp     BIGINT NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, checkin_date),
    INDEX idx_checkin_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS user_stats (
    id                  VARCHAR(255) PRIMARY KEY,
    user_id             VARCHAR(255) NOT NULL,
    stat_date           DATE NOT NULL,
    study_seconds       INT NOT NULL DEFAULT 0,
    checkin_streak      INT NOT NULL DEFAULT 0,
    mastery_score       FLOAT NOT NULL DEFAULT 0,
    problems_attempted  INT NOT NULL DEFAULT 0,
    problems_correct    INT NOT NULL DEFAULT 0,
    scenes_completed    INT NOT NULL DEFAULT 0,
    last_active_at      BIGINT NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, stat_date),
    INDEX idx_stats_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS mistakes (
    id                  VARCHAR(255) PRIMARY KEY,
    user_id             VARCHAR(255) NOT NULL,
    problem_text        TEXT NOT NULL,
    problem_image       LONGTEXT,
    user_answer         TEXT NOT NULL,
    correct_answer      TEXT NOT NULL,
    error_type          VARCHAR(50) NOT NULL,
    error_explanation   TEXT,
    knowledge_points    JSON,
    review_count        INT NOT NULL DEFAULT 0,
    last_review         BIGINT,
    next_review         BIGINT,
    mastery_level       INT NOT NULL DEFAULT 0,
    reviewed            BOOLEAN NOT NULL DEFAULT FALSE,
    source_session_id   VARCHAR(255),
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mistakes_reviewed (reviewed),
    INDEX idx_mistakes_next_review (next_review),
    INDEX idx_mistakes_owner_reviewed (user_id, reviewed),
    INDEX idx_mistakes_owner_next_review (user_id, next_review)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

// ── Schema upgrades for mistakes owner isolation ────────────────────

async function ensureMistakesOwnerSchema(pool: Pool): Promise<void> {
  const [[columnRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
     WHERE table_schema = DATABASE() AND table_name = 'mistakes' AND column_name = 'user_id'`,
  );

  if (columnRow.cnt === 0) {
    await pool.query(
      'ALTER TABLE mistakes ADD COLUMN user_id VARCHAR(255) NULL AFTER id',
    );
  }

  const indexes = [
    { name: 'idx_mistakes_owner_reviewed', columns: 'user_id, reviewed' },
    { name: 'idx_mistakes_owner_next_review', columns: 'user_id, next_review' },
  ];

  for (const { name, columns } of indexes) {
    const [[indexRow]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.STATISTICS
       WHERE table_schema = DATABASE() AND table_name = 'mistakes' AND index_name = ?`,
      [name],
    );

    if (indexRow.cnt === 0) {
      await pool.query(`ALTER TABLE mistakes ADD INDEX ${name} (${columns})`);
    }
  }
}

// ── Data migration from storage_entries ─────────────────────────────

async function migrateFromStorageEntries(pool: Pool): Promise<void> {
  const tables = [
    { table: 'users', key: 'users' },
    { table: 'user_checkins', key: 'user_checkins' },
    { table: 'user_stats', key: 'user_stats' },
    { table: 'mistakes', key: 'mistakes' },
  ];

  for (const { table, key } of tables) {
    // Check if dedicated table is empty
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM ${table}`,
    );
    if (countRows[0].cnt > 0) continue;

    // Check if storage_entries has data for this table
    const [oldRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM storage_entries WHERE table_name = ?',
      [key],
    );
    if (oldRows.length === 0) continue;

    log.info(`Migrating ${oldRows.length} rows from storage_entries.${key} → ${table}`);

    for (const row of oldRows) {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      const createdAt =
        typeof row.created_at === 'string' ? row.created_at : toDatetime(row.created_at);
      const updatedAt =
        typeof row.updated_at === 'string' ? row.updated_at : toDatetime(row.updated_at);

      if (table === 'users') {
        await pool.query(
          `INSERT IGNORE INTO users (id, email, username, password_hash, role, status, guest_id, plan_type,
            avatar, nickname, bio, education_level, grade, learning_style, detail_level,
            preferred_language, ai_personality, ai_name, custom_instructions,
            auto_generate_quiz, show_step_by_step, enable_memory, enable_rag,
            email_verified, email_verify_token, reset_token, reset_token_expiry,
            created_at, updated_at, last_login_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            row.id,
            data.email ?? null,
            data.username,
            data.passwordHash ?? null,
            data.role ?? 'user',
            data.status ?? 'active',
            data.guestId ?? null,
            data.planType ?? 'free',
            data.avatar ?? null,
            data.nickname ?? null,
            data.bio ?? null,
            data.educationLevel ?? null,
            data.grade ?? null,
            data.learningStyle ?? null,
            data.detailLevel ?? null,
            data.preferredLanguage ?? null,
            data.aiPersonality ?? null,
            data.aiName ?? null,
            data.customInstructions ?? null,
            data.autoGenerateQuiz ?? false,
            data.showStepByStep ?? true,
            data.enableMemory ?? true,
            data.enableRAG ?? true,
            data.emailVerified ?? false,
            data.emailVerifyToken ?? null,
            data.resetToken ?? null,
            data.resetTokenExpiry ? toDatetime(data.resetTokenExpiry) : null,
            createdAt,
            updatedAt,
            data.lastLoginAt ? toDatetime(data.lastLoginAt) : null,
          ],
        );
      } else if (table === 'user_checkins') {
        await pool.query(
          'INSERT IGNORE INTO user_checkins (id, user_id, checkin_date, timestamp, created_at) VALUES (?,?,?,?,?)',
          [row.id, data.userId, data.date, data.timestamp, createdAt],
        );
      } else if (table === 'user_stats') {
        await pool.query(
          `INSERT IGNORE INTO user_stats (id, user_id, stat_date, study_seconds, checkin_streak,
            mastery_score, problems_attempted, problems_correct, scenes_completed, last_active_at, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            row.id,
            data.userId,
            data.date,
            data.studySeconds ?? 0,
            data.checkinStreak ?? 0,
            data.masteryScore ?? 0,
            data.problemsAttempted ?? 0,
            data.problemsCorrect ?? 0,
            data.scenesCompleted ?? 0,
            data.lastActiveAt ?? Date.now(),
            createdAt,
            updatedAt,
          ],
        );
      } else if (table === 'mistakes') {
        // Only migrate mistakes that have a known owner. Legacy entries without
        // a userId cannot be safely attributed, so they are skipped.
        if (!data.userId) continue;

        await pool.query(
          `INSERT IGNORE INTO mistakes (id, user_id, problem_text, problem_image, user_answer, correct_answer,
            error_type, error_explanation, knowledge_points, review_count, last_review, next_review,
            mastery_level, reviewed, source_session_id, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            row.id,
            data.userId,
            data.problemText ?? '',
            data.problemImage ?? null,
            data.userAnswer ?? '',
            data.correctAnswer ?? '',
            data.errorType ?? 'concept',
            data.errorExplanation ?? null,
            JSON.stringify(data.knowledgePoints ?? []),
            data.reviewCount ?? 0,
            data.lastReview ?? null,
            data.nextReview ?? null,
            data.masteryLevel ?? 0,
            data.reviewed ?? false,
            data.sourceSessionId ?? null,
            createdAt,
            updatedAt,
          ],
        );
      }
    }
  }
}

// ── Provider ────────────────────────────────────────────────────────

export class MySQLStorageProvider implements StorageProvider {
  async isAvailable(): Promise<boolean> {
    try {
      const pool = await getPool();
      const [rows] = await pool.query('SELECT 1');
      if (!Array.isArray(rows)) return false;

      // Create all tables
      for (const sql of CREATE_TABLES_SQL) {
        await pool.query(sql);
      }

      // Ensure mistakes table has owner-isolation columns/indexes for existing deployments
      await ensureMistakesOwnerSchema(pool);

      // Migrate old data from storage_entries
      await migrateFromStorageEntries(pool);

      return true;
    } catch (err) {
      log.error('MySQL connection failed:', err instanceof Error ? err.message : err);
      return false;
    }
  }

  // ── INSERT (atomic create) ──────────────────────────────────────────

  async insert<T>(table: string, entry: StorageEntry<T>): Promise<void> {
    const pool = await getPool();
    const data = entry.data as Record<string, unknown>;

    try {
      if (table === 'mistakes') {
        await pool.query(
          `INSERT INTO mistakes (id, user_id, problem_text, problem_image, user_answer, correct_answer,
            error_type, error_explanation, knowledge_points, review_count, last_review, next_review,
            mastery_level, reviewed, source_session_id, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            entry.id,
            data.userId,
            data.problemText ?? '',
            data.problemImage ?? null,
            data.userAnswer ?? '',
            data.correctAnswer ?? '',
            data.errorType ?? 'concept',
            data.errorExplanation ?? null,
            JSON.stringify(data.knowledgePoints ?? []),
            data.reviewCount ?? 0,
            data.lastReview ?? null,
            data.nextReview ?? null,
            data.masteryLevel ?? 0,
            data.reviewed ?? false,
            data.sourceSessionId ?? null,
            toDatetime(entry.createdAt),
            toDatetime(entry.updatedAt),
          ],
        );
      } else {
        await pool.query(
          `INSERT INTO storage_entries (id, table_name, data, created_at, updated_at)
           VALUES (?,?,?,?,?)`,
          [entry.id, table, JSON.stringify(data), toDatetime(entry.createdAt), toDatetime(entry.updatedAt)],
        );
      }
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === 'ER_DUP_ENTRY') {
        throw new StorageEntryAlreadyExistsError(table, entry.id, { cause: err });
      }
      throw err;
    }
  }

  // ── SET (upsert) ────────────────────────────────────────────────────

  async set<T>(table: string, entry: StorageEntry<T>): Promise<void> {
    const pool = await getPool();
    const data = entry.data as Record<string, unknown>;

    if (table === 'users') {
      await pool.query(
        `INSERT INTO users (id, email, username, password_hash, role, status, guest_id, plan_type,
          avatar, nickname, bio, education_level, grade, learning_style, detail_level,
          preferred_language, ai_personality, ai_name, custom_instructions,
          auto_generate_quiz, show_step_by_step, enable_memory, enable_rag,
          email_verified, email_verify_token, reset_token, reset_token_expiry,
          created_at, updated_at, last_login_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          email=VALUES(email), username=VALUES(username), password_hash=VALUES(password_hash),
          role=VALUES(role), status=VALUES(status), guest_id=VALUES(guest_id), plan_type=VALUES(plan_type),
          avatar=VALUES(avatar), nickname=VALUES(nickname), bio=VALUES(bio),
          education_level=VALUES(education_level), grade=VALUES(grade), learning_style=VALUES(learning_style),
          detail_level=VALUES(detail_level), preferred_language=VALUES(preferred_language),
          ai_personality=VALUES(ai_personality), ai_name=VALUES(ai_name), custom_instructions=VALUES(custom_instructions),
          auto_generate_quiz=VALUES(auto_generate_quiz), show_step_by_step=VALUES(show_step_by_step),
          enable_memory=VALUES(enable_memory), enable_rag=VALUES(enable_rag),
          email_verified=VALUES(email_verified), email_verify_token=VALUES(email_verify_token),
          reset_token=VALUES(reset_token), reset_token_expiry=VALUES(reset_token_expiry),
          updated_at=VALUES(updated_at), last_login_at=VALUES(last_login_at)`,
        [
          entry.id,
          data.email ?? null,
          data.username,
          data.passwordHash ?? null,
          data.role ?? 'user',
          data.status ?? 'active',
          data.guestId ?? null,
          data.planType ?? 'free',
          data.avatar ?? null,
          data.nickname ?? null,
          data.bio ?? null,
          data.educationLevel ?? null,
          data.grade ?? null,
          data.learningStyle ?? null,
          data.detailLevel ?? null,
          data.preferredLanguage ?? null,
          data.aiPersonality ?? null,
          data.aiName ?? null,
          data.customInstructions ?? null,
          data.autoGenerateQuiz ?? false,
          data.showStepByStep ?? true,
          data.enableMemory ?? true,
          data.enableRAG ?? true,
          data.emailVerified ?? false,
          data.emailVerifyToken ?? null,
          data.resetToken ?? null,
          toOptionalDatetime(data.resetTokenExpiry),
          toDatetime(entry.createdAt),
          toDatetime(entry.updatedAt),
          toOptionalDatetime(data.lastLoginAt),
        ],
      );
    } else if (table === 'user_checkins') {
      await pool.query(
        `INSERT INTO user_checkins (id, user_id, checkin_date, timestamp, created_at)
        VALUES (?,?,?,?,?)
        ON DUPLICATE KEY UPDATE timestamp=VALUES(timestamp)`,
        [entry.id, data.userId, data.date, data.timestamp, toDatetime(entry.createdAt)],
      );
    } else if (table === 'user_stats') {
      await pool.query(
        `INSERT INTO user_stats (id, user_id, stat_date, study_seconds, checkin_streak,
          mastery_score, problems_attempted, problems_correct, scenes_completed, last_active_at,
          created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          study_seconds=VALUES(study_seconds), checkin_streak=VALUES(checkin_streak),
          mastery_score=VALUES(mastery_score), problems_attempted=VALUES(problems_attempted),
          problems_correct=VALUES(problems_correct), scenes_completed=VALUES(scenes_completed),
          last_active_at=VALUES(last_active_at), updated_at=VALUES(updated_at)`,
        [
          entry.id,
          data.userId,
          data.date,
          data.studySeconds ?? 0,
          data.checkinStreak ?? 0,
          data.masteryScore ?? 0,
          data.problemsAttempted ?? 0,
          data.problemsCorrect ?? 0,
          data.scenesCompleted ?? 0,
          data.lastActiveAt ?? Date.now(),
          toDatetime(entry.createdAt),
          toDatetime(entry.updatedAt),
        ],
      );
    } else if (table === 'mistakes') {
      await pool.query(
        `INSERT INTO mistakes (id, user_id, problem_text, problem_image, user_answer, correct_answer,
          error_type, error_explanation, knowledge_points, review_count, last_review, next_review,
          mastery_level, reviewed, source_session_id, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          user_id=VALUES(user_id), problem_text=VALUES(problem_text), problem_image=VALUES(problem_image),
          user_answer=VALUES(user_answer), correct_answer=VALUES(correct_answer),
          error_type=VALUES(error_type), error_explanation=VALUES(error_explanation),
          knowledge_points=VALUES(knowledge_points), review_count=VALUES(review_count),
          last_review=VALUES(last_review), next_review=VALUES(next_review),
          mastery_level=VALUES(mastery_level), reviewed=VALUES(reviewed),
          source_session_id=VALUES(source_session_id), updated_at=VALUES(updated_at)`,
        [
          entry.id,
          data.userId,
          data.problemText ?? '',
          data.problemImage ?? null,
          data.userAnswer ?? '',
          data.correctAnswer ?? '',
          data.errorType ?? 'concept',
          data.errorExplanation ?? null,
          JSON.stringify(data.knowledgePoints ?? []),
          data.reviewCount ?? 0,
          data.lastReview ?? null,
          data.nextReview ?? null,
          data.masteryLevel ?? 0,
          data.reviewed ?? false,
          data.sourceSessionId ?? null,
          toDatetime(entry.createdAt),
          toDatetime(entry.updatedAt),
        ],
      );
    } else {
      // Fallback: generic storage_entries
      await pool.query(
        `INSERT INTO storage_entries (id, table_name, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)`,
        [
          entry.id,
          table,
          JSON.stringify(entry.data),
          toDatetime(entry.createdAt),
          toDatetime(entry.updatedAt),
        ],
      );
    }
  }

  // ── GET by id ───────────────────────────────────────────────────────

  async get<T>(table: string, id: string): Promise<StorageEntry<T> | null> {
    const pool = await getPool();

    if (table === 'users') {
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToUserEntry(rows[0]) as StorageEntry<T>;
    }

    if (table === 'user_checkins') {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM user_checkins WHERE id = ?',
        [id],
      );
      if (rows.length === 0) return null;
      return rowToCheckinEntry(rows[0]) as StorageEntry<T>;
    }

    if (table === 'user_stats') {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM user_stats WHERE id = ?',
        [id],
      );
      if (rows.length === 0) return null;
      return rowToStatsEntry(rows[0]) as StorageEntry<T>;
    }

    if (table === 'mistakes') {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mistakes WHERE id = ?',
        [id],
      );
      if (rows.length === 0) return null;
      return rowToMistakeEntry(rows[0]) as StorageEntry<T>;
    }

    // Fallback
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM storage_entries WHERE id = ? AND table_name = ?',
      [id, table],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id as string,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  // ── GET ALL ─────────────────────────────────────────────────────────

  async getAll<T>(
    table: string,
    filter?: (entry: StorageEntry<T>) => boolean,
  ): Promise<StorageEntry<T>[]> {
    const pool = await getPool();
    let entries: StorageEntry<T>[];

    if (table === 'users') {
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM users');
      entries = rows.map((r) => rowToUserEntry(r) as StorageEntry<T>);
    } else if (table === 'user_checkins') {
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM user_checkins');
      entries = rows.map((r) => rowToCheckinEntry(r) as StorageEntry<T>);
    } else if (table === 'user_stats') {
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM user_stats');
      entries = rows.map((r) => rowToStatsEntry(r) as StorageEntry<T>);
    } else if (table === 'mistakes') {
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM mistakes');
      entries = rows.map((r) => rowToMistakeEntry(r) as StorageEntry<T>);
    } else {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM storage_entries WHERE table_name = ?',
        [table],
      );
      entries = rows.map((row) => ({
        id: row.id as string,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      }));
    }

    return filter ? entries.filter(filter) : entries;
  }

  // ── DELETE ───────────────────────────────────────────────────────────

  async delete(table: string, id: string): Promise<boolean> {
    const pool = await getPool();
    const sqlMap: Record<string, string> = {
      users: 'DELETE FROM users WHERE id = ?',
      user_checkins: 'DELETE FROM user_checkins WHERE id = ?',
      user_stats: 'DELETE FROM user_stats WHERE id = ?',
      mistakes: 'DELETE FROM mistakes WHERE id = ?',
    };
    const sql = sqlMap[table] ?? 'DELETE FROM storage_entries WHERE id = ? AND table_name = ?';
    const params = sqlMap[table] ? [id] : [id, table];
    const [result] = await pool.query<ResultSetHeader>(sql, params);
    return result.affectedRows > 0;
  }

  // ── CLEAR ───────────────────────────────────────────────────────────

  async clear(table: string): Promise<void> {
    const pool = await getPool();
    if (isDedicatedTable(table)) {
      await pool.query(`DELETE FROM ${table}`);
    } else {
      await pool.query('DELETE FROM storage_entries WHERE table_name = ?', [table]);
    }
  }

  // ── COUNT ───────────────────────────────────────────────────────────

  async count(table: string): Promise<number> {
    const pool = await getPool();
    if (isDedicatedTable(table)) {
      const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM ${table}`);
      return rows[0].cnt as number;
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM storage_entries WHERE table_name = ?',
      [table],
    );
    return rows[0].cnt as number;
  }
}

// ── Row → StorageEntry mappers ──────────────────────────────────────

function parseDatetime(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return new Date(val as string).getTime();
}

function rowToUserEntry(row: RowDataPacket): StorageEntry {
  return {
    id: row.id as string,
    data: {
      id: row.id as string,
      email: row.email,
      username: row.username,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      guestId: row.guest_id,
      planType: row.plan_type,
      avatar: row.avatar,
      nickname: row.nickname,
      bio: row.bio,
      educationLevel: row.education_level,
      grade: row.grade,
      learningStyle: row.learning_style,
      detailLevel: row.detail_level,
      preferredLanguage: row.preferred_language,
      aiPersonality: row.ai_personality,
      aiName: row.ai_name,
      customInstructions: row.custom_instructions,
      autoGenerateQuiz: !!row.auto_generate_quiz,
      showStepByStep: !!row.show_step_by_step,
      enableMemory: !!row.enable_memory,
      enableRAG: !!row.enable_rag,
      emailVerified: !!row.email_verified,
      emailVerifyToken: row.email_verify_token,
      resetToken: row.reset_token,
      resetTokenExpiry: row.reset_token_expiry ? parseDatetime(row.reset_token_expiry) : null,
      lastLoginAt: row.last_login_at ? parseDatetime(row.last_login_at) : null,
      createdAt: parseDatetime(row.created_at),
      updatedAt: parseDatetime(row.updated_at),
    },
    createdAt: parseDatetime(row.created_at),
    updatedAt: parseDatetime(row.updated_at),
  };
}

function rowToCheckinEntry(row: RowDataPacket): StorageEntry {
  return {
    id: row.id as string,
    data: {
      userId: row.user_id,
      date:
        row.checkin_date instanceof Date
          ? row.checkin_date.toISOString().slice(0, 10)
          : String(row.checkin_date).slice(0, 10),
      timestamp: Number(row.timestamp),
    },
    createdAt: parseDatetime(row.created_at),
    updatedAt: parseDatetime(row.created_at),
  };
}

function rowToStatsEntry(row: RowDataPacket): StorageEntry {
  return {
    id: row.id as string,
    data: {
      userId: row.user_id,
      date:
        row.stat_date instanceof Date
          ? row.stat_date.toISOString().slice(0, 10)
          : String(row.stat_date).slice(0, 10),
      studySeconds: row.study_seconds,
      checkinStreak: row.checkin_streak,
      masteryScore: row.mastery_score,
      problemsAttempted: row.problems_attempted,
      problemsCorrect: row.problems_correct,
      scenesCompleted: row.scenes_completed,
      lastActiveAt: Number(row.last_active_at),
    },
    createdAt: parseDatetime(row.created_at),
    updatedAt: parseDatetime(row.updated_at),
  };
}

function rowToMistakeEntry(row: RowDataPacket): StorageEntry {
  const knowledgePoints =
    typeof row.knowledge_points === 'string'
      ? JSON.parse(row.knowledge_points)
      : (row.knowledge_points ?? []);

  return {
    id: row.id as string,
    data: {
      id: row.id as string,
      userId: row.user_id,
      problemText: row.problem_text,
      problemImage: row.problem_image,
      userAnswer: row.user_answer,
      correctAnswer: row.correct_answer,
      errorType: row.error_type,
      errorExplanation: row.error_explanation,
      knowledgePoints,
      reviewCount: row.review_count,
      lastReview: row.last_review ? Number(row.last_review) : undefined,
      nextReview: row.next_review ? Number(row.next_review) : undefined,
      masteryLevel: row.mastery_level,
      reviewed: !!row.reviewed,
      sourceSessionId: row.source_session_id,
      source: row.source,
      solutionSteps:
        typeof row.solution_steps === 'string'
          ? JSON.parse(row.solution_steps)
          : (row.solution_steps ?? []),
      hints:
        typeof row.hints === 'string' ? JSON.parse(row.hints) : (row.hints ?? []),
    },
    createdAt: parseDatetime(row.created_at),
    updatedAt: parseDatetime(row.updated_at),
  };
}
