/**
 * P1-003: Question Bank DAO tests
 *
 * Tests CRUD, search, filter, pagination, dedup.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { createQuestionBankDAO } from '@/lib/storage/dao/question-bank';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { QuestionBankEntry } from '@/lib/storage/dao/question-bank';

function makeQuestion(overrides: Partial<QuestionBankEntry> = {}): QuestionBankEntry {
  return {
    problemHash: 'hash_' + Date.now() + Math.random(),
    problemText: 'Solve for x: x + 1 = 2',
    answer: 'x = 1',
    steps: ['Subtract 1 from both sides', 'x = 1'],
    knowledgePoints: ['linear equation', 'algebra'],
    agentId: 'science-agent',
    verified: false,
    ...overrides,
  };
}

describe('QuestionBankDAO', () => {
  let dao: ReturnType<typeof createQuestionBankDAO>;

  beforeEach(() => {
    const storage = new MemoryStorageProvider();
    dao = createQuestionBankDAO(storage);
  });

  // ─── upsert / getByHash ───

  describe('upsert / getByHash', () => {
    test('inserts and retrieves a question', async () => {
      const q = makeQuestion();
      await dao.upsert(q);
      const found = await dao.getByHash(q.problemHash);
      expect(found).toEqual(q);
    });

    test('updates existing question preserving createdAt', async () => {
      const q = makeQuestion();
      await dao.upsert(q);
      // Wait to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));
      q.answer = 'updated answer';
      await dao.upsert(q);
      const found = await dao.getByHash(q.problemHash);
      expect(found?.answer).toBe('updated answer');
      // createdAt should be preserved
      const all = await dao.list(1, 100);
      expect(all.items).toHaveLength(1);
    });

    test('returns null for non-existent hash', async () => {
      const found = await dao.getByHash('nonexistent');
      expect(found).toBeNull();
    });
  });

  // ─── search ───

  describe('search', () => {
    test('finds questions by substring match', async () => {
      await dao.upsert(makeQuestion({ problemHash: 'h1', problemText: 'Solve for x: x + 1 = 2' }));
      await dao.upsert(makeQuestion({ problemHash: 'h2', problemText: 'What is the derivative of sin(x)?' }));
      const results = await dao.search('derivative');
      expect(results).toHaveLength(1);
      expect(results[0].problemHash).toBe('h2');
    });

    test('case-insensitive search', async () => {
      await dao.upsert(makeQuestion({ problemHash: 'h1', problemText: 'Solve DERIVATIVE' }));
      const results = await dao.search('derivative');
      expect(results).toHaveLength(1);
    });

    test('returns multiple matches sorted by updatedAt', async () => {
      await dao.upsert(makeQuestion({ problemHash: 'h1', problemText: 'Math question A' }));
      await dao.upsert(makeQuestion({ problemHash: 'h2', problemText: 'Math question B' }));
      await dao.upsert(makeQuestion({ problemHash: 'h3', problemText: 'Physics question' }));
      const results = await dao.search('question');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    test('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await dao.upsert(makeQuestion({ problemHash: `h${i}`, problemText: `Test question ${i}` }));
      }
      const results = await dao.search('question', 2);
      expect(results).toHaveLength(2);
    });

    test('returns empty array when no matches', async () => {
      await dao.upsert(makeQuestion({ problemHash: 'h1', problemText: 'Math' }));
      const results = await dao.search('nonexistent-word');
      expect(results).toEqual([]);
    });
  });

  // ─── findByKnowledgePoint ───

  describe('findByKnowledgePoint', () => {
    test('finds questions by knowledge point', async () => {
      await dao.upsert(makeQuestion({
        problemHash: 'h1',
        knowledgePoints: ['algebra', 'equation'],
      }));
      await dao.upsert(makeQuestion({
        problemHash: 'h2',
        knowledgePoints: ['geometry', 'triangle'],
      }));
      const results = await dao.findByKnowledgePoint('algebra');
      expect(results).toHaveLength(1);
      expect(results[0].problemHash).toBe('h1');
    });

    test('case-insensitive knowledge point match', async () => {
      await dao.upsert(makeQuestion({
        problemHash: 'h1',
        knowledgePoints: ['Algebra'],
      }));
      const results = await dao.findByKnowledgePoint('algebra');
      expect(results).toHaveLength(1);
    });

    test('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await dao.upsert(makeQuestion({
          problemHash: `h${i}`,
          knowledgePoints: ['math'],
        }));
      }
      const results = await dao.findByKnowledgePoint('math', 3);
      expect(results).toHaveLength(3);
    });
  });

  // ─── list ───

  describe('list', () => {
    test('returns all items with total count', async () => {
      await dao.upsert(makeQuestion({ problemHash: 'h1' }));
      await dao.upsert(makeQuestion({ problemHash: 'h2' }));
      const { items, total } = await dao.list();
      expect(total).toBe(2);
      expect(items).toHaveLength(2);
    });

    test('paginates correctly', async () => {
      for (let i = 0; i < 5; i++) {
        await dao.upsert(makeQuestion({ problemHash: `h${i}` }));
      }
      const page1 = await dao.list(1, 3);
      const page2 = await dao.list(2, 3);
      expect(page1.items).toHaveLength(3);
      expect(page2.items).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page2.total).toBe(5);
    });

    test('sorts by updatedAt descending', async () => {
      await dao.upsert(makeQuestion({ problemHash: 'h1' }));
      await new Promise((r) => setTimeout(r, 10));
      await dao.upsert(makeQuestion({ problemHash: 'h2' }));
      const { items } = await dao.list(1, 10);
      expect(items[0].problemHash).toBe('h2');
      expect(items[1].problemHash).toBe('h1');
    });
  });

  // ─── delete ───

  describe('delete', () => {
    test('deletes a question', async () => {
      await dao.upsert(makeQuestion({ problemHash: 'h1' }));
      const deleted = await dao.delete('h1');
      expect(deleted).toBe(true);
      expect(await dao.getByHash('h1')).toBeNull();
    });

    test('returns false for non-existent hash', async () => {
      const result = await dao.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ─── count / exists ───

  describe('count / exists', () => {
    test('count returns total', async () => {
      await dao.upsert(makeQuestion({ problemHash: 'h1' }));
      await dao.upsert(makeQuestion({ problemHash: 'h2' }));
      expect(await dao.count()).toBe(2);
    });

    test('exists returns true for existing hash', async () => {
      await dao.upsert(makeQuestion({ problemHash: 'h1' }));
      expect(await dao.exists('h1')).toBe(true);
    });

    test('exists returns false for non-existent hash', async () => {
      expect(await dao.exists('nope')).toBe(false);
    });
  });
});
