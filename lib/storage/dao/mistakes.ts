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
  /** Authenticated owner */
  userId: string;
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
  /** Source category of the mistake entry */
  source?: 'classroom-quiz' | 'solve' | 'manual' | 'review' | 'classroom-diagnostic';
  /** Step-by-step solution process (AI-generated) */
  solutionSteps?: string[];
  /** Tiered hints: [思路方向, 关键公式, 详细计算] */
  hints?: string[];
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
    async add(
      userId: string,
      entry: Omit<MistakeBookEntry, 'userId' | 'reviewCount' | 'masteryLevel' | 'reviewed'>,
    ): Promise<void> {
      if (!userId) throw new Error('Authenticated userId is required');
      const now = Date.now();
      const storageEntry: StorageEntry<MistakeBookEntry> = {
        id: entry.id,
        data: {
          ...entry,
          userId,
          reviewCount: 0,
          masteryLevel: 0,
          reviewed: false,
        },
        createdAt: now,
        updatedAt: now,
      };
      await storage.insert(TABLE, storageEntry);
    },

    /** Get a mistake by ID */
    async get(userId: string, id: string): Promise<MistakeBookEntry | null> {
      if (!userId) throw new Error('Authenticated userId is required');
      const result = await storage.get<MistakeBookEntry>(TABLE, id);
      return result?.data.userId === userId ? result.data : null;
    },

    /** Update a mistake */
    async update(
      userId: string,
      id: string,
      patch: Partial<Omit<MistakeBookEntry, 'id' | 'userId'>>,
    ): Promise<boolean> {
      if (!userId) throw new Error('Authenticated userId is required');
      const existing = await storage.get<MistakeBookEntry>(TABLE, id);
      if (!existing || existing.data.userId !== userId) return false;
      // Defensive: never allow id / userId to be overwritten at runtime,
      // even if a caller bypasses the TypeScript-omitted type.
      const { id: _id, userId: _userId, ...safePatch } = patch as Record<string, unknown>;
      existing.data = { ...existing.data, ...safePatch } as MistakeBookEntry;
      existing.updatedAt = Date.now();
      await storage.set(TABLE, existing);
      return true;
    },

    /** Reset review progress after a wrong answer */
    async resetReview(userId: string, id: string): Promise<boolean> {
      if (!userId) throw new Error('Authenticated userId is required');
      const existing = await storage.get<MistakeBookEntry>(TABLE, id);
      if (!existing || existing.data.userId !== userId) return false;

      existing.data.reviewCount = 0;
      existing.data.masteryLevel = 0;
      existing.data.lastReview = Date.now();
      existing.data.nextReview = Date.now() + EBBINGHAUS_INTERVALS[0] * 24 * 60 * 60 * 1000;
      existing.data.reviewed = false;
      existing.updatedAt = Date.now();

      await storage.set(TABLE, existing);
      return true;
    },

    /** Record a successful review (Ebbinghaus schedule) */
    async recordReview(userId: string, id: string): Promise<boolean> {
      if (!userId) throw new Error('Authenticated userId is required');
      const existing = await storage.get<MistakeBookEntry>(TABLE, id);
      if (!existing || existing.data.userId !== userId) return false;

      existing.data.reviewCount += 1;
      existing.data.lastReview = Date.now();
      const { nextReview, masteryLevel } = calcNextReview(existing.data);
      existing.data.nextReview = nextReview;
      existing.data.masteryLevel = masteryLevel;
      existing.data.reviewed = masteryLevel >= EBBINGHAUS_INTERVALS.length;
      existing.updatedAt = Date.now();

      await storage.set(TABLE, existing);
      return true;
    },

    /** Delete a mistake */
    async delete(userId: string, id: string): Promise<boolean> {
      if (!userId) throw new Error('Authenticated userId is required');
      const existing = await storage.get<MistakeBookEntry>(TABLE, id);
      if (!existing || existing.data.userId !== userId) return false;
      return storage.delete(TABLE, id);
    },

    /** List mistakes with optional filtering */
    async list(userId: string, opts?: {
      errorType?: ErrorType;
      reviewed?: boolean;
      masteryBelow?: number;
      page?: number;
      pageSize?: number;
    }): Promise<{ items: MistakeBookEntry[]; total: number }> {
      if (!userId) throw new Error('Authenticated userId is required');
      const all = await storage.getAll<MistakeBookEntry>(TABLE);
      let filtered = all.filter((entry) => entry.data.userId === userId);

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
        items: sorted.slice(start, start + pageSize).map((e) => e.data),
        total: sorted.length,
      };
    },

    /** Get mistakes due for review (Ebbinghaus) */
    async getDueForReview(userId: string): Promise<MistakeBookEntry[]> {
      if (!userId) throw new Error('Authenticated userId is required');
      const all = await storage.getAll<MistakeBookEntry>(TABLE);
      const now = Date.now();
      return all
        .filter((e) => {
          const d = e.data;
          return (
            d.userId === userId &&
            !d.reviewed &&
            d.nextReview !== undefined &&
            d.nextReview <= now
          );
        })
        .sort((a, b) => (a.data.nextReview ?? 0) - (b.data.nextReview ?? 0))
        .map((e) => e.data);
    },

    /** Get mistakes by knowledge point */
    async findByKnowledgePoint(userId: string, point: string): Promise<MistakeBookEntry[]> {
      if (!userId) throw new Error('Authenticated userId is required');
      const all = await storage.getAll<MistakeBookEntry>(TABLE);
      return all
        .filter((e) =>
          e.data.userId === userId &&
          e.data.knowledgePoints.some((kp) => kp.toLowerCase().includes(point.toLowerCase())),
        )
        .map((e) => e.data);
    },

    /** Count total mistakes */
    async count(
      userId: string,
      opts?: { errorType?: ErrorType; reviewed?: boolean },
    ): Promise<number> {
      if (!userId) throw new Error('Authenticated userId is required');
      const all = await storage.getAll<MistakeBookEntry>(TABLE);
      let filtered = all.filter((entry) => entry.data.userId === userId);
      if (opts?.errorType !== undefined) {
        filtered = filtered.filter((e) => e.data.errorType === opts.errorType);
      }
      if (opts?.reviewed !== undefined) {
        filtered = filtered.filter((e) => e.data.reviewed === opts.reviewed);
      }
      return filtered.length;
    },

    /** Get error type distribution */
    async getErrorTypeDistribution(userId: string): Promise<Record<ErrorType, number>> {
      if (!userId) throw new Error('Authenticated userId is required');
      const all = await storage.getAll<MistakeBookEntry>(TABLE);
      const dist: Record<string, number> = {};
      for (const e of all) {
        if (e.data.userId !== userId) continue;
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
