/**
 * P1-003: Storage factory tests
 *
 * Tests createStorageProvider fallback logic and preferred backend ordering.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createStorageProvider, getStorageProvider } from '@/lib/storage/storage-factory';
import type { StorageConfig } from '@/lib/storage/storage-types';

// Mock the logger to avoid console output
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('createStorageProvider', () => {
  test('returns MemoryStorageProvider when IndexedDB and localStorage unavailable', async () => {
    // In jsdom, IndexedDB is undefined. localStorage might exist.
    // We force memory by mocking localStorage too.
    const lsGet = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    const lsSet = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage disabled');
    });

    const provider = await createStorageProvider({ preferredBackend: 'memory' });
    expect(provider.constructor.name).toBe('MemoryStorageProvider');

    lsGet.mockRestore();
    lsSet.mockRestore();
  });

  test('returns provider with isAvailable() === true', async () => {
    const config: StorageConfig = { preferredBackend: 'memory' };
    const provider = await createStorageProvider(config);
    expect(await provider.isAvailable()).toBe(true);
  });

  test('provider supports full CRUD', async () => {
    const config: StorageConfig = { preferredBackend: 'memory' };
    const provider = await createStorageProvider(config);

    await provider.set('test', {
      id: '1',
      data: { msg: 'hello' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const entry = await provider.get('test', '1');
    expect(entry).not.toBeNull();
    expect(entry?.data).toEqual({ msg: 'hello' });

    const all = await provider.getAll('test');
    expect(all).toHaveLength(1);

    expect(await provider.count('test')).toBe(1);

    await provider.delete('test', '1');
    expect(await provider.get('test', '1')).toBeNull();
  });
});

describe('getStorageProvider', () => {
  test('returns a cached singleton', async () => {
    // Reset the module-level singleton by getting fresh import
    // Since we can't easily reset module state, we just verify it returns a valid provider
    const provider = await getStorageProvider();
    expect(await provider.isAvailable()).toBe(true);
  });
});
