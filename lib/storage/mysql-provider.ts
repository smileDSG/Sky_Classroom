/**
 * MySQL Storage Provider
 *
 * Server-side storage using MySQL.
 * Used by API routes for persistent user data.
 */

import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import type { StorageProvider, StorageEntry } from './storage-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('Storage:MySQL');

let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;

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

export class MySQLStorageProvider implements StorageProvider {
  async isAvailable(): Promise<boolean> {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT 1');
      return Array.isArray(rows);
    } catch {
      return false;
    }
  }

  async set<T>(table: string, entry: StorageEntry<T>): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO storage_entries (id, table_name, data, created_at, updated_at)
       VALUES (?, ?, ?, FROM_UNIXTIME(? / 1000), FROM_UNIXTIME(? / 1000))
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)`,
      [entry.id, table, JSON.stringify(entry.data), entry.createdAt, entry.updatedAt],
    );
  }

  async get<T>(table: string, id: string): Promise<StorageEntry<T> | null> {
    const pool = getPool();
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

  async getAll<T>(table: string, filter?: (entry: StorageEntry<T>) => boolean): Promise<StorageEntry<T>[]> {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM storage_entries WHERE table_name = ?',
      [table],
    );
    const entries: StorageEntry<T>[] = rows.map((row) => ({
      id: row.id as string,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }));
    return filter ? entries.filter(filter) : entries;
  }

  async delete(table: string, id: string): Promise<boolean> {
    const pool = getPool();
    const [result] = await pool.query(
      'DELETE FROM storage_entries WHERE id = ? AND table_name = ?',
      [id, table],
    );
    return (result as mysql.ResultSetHeader).affectedRows > 0;
  }

  async clear(table: string): Promise<void> {
    const pool = getPool();
    await pool.query('DELETE FROM storage_entries WHERE table_name = ?', [table]);
  }

  async count(table: string): Promise<number> {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM storage_entries WHERE table_name = ?',
      [table],
    );
    return rows[0].cnt as number;
  }
}
