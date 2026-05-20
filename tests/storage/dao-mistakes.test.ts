/**
 * P1-003: Mistake Book DAO tests
 *
 * Tests CRUD, Ebbinghaus scheduling, filtering, distribution.
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  createMistakeBookDAO,
  EBBINGHAUS_INTERVALS,
  type MistakeBookEntry,
  type ErrorType,
} from '@/lib/storage/dao/mistakes';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

function makeMistake(overrides: Partial<MistakeBookEntry> = {}): MistakeBookEntry {
  return {
    id: 'mistake_' + Date.now() + Math.random(),
    problemText: '2 + 2 = 5',
    userAnswer: '5',
    correctAnswer: '4',
    errorType: 'calculation',
    knowledgePoints: ['arithmetic'],
    reviewCount: 0,
    masteryLevel: 0,
    reviewed: false,
    ...overrides,
  };
}

describe('MistakeBookDAO', () => {
  let dao: ReturnType<typeof createMistakeBookDAO>;

  beforeEach(() => {
    const storage = new MemoryStorageProvider();
    dao = createMistakeBookDAO(storage);
  });

  // ─── add / get ───

  describe('add / get', () => {
    test('adds a mistake with default values', async () => {
      const m = makeMistake();
      await dao.add(m);
      const found = await dao.get(m.id);
      expect(found).not.toBeNull();
      expect(found?.reviewCount).toBe(0);
      expect(found?.masteryLevel).toBe(0);
      expect(found?.reviewed).toBe(false);
    });

    test('returns null for non-existent id', async () => {
      const found = await dao.get('nonexistent');
      expect(found).toBeNull();
    });
  });

  // ─── update ───

  describe('update', () => {
    test('updates fields', async () => {
      const m = makeMistake();
      await dao.add(m);
      await dao.update(m.id, { reviewed: true, errorExplanation: 'Simple arithmetic error' });
      const found = await dao.get(m.id);
      expect(found?.reviewed).toBe(true);
      expect(found?.errorExplanation).toBe('Simple arithmetic error');
    });

    test('throws if entry not found', async () => {
      await expect(dao.update('nonexistent', { reviewed: true })).rejects.toThrow(
        'Mistake nonexistent not found',
      );
    });
  });

  // ─── recordReview ───

  describe('recordReview', () => {
    test('increments reviewCount and sets nextReview', async () => {
      const m = makeMistake();
      await dao.add(m);
      await dao.recordReview(m.id);
      const found = await dao.get(m.id);
      expect(found?.reviewCount).toBe(1);
      expect(found?.nextReview).toBeDefined();
      expect(found?.nextReview).toBeGreaterThan(Date.now());
    });

    test('updates masteryLevel based on reviewCount', async () => {
      const m = makeMistake();
      await dao.add(m);
      // Review 6 times to complete all intervals
      for (let i = 0; i < 6; i++) {
        await dao.recordReview(m.id);
      }
      const found = await dao.get(m.id);
      expect(found?.masteryLevel).toBe(EBBINGHAUS_INTERVALS.length);
      expect(found?.reviewed).toBe(true);
    });

    test('sets lastReview timestamp', async () => {
      const m = makeMistake();
      await dao.add(m);
      await dao.recordReview(m.id);
      const found = await dao.get(m.id);
      expect(found?.lastReview).toBeGreaterThan(0);
    });

    test('throws if entry not found', async () => {
      await expect(dao.recordReview('nonexistent')).rejects.toThrow(
        'Mistake nonexistent not found',
      );
    });
  });

  // ─── delete ───

  describe('delete', () => {
    test('deletes a mistake', async () => {
      const m = makeMistake();
      await dao.add(m);
      expect(await dao.delete(m.id)).toBe(true);
      expect(await dao.get(m.id)).toBeNull();
    });
  });

  // ─── list ───

  describe('list', () => {
    test('returns all items', async () => {
      await dao.add(makeMistake({ id: 'm1' }));
      await dao.add(makeMistake({ id: 'm2' }));
      const { items, total } = await dao.list();
      expect(total).toBe(2);
      expect(items).toHaveLength(2);
    });

    test('filters by errorType', async () => {
      await dao.add(makeMistake({ id: 'm1', errorType: 'calculation' }));
      await dao.add(makeMistake({ id: 'm2', errorType: 'concept' }));
      await dao.add(makeMistake({ id: 'm3', errorType: 'calculation' }));
      const { items, total } = await dao.list({ errorType: 'calculation' });
      expect(total).toBe(2);
      expect(items.every((i) => i.errorType === 'calculation')).toBe(true);
    });

    test('filters by reviewed', async () => {
      const m1 = makeMistake({ id: 'm1' });
      const m2 = makeMistake({ id: 'm2' });
      await dao.add(m1);
      await dao.add(m2);
      await dao.update(m2.id, { reviewed: true });
      const { items } = await dao.list({ reviewed: true });
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('m2');
    });

    test('filters by masteryBelow', async () => {
      const m1 = makeMistake({ id: 'm1' });
      const m2 = makeMistake({ id: 'm2' });
      await dao.add(m1);
      await dao.add(m2);
      await dao.update(m2.id, { masteryLevel: 5 });
      const { items } = await dao.list({ masteryBelow: 3 });
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('m1');
    });

    test('paginates', async () => {
      for (let i = 0; i < 5; i++) {
        await dao.add(makeMistake({ id: `m${i}` }));
      }
      const { items } = await dao.list({ page: 1, pageSize: 2 });
      expect(items).toHaveLength(2);
    });
  });

  // ─── getDueForReview ───

  describe('getDueForReview', () => {
    test('returns mistakes past their nextReview time', async () => {
      const m = makeMistake({
        id: 'due1',
        nextReview: Date.now() - 1000, // 1 second ago
        reviewed: false,
      });
      await dao.add(m);
      const due = await dao.getDueForReview();
      expect(due.some((d) => d.id === 'due1')).toBe(true);
    });

    test('excludes already reviewed mistakes', async () => {
      const m = makeMistake({
        id: 'reviewed',
        nextReview: Date.now() - 1000,
      });
      await dao.add(m);
      await dao.update(m.id, { reviewed: true });
      const due = await dao.getDueForReview();
      expect(due.some((d) => d.id === 'reviewed')).toBe(false);
    });

    test('excludes mistakes not yet due', async () => {
      await dao.add(makeMistake({
        id: 'not-due',
        nextReview: Date.now() + 86400000, // tomorrow
        reviewed: false,
      }));
      const due = await dao.getDueForReview();
      expect(due.some((d) => d.id === 'not-due')).toBe(false);
    });

    test('sorts by nextReview ascending', async () => {
      await dao.add(makeMistake({ id: 'm2', nextReview: Date.now() - 500, reviewed: false }));
      await dao.add(makeMistake({ id: 'm1', nextReview: Date.now() - 1000, reviewed: false }));
      const due = await dao.getDueForReview();
      expect(due[0].id).toBe('m1');
      expect(due[1].id).toBe('m2');
    });
  });

  // ─── findByKnowledgePoint ───

  describe('findByKnowledgePoint', () => {
    test('finds mistakes by knowledge point', async () => {
      await dao.add(makeMistake({ id: 'm1', knowledgePoints: ['arithmetic'] }));
      await dao.add(makeMistake({ id: 'm2', knowledgePoints: ['geometry'] }));
      const results = await dao.findByKnowledgePoint('arithmetic');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('m1');
    });
  });

  // ─── count ───

  describe('count', () => {
    test('returns total count', async () => {
      await dao.add(makeMistake({ id: 'm1' }));
      await dao.add(makeMistake({ id: 'm2' }));
      expect(await dao.count()).toBe(2);
    });

    test('counts with errorType filter', async () => {
      await dao.add(makeMistake({ id: 'm1', errorType: 'calculation' }));
      await dao.add(makeMistake({ id: 'm2', errorType: 'concept' }));
      expect(await dao.count({ errorType: 'calculation' })).toBe(1);
    });
  });

  // ─── getErrorTypeDistribution ───

  describe('getErrorTypeDistribution', () => {
    test('returns all 5 error types with defaults of 0', async () => {
      const dist = await dao.getErrorTypeDistribution();
      const types: ErrorType[] = ['calculation', 'concept', 'reasoning', 'reading', 'careless'];
      for (const t of types) {
        expect(dist).toHaveProperty(t);
        expect(typeof dist[t]).toBe('number');
      }
    });

    test('counts correctly', async () => {
      await dao.add(makeMistake({ id: 'm1', errorType: 'calculation' }));
      await dao.add(makeMistake({ id: 'm2', errorType: 'calculation' }));
      await dao.add(makeMistake({ id: 'm3', errorType: 'concept' }));
      const dist = await dao.getErrorTypeDistribution();
      expect(dist.calculation).toBe(2);
      expect(dist.concept).toBe(1);
      expect(dist.reasoning).toBe(0);
    });
  });
});
