/**
 * 成长快照 DAO（T01 / §3.4）。
 *
 * 严格仿照 lib/storage/dao/user-stats.ts 的范式，读写服务端轻量表 user_growth_snapshots
 * （每日一条，user_id + snapshot_date 唯一）。所有数值来自真实记录，禁止插值膨胀。
 */

import type { StorageProvider, StorageEntry } from '../storage-types';
import type { GrowthSnapshot } from '@/lib/retention/types';

const TABLE = 'user_growth_snapshots';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function snapKey(userId: string, date: string): string {
  return `${userId}_${date}`;
}

export function createGrowthSnapshotDAO(storage: StorageProvider) {
  return {
    /** 读取某日快照 */
    async get(userId: string, date?: string): Promise<GrowthSnapshot | null> {
      const d = date ?? todayStr();
      const result = await storage.get<GrowthSnapshot>(TABLE, snapKey(userId, d));
      return result?.data ?? null;
    },

    /** 读取该用户全部快照（按日期升序） */
    async getAll(userId: string): Promise<GrowthSnapshot[]> {
      const entries = await storage.getAll<GrowthSnapshot>(
        TABLE,
        (e: StorageEntry<GrowthSnapshot>) =>
          (e.data as GrowthSnapshot & { userId?: string }).userId === userId,
      );
      return entries
        .map((e) => e.data)
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    /** upsert 当日快照（幂等：同日覆盖） */
    async record(userId: string, snap: GrowthSnapshot): Promise<GrowthSnapshot> {
      const now = Date.now();
      await storage.set(TABLE, {
        id: snapKey(userId, snap.date),
        data: { ...snap, userId } as unknown as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      });
      return snap;
    },
  };
}
