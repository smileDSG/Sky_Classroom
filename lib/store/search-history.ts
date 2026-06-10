import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SearchInputType = 'image' | 'voice' | 'text';
export type SearchStatus = 'success' | 'failed' | 'abandoned';

export interface SearchRecord {
  id: string;
  type: SearchInputType;
  query: string;
  status: SearchStatus;
  timestamp: number;
  /** Error message if failed */
  error?: string;
  /** Whether this search resulted in a saved question bank entry */
  hasSolution?: boolean;
  /** Base64 or URL of the captured/preview image (for image type searches) */
  problemImage?: string;
}

interface SearchHistoryState {
  records: SearchRecord[];
  addRecord: (
    record: Omit<SearchRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: number },
  ) => void;
  updateRecord: (id: string, updates: Partial<SearchRecord>) => void;
  deleteRecord: (id: string) => void;
  deleteRecords: (ids: string[]) => void;
  clearRecords: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      records: [],
      addRecord: (record) =>
        set((state) => {
          const newRecord: SearchRecord = {
            id: record.id ?? `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: record.timestamp ?? Date.now(),
            type: record.type,
            query: record.query,
            status: record.status,
            error: record.error,
            hasSolution: record.hasSolution,
            problemImage: record.problemImage,
          };
          // Keep max 100 records, newest first
          const updated = [newRecord, ...state.records].slice(0, 100);
          return { records: updated };
        }),
      updateRecord: (id, updates) =>
        set((state) => ({
          records: state.records.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      deleteRecord: (id) =>
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        })),
      deleteRecords: (ids) =>
        set((state) => ({
          records: state.records.filter((r) => !ids.includes(r.id)),
        })),
      clearRecords: () => set({ records: [] }),
    }),
    {
      name: 'solve-search-history',
      version: 1,
    },
  ),
);
