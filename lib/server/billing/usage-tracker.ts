/**
 * Usage tracker — per-user daily usage counting and limit checking.
 */

import { getServerStorage } from '@/lib/server/server-storage';
import type { StorageProvider } from '@/lib/storage/storage-types';
import { getPlanLimits, type PlanType } from './plans';

const TABLE = 'user_usage';

export interface UsageEntry {
  id: string; // `${userId}_${date}`
  userId: string;
  date: string; // YYYY-MM-DD
  llmCalls: number;
  generationCount: number;
  storageUsed: number;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

let _provider: StorageProvider | null = null;

async function ensureProvider(): Promise<StorageProvider> {
  if (!_provider) {
    _provider = await getServerStorage();
  }
  return _provider;
}

export async function createUsageTracker(storage?: StorageProvider) {
  const s = storage ?? (await ensureProvider());

  async function getEntry(userId: string, date: string): Promise<UsageEntry> {
    const id = `${userId}_${date}`;
    const result = await s.get<UsageEntry>(TABLE, id);
    if (result?.data) return result.data as unknown as UsageEntry;
    return { id, userId, date, llmCalls: 0, generationCount: 0, storageUsed: 0 };
  }

  async function saveEntry(entry: UsageEntry): Promise<void> {
    await s.set(TABLE, {
      id: entry.id,
      data: entry as unknown as Record<string, unknown>,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return {
    /** Increment a usage counter */
    async increment(
      userId: string,
      planType: import('./plans').PlanType,
      metric: 'llmCalls' | 'generationCount' | 'storageUsed',
      count = 1,
    ): Promise<void> {
      const date = today();
      const entry = await getEntry(userId, date);
      if (metric === 'llmCalls') entry.llmCalls += count;
      else if (metric === 'generationCount') entry.generationCount += count;
      else entry.storageUsed += count;
      await saveEntry(entry);
    },

    /** Get current day's usage */
    async getDailyUsage(userId: string): Promise<UsageEntry> {
      return getEntry(userId, today());
    },

    /** Check if user is within their limits */
    async checkUsageLimit(
      userId: string,
      planType: PlanType,
      metric: 'llmCalls' | 'generationCount',
    ): Promise<{ withinLimit: boolean; current: number; limit: number }> {
      const limits = getPlanLimits(planType);
      const limit = metric === 'llmCalls' ? limits.llmCallsPerDay : limits.generationsPerDay;
      if (limit === 0) return { withinLimit: true, current: 0, limit: 0 }; // unlimited

      const usage = await getEntry(userId, today());
      const current = metric === 'llmCalls' ? usage.llmCalls : usage.generationCount;
      return { withinLimit: current < limit, current, limit };
    },

    /** Reset usage for a date (for testing or admin) */
    async resetUsage(userId: string, date?: string): Promise<void> {
      const d = date ?? today();
      const id = `${userId}_${d}`;
      await s.delete(TABLE, id);
    },
  };
}

export type UsageTracker = ReturnType<typeof createUsageTracker>;
