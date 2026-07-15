/**
 * P1-003: Storage migration manager tests
 *
 * Tests register, getCurrentVersion, setCurrentVersion, migrate, getRegistered.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { createMigrationManager } from '@/lib/storage/migration';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';

describe('createMigrationManager', () => {
  let storage: StorageProvider;
  let manager: ReturnType<typeof createMigrationManager>;

  beforeEach(async () => {
    storage = new MemoryStorageProvider();
    manager = createMigrationManager(storage);
  });

  // ─── register ───

  describe('register', () => {
    test('adds a migration to the registry', () => {
      manager.register(1, 'init', vi.fn());
      const registered = manager.getRegistered();
      expect(registered).toEqual([{ version: 1, name: 'init' }]);
    });

    test('tracks highest registered version', () => {
      manager.register(1, 'first', vi.fn());
      manager.register(3, 'third', vi.fn());
      manager.register(2, 'second', vi.fn());
      const registered = manager.getRegistered();
      expect(registered).toHaveLength(3);
    });
  });

  // ─── getCurrentVersion ───

  describe('getCurrentVersion', () => {
    test('returns 0 when no migrations have been applied', async () => {
      const version = await manager.getCurrentVersion();
      expect(version).toBe(0);
    });

    test('returns version after setCurrentVersion', async () => {
      await manager.setCurrentVersion(5);
      const version = await manager.getCurrentVersion();
      expect(version).toBe(5);
    });
  });

  // ─── setCurrentVersion ───

  describe('setCurrentVersion', () => {
    test('persists version to storage', async () => {
      await manager.setCurrentVersion(3);
      // Read directly from storage to verify persistence
      const entry = await storage.get('__migrations', 'current');
      expect((entry?.data as { version: number }).version).toBe(3);
    });
  });

  // ─── migrate ───

  describe('migrate', () => {
    test('applies no migrations when version is current', async () => {
      manager.register(1, 'init', vi.fn());
      await manager.setCurrentVersion(1);
      const result = await manager.migrate();
      expect(result.applied).toEqual([]);
      expect(result.targetVersion).toBe(1);
    });

    test('applies pending migrations in order', async () => {
      const fn1 = vi.fn().mockResolvedValue(undefined);
      const fn2 = vi.fn().mockResolvedValue(undefined);
      const fn3 = vi.fn().mockResolvedValue(undefined);

      manager.register(1, 'init-schema', fn1);
      manager.register(2, 'add-users', fn2);
      manager.register(3, 'add-roles', fn3);

      const result = await manager.migrate();
      expect(result.applied).toEqual(['init-schema', 'add-users', 'add-roles']);
      expect(result.targetVersion).toBe(3);
      expect(fn1).toHaveBeenCalledBefore(fn2);
      expect(fn2).toHaveBeenCalledBefore(fn3);
    });

    test('skips already-applied migrations', async () => {
      const fn1 = vi.fn().mockResolvedValue(undefined);
      const fn2 = vi.fn().mockResolvedValue(undefined);

      manager.register(1, 'init', fn1);
      manager.register(2, 'add-table', fn2);
      await manager.setCurrentVersion(1);

      const result = await manager.migrate();
      expect(result.applied).toEqual(['add-table']);
      expect(result.targetVersion).toBe(2);
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    test('throws error with migration name on failure', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('DB connection failed'));
      manager.register(1, 'bad-migration', failFn);

      await expect(manager.migrate()).rejects.toThrow(
        'Migration "bad-migration" (v1) failed: DB connection failed',
      );
    });

    test('stops on first failure', async () => {
      const fn1 = vi.fn().mockResolvedValue(undefined);
      const fn2 = vi.fn().mockRejectedValue(new Error('step 2 failed'));
      const fn3 = vi.fn().mockResolvedValue(undefined);

      manager.register(1, 'step1', fn1);
      manager.register(2, 'step2', fn2);
      manager.register(3, 'step3', fn3);

      await expect(manager.migrate()).rejects.toThrow('step2');
      expect(fn1).toHaveBeenCalled();
      expect(fn3).not.toHaveBeenCalled();
    });

    test('migration receives storage provider', async () => {
      const fn = vi.fn().mockImplementation(async (storage: StorageProvider) => {
        await storage.set('data', {
          id: 'migrated',
          data: { migrated: true },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      manager.register(1, 'seed-data', fn);
      await manager.migrate();
      const entry = await storage.get('data', 'migrated');
      expect(entry?.data).toEqual({ migrated: true });
    });
  });

  // ─── getRegistered ───

  describe('getRegistered', () => {
    test('returns empty array when no migrations registered', () => {
      expect(manager.getRegistered()).toEqual([]);
    });

    test('returns all registered migrations', () => {
      manager.register(1, 'a', vi.fn());
      manager.register(2, 'b', vi.fn());
      const result = manager.getRegistered();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ version: 1, name: 'a' });
      expect(result[1]).toEqual({ version: 2, name: 'b' });
    });
  });
});
