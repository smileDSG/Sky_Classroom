/**
 * P1-003: Memory storage provider tests
 *
 * Tests all 7 methods of MemoryStorageProvider.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import { StorageEntryAlreadyExistsError } from '@/lib/storage/storage-errors';
import type { StorageEntry } from '@/lib/storage/storage-types';
import { createUserDAO } from '@/lib/storage/dao/users';
import type { LearningOnboardingProfile } from '@/lib/onboarding/types';

function makeEntry(id: string, data: unknown): StorageEntry {
  return {
    id,
    data,
    createdAt: 1000,
    updatedAt: 1000,
  };
}

describe('MemoryStorageProvider', () => {
  let provider: MemoryStorageProvider;

  beforeEach(() => {
    provider = new MemoryStorageProvider();
  });

  // ─── isAvailable ───

  describe('isAvailable', () => {
    test('always returns true', async () => {
      const result = await provider.isAvailable();
      expect(result).toBe(true);
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

    test('overwrites existing entry on second set', async () => {
      const entry1 = makeEntry('1', { name: 'Alice' });
      const entry2 = makeEntry('1', { name: 'Bob' });
      await provider.set('users', entry1);
      await provider.set('users', entry2);
      const result = await provider.get('users', '1');
      expect(result).toEqual(entry2);
    });

    test('isolates tables from each other', async () => {
      await provider.set('users', makeEntry('1', { name: 'Alice' }));
      await provider.set('posts', makeEntry('1', { title: 'Hello' }));
      const user = await provider.get('users', '1');
      const post = await provider.get('posts', '1');
      expect(user?.data).toEqual({ name: 'Alice' });
      expect(post?.data).toEqual({ title: 'Hello' });
    });

    test('auto-creates tables on first set', async () => {
      const result = await provider.get('new-table', '1');
      expect(result).toBeNull(); // table didn't exist
      await provider.set('new-table', makeEntry('1', 'test'));
      const found = await provider.get('new-table', '1');
      expect(found?.data).toBe('test');
    });
  });

  describe('insert', () => {
    test('rejects a duplicate id without changing the original entry', async () => {
      const original = makeEntry('1', { name: 'Alice' });
      const duplicate = makeEntry('1', { name: 'Bob' });

      await provider.insert('users', original);

      await expect(provider.insert('users', duplicate)).rejects.toBeInstanceOf(
        StorageEntryAlreadyExistsError,
      );
      expect(await provider.get('users', '1')).toEqual(original);
    });
  });

  // ─── getAll ───

  describe('getAll', () => {
    test('returns all entries in a table', async () => {
      await provider.set('items', makeEntry('a', { val: 1 }));
      await provider.set('items', makeEntry('b', { val: 2 }));
      await provider.set('items', makeEntry('c', { val: 3 }));
      const result = await provider.getAll('items');
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
    });

    test('returns empty array for empty table', async () => {
      const result = await provider.getAll('empty');
      expect(result).toEqual([]);
    });

    test('applies filter function', async () => {
      await provider.set('items', makeEntry('a', { active: true }));
      await provider.set('items', makeEntry('b', { active: false }));
      await provider.set('items', makeEntry('c', { active: true }));
      const result = await provider.getAll('items', (e) => (e.data as { active: boolean }).active);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id)).toEqual(expect.arrayContaining(['a', 'c']));
    });
  });

  // ─── delete ───

  describe('delete', () => {
    test('returns true and removes entry', async () => {
      await provider.set('items', makeEntry('1', 'test'));
      const deleted = await provider.delete('items', '1');
      expect(deleted).toBe(true);
      const result = await provider.get('items', '1');
      expect(result).toBeNull();
    });

    test('returns false for non-existent id', async () => {
      const result = await provider.delete('items', 'nonexistent');
      expect(result).toBe(false);
    });

    test('deleting from non-existent table returns false', async () => {
      const result = await provider.delete('empty', '1');
      expect(result).toBe(false);
    });
  });

  // ─── clear ───

  describe('clear', () => {
    test('removes all entries from a table', async () => {
      await provider.set('items', makeEntry('a', 1));
      await provider.set('items', makeEntry('b', 2));
      await provider.clear('items');
      const result = await provider.getAll('items');
      expect(result).toHaveLength(0);
    });

    test('does not affect other tables', async () => {
      await provider.set('t1', makeEntry('a', 1));
      await provider.set('t2', makeEntry('b', 2));
      await provider.clear('t1');
      const r1 = await provider.getAll('t1');
      const r2 = await provider.getAll('t2');
      expect(r1).toHaveLength(0);
      expect(r2).toHaveLength(1);
    });

    test('clearing non-existent table is no-op', async () => {
      await expect(provider.clear('nonexistent')).resolves.toBeUndefined();
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

    test('count decreases after delete', async () => {
      await provider.set('items', makeEntry('a', 1));
      await provider.set('items', makeEntry('b', 2));
      await provider.delete('items', 'a');
      expect(await provider.count('items')).toBe(1);
    });
  });
});

describe('user profile storage', () => {
  test('round-trips a learning onboarding profile', async () => {
    const provider = new MemoryStorageProvider();
    const users = await createUserDAO(provider);
    const learningOnboarding: LearningOnboardingProfile = {
      version: 1,
      status: 'completed',
      weakSubjects: ['math'],
      learningGoal: 'build-foundations',
      teachingPreference: 'step-by-step',
      completedAt: 100,
    };

    await users.create({
      id: 'user-1',
      email: 'student@example.com',
      username: 'student',
      passwordHash: null,
      role: 'user',
      status: 'active',
      guestId: null,
      planType: 'free',
      avatar: null,
      nickname: null,
      bio: null,
      educationLevel: 'middle',
      grade: '初二',
      favoriteSubjects: [{ id: 'math', name: '数学', enabled: true }],
      learningOnboarding,
      learningStyle: null,
      detailLevel: null,
      preferredLanguage: null,
      aiPersonality: null,
      aiName: null,
      customInstructions: null,
      autoGenerateQuiz: null,
      showStepByStep: null,
      enableMemory: null,
      enableRAG: null,
      emailVerified: true,
      emailVerifyToken: null,
      resetToken: null,
      resetTokenExpiry: null,
    });

    const loaded = await provider.get('users', 'user-1');
    expect((loaded?.data as { learningOnboarding: unknown }).learningOnboarding).toEqual(
      learningOnboarding,
    );
  });
});
