export class StorageEntryAlreadyExistsError extends Error {
  readonly code = 'STORAGE_ENTRY_ALREADY_EXISTS';
  readonly table: string;
  readonly entryId: string;

  constructor(table: string, entryId: string, options?: { cause?: unknown }) {
    super(`Storage entry already exists: ${table}/${entryId}`, options);
    this.name = 'StorageEntryAlreadyExistsError';
    this.table = table;
    this.entryId = entryId;
  }
}

export class StorageAtomicInsertUnavailableError extends Error {
  readonly code = 'STORAGE_ATOMIC_INSERT_UNAVAILABLE';
  readonly backend: string;

  constructor(backend: string) {
    super(`Atomic insert is unavailable for storage backend: ${backend}`);
    this.name = 'StorageAtomicInsertUnavailableError';
    this.backend = backend;
  }
}
