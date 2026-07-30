import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { IndexedDBStorageProvider } from '@/lib/storage/indexeddb-provider';
import { StorageEntryAlreadyExistsError } from '@/lib/storage/storage-errors';
import type { StorageEntry } from '@/lib/storage/storage-types';

function makeEntry(id: string, data: unknown): StorageEntry {
  return { id, data, createdAt: 1000, updatedAt: 1000 };
}

describe('IndexedDBStorageProvider insert', () => {
  it('rejects a duplicate id without changing the original entry', async () => {
    const provider = new IndexedDBStorageProvider({
      databaseName: `profile-insert-${Date.now()}-${Math.random()}`,
    });
    const original = makeEntry('1', { name: 'Alice' });
    const duplicate = makeEntry('1', { name: 'Bob' });

    await provider.insert('users', original);

    await expect(provider.insert('users', duplicate)).rejects.toBeInstanceOf(
      StorageEntryAlreadyExistsError,
    );
    expect(await provider.get('users', '1')).toEqual(original);
  });
});
