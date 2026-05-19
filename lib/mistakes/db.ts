/**
 * Sky Classroom — IndexedDB wrapper for the mistakes store.
 *
 * Database: 'sky-classroom'
 * Object store: 'mistakes' (keyPath: 'id')
 */

import type { MistakeRecord } from './types';

const DB_NAME = 'sky-classroom';
const STORE_NAME = 'mistakes';
const DB_VERSION = 1;

/**
 * Open (or create/upgrade) the IndexedDB database and return the handle.
 */
export function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' as keyof MistakeRecord });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject(
        new Error(
          `Failed to open IndexedDB: ${(event.target as IDBOpenDBRequest).error?.message}`,
        ),
      );
    };
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          `IndexedDB request failed: ${request.error?.message}`,
        ),
      );
  });
}

function txn(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

/**
 * Insert a single mistake record.
 * Throws if a record with the same id already exists.
 */
export async function addMistake(record: MistakeRecord): Promise<void> {
  const db = await getDB();
  await promisify(txn(db, 'readwrite').add(record));
}

/**
 * Retrieve all mistake records from the store.
 */
export async function getAllMistakes(): Promise<MistakeRecord[]> {
  const db = await getDB();
  return promisify(txn(db, 'readonly').getAll());
}

/**
 * Partially update a mistake record by id.
 */
export async function updateMistake(
  id: string,
  changes: Partial<MistakeRecord>,
): Promise<void> {
  const db = await getDB();
  const store = txn(db, 'readwrite');
  const existing = await promisify(store.get(id));
  if (!existing) {
    throw new Error(`Mistake record not found: ${id}`);
  }
  const updated = { ...existing, ...changes };
  await promisify(store.put(updated));
}

/**
 * Delete a single mistake record by id.
 */
export async function deleteMistake(id: string): Promise<void> {
  const db = await getDB();
  await promisify(txn(db, 'readwrite').delete(id));
}

/**
 * Remove all mistake records from the store.
 */
export async function clearAll(): Promise<void> {
  const db = await getDB();
  await promisify(txn(db, 'readwrite').clear());
}
