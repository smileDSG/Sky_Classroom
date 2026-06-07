/**
 * LocalStorage Storage Provider
 *
 * Fallback when IndexedDB is unavailable. Stores data as JSON strings
 * under namespaced keys: `{prefix}:{table}:{id}`.
 */

import type { StorageProvider, StorageEntry } from './storage-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('Storage:LocalStorage');

const TABLE_INDEX_KEY = (prefix: string, table: string) => `${prefix}::__idx:${table}`;

export class LocalStorageProvider implements StorageProvider {
  private prefix: string;

  constructor(prefix = 'sky') {
    this.prefix = prefix;
  }

  private itemKey(table: string, id: string): string {
    return `${this.prefix}:${table}:${id}`;
  }

  private getTableIndex(table: string): Set<string> {
    try {
      const raw = localStorage.getItem(TABLE_INDEX_KEY(this.prefix, table));
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  }

  private setTableIndex(table: string, ids: Set<string>): void {
    localStorage.setItem(TABLE_INDEX_KEY(this.prefix, table), JSON.stringify([...ids]));
  }

  async isAvailable(): Promise<boolean> {
    try {
      const testKey = `__${this.prefix}_test__`;
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  async set<T>(table: string, entry: StorageEntry<T>): Promise<void> {
    try {
      const key = this.itemKey(table, entry.id);
      localStorage.setItem(key, JSON.stringify(entry));
      const index = this.getTableIndex(table);
      index.add(entry.id);
      this.setTableIndex(table, index);
    } catch (err) {
      log.error(`set(${table}, ${entry.id}) failed:`, err);
      throw err;
    }
  }

  async get<T>(table: string, id: string): Promise<StorageEntry<T> | null> {
    try {
      const key = this.itemKey(table, id);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as StorageEntry<T>;
    } catch (err) {
      log.error(`get(${table}, ${id}) failed:`, err);
      return null;
    }
  }

  async getAll<T>(
    table: string,
    filter?: (entry: StorageEntry<T>) => boolean,
  ): Promise<StorageEntry<T>[]> {
    const index = this.getTableIndex(table);
    const results: StorageEntry<T>[] = [];

    for (const id of index) {
      const entry = await this.get<T>(table, id);
      if (entry && (!filter || filter(entry))) {
        results.push(entry);
      }
    }

    return results;
  }

  async delete(table: string, id: string): Promise<boolean> {
    try {
      const key = this.itemKey(table, id);
      localStorage.removeItem(key);
      const index = this.getTableIndex(table);
      index.delete(id);
      this.setTableIndex(table, index);
      return true;
    } catch (err) {
      log.error(`delete(${table}, ${id}) failed:`, err);
      return false;
    }
  }

  async clear(table: string): Promise<void> {
    const index = this.getTableIndex(table);
    for (const id of index) {
      localStorage.removeItem(this.itemKey(table, id));
    }
    index.clear();
    this.setTableIndex(table, index);
  }

  async count(table: string): Promise<number> {
    return this.getTableIndex(table).size;
  }
}
