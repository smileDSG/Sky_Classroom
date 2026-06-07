/**
 * Sky Classroom — Storage wrapper for the mistakes store.
 *
 * Uses browser IndexedDB when available; falls back to in-memory Map on the server.
 */

import type { MistakeRecord } from './types';

// ── In-memory fallback (server-side) ─────────────────────────────────

const memStore = new Map<string, MistakeRecord>();

function isBrowser() {
  return typeof indexedDB !== 'undefined';
}

// ── Browser IndexedDB path ──────────────────────────────────────────

const DB_NAME = 'sky-classroom';
const STORE_NAME = 'mistakes';
const DB_VERSION = 1;

function getIDB(): Promise<IDBDatabase> {
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
      reject(new Error(`IndexedDB request failed: ${request.error?.message}`));
  });
}

function txn(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

// ── Public API ──────────────────────────────────────────────────────

export function getDB() {
  // Re-exported for backward compat; internal callers should use the
  // functions below instead.
  if (!isBrowser()) throw new Error('getDB() is only available in browser');
  return getIDB();
}

export async function addMistake(record: MistakeRecord): Promise<void> {
  if (isBrowser()) {
    const db = await getIDB();
    await promisify(txn(db, 'readwrite').add(record));
  } else {
    if (memStore.has(record.id)) {
      throw new Error(`Mistake record already exists: ${record.id}`);
    }
    memStore.set(record.id, record);
  }
}

export async function getAllMistakes(): Promise<MistakeRecord[]> {
  if (isBrowser()) {
    const db = await getIDB();
    return promisify(txn(db, 'readonly').getAll());
  }
  return Array.from(memStore.values());
}

export async function updateMistake(
  id: string,
  changes: Partial<MistakeRecord>,
): Promise<void> {
  if (isBrowser()) {
    const db = await getIDB();
    const store = txn(db, 'readwrite');
    const existing = await promisify(store.get(id));
    if (!existing) throw new Error(`Mistake record not found: ${id}`);
    await promisify(store.put({ ...existing, ...changes }));
  } else {
    const existing = memStore.get(id);
    if (!existing) throw new Error(`Mistake record not found: ${id}`);
    memStore.set(id, { ...existing, ...changes });
  }
}

export async function deleteMistake(id: string): Promise<void> {
  if (isBrowser()) {
    const db = await getIDB();
    await promisify(txn(db, 'readwrite').delete(id));
  } else {
    memStore.delete(id);
  }
}

export async function clearAll(): Promise<void> {
  if (isBrowser()) {
    const db = await getIDB();
    await promisify(txn(db, 'readwrite').clear());
  } else {
    memStore.clear();
  }
}
