/**
 * P1-002 — Question Bank DAO unit tests.
 *
 * Mocks mysql2/promise pool to verify DAO logic without a real database.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock mysql2/promise ─────────────────────────────────────────────

const mockQuery = vi.fn();
const mockPool = { query: mockQuery };

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn(() => mockPool),
  },
  // Named exports used by the DAO
}));

// ── Mock logger ─────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ── Import after mocks ──────────────────────────────────────────────

// We need to reset modules so the DAO picks up our mocked pool
beforeEach(async () => {
  vi.clearAllMocks();
  // Reset the internal table-ensured flag by re-importing
  vi.resetModules();
});

// ── Helper: build a mock row ────────────────────────────────────────

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qb_test_001',
    subject: '数学',
    grade: '高一',
    difficulty: 'medium',
    question_type: 'choice',
    content: '1 + 1 = ?',
    answer: '2',
    explanation: '基础加法',
    knowledge_points: JSON.stringify(['加法']),
    image: null,
    options: JSON.stringify(['1', '2', '3', '4']),
    source: '2024期中',
    tags: JSON.stringify(['基础']),
    problem_hash: 'qb_abc123',
    verified: 0,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('QuestionBank DAO', () => {
  test('insertOne: generates id and hash, calls INSERT', async () => {
    // Ensure table returns OK
    mockQuery.mockResolvedValueOnce([{}, []]); // CREATE TABLE
    // INSERT returns OK
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const { insertOne } = await import('@/lib/question-bank/dao');

    const row = await insertOne({
      subject: '数学',
      grade: '高一',
      difficulty: 'medium',
      questionType: 'choice',
      content: '1 + 1 = ?',
      answer: '2',
      options: ['1', '2', '3', '4'],
    });

    expect(row.id).toMatch(/^qb_/);
    expect(row.problemHash).toMatch(/^qb_/);
    expect(row.subject).toBe('数学');
    expect(row.content).toBe('1 + 1 = ?');
    expect(row.verified).toBe(true);
    expect(mockQuery).toHaveBeenCalledTimes(2); // ensureTable + INSERT
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO question_bank');
    expect(insertCall[1][14]).toBe(true);
  });

  test('insertBatch: handles bulk insert with INSERT IGNORE', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([{ affectedRows: 3 }, []]); // batch insert

    const { insertBatch } = await import('@/lib/question-bank/dao');

    const result = await insertBatch([
      { subject: '数学', grade: '高一', difficulty: 'easy', questionType: 'fill', content: '2+2=?', answer: '4' },
      { subject: '数学', grade: '高一', difficulty: 'medium', questionType: 'choice', content: '3*3=?', answer: '9' },
      { subject: '英语', grade: '高二', difficulty: 'hard', questionType: 'solve', content: 'Translate: hello', answer: '你好' },
    ]);

    expect(result.total).toBe(3);
    expect(result.inserted).toBe(3);
    expect(result.duplicates).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  test('insertBatch: skips entries with missing content/answer', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // batch insert

    const { insertBatch } = await import('@/lib/question-bank/dao');

    const result = await insertBatch([
      { subject: '数学', grade: '高一', difficulty: 'easy', questionType: 'fill', content: '1+1=?', answer: '2' },
      { subject: '数学', grade: '高一', difficulty: 'easy', questionType: 'fill', content: '', answer: '' }, // invalid
    ]);

    expect(result.total).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('Missing content or answer');
  });

  test('findById: returns mapped row', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([[makeRow()], []]); // SELECT

    const { findById } = await import('@/lib/question-bank/dao');

    const row = await findById('qb_test_001');
    expect(row).not.toBeNull();
    expect(row!.id).toBe('qb_test_001');
    expect(row!.subject).toBe('数学');
    expect(row!.difficulty).toBe('medium');
    expect(row!.knowledgePoints).toEqual(['加法']);
    expect(row!.options).toEqual(['1', '2', '3', '4']);
    expect(row!.verified).toBe(false);
  });

  test('findById: returns null when not found', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([[], []]); // empty result

    const { findById } = await import('@/lib/question-bank/dao');

    const row = await findById('nonexistent');
    expect(row).toBeNull();
  });

  test('findByHash: uses problem_hash index', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([[makeRow()], []]);

    const { findByHash } = await import('@/lib/question-bank/dao');

    const row = await findByHash('qb_abc123');
    expect(row).not.toBeNull();
    expect(row!.problemHash).toBe('qb_abc123');

    // Verify query uses problem_hash
    const selectCall = mockQuery.mock.calls[1];
    expect(selectCall[0]).toContain('problem_hash');
  });

  test('search: applies filters correctly', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([[makeRow()], []]);

    const { search } = await import('@/lib/question-bank/dao');

    const results = await search({ subject: '数学', difficulty: 'medium', limit: 10 });
    expect(results).toHaveLength(1);
    expect(results[0].subject).toBe('数学');

    // Verify WHERE clause
    const searchCall = mockQuery.mock.calls[1];
    const sql = searchCall[0] as string;
    expect(sql).toContain('subject = ?');
    expect(sql).toContain('difficulty = ?');
    expect(sql).toContain('LIMIT ?');
  });

  test('search: keyword triggers LIKE query', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([[makeRow()], []]);

    const { search } = await import('@/lib/question-bank/dao');

    await search({ keyword: '加法' });

    const searchCall = mockQuery.mock.calls[1];
    const sql = searchCall[0] as string;
    expect(sql).toContain('content LIKE ?');
    expect(sql).toContain('explanation LIKE ?');
  });

  test('update: only updates provided fields', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const { update } = await import('@/lib/question-bank/dao');

    const ok = await update('qb_test_001', { verified: true, difficulty: 'hard' });
    expect(ok).toBe(true);

    const updateCall = mockQuery.mock.calls[1];
    const sql = updateCall[0] as string;
    expect(sql).toContain('verified = ?');
    expect(sql).toContain('difficulty = ?');
    expect(sql).not.toContain('subject = ?');
  });

  test('update: re-hashes when content changes', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const { update } = await import('@/lib/question-bank/dao');

    await update('qb_test_001', { content: '新题目内容' });

    const updateCall = mockQuery.mock.calls[1];
    const sql = updateCall[0] as string;
    expect(sql).toContain('content = ?');
    expect(sql).toContain('problem_hash = ?');
  });

  test('deleteById: sends DELETE with id', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const { deleteById } = await import('@/lib/question-bank/dao');

    const ok = await deleteById('qb_test_001');
    expect(ok).toBe(true);

    const deleteCall = mockQuery.mock.calls[1];
    expect(deleteCall[0]).toContain('DELETE FROM question_bank WHERE id = ?');
  });

  test('count: returns count with optional filters', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([[{ cnt: 42 }], []]);

    const { count } = await import('@/lib/question-bank/dao');

    const n = await count({ subject: '数学' });
    expect(n).toBe(42);
  });

  test('count: returns total when no filters', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([[{ cnt: 100 }], []]);

    const { count } = await import('@/lib/question-bank/dao');

    const n = await count();
    expect(n).toBe(100);
  });

  test('list: returns rows ordered by created_at DESC', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    mockQuery.mockResolvedValueOnce([[makeRow({ id: 'qb_1' }), makeRow({ id: 'qb_2' })], []]);

    const { list } = await import('@/lib/question-bank/dao');

    const rows = await list(10, 0);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('qb_1');
    expect(rows[1].id).toBe('qb_2');

    const listCall = mockQuery.mock.calls[1];
    expect(listCall[0]).toContain('ORDER BY created_at DESC');
    expect(listCall[0]).toContain('LIMIT ?');
  });

  test('insertBatch: handles duplicates via INSERT IGNORE', async () => {
    mockQuery.mockResolvedValueOnce([{}, []]); // ensureTable
    // 3 entries, but only 1 inserted (2 dupes)
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const { insertBatch } = await import('@/lib/question-bank/dao');

    const result = await insertBatch([
      { subject: '数学', grade: '高一', difficulty: 'easy', questionType: 'fill', content: 'same', answer: 'x' },
      { subject: '数学', grade: '高一', difficulty: 'easy', questionType: 'fill', content: 'same', answer: 'x' },
      { subject: '数学', grade: '高一', difficulty: 'easy', questionType: 'fill', content: 'same', answer: 'x' },
    ]);

    expect(result.inserted).toBe(1);
    expect(result.duplicates).toBe(2);
  });
});
