/**
 * Unified Storage Interfaces
 *
 * Abstracts over IndexedDB, localStorage, and in-memory fallback
 * so that DAO layers and Sky Classroom modules don't depend on
 * a specific storage implementation.
 */

/** Generic storage entry with metadata */
export interface StorageEntry<T = unknown> {
  id: string;
  data: T;
  createdAt: number;
  updatedAt: number;
}

/** Unified storage provider interface */
export interface StorageProvider {
  /** Create a new entry. Must reject when the table/id already exists. */
  insert<T>(table: string, entry: StorageEntry<T>): Promise<void>;

  /** Save an entry (upsert) */
  set<T>(table: string, entry: StorageEntry<T>): Promise<void>;

  /** Get an entry by id */
  get<T>(table: string, id: string): Promise<StorageEntry<T> | null>;

  /** Get all entries from a table, optionally filtered */
  getAll<T>(table: string, filter?: (entry: StorageEntry<T>) => boolean): Promise<StorageEntry<T>[]>;

  /** Delete an entry by id. Returns true if found and deleted. */
  delete(table: string, id: string): Promise<boolean>;

  /** Delete all entries from a table */
  clear(table: string): Promise<void>;

  /** Count entries in a table */
  count(table: string): Promise<number>;

  /** Check if the storage backend is available */
  isAvailable(): Promise<boolean>;
}

/**
 * Storage backend type identifiers
 */
export type StorageBackend = 'indexeddb' | 'localstorage' | 'memory';

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Preferred backend. Falls back automatically if unavailable. */
  preferredBackend?: StorageBackend;
  /** Database name (for IndexedDB) */
  databaseName?: string;
  /** Database version (for IndexedDB) */
  databaseVersion?: number;
}

/** Default configuration */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  preferredBackend: 'indexeddb',
  databaseName: 'sky-classroom-storage',
  databaseVersion: 1,
};
