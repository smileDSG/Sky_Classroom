/**
 * Cross-user isolation regression tests for MistakeBookDAO
 *
 * Ensures that every read, write, and aggregate operation is scoped to the
 * authenticated user. These tests live at the DAO layer so they guard the
 * storage boundary regardless of which API route calls it.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { createMistakeBookDAO, type MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

const ALICE = 'user-alice';
const BOB = 'user-bob';

function makeEntry(
  userId: string,
  overrides: Partial<MistakeBookEntry> = {},
): Omit<MistakeBookEntry, 'reviewCount' | 'masteryLevel' | 'reviewed'> {
  return {
    id: `mistake-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    problemText: 'sample problem',
    userAnswer: 'wrong',
    correctAnswer: 'right',
    errorType: 'concept',
    knowledgePoints: ['isolation-topic'],
    ...overrides,
  };
}

describe('MistakeBookDAO cross-user isolation', () => {
  let storage: MemoryStorageProvider;
  let dao: ReturnType<typeof createMistakeBookDAO>;

  beforeEach(() => {
    storage = new MemoryStorageProvider();
    dao = createMistakeBookDAO(storage);
  });

  test('add requires a userId', async () => {
    await expect(dao.add('', makeEntry(ALICE))).rejects.toThrow('Authenticated userId is required');
  });

  test('add stores the authenticated userId even when entry.userId differs', async () => {
    const entry = makeEntry('attacker');
    await dao.add(ALICE, entry);
    const found = await dao.get(ALICE, entry.id);
    expect(found?.userId).toBe(ALICE);
  });

  test('get returns null for another users mistake', async () => {
    const entry = makeEntry(ALICE);
    await dao.add(ALICE, entry);
    expect(await dao.get(BOB, entry.id)).toBeNull();
  });

  test('update returns false for another users mistake and leaves it intact', async () => {
    const entry = makeEntry(ALICE, { errorExplanation: 'original' });
    await dao.add(ALICE, entry);

    const result = await dao.update(BOB, entry.id, { errorExplanation: 'tampered' });
    expect(result).toBe(false);

    const found = await dao.get(ALICE, entry.id);
    expect(found?.errorExplanation).toBe('original');
  });

  test('update ignores runtime attempts to overwrite id or userId', async () => {
    const entry = makeEntry(ALICE, { id: 'original-id' });
    await dao.add(ALICE, entry);

    await dao.update(ALICE, entry.id, {
      userId: BOB,
      id: 'hijacked-id',
    } as unknown as Partial<MistakeBookEntry>);

    const found = await dao.get(ALICE, entry.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe('original-id');
    expect(found?.userId).toBe(ALICE);
  });

  test('recordReview returns false for another users mistake and leaves it intact', async () => {
    const entry = makeEntry(ALICE);
    await dao.add(ALICE, entry);

    const result = await dao.recordReview(BOB, entry.id);
    expect(result).toBe(false);

    const found = await dao.get(ALICE, entry.id);
    expect(found?.reviewCount).toBe(0);
    expect(found?.reviewed).toBe(false);
  });

  test('delete returns false for another users mistake and leaves it intact', async () => {
    const entry = makeEntry(ALICE);
    await dao.add(ALICE, entry);

    const result = await dao.delete(BOB, entry.id);
    expect(result).toBe(false);

    expect(await dao.get(ALICE, entry.id)).not.toBeNull();
  });

  test('list excludes other users mistakes', async () => {
    await dao.add(ALICE, makeEntry(ALICE, { id: 'alice-1' }));
    await dao.add(BOB, makeEntry(BOB, { id: 'bob-1' }));
    await dao.add(ALICE, makeEntry(ALICE, { id: 'alice-2', errorType: 'calculation' }));

    const { items, total } = await dao.list(ALICE);
    expect(total).toBe(2);
    expect(items.map((i) => i.id).sort()).toEqual(['alice-1', 'alice-2']);
  });

  test('list filters remain scoped to the authenticated user', async () => {
    await dao.add(ALICE, makeEntry(ALICE, { id: 'alice-calc', errorType: 'calculation' }));
    await dao.add(BOB, makeEntry(BOB, { id: 'bob-calc', errorType: 'calculation' }));

    const { items, total } = await dao.list(ALICE, { errorType: 'calculation' });
    expect(total).toBe(1);
    expect(items[0].id).toBe('alice-calc');
  });

  test('getDueForReview excludes other users due items', async () => {
    await dao.add(
      ALICE,
      makeEntry(ALICE, { id: 'alice-due', nextReview: Date.now() - 1_000, reviewed: false }),
    );
    await dao.add(
      BOB,
      makeEntry(BOB, { id: 'bob-due', nextReview: Date.now() - 1_000, reviewed: false }),
    );

    const due = await dao.getDueForReview(ALICE);
    expect(due.map((d) => d.id)).toEqual(['alice-due']);
  });

  test('findByKnowledgePoint excludes other users matches', async () => {
    await dao.add(ALICE, makeEntry(ALICE, { id: 'alice-kp', knowledgePoints: ['shared-topic'] }));
    await dao.add(BOB, makeEntry(BOB, { id: 'bob-kp', knowledgePoints: ['shared-topic'] }));

    const found = await dao.findByKnowledgePoint(ALICE, 'shared-topic');
    expect(found.map((f) => f.id)).toEqual(['alice-kp']);
  });

  test('count excludes other users mistakes', async () => {
    await dao.add(ALICE, makeEntry(ALICE, { id: 'alice-1', errorType: 'calculation' }));
    await dao.add(BOB, makeEntry(BOB, { id: 'bob-1', errorType: 'calculation' }));

    expect(await dao.count(ALICE)).toBe(1);
    expect(await dao.count(ALICE, { errorType: 'calculation' })).toBe(1);
  });

  test('getErrorTypeDistribution excludes other users mistakes', async () => {
    await dao.add(ALICE, makeEntry(ALICE, { id: 'alice-calc', errorType: 'calculation' }));
    await dao.add(ALICE, makeEntry(ALICE, { id: 'alice-calc-2', errorType: 'calculation' }));
    await dao.add(BOB, makeEntry(BOB, { id: 'bob-calc', errorType: 'calculation' }));

    const dist = await dao.getErrorTypeDistribution(ALICE);
    expect(dist.calculation).toBe(2);
  });
});
