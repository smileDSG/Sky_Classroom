import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorageEntry } from '@/lib/storage/storage-types';

const mysqlBoundary = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  query: vi.fn(),
}));

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn(() => ({ query: mysqlBoundary.query })),
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

function makeEntry(id: string, data: unknown): StorageEntry {
  return { id, data, createdAt: 1000, updatedAt: 1000 };
}

describe('MySQLStorageProvider insert', () => {
  beforeEach(() => {
    mysqlBoundary.rows.clear();
    mysqlBoundary.query.mockReset();
    mysqlBoundary.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();

      if (normalized.startsWith('INSERT INTO storage_entries')) {
        const [id, table, data, createdAt, updatedAt] = params;
        const key = `${String(table)}:${String(id)}`;
        if (mysqlBoundary.rows.has(key)) {
          throw Object.assign(new Error('Duplicate entry'), {
            code: 'ER_DUP_ENTRY',
            errno: 1062,
          });
        }
        mysqlBoundary.rows.set(key, {
          id,
          table_name: table,
          data,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return [{ affectedRows: 1 }, []];
      }

      if (normalized.startsWith('INSERT INTO mistakes')) {
        const columnMatch = normalized.match(/INSERT INTO mistakes \(([^)]+)\) VALUES/);
        if (!columnMatch) throw new Error(`Unable to parse mistake insert: ${normalized}`);
        const columns = columnMatch[1].split(',').map((column) => column.trim());
        const row = Object.fromEntries(columns.map((column, index) => [column, params[index]]));
        mysqlBoundary.rows.set(`mistakes:${String(row.id)}`, row);
        return [{ affectedRows: 1 }, []];
      }

      if (normalized === 'SELECT * FROM storage_entries WHERE id = ? AND table_name = ?') {
        const [id, table] = params;
        const row = mysqlBoundary.rows.get(`${String(table)}:${String(id)}`);
        return [[...(row ? [row] : [])], []];
      }

      if (normalized === 'SELECT * FROM mistakes WHERE id = ?') {
        const row = mysqlBoundary.rows.get(`mistakes:${String(params[0])}`);
        return [[...(row ? [row] : [])], []];
      }

      throw new Error(`Unexpected SQL in test boundary: ${normalized}`);
    });
    vi.resetModules();
  });

  it('rejects a duplicate generic entry without changing the original data', async () => {
    const [{ MySQLStorageProvider }, { StorageEntryAlreadyExistsError }] = await Promise.all([
      import('@/lib/storage/mysql-provider'),
      import('@/lib/storage/storage-errors'),
    ]);
    const provider = new MySQLStorageProvider();
    const original = makeEntry('1', { name: 'Alice' });
    const duplicate = makeEntry('1', { name: 'Bob' });

    await provider.insert('learner-profile-snapshots', original);

    await expect(provider.insert('learner-profile-snapshots', duplicate)).rejects.toBeInstanceOf(
      StorageEntryAlreadyExistsError,
    );
    expect((await provider.get('learner-profile-snapshots', '1'))?.data).toEqual(original.data);
  });

  it('preserves mistake identity and owner through insert and get', async () => {
    const { MySQLStorageProvider } = await import('@/lib/storage/mysql-provider');
    const provider = new MySQLStorageProvider();

    await provider.insert(
      'mistakes',
      makeEntry('mistake-1', {
        id: 'mistake-1',
        userId: 'user-a',
        problemText: '1 + 1',
        userAnswer: '3',
        correctAnswer: '2',
        errorType: 'calculation',
        knowledgePoints: ['addition'],
      }),
    );

    const stored = await provider.get<{ id: string; userId: string }>('mistakes', 'mistake-1');

    expect(stored?.data).toMatchObject({ id: 'mistake-1', userId: 'user-a' });
  });

  it('preserves mistake owner when set creates the row', async () => {
    const { MySQLStorageProvider } = await import('@/lib/storage/mysql-provider');
    const provider = new MySQLStorageProvider();

    await provider.set(
      'mistakes',
      makeEntry('mistake-set-1', {
        id: 'mistake-set-1',
        userId: 'user-a',
        problemText: '2 + 2',
        userAnswer: '5',
        correctAnswer: '4',
        errorType: 'calculation',
      }),
    );

    const stored = await provider.get<{ userId: string }>('mistakes', 'mistake-set-1');

    expect(stored?.data.userId).toBe('user-a');
  });

  it('creates an owner-scoped mistakes schema', async () => {
    mysqlBoundary.query.mockImplementation(async (sql: string) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      if (normalized === 'SELECT 1') return [[{ ok: 1 }], []];
      if (normalized.startsWith('CREATE TABLE IF NOT EXISTS')) return [[], []];
      if (normalized.startsWith('SELECT COUNT(*) as cnt FROM')) return [[{ cnt: 1 }], []];
      throw new Error(`Unexpected SQL in test boundary: ${normalized}`);
    });
    const { MySQLStorageProvider } = await import('@/lib/storage/mysql-provider');
    const provider = new MySQLStorageProvider();

    await expect(provider.isAvailable()).resolves.toBe(true);

    const mistakeSchema = mysqlBoundary.query.mock.calls
      .map(([sql]) => String(sql).replace(/\s+/g, ' ').trim())
      .find((sql) => sql.startsWith('CREATE TABLE IF NOT EXISTS mistakes'));
    expect(mistakeSchema).toContain('user_id VARCHAR(255) NOT NULL');
    expect(mistakeSchema).toContain('INDEX idx_mistakes_owner_reviewed (user_id, reviewed)');
    expect(mistakeSchema).toContain('INDEX idx_mistakes_owner_next_review (user_id, next_review)');
  });

  it('idempotently upgrades an existing mistakes table without assigning an owner', async () => {
    const schemaState = {
      hasUserId: false,
      indexes: new Set<string>(),
    };
    mysqlBoundary.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      if (normalized === 'SELECT 1') return [[{ ok: 1 }], []];
      if (normalized.startsWith('CREATE TABLE IF NOT EXISTS')) return [[], []];
      if (normalized.includes('FROM information_schema.COLUMNS')) {
        return [[{ cnt: schemaState.hasUserId ? 1 : 0 }], []];
      }
      if (normalized.includes('FROM information_schema.STATISTICS')) {
        return [[{ cnt: schemaState.indexes.has(String(params[1])) ? 1 : 0 }], []];
      }
      if (normalized === 'ALTER TABLE mistakes ADD COLUMN user_id VARCHAR(255) NULL AFTER id') {
        schemaState.hasUserId = true;
        return [[], []];
      }
      if (normalized.startsWith('ALTER TABLE mistakes ADD INDEX')) {
        const indexName = normalized.split(' ')[5];
        schemaState.indexes.add(indexName);
        return [[], []];
      }
      if (normalized.startsWith('SELECT COUNT(*) as cnt FROM')) return [[{ cnt: 1 }], []];
      throw new Error(`Unexpected SQL in test boundary: ${normalized}`);
    });
    const { MySQLStorageProvider } = await import('@/lib/storage/mysql-provider');
    const provider = new MySQLStorageProvider();

    await expect(provider.isAvailable()).resolves.toBe(true);
    await expect(provider.isAvailable()).resolves.toBe(true);

    const normalizedCalls = mysqlBoundary.query.mock.calls.map(([sql]) =>
      String(sql).replace(/\s+/g, ' ').trim(),
    );
    expect(
      normalizedCalls.filter(
        (sql) => sql === 'ALTER TABLE mistakes ADD COLUMN user_id VARCHAR(255) NULL AFTER id',
      ),
    ).toHaveLength(1);
    expect(
      normalizedCalls.filter((sql) =>
        sql.startsWith('ALTER TABLE mistakes ADD INDEX idx_mistakes_owner_reviewed'),
      ),
    ).toHaveLength(1);
    expect(
      normalizedCalls.filter((sql) =>
        sql.startsWith('ALTER TABLE mistakes ADD INDEX idx_mistakes_owner_next_review'),
      ),
    ).toHaveLength(1);
  });

  it('migrates only legacy mistakes with an explicit owner', async () => {
    mysqlBoundary.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      if (normalized === 'SELECT 1') return [[{ ok: 1 }], []];
      if (normalized.startsWith('CREATE TABLE IF NOT EXISTS')) return [[], []];
      if (normalized.includes('FROM information_schema.')) return [[{ cnt: 1 }], []];
      if (normalized.startsWith('SELECT COUNT(*) as cnt FROM')) {
        return [[{ cnt: normalized.endsWith('FROM mistakes') ? 0 : 1 }], []];
      }
      if (normalized === 'SELECT * FROM storage_entries WHERE table_name = ?') {
        expect(params).toEqual(['mistakes']);
        return [[
          {
            id: 'owned',
            data: JSON.stringify({
              userId: 'user-a',
              problemText: 'owned problem',
              userAnswer: 'x',
              correctAnswer: 'y',
            }),
            created_at: 1000,
            updated_at: 1000,
          },
          {
            id: 'orphan',
            data: JSON.stringify({
              problemText: 'orphan problem',
              userAnswer: 'x',
              correctAnswer: 'y',
            }),
            created_at: 1000,
            updated_at: 1000,
          },
        ], []];
      }
      if (normalized.startsWith('INSERT IGNORE INTO mistakes')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL in test boundary: ${normalized}`);
    });
    const { MySQLStorageProvider } = await import('@/lib/storage/mysql-provider');
    const provider = new MySQLStorageProvider();

    await expect(provider.isAvailable()).resolves.toBe(true);

    const mistakeInserts = mysqlBoundary.query.mock.calls.filter(([sql]) =>
      String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT IGNORE INTO mistakes'),
    );
    expect(mistakeInserts).toHaveLength(1);
    expect(String(mistakeInserts[0][0]).replace(/\s+/g, ' ')).toContain('(id, user_id,');
    expect(mistakeInserts[0][1]?.slice(0, 2)).toEqual(['owned', 'user-a']);
  });

  it('reports storage unavailable when a legacy owner migration fails', async () => {
    mysqlBoundary.query.mockImplementation(async (sql: string) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      if (normalized === 'SELECT 1') return [[{ ok: 1 }], []];
      if (normalized.startsWith('CREATE TABLE IF NOT EXISTS')) return [[], []];
      if (normalized.includes('FROM information_schema.')) return [[{ cnt: 1 }], []];
      if (normalized.startsWith('SELECT COUNT(*) as cnt FROM')) {
        return [[{ cnt: normalized.endsWith('FROM mistakes') ? 0 : 1 }], []];
      }
      if (normalized === 'SELECT * FROM storage_entries WHERE table_name = ?') {
        return [[{
          id: 'owned',
          data: JSON.stringify({
            userId: 'user-a',
            problemText: 'problem',
            userAnswer: 'x',
            correctAnswer: 'y',
          }),
          created_at: 1000,
          updated_at: 1000,
        }], []];
      }
      if (normalized.startsWith('INSERT IGNORE INTO mistakes')) {
        throw new Error('migration write failed');
      }
      throw new Error(`Unexpected SQL in test boundary: ${normalized}`);
    });
    const { MySQLStorageProvider } = await import('@/lib/storage/mysql-provider');
    const provider = new MySQLStorageProvider();

    await expect(provider.isAvailable()).resolves.toBe(false);
  });
});
