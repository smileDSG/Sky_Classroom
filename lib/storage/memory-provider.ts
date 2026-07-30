/**
 * In-Memory Storage Provider
 *
 * Used as a last-resort fallback when neither IndexedDB nor localStorage
 * are available. Data is lost on page refresh.
 */

import type { StorageProvider, StorageEntry } from './storage-types';
import { StorageEntryAlreadyExistsError } from './storage-errors';

export class MemoryStorageProvider implements StorageProvider {
  private tables: Map<string, Map<string, StorageEntry>> = new Map();

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  private getTable(table: string): Map<string, StorageEntry> {
    if (!this.tables.has(table)) {
      this.tables.set(table, new Map());
    }
    return this.tables.get(table)!;
  }

  async set<T>(table: string, entry: StorageEntry<T>): Promise<void> {
    this.getTable(table).set(entry.id, entry as StorageEntry);
  }

  async insert<T>(table: string, entry: StorageEntry<T>): Promise<void> {
    const target = this.getTable(table);
    if (target.has(entry.id)) {
      throw new StorageEntryAlreadyExistsError(table, entry.id);
    }
    target.set(entry.id, entry as StorageEntry);
  }

  async get<T>(table: string, id: string): Promise<StorageEntry<T> | null> {
    const t = this.getTable(table);
    return ((t.get(id) ?? null) as StorageEntry<T> | null);
  }

  async getAll<T>(
    table: string,
    filter?: (entry: StorageEntry<T>) => boolean,
  ): Promise<StorageEntry<T>[]> {
    const entries = [...this.getTable(table).values()] as StorageEntry<T>[];
    return filter ? entries.filter(filter) : entries;
  }

  async delete(table: string, id: string): Promise<boolean> {
    return this.getTable(table).delete(id);
  }

  async clear(table: string): Promise<void> {
    this.tables.get(table)?.clear();
  }

  async count(table: string): Promise<number> {
    return this.getTable(table).size;
  }
}
