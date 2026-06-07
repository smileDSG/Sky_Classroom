/**
 * Knowledge Base — MySQL data access layer
 */

import { createLogger } from '@/lib/logger';
import type { KBChunk, KBType } from './types';

const log = createLogger('KB:DAO');

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
    connectionLimit: 10,
    queueLimit: 0,
  });
  return _pool;
}

interface KBRow extends import('mysql2/promise').RowDataPacket {
  id: string;
  kb_type: string;
  doc_id: string;
  doc_title: string;
  chunk_index: number;
  total_chunks: number;
  content: string;
  tags: string | null;
  source_id: string | null;
  verified: number;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

function rowToChunk(row: KBRow): KBChunk {
  return {
    id: row.id,
    kbType: row.kb_type as KBType,
    docId: row.doc_id,
    docTitle: row.doc_title,
    chunkIndex: row.chunk_index,
    totalChunks: row.total_chunks,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    sourceId: row.source_id,
    verified: !!row.verified,
    usageCount: row.usage_count,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/** Ensure the table exists (auto-migrate) */
export async function ensureTable(): Promise<void> {
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id VARCHAR(64) NOT NULL,
      kb_type VARCHAR(32) NOT NULL,
      doc_id VARCHAR(64) NOT NULL,
      doc_title TEXT NOT NULL,
      chunk_index INT NOT NULL DEFAULT 0,
      total_chunks INT NOT NULL DEFAULT 1,
      content TEXT NOT NULL,
      tags JSON DEFAULT NULL,
      source_id VARCHAR(128) DEFAULT NULL,
      verified TINYINT(1) NOT NULL DEFAULT 0,
      usage_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_kb_type (kb_type),
      INDEX idx_source (source_id),
      INDEX idx_verified (verified),
      INDEX idx_doc_id (doc_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/** Insert or update a chunk */
export async function upsertChunk(chunk: KBChunk): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO knowledge_base (id, kb_type, doc_id, doc_title, chunk_index, total_chunks, content, tags, source_id, verified, usage_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       content = VALUES(content), tags = VALUES(tags), verified = VALUES(verified),
       usage_count = VALUES(usage_count), updated_at = CURRENT_TIMESTAMP`,
    [
      chunk.id, chunk.kbType, chunk.docId, chunk.docTitle,
      chunk.chunkIndex, chunk.totalChunks, chunk.content,
      JSON.stringify(chunk.tags), chunk.sourceId,
      chunk.verified ? 1 : 0, chunk.usageCount,
    ],
  );
}

/** Bulk insert chunks */
export async function upsertChunks(chunks: KBChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const chunk of chunks) {
      await conn.query(
        `INSERT INTO knowledge_base (id, kb_type, doc_id, doc_title, chunk_index, total_chunks, content, tags, source_id, verified, usage_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           content = VALUES(content), tags = VALUES(tags), verified = VALUES(verified),
           usage_count = VALUES(usage_count), updated_at = CURRENT_TIMESTAMP`,
        [
          chunk.id, chunk.kbType, chunk.docId, chunk.docTitle,
          chunk.chunkIndex, chunk.totalChunks, chunk.content,
          JSON.stringify(chunk.tags), chunk.sourceId,
          chunk.verified ? 1 : 0, chunk.usageCount,
        ],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Get all chunks for a kb_type */
export async function getChunksByType(kbType: KBType): Promise<KBChunk[]> {
  const pool = await getPool();
  const [rows] = await pool.query<KBRow[]>(
    'SELECT * FROM knowledge_base WHERE kb_type = ?',
    [kbType],
  );
  return rows.map(rowToChunk);
}

/** Get chunks by source_id */
export async function getChunksBySource(kbType: KBType, sourceId: string): Promise<KBChunk[]> {
  const pool = await getPool();
  const [rows] = await pool.query<KBRow[]>(
    'SELECT * FROM knowledge_base WHERE kb_type = ? AND source_id = ?',
    [kbType, sourceId],
  );
  return rows.map(rowToChunk);
}

/** Delete all chunks for a document */
export async function deleteDocument(docId: string): Promise<void> {
  const pool = await getPool();
  await pool.query('DELETE FROM knowledge_base WHERE doc_id = ?', [docId]);
}

/** Delete all chunks for a kb_type */
export async function deleteByType(kbType: KBType): Promise<void> {
  const pool = await getPool();
  await pool.query('DELETE FROM knowledge_base WHERE kb_type = ?', [kbType]);
}

/** Increment usage count for a chunk */
export async function incrementUsage(chunkId: string): Promise<void> {
  const pool = await getPool();
  await pool.query(
    'UPDATE knowledge_base SET usage_count = usage_count + 1 WHERE id = ?',
    [chunkId],
  );
}

/** Mark chunks as verified by source_id */
export async function verifyBySource(sourceId: string): Promise<void> {
  const pool = await getPool();
  await pool.query(
    'UPDATE knowledge_base SET verified = 1 WHERE source_id = ?',
    [sourceId],
  );
}

/** Get stats */
export async function getStats(): Promise<{
  totalChunks: number;
  totalDocuments: number;
  byType: Record<string, { chunks: number; documents: number }>;
}> {
  const pool = await getPool();

  const [totalRows] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
    'SELECT COUNT(*) as chunks, COUNT(DISTINCT doc_id) as docs FROM knowledge_base',
  );

  const [typeRows] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
    'SELECT kb_type, COUNT(*) as chunks, COUNT(DISTINCT doc_id) as docs FROM knowledge_base GROUP BY kb_type',
  );

  const byType: Record<string, { chunks: number; documents: number }> = {};
  for (const row of typeRows) {
    byType[row.kb_type] = { chunks: row.chunks, documents: row.docs };
  }

  return {
    totalChunks: totalRows[0]?.chunks || 0,
    totalDocuments: totalRows[0]?.docs || 0,
    byType,
  };
}

/** Check if source already exists */
export async function sourceExists(sourceId: string): Promise<boolean> {
  const pool = await getPool();
  const [rows] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
    'SELECT 1 FROM knowledge_base WHERE source_id = ? LIMIT 1',
    [sourceId],
  );
  return rows.length > 0;
}
