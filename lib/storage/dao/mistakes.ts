/**
 * Mistake Book DAO (Data Access Object)
 *
 * CRUD operations for the mistake book stored in the unified storage layer.
 * Supports filtering by error type, review tracking, and Ebbinghaus scheduling.
 */

import type { StorageProvider, StorageEntry } from '../storage-types';

/** Error type classification */
export type ErrorType =
  | 'calculation'     // Arithmetic / algebraic mistake
  | 'concept'         // Misunderstood concept
  | 'reasoning'       // Logical reasoning error
  | 'reading'         // Misread the question
  | 'careless';       // Simple oversight

/** Ebbinghaus review intervals (in days) */
export const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30];

/** A single mistake entry */
export interface MistakeBookEntry {
  /** Unique identifier */
  id: string;
  /** Problem text */
  problemText: string;
  /** Optional problem image (base64) */
  problemImage?: string;
  /** User's answer */
  userAnswer: string;
  /** Correct answer */
  correctAnswer: string;
  /** Error type classification */
  errorType: ErrorType;
  /** Explanation of why the user's answer was wrong */
  errorExplanation?: string;
  /** Associated knowledge points */
  knowledgePoints: string[];
  /** Number of times reviewed */
  reviewCount: number;
  /** Last review timestamp */
  lastReview?: number;
  /** Next scheduled review timestamp */
  nextReview?: number;
  /** Mastery level (0 = not mastered, 6 = fully mastered = completed all intervals) */
  masteryLevel: number;
  /** Whether this mistake has been marked as reviewed/solved */
  reviewed: boolean;
  /** Source: which solve session this came from */
  sourceSessionId?: string;
}

const TABLE = 'mistakes';

/** Calculate next review date based on Ebbinghaus intervals */
function calcNextReview(entry: MistakeBookEntry): { nextReview: number; masteryLevel: number } {
  const intervalIndex = Math.min(entry.reviewCount, EBBINGHAUS_INTERVALS.length - 1);
  const daysUntilReview = EBBINGHAUS_INTERVALS[intervalIndex];
  const nextReview = Date.now() + daysUntilReview * 24 * 60 * 60 * 1000;
  const masteryLevel = entry.reviewCount >= EBBINGHAUS_INTERVALS.length ? EBBINGHAUS_INTERVALS.length : entry.reviewCount;
  return { nextReview, masteryLevel };
}

export function createMistakeBookDAO(storage: StorageProvider) {
  return {
    /** Add a new mistake (auto-generated from grading results) */
    async add(entry: Omit<MistakeBookEntry, 'reviewCount' | 'masteryLevel' | 'reviewed'>): Promise<void> {
      const now = Date.now();
      const storageEntry: StorageEntry<MistakeBookEntry> = {
        id: entry.id,
        data: {
          ...entry,
          reviewCount: 0,
          masteryLevel: 0,
          reviewed: false,
        },
        createdAt: now,
        updatedAt: now,
      };
      await storage.set(TABLE, storageEntry);
    },

    /** Get a mistake by ID */
    async get(id: string): Promise<MistakeBookEntry | null> {
      const result = await storage.get<MistakeBookEntry>(TABLE, id);
      return result ? { ...result.data, id: result.id } : null;
    },

    /** Update a mistake */
    async update(id: string, patch: Partial<MistakeBookEntry>): Promise<void> {
      const existing = await storage.get<MistakeBookEntry>(TABLE, id);
      if (!existing) throw new Error(`Mistake ${id} not found`);
      existing.data = { ...existing.data, ...patch };
      existing.updatedAt = Date.now();
      await storage.set(TABLE, existing);
    },

    /** Record a successful review (Ebbinghaus schedule) */
    async recordReview(id: string): Promise<void> {
      const existing = await storage.get<MistakeBookEntry>(TABLE, id);
      if (!existing) throw new Error(`Mistake ${id} not found`);

      existing.data.reviewCount += 1;
      existing.data.lastReview = Date.now();
      const { nextReview, masteryLevel } = calcNextReview(existing.data);
      existing.data.nextReview = nextReview;
      existing.data.masteryLevel = masteryLevel;
      existing.data.reviewed = masteryLevel >= EBBINGHAUS_INTERVALS.length;
      existing.updatedAt = Date.now();

      await storage.set(TABLE, existing);
    },

    /** Reset review progress after a wrong answer */
    async resetReview(id: string): Promise<void> {
      const existing = await storage.get<MistakeBookEntry>(TABLE, id);
      if (!existing) throw new Error(`Mistake ${id} not found`);

      existing.data.reviewCount = 0;
      existing.data.masteryLevel = 0;
      existing.data.lastReview = Date.now();
      existing.data.nextReview = Date.now() + EBBINGHAUS_INTERVALS[0] * 24 * 60 * 60 * 1000;
      existing.data.reviewed = false;
      existing.updatedAt = Date.now();

      await storage.set(TABLE, existing);
    },

    /** Delete a mistake */
    async delete(id: string): Promise<boolean> {
      return storage.delete(TABLE, id);
    },

    /** List mistakes with optional filtering */
    async list(opts?: {
      errorType?: ErrorType;
      reviewed?: boolean;
      masteryBelow?: number;
      page?: number;
      pageSize?: number;
    }): Promise<{ items: MistakeBookEntry[]; total: number }> {
      const all = await storage.getAll<MistakeBookEntry>(TABLE);
      let filtered = all;

      if (opts?.errorType !== undefined) {
        filtered = filtered.filter((e) => e.data.errorType === opts.errorType);
      }
      if (opts?.reviewed !== undefined) {
        filtered = filtered.filter((e) => e.data.reviewed === opts.reviewed);
      }
      if (opts?.masteryBelow !== undefined) {
        filtered = filtered.filter((e) => e.data.masteryLevel < opts.masteryBelow!);
      }

      const sorted = filtered.sort((a, b) => b.updatedAt - a.updatedAt);
      const page = opts?.page ?? 1;
      const pageSize = opts?.pageSize ?? 20;
      const start = (page - 1) * pageSize;

      return {
        items: sorted.slice(start, start + pageSize).map((e) => ({ ...e.data, id: e.id })),
        total: sorted.length,
      };
    },

    /** Get mistakes due for review (Ebbinghaus) */
    async getDueForReview(): Promise<MistakeBookEntry[]> {
      const all = await storage.getAll<MistakeBookEntry>(TABLE);
      const now = Date.now();
      return all
        .filter((e) => {
          const d = e.data;
          return !d.reviewed && d.nextReview !== undefined && d.nextReview <= now;
        })
        .sort((a, b) => (a.data.nextReview ?? 0) - (b.data.nextReview ?? 0))
        .map((e) => ({ ...e.data, id: e.id }));
    },

    /** Get mistakes by knowledge point */
    async findByKnowledgePoint(point: string): Promise<MistakeBookEntry[]> {
      const all = await storage.getAll<MistakeBookEntry>(TABLE);
      return all
        .filter((e) =>
          e.data.knowledgePoints.some(
            (kp) => kp.toLowerCase().includes(point.toLowerCase()),
          ),
        )
        .map((e) => ({ ...e.data, id: e.id }));
    },

    /** Count total mistakes */
    async count(opts?: { errorType?: ErrorType; reviewed?: boolean }): Promise<number> {
      const all = await storage.getAll<MistakeBookEntry>(TABLE);
      let filtered = all;
      if (opts?.errorType !== undefined) {
        filtered = filtered.filter((e) => e.data.errorType === opts.errorType);
      }
      if (opts?.reviewed !== undefined) {
        filtered = filtered.filter((e) => e.data.reviewed === opts.reviewed);
      }
      return filtered.length;
    },

    /** Get error type distribution */
    async getErrorTypeDistribution(): Promise<Record<ErrorType, number>> {
      const all = await storage.getAll<MistakeBookEntry>(TABLE);
      const dist: Record<string, number> = {};
      for (const e of all) {
        dist[e.data.errorType] = (dist[e.data.errorType] ?? 0) + 1;
      }
      const types: ErrorType[] = ['calculation', 'concept', 'reasoning', 'reading', 'careless'];
      const result = {} as Record<ErrorType, number>;
      for (const t of types) {
        result[t] = dist[t] ?? 0;
      }
      return result;
    },
  };
}
