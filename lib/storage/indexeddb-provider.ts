/**
 * IndexedDB Storage Provider
 *
 * Uses the raw IndexedDB API for a clean generic provider.
 * Stores { id, data, createdAt, updatedAt } entries in object stores.
 */

import type { StorageProvider, StorageEntry, StorageConfig } from './storage-types';
import { DEFAULT_STORAGE_CONFIG } from './storage-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('Storage:IndexedDB');

export class IndexedDBStorageProvider implements StorageProvider {
  private db: IDBDatabase | null = null;
  private dbName: string;

  constructor(config: StorageConfig = DEFAULT_STORAGE_CONFIG) {
    this.dbName = config.databaseName ?? DEFAULT_STORAGE_CONFIG.databaseName!;
  }

  private async openDb(): Promise<IDBDatabase> {
    if (this.db) {
      // Check if the connection is still usable
      try {
        this.db.objectStoreNames; // throws if closing/closed
        return this.db;
      } catch {
        this.db = null;
      }
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Create the default tables; additional tables are created lazily
        if (!db.objectStoreNames.contains('question-bank')) {
          db.createObjectStore('question-bank', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('mistakes')) {
          db.createObjectStore('mistakes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('knowledge-graph')) {
          db.createObjectStore('knowledge-graph', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('__migrations')) {
          db.createObjectStore('__migrations', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.db.onclose = () => { this.db = null; };
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async ensureStore(db: IDBDatabase, name: string): Promise<IDBDatabase> {
    if (!db.objectStoreNames.contains(name)) {
      // Must close, reopen with new version to add stores
      const currentVersion = db.version;
      db.close();
      this.db = null;

      return new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, currentVersion + 1);
        req.onupgradeneeded = (e) => {
          const newDb = (e.target as IDBOpenDBRequest).result;
          if (!newDb.objectStoreNames.contains(name)) {
            newDb.createObjectStore(name, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => {
          this.db = (e.target as IDBOpenDBRequest).result;
          this.db.onclose = () => { this.db = null; };
          resolve(this.db);
        };
        req.onerror = () => reject(req.error);
      });
    }
    return db;
  }

  private async transaction(
    storeName: string,
    mode: IDBTransactionMode = 'readonly',
  ): Promise<{ store: IDBObjectStore; tx: IDBTransaction }> {
    const db = await this.openDb();
    const readyDb = await this.ensureStore(db, storeName);
    const tx = readyDb.transaction(storeName, mode);
    return { store: tx.objectStore(storeName), tx };
  }

  async isAvailable(): Promise<boolean> {
    return typeof indexedDB !== 'undefined';
  }

  async set<T>(table: string, entry: StorageEntry<T>): Promise<void> {
    try {
      const { store, tx } = await this.transaction(table, 'readwrite');
      store.put(entry);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      log.error(`set(${table}, ${entry.id}) failed:`, err);
      throw err;
    }
  }

  async get<T>(table: string, id: string): Promise<StorageEntry<T> | null> {
    try {
      const { store } = await this.transaction(table);
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve((req.result as StorageEntry<T>) ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      log.error(`get(${table}, ${id}) failed:`, err);
      return null;
    }
  }

  async getAll<T>(
    table: string,
    filter?: (entry: StorageEntry<T>) => boolean,
  ): Promise<StorageEntry<T>[]> {
    try {
      const { store } = await this.transaction(table);
      const entries = await new Promise<StorageEntry<T>[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as StorageEntry<T>[]);
        req.onerror = () => reject(req.error);
      });
      return filter ? entries.filter(filter) : entries;
    } catch (err) {
      log.error(`getAll(${table}) failed:`, err);
      return [];
    }
  }

  async delete(table: string, id: string): Promise<boolean> {
    try {
      const { store, tx } = await this.transaction(table, 'readwrite');
      store.delete(id);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (err) {
      log.error(`delete(${table}, ${id}) failed:`, err);
      return false;
    }
  }

  async clear(table: string): Promise<void> {
    try {
      const { store, tx } = await this.transaction(table, 'readwrite');
      store.clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      log.error(`clear(${table}) failed:`, err);
      throw err;
    }
  }

  async count(table: string): Promise<number> {
    try {
      const { store } = await this.transaction(table);
      return new Promise((resolve, reject) => {
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      log.error(`count(${table}) failed:`, err);
      return 0;
    }
  }
}
