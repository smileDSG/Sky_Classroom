/**
 * Storage Module — Barrel Exports
 *
 * Two concerns are exported here:
 * 1. Media Storage (existing) — cloud file storage for generated media
 * 2. Unified Data Storage (new) — IndexedDB/localStorage/memory for app data
 */

// ── Media Storage (existing) ──
import { NoopStorageProvider } from './providers/noop';
import type { StorageProvider } from './types';

let _mediaProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_mediaProvider) {
    _mediaProvider = new NoopStorageProvider();
  }
  return _mediaProvider;
}

export type { StorageProvider, StorageType } from './types';

// ── Unified Data Storage (new) ──
export type {
  StorageEntry,
  StorageProvider as DataStorageProvider,
  StorageBackend,
  StorageConfig,
} from './storage-types';
export { DEFAULT_STORAGE_CONFIG } from './storage-types';

export { IndexedDBStorageProvider } from './indexeddb-provider';
export { LocalStorageProvider } from './local-storage-provider';
export { MemoryStorageProvider } from './memory-provider';
export {
  createStorageProvider,
  getStorageProvider as getDataStorageProvider,
} from './storage-factory';

// ── DAOs ──
export { createQuestionBankDAO, type QuestionBankEntry } from './dao/question-bank';
export { createMistakeBookDAO, type MistakeBookEntry } from './dao/mistakes';
export { createKnowledgeGraphDAO, type KnowledgeGraphEntry } from './dao/knowledge-graph';
export { createMigrationManager, type MigrationStep } from './migration';
