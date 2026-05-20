/**
 * P1-003: LocalStorage provider tests
 *
 * Tests all 7 methods of LocalStorageProvider.
 * Uses a mock localStorage (jsdom provides this, but we clear between tests).
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageProvider } from '@/lib/storage/local-storage-provider';
import type { StorageEntry } from '@/lib/storage/storage-types';

function makeEntry(id: string, data: unknown): StorageEntry {
  return { id, data, createdAt: 1000, updatedAt: 1000 };
}

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  beforeEach(() => {
    provider = new LocalStorageProvider('test-sky');
    // Clear all test keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('test-sky')) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  });

  afterEach(() => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('test-sky')) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  });

  // ─── isAvailable ───

  describe('isAvailable', () => {
    test('returns true when localStorage works', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });
  });

  // ─── set / get ───

  describe('set / get', () => {
    test('stores and retrieves an entry', async () => {
      const entry = makeEntry('1', { name: 'Alice' });
      await provider.set('users', entry);
      const result = await provider.get('users', '1');
      expect(result).toEqual(entry);
    });

    test('returns null for non-existent id', async () => {
      const result = await provider.get('users', 'nonexistent');
      expect(result).toBeNull();
    });

    test('namespaces keys with prefix', async () => {
      const entry = makeEntry('1', 'test');
      await provider.set('table', entry);
      // Key should be test-sky:table:1
      const raw = localStorage.getItem('test-sky:table:1');
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!)).toEqual(entry);
    });

    test('maintains table index', async () => {
      await provider.set('users', makeEntry('a', 1));
      await provider.set('users', makeEntry('b', 2));
      const indexRaw = localStorage.getItem('test-sky::__idx:users');
      const index = JSON.parse(indexRaw!) as string[];
      expect(index.sort()).toEqual(['a', 'b']);
    });
  });

  // ─── getAll ───

  describe('getAll', () => {
    test('returns all entries', async () => {
      await provider.set('items', makeEntry('a', 1));
      await provider.set('items', makeEntry('b', 2));
      await provider.set('items', makeEntry('c', 3));
      const result = await provider.getAll('items');
      expect(result).toHaveLength(3);
    });

    test('returns empty array for empty table', async () => {
      const result = await provider.getAll('empty');
      expect(result).toEqual([]);
    });

    test('applies filter', async () => {
      await provider.set('items', makeEntry('a', { active: true }));
      await provider.set('items', makeEntry('b', { active: false }));
      const result = await provider.getAll('items', (e) => (e.data as { active: boolean }).active);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
    });
  });

  // ─── delete ───

  describe('delete', () => {
    test('returns true and removes entry', async () => {
      await provider.set('items', makeEntry('1', 'test'));
      expect(await provider.delete('items', '1')).toBe(true);
      expect(await provider.get('items', '1')).toBeNull();
    });

    test('removes from index', async () => {
      await provider.set('items', makeEntry('a', 1));
      await provider.set('items', makeEntry('b', 2));
      await provider.delete('items', 'a');
      const indexRaw = localStorage.getItem('test-sky::__idx:items');
      const index = JSON.parse(indexRaw!) as string[];
      expect(index).toEqual(['b']);
    });

    test('removes the item key from localStorage', async () => {
      await provider.set('items', makeEntry('1', 'test'));
      expect(localStorage.getItem('test-sky:items:1')).toBeTruthy();
      await provider.delete('items', '1');
      expect(localStorage.getItem('test-sky:items:1')).toBeNull();
    });
  });

  // ─── clear ───

  describe('clear', () => {
    test('removes all entries and index', async () => {
      await provider.set('items', makeEntry('a', 1));
      await provider.set('items', makeEntry('b', 2));
      await provider.clear('items');
      expect(await provider.getAll('items')).toEqual([]);
      expect(await provider.count('items')).toBe(0);
    });

    test('does not affect other tables', async () => {
      await provider.set('t1', makeEntry('a', 1));
      await provider.set('t2', makeEntry('b', 2));
      await provider.clear('t1');
      expect(await provider.getAll('t2')).toHaveLength(1);
    });
  });

  // ─── count ───

  describe('count', () => {
    test('returns correct count', async () => {
      await provider.set('items', makeEntry('a', 1));
      await provider.set('items', makeEntry('b', 2));
      expect(await provider.count('items')).toBe(2);
    });

    test('returns 0 for empty table', async () => {
      expect(await provider.count('empty')).toBe(0);
    });
  });

  // ─── Prefix isolation ───

  describe('prefix isolation', () => {
    test('two providers with different prefixes are isolated', async () => {
      const p1 = new LocalStorageProvider('prefix-a');
      const p2 = new LocalStorageProvider('prefix-b');
      await p1.set('shared', makeEntry('1', 'from-a'));
      await p2.set('shared', makeEntry('1', 'from-b'));
      const r1 = await p1.get('shared', '1');
      const r2 = await p2.get('shared', '1');
      expect(r1?.data).toBe('from-a');
      expect(r2?.data).toBe('from-b');
    });
  });
});
