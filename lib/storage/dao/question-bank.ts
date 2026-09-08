/**
 * Question Bank DAO (Data Access Object)
 *
 * CRUD operations for the question bank stored in the unified storage layer.
 * Supports fuzzy search by text similarity and filtering by knowledge point.
 */

import type { StorageProvider, StorageEntry } from '../storage-types';

/** A single question bank entry */
export interface QuestionBankEntry {
  /** Normalised text hash for deduplication */
  problemHash: string;
  /** Original problem text */
  problemText: string;
  /** Optional base64-encoded problem image */
  problemImage?: string;
  /** Correct answer */
  answer: string;
  /** Associated knowledge points */
  knowledgePoints: { name: string; description: string; difficulty: string }[];
  /** Similar questions */
  similarQuestions?: { problem: string; difficulty: number; knowledgePoint: string }[];
  /** Agent ID that solved this */
  agentId: string;
  /** Whether this has been verified by a teacher */
  verified: boolean;
  /** Similar problem IDs */
  similarIds?: string[];
}

const TABLE = 'question-bank';

export function createQuestionBankDAO(storage: StorageProvider) {
  return {
    /** Add or update a question */
    async upsert(entry: QuestionBankEntry): Promise<void> {
      const now = Date.now();
      const storageEntry: StorageEntry<QuestionBankEntry> = {
        id: entry.problemHash,
        data: entry,
        createdAt: now,
        updatedAt: now,
      };
      // Check if exists to preserve createdAt
      const existing = await storage.get<QuestionBankEntry>(TABLE, entry.problemHash);
      if (existing) {
        storageEntry.createdAt = existing.createdAt;
      }
      await storage.set(TABLE, storageEntry);
    },

    /** Get a question by hash */
    async getByHash(problemHash: string): Promise<QuestionBankEntry | null> {
      const result = await storage.get<QuestionBankEntry>(TABLE, problemHash);
      return result?.data ?? null;
    },

    /** Fuzzy search by problem text (simple substring match) */
    async search(query: string, limit = 10): Promise<QuestionBankEntry[]> {
      const all = await storage.getAll<QuestionBankEntry>(TABLE);
      const q = query.toLowerCase();
      const matches = all
        .filter((e) => e.data.problemText.toLowerCase().includes(q))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);
      return matches.map((e) => e.data);
    },

    /** Filter by knowledge point(s) */
    async findByKnowledgePoint(point: string, limit = 20): Promise<QuestionBankEntry[]> {
      const all = await storage.getAll<QuestionBankEntry>(TABLE);
      const matches = all
        .filter((e) =>
          e.data.knowledgePoints.some((kp) => kp.name.toLowerCase().includes(point.toLowerCase())),
        )
        .slice(0, limit);
      return matches.map((e) => e.data);
    },

    /** Get all questions with pagination */
    async list(page = 1, pageSize = 20): Promise<{ items: QuestionBankEntry[]; total: number }> {
      const all = await storage.getAll<QuestionBankEntry>(TABLE);
      const sorted = all.sort((a, b) => b.updatedAt - a.updatedAt);
      const start = (page - 1) * pageSize;
      return {
        items: sorted.slice(start, start + pageSize).map((e) => e.data),
        total: sorted.length,
      };
    },

    /** Delete a question by hash */
    async delete(problemHash: string): Promise<boolean> {
      return storage.delete(TABLE, problemHash);
    },

    /** Count total questions */
    async count(): Promise<number> {
      return storage.count(TABLE);
    },

    /** Check if a question already exists (for dedup) */
    async exists(problemHash: string): Promise<boolean> {
      return (await storage.get<QuestionBankEntry>(TABLE, problemHash)) !== null;
    },
  };
}
