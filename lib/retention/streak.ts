/**
 * 连续学习天数服务（T01 / FR-03）。
 *
 * 复用现有 user_checkins 表（幂等 upsert 当日打卡）+ user_stats.checkinStreak（及新增 peak_streak），
 * 仅改变触发语义：当日完成 ≥1 个知识点的有效学习（做题 / 完成小节）即计"活跃"，
 * 不以纯停留时长判定（Q1）。提供状态机：同日幂等、中断保留峰值、温柔回归。
 *
 * 服务端使用：通过 getServerStreakService() 取得实例（注入 StorageProvider）。
 * 客户端通过 recordLearningStreakClient() / fetchStreakStateClient() 经 API 触发与读取。
 */

import type { StorageProvider, StorageEntry } from '@/lib/storage/storage-types';
import { createUserStatsDAO } from '@/lib/storage/dao/user-stats';
import { getServerStorage } from '@/lib/server/server-storage';
import { createLogger } from '@/lib/logger';
import { toLocalDateStr, getYesterdayLocal, diffLocalDays } from './date';
import type { StreakState, StreakStatus } from './types';

const log = createLogger('Retention:Streak');

const CHECKIN_TABLE = 'user_checkins';

interface CheckInRow {
  userId: string;
  date: string; // YYYY-MM-DD（本地）
  timestamp: number;
}

function deriveStatus(current: number, peak: number): StreakStatus {
  if (current <= 0) return 'inactive';
  // 达到个人里程碑（≥7 天且正好是峰值）→ 中性回顾，非奖励
  if (current >= 7 && current === peak) return 'peak';
  return 'active';
}

export class LearningStreakService {
  constructor(private readonly storage: StorageProvider) {}

  /**
   * 当日有效学习触发：幂等记录当日 checkin，并重算连续天数与峰值。
   * 同日多次调用只写一次（先查后写）。
   */
  async recordActivity(userId: string, date?: string): Promise<StreakState> {
    const todayStr = date ?? toLocalDateStr();
    const id = `${userId}_${todayStr}`;
    const existing = await this.storage.get<CheckInRow>(CHECKIN_TABLE, id);
    if (existing?.data) {
      // 同日幂等：已记录，直接返回当前状态，不再重复写库
      return this.getStreak(userId, todayStr);
    }

    await this.storage.set(CHECKIN_TABLE, {
      id,
      data: {
        userId,
        date: todayStr,
        timestamp: Date.now(),
      } as unknown as Record<string, unknown>,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return this.computeAndPersist(userId, todayStr);
  }

  /** 读取当前连续天数状态（峰值取跨天历史最大值，实时推算，不依赖单日分键记录）。 */
  async getStreak(userId: string, date?: string): Promise<StreakState> {
    const todayStr = date ?? toLocalDateStr();
    const current = await this.countConsecutive(userId, todayStr);
    const peak = Math.max(await this.computePeakStreak(userId, todayStr), current);
    const lastActive = await this.lastActiveDate(userId, todayStr);
    return {
      currentStreak: current,
      peakStreak: peak,
      lastActiveDate: lastActive,
      status: deriveStatus(current, peak),
    };
  }

  /**
   * 每日定时评估（或在进入 App 时调用）：
   * 今日与昨日都未活跃 → 视为中断（保留峰值），状态置 broken；
   * 连续中断达到阈值 → at-risk（召回钩子读取后决定是否自动静默，属 T05）。
   */
  async evaluateDaily(userId: string, date?: string): Promise<StreakState> {
    const todayStr = date ?? toLocalDateStr();
    const yesterday = getYesterdayLocal(todayStr);
    const todayEntry = await this.storage.get<CheckInRow>(CHECKIN_TABLE, `${userId}_${todayStr}`);
    const yesterdayEntry = await this.storage.get<CheckInRow>(
      CHECKIN_TABLE,
      `${userId}_${yesterday}`,
    );

    const state = await this.getStreak(userId, todayStr);

    if (!todayEntry?.data && !yesterdayEntry?.data) {
      // 连续中断：当前连续自然为 0（countConsecutive 找不到当日/昨日记录），
      // 峰值由 computePeakStreak 从历史活跃日期保留，无需额外写库。
      const broken = await this.getStreak(userId, todayStr);
      return { ...broken, status: 'broken' };
    }

    // 仅昨日未活跃、今日已活跃 → 仍 active（刚回归）
    if (!yesterdayEntry?.data && todayEntry?.data) {
      return state;
    }
    return state;
  }

  // ── 内部：活跃日期与峰值 ──

  /** 取出该用户全部活跃日期（升序 YYYY-MM-DD）。user_checkins 是唯一真相源。 */
  private async activeDates(userId: string): Promise<string[]> {
    const all = await this.storage.getAll<CheckInRow>(
      CHECKIN_TABLE,
      (e) => e.data?.userId === userId,
    );
    return all
      .map((e: StorageEntry<CheckInRow>) => e.data?.date)
      .filter((d): d is string => typeof d === 'string' && d.length > 0)
      .sort();
  }

  /**
   * 峰值 = 历史最长连续段。
   * 说明：user_stats 按「用户_日期」分键存单日记录，把跨天的峰值写进当天那条
   * 会在换天后读不到，因此峰值一律从 user_checkins 的活跃日期实时推算。
   */
  private async computePeakStreak(userId: string, todayStr: string): Promise<number> {
    const dates = await this.activeDates(userId);
    let peak = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of dates) {
      // 未来日期不计入
      if (d > todayStr) continue;
      run = prev !== null && diffLocalDays(prev, d) === 1 ? run + 1 : 1;
      if (run > peak) peak = run;
      prev = d;
    }
    return peak;
  }

  private async countConsecutive(userId: string, fromDate: string): Promise<number> {
    let streak = 0;
    let cursor = fromDate;
    for (;;) {
      const entry = await this.storage.get<CheckInRow>(CHECKIN_TABLE, `${userId}_${cursor}`);
      if (entry?.data) {
        streak += 1;
        cursor = getYesterdayLocal(cursor);
      } else if (cursor === fromDate) {
        // 今日还没学习，从昨天接着数
        cursor = getYesterdayLocal(cursor);
      } else {
        break;
      }
    }
    return streak;
  }

  private async lastActiveDate(userId: string, todayStr: string): Promise<string> {
    // ⚠️ 不能用 `countConsecutive(...) > 0` 来判断"今天是否已学"：
    // countConsecutive 在今天没有记录时会回退到昨天继续往前数, 于是只要昨天(或更早)
    // 学过就返回 > 0, 导致本函数错误地返回"今天"。
    // 后果: 召回钩子永远判定"今天已经学过了" → 召回永不触发(FR-12 形同虚设)。
    // 正确做法: 今天是否活跃, 只看今天这一条记录在不在。
    const todayEntry = await this.storage.get<CheckInRow>(CHECKIN_TABLE, `${userId}_${todayStr}`);
    if (todayEntry?.data) return todayStr;
    const dates = await this.activeDates(userId);
    for (let i = dates.length - 1; i >= 0; i -= 1) {
      if (dates[i] < todayStr) return dates[i];
    }
    return '';
  }

  private async computeAndPersist(userId: string, todayStr: string): Promise<StreakState> {
    const current = await this.countConsecutive(userId, todayStr);
    // 峰值实时推算（跨天可靠），同时写回当天记录做缓存/展示用。
    const peak = Math.max(await this.computePeakStreak(userId, todayStr), current);
    const statsDAO = createUserStatsDAO(this.storage);
    await statsDAO.update(userId, { checkinStreak: current, peakStreak: peak }, todayStr);
    const lastActive = await this.lastActiveDate(userId, todayStr);
    return {
      currentStreak: current,
      peakStreak: peak,
      lastActiveDate: lastActive,
      status: deriveStatus(current, peak),
    };
  }
}

/** 服务端实例（注入持久化 StorageProvider）。 */
export async function getServerStreakService(): Promise<LearningStreakService> {
  const storage = await getServerStorage();
  return new LearningStreakService(storage);
}

// ── 客户端辅助已移至 ./streak-client.ts ──
// 原因：本文件 import 了 server-storage（→ mysql2 → 'tls'），
// 客户端组件引用本文件会把服务端依赖拖进浏览器 bundle。客户端请从 streak-client.ts 导入。

/** 供其他模块判断"是否已中断 N 天"（R-3 召回用，T05 调用）。 */
export function isStreakBrokenForDays(state: StreakState, todayStr: string, days: number): boolean {
  if (!state.lastActiveDate) return false;
  return diffLocalDays(state.lastActiveDate, todayStr) >= days;
}
