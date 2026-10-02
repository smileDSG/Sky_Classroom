/**
 * 成长可见数据服务（T01 / FR-01/02）。
 *
 * 每日真实快照：掌握度% / 错题总数 / 已攻克数 / 薄弱点数，全部来自知识图谱与错题本，
 * 禁止插值膨胀、禁止奖励数值（R-2）。服务端经 user_growth_snapshots 表持久化（每日一条），
 * 客户端读取失败时回退到本地缓存（store.growthLocalCache）。
 */

import type { StorageProvider } from '@/lib/storage/storage-types';
import { createGrowthSnapshotDAO } from '@/lib/storage/dao/growth-snapshots';
import { buildKnowledgeGraph, getMasterySummary } from '@/lib/knowledge-graph';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import { getServerStorage } from '@/lib/server/server-storage';
import { createLogger } from '@/lib/logger';
import { toLocalDateStr } from './date';
import type { GrowthSnapshot, MistakeTrendPoint } from './types';

const log = createLogger('Retention:Growth');

/**
 * 快照计算所需的最小错题形状（兼容 MistakeBookEntry 与 MistakeRecord）。
 * buildKnowledgeGraph 只需 id / knowledgePoints / reviewCount / reviewed / lastReview。
 */
type SnapshotMistake = {
  id: string;
  knowledgePoints: string[];
  reviewCount?: number;
  reviewed?: boolean;
  lastReview?: number;
};

export class GrowthHistoryService {
  constructor(private readonly storage: StorageProvider) {}

  /** 记录当日快照（真实值，无插值）。同日覆盖。 */
  async recordSnapshot(userId: string, snap: GrowthSnapshot): Promise<void> {
    const dao = createGrowthSnapshotDAO(this.storage);
    await dao.record(userId, snap);
  }

  /** 掌握度曲线：按日期升序的真实快照序列。 */
  async getMasteryCurve(userId: string): Promise<GrowthSnapshot[]> {
    const dao = createGrowthSnapshotDAO(this.storage);
    return dao.getAll(userId);
  }

  /** 错题减少趋势：每点 = (date, 当日错题总数, 已攻克数)。 */
  async getMistakeTrend(userId: string): Promise<MistakeTrendPoint[]> {
    const curve = await this.getMasteryCurve(userId);
    return curve.map((s) => ({ date: s.date, total: s.mistakeTotal, resolved: s.reviewedCount }));
  }
}

/** 服务端实例。 */
export async function getServerGrowthHistory(): Promise<GrowthHistoryService> {
  const storage = await getServerStorage();
  return new GrowthHistoryService(storage);
}

/**
 * 从用户的真实错题记录派生当日快照（无插值）。
 * 服务端调用：复用 buildKnowledgeGraph + getMasterySummary。
 */
export async function computeSnapshotFromMistakes(
  userId: string,
  storage: StorageProvider,
): Promise<GrowthSnapshot> {
  const entries = await storage.getAll<MistakeBookEntry>(
    'mistakes',
    (e) => e.data.userId === userId,
  );
  const mistakes = entries.map((e) => e.data);
  return buildSnapshotFromMistakes(mistakes);
}

/** 纯函数版：给定错题数组计算快照（客户端也可复用，保证口径一致）。 */
export function buildSnapshotFromMistakes(
  mistakes: SnapshotMistake[],
  date: string = toLocalDateStr(),
): GrowthSnapshot {
  const graph = mistakes.length > 0 ? buildKnowledgeGraph(mistakes) : null;
  const summary = graph ? getMasterySummary(graph) : null;
  return {
    date,
    masteryPercent: summary?.overallMastery ?? 0,
    mistakeTotal: mistakes.length,
    reviewedCount: mistakes.filter((m) => m.reviewed).length,
    weakCount: summary?.weakCount ?? graph?.weakPoints.length ?? 0,
  };
}

// ── 客户端辅助已移至 ./growth-client.ts ──
// 原因：本文件 import 了 server-storage（→ mysql2 → 'tls'），
// 客户端组件引用本文件会把服务端依赖拖进浏览器 bundle。客户端请从 growth-client.ts 导入。
