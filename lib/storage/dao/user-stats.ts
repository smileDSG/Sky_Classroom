/**
 * User Stats DAO
 *
 * Stores daily learning statistics per user.
 * Key: {userId}_{date} in the unified storage_entries table.
 */

import type { StorageProvider, StorageEntry } from '../storage-types';

export interface UserStatsEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  studySeconds: number; // Real study time in seconds
  checkinStreak: number; // Consecutive check-in days
  peakStreak: number; // Longest consecutive streak (retained across breaks)
  masteryScore: number; // Comprehensive mastery score (0-100)
  problemsAttempted: number;
  problemsCorrect: number;
  scenesCompleted: number;
  lastActiveAt: number; // Timestamp of last activity
}

const TABLE = 'user_stats';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function statsKey(userId: string, date: string): string {
  return `${userId}_${date}`;
}

export function createUserStatsDAO(storage: StorageProvider) {
  return {
    /** Get stats for a user on a specific date */
    async get(userId: string, date?: string): Promise<UserStatsEntry | null> {
      const d = date ?? todayStr();
      const result = await storage.get<UserStatsEntry>(TABLE, statsKey(userId, d));
      return result?.data ?? null;
    },

    /** Get or create default stats for today */
    async getOrCreate(userId: string, date?: string): Promise<UserStatsEntry> {
      const existing = await this.get(userId, date);
      if (existing) return existing;
      const d = date ?? todayStr();
      return {
        userId,
        date: d,
        studySeconds: 0,
        checkinStreak: 0,
        peakStreak: 0,
        masteryScore: 0,
        problemsAttempted: 0,
        problemsCorrect: 0,
        scenesCompleted: 0,
        lastActiveAt: Date.now(),
      };
    },

    /** Update stats for today (merge patch into existing) */
    async update(
      userId: string,
      patch: Partial<Omit<UserStatsEntry, 'userId' | 'date'>>,
      date?: string,
    ): Promise<UserStatsEntry> {
      const d = date ?? todayStr();
      const existing = await this.getOrCreate(userId, d);
      const updated: UserStatsEntry = {
        ...existing,
        ...patch,
        lastActiveAt: Date.now(),
      };
      const now = Date.now();
      await storage.set(TABLE, {
        id: statsKey(userId, d),
        data: updated as unknown as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      });
      return updated;
    },

    /** Add study seconds (incremental) */
    async addStudySeconds(userId: string, seconds: number, date?: string): Promise<UserStatsEntry> {
      const d = date ?? todayStr();
      const existing = await this.getOrCreate(userId, d);
      return this.update(
        userId,
        {
          studySeconds: existing.studySeconds + seconds,
        },
        d,
      );
    },

    /** Increment problem counters */
    async recordProblem(userId: string, correct: boolean, date?: string): Promise<UserStatsEntry> {
      const d = date ?? todayStr();
      const existing = await this.getOrCreate(userId, d);
      return this.update(
        userId,
        {
          problemsAttempted: existing.problemsAttempted + 1,
          problemsCorrect: existing.problemsCorrect + (correct ? 1 : 0),
        },
        d,
      );
    },

    /** Increment scenes completed */
    async recordSceneCompletion(userId: string, date?: string): Promise<UserStatsEntry> {
      const d = date ?? todayStr();
      const existing = await this.getOrCreate(userId, d);
      return this.update(
        userId,
        {
          scenesCompleted: existing.scenesCompleted + 1,
        },
        d,
      );
    },

    /** Set check-in streak */
    async setStreak(userId: string, streak: number, date?: string): Promise<UserStatsEntry> {
      return this.update(userId, { checkinStreak: streak }, date);
    },

    /** Set mastery score */
    async setMasteryScore(userId: string, score: number, date?: string): Promise<UserStatsEntry> {
      return this.update(userId, { masteryScore: score }, date);
    },
  };
}
