/**
 * Data Migration Manager
 *
 * Handles schema/data migrations for the unified storage layer.
 * Each migration is versioned and applied sequentially.
 *
 * Usage:
 *   const manager = createMigrationManager(storage);
 *   manager.registerMigration(1, 'add-review-counts', async (storage) => {
 *     // migration logic
 *   });
 *   await manager.migrate();
 */

import type { StorageProvider, StorageEntry } from './storage-types';

export type MigrationStep = (storage: StorageProvider) => Promise<void>;

const META_TABLE = '__migrations';

export function createMigrationManager(storage: StorageProvider) {
  const migrations: { version: number; name: string; fn: MigrationStep }[] = [];
  let currentVersion = 0;

  return {
    /** Register a migration step */
    register(version: number, name: string, fn: MigrationStep): void {
      migrations.push({ version, name, fn });
      if (version > currentVersion) currentVersion = version;
    },

    /** Get the current migration version */
    async getCurrentVersion(): Promise<number> {
      const entry = await storage.get<{ version: number }>(META_TABLE, 'current');
      return entry?.data.version ?? 0;
    },

    /** Set the current migration version */
    async setCurrentVersion(version: number): Promise<void> {
      await storage.set(META_TABLE, {
        id: 'current',
        data: { version },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    },

    /** Run all pending migrations */
    async migrate(): Promise<{ applied: string[]; targetVersion: number }> {
      const fromVersion = await this.getCurrentVersion();
      const pending = migrations
        .filter((m) => m.version > fromVersion)
        .sort((a, b) => a.version - b.version);

      if (pending.length === 0) {
        return { applied: [], targetVersion: fromVersion };
      }

      const applied: string[] = [];
      for (const m of pending) {
        try {
          await m.fn(storage);
          await this.setCurrentVersion(m.version);
          applied.push(m.name);
        } catch (err) {
          throw new Error(
            `Migration "${m.name}" (v${m.version}) failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return { applied, targetVersion: pending[pending.length - 1].version };
    },

    /** Get all registered migrations */
    getRegistered(): { version: number; name: string }[] {
      return migrations.map(({ version, name }) => ({ version, name }));
    },
  };
}
