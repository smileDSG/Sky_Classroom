/**
 * API Key Pool — DAO Layer
 *
 * Direct MySQL access for the dedicated `api_keys` table.
 * Uses the same connection config as mysql-provider.
 */

import { encrypt, decrypt, maskKey } from '@/lib/api-key-pool/crypto';
import type { ApiKeyEntry, ApiKeyRow } from '@/lib/api-key-pool/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('DAO:ApiKeyPool');

let _pool: import('mysql2/promise').Pool | null = null;

async function getPool(): Promise<import('mysql2/promise').Pool> {
  if (_pool) return _pool;
  const mysql = await import('mysql2/promise');
  _pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sky_classroom',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
  return _pool;
}

function rowToEntry(row: ApiKeyRow, decrypted = false): ApiKeyEntry {
  return {
    id: row.id,
    provider: row.provider,
    apiKey: decrypted ? decrypt(row.api_key) : maskKey(decrypt(row.api_key)),
    baseUrl: row.base_url ?? undefined,
    label: row.label ?? undefined,
    isActive: !!row.is_active,
    priority: row.priority,
    requestCount: Number(row.request_count),
    errorCount: Number(row.error_count),
    lastUsedAt: row.last_used_at ?? undefined,
    lastErrorAt: row.last_error_at ?? undefined,
    rateLimitedUntil: row.rate_limited_until ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDatetime(ts: number): string {
  return new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
}

// ── Public API ─────────────────────────────────────────────────────

/** List keys (decrypted=false masks the key for display) */
export async function listKeys(provider?: string, decrypted = false): Promise<ApiKeyEntry[]> {
  const pool = await getPool();
  const sql = provider
    ? 'SELECT * FROM api_keys WHERE provider = ? ORDER BY priority DESC, created_at ASC'
    : 'SELECT * FROM api_keys ORDER BY provider, priority DESC, created_at ASC';
  const params = provider ? [provider] : [];
  const [rows] = await pool.query<import('mysql2/promise').RowDataPacket[]>(sql, params);
  return (rows as ApiKeyRow[]).map((r) => rowToEntry(r, decrypted));
}

/** Get all active (non-rate-limited) keys for a provider, decrypted */
export async function getActiveKeys(provider: string): Promise<ApiKeyEntry[]> {
  const pool = await getPool();
  const now = toDatetime(Date.now());
  const [rows] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
    `SELECT * FROM api_keys
     WHERE provider = ? AND is_active = TRUE
       AND (rate_limited_until IS NULL OR rate_limited_until <= ?)
     ORDER BY priority DESC, created_at ASC`,
    [provider, now],
  );
  return (rows as ApiKeyRow[]).map((r) => rowToEntry(r, true));
}

/** Get a single key by id (decrypted) */
export async function getKeyById(id: string): Promise<ApiKeyEntry | null> {
  const pool = await getPool();
  const [rows] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
    'SELECT * FROM api_keys WHERE id = ?',
    [id],
  );
  if (rows.length === 0) return null;
  return rowToEntry(rows[0] as ApiKeyRow, true);
}

/** Create a new key (encrypts before storing) */
export async function createKey(entry: {
  id: string;
  provider: string;
  apiKey: string;
  baseUrl?: string;
  label?: string;
  priority?: number;
}): Promise<ApiKeyEntry> {
  const pool = await getPool();
  const encrypted = encrypt(entry.apiKey);
  const now = toDatetime(Date.now());

  await pool.query(
    `INSERT INTO api_keys (id, provider, api_key, base_url, label, is_active, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, TRUE, ?, ?, ?)`,
    [entry.id, entry.provider, encrypted, entry.baseUrl ?? null, entry.label ?? null, entry.priority ?? 0, now, now],
  );

  return {
    id: entry.id,
    provider: entry.provider,
    apiKey: entry.apiKey,
    baseUrl: entry.baseUrl,
    label: entry.label,
    isActive: true,
    priority: entry.priority ?? 0,
    requestCount: 0,
    errorCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Update a key (partial patch) */
export async function updateKey(id: string, patch: {
  apiKey?: string;
  baseUrl?: string;
  label?: string;
  isActive?: boolean;
  priority?: number;
}): Promise<ApiKeyEntry | null> {
  const pool = await getPool();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.apiKey !== undefined) {
    sets.push('api_key = ?');
    params.push(encrypt(patch.apiKey));
  }
  if (patch.baseUrl !== undefined) {
    sets.push('base_url = ?');
    params.push(patch.baseUrl);
  }
  if (patch.label !== undefined) {
    sets.push('label = ?');
    params.push(patch.label);
  }
  if (patch.isActive !== undefined) {
    sets.push('is_active = ?');
    params.push(patch.isActive);
  }
  if (patch.priority !== undefined) {
    sets.push('priority = ?');
    params.push(patch.priority);
  }

  if (sets.length === 0) return getKeyById(id);

  sets.push('updated_at = ?');
  params.push(toDatetime(Date.now()));
  params.push(id);

  await pool.query(
    `UPDATE api_keys SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );

  return getKeyById(id);
}

/** Delete a key */
export async function removeKey(id: string): Promise<boolean> {
  const pool = await getPool();
  const [result] = await pool.query('DELETE FROM api_keys WHERE id = ?', [id]);
  return (result as { affectedRows: number }).affectedRows > 0;
}

/** Increment request count and update last_used_at */
export async function incrementUsage(id: string): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `UPDATE api_keys
     SET request_count = request_count + 1, last_used_at = ?, updated_at = ?
     WHERE id = ?`,
    [toDatetime(Date.now()), toDatetime(Date.now()), id],
  );
}

/** Increment error count and update last_error_at */
export async function incrementError(id: string): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `UPDATE api_keys
     SET error_count = error_count + 1, last_error_at = ?, updated_at = ?
     WHERE id = ?`,
    [toDatetime(Date.now()), toDatetime(Date.now()), id],
  );
}

/** Mark a key as rate-limited until a specific time */
export async function markRateLimited(id: string, until: Date): Promise<void> {
  const pool = await getPool();
  await pool.query(
    'UPDATE api_keys SET rate_limited_until = ?, updated_at = ? WHERE id = ?',
    [toDatetime(until.getTime()), toDatetime(Date.now()), id],
  );
}
