/**
 * 留存模块核心状态机测试（T01验收点）。
 *
 * 覆盖：连续天数同日幂等 / 中断保留峰值 / 温柔回归、成长快照真实值无插值。
 * 用内存 StorageProvider 假实现，不触碰真实数据库。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LearningStreakService } from '@/lib/retention/streak';
import { buildSnapshotFromMistakes } from '@/lib/retention/growth-history';
import type { StorageProvider, StorageEntry } from '@/lib/storage/storage-types';
import type { StreakState } from '@/lib/retention/types';

// ── 内存版StorageProvider（最小可用实现） ────────────────────────────

function createMemoryStorage(): StorageProvider {
  const tables = new Map<string, Map<string, StorageEntry<unknown>>>();
  const table = (name: string) => {
    let t = tables.get(name);
    if (!t) {
      t = new Map();
      tables.set(name, t);
    }
    return t;
  };

  return {
    async get<T>(name: string, id: string) {
      return table(name).get(id) as StorageEntry<T> | undefined;
    },
    async getAll<T>(name: string, filter?) {
      const all = [...table(name).values()] as StorageEntry<T>[];
      return filter ? all.filter(filter) : all;
    },
    async set<T>(name: string, entry: { id: string; data: T }) {
      table(name).set(entry.id, {
        id: entry.id,
        data: entry.data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as StorageEntry<unknown>);
    },
    async delete(name: string, id: string) {
      table(name).delete(id);
    },
    async clear(name: string) {
      table(name).clear();
    },
  } as unknown as StorageProvider;
}

/** 构造一段连续/中断的活跃日期（写入 user_checkins 原始格式）。 */
async function seedCheckins(
  svc: LearningStreakService,
  userId: string,
  dates: string[],
): Promise<void> {
  const storage = (svc as unknown as { storage: StorageProvider }).storage;
  for (const d of dates) {
    await storage.set('user_checkins', {
      id: `${userId}_${d}`,
      data: { userId, date: d, timestamp: Date.parse(`${d}T10:00:00`) },
    });
  }
}

/** 读出服务端算出的连续天数（绕过客户端 API）。 */
async function readStreak(svc: LearningStreakService, userId: string, date: string) {
  return svc.getStreak(userId, date);
}

// ── 测试 ────────────────────────────────────────────────────────────

describe('LearningStreakService（连续天数状态机）', () => {
  const USER = 'u1';
  let svc: LearningStreakService;

  beforeEach(() => {
    svc = new LearningStreakService(createMemoryStorage());
  });

  it('当日首次有效学习 → 激活，currentStreak=1', async () => {
    const state = await svc.recordActivity(USER, '2026-10-01');
    expect(state.currentStreak).toBe(1);
    expect(state.lastActiveDate).toBe('2026-10-01');
    expect(state.status).toBe('active');
  });

  it('同日重复触发幂等（Q1：多次只记一次）', async () => {
    const first = await svc.recordActivity(USER, '2026-10-01');
    const second = await svc.recordActivity(USER, '2026-10-01');
    const third = await svc.recordActivity(USER, '2026-10-01');
    expect(second.currentStreak).toBe(first.currentStreak);
    expect(third.currentStreak).toBe(first.currentStreak);
    expect(third.currentStreak).toBe(1);
  });

  it('连续多日 → 天数累加', async () => {
    await svc.recordActivity(USER, '2026-10-01');
    await svc.recordActivity(USER, '2026-10-02');
    const s = await svc.recordActivity(USER, '2026-10-03');
    expect(s.currentStreak).toBe(3);
    expect(s.peakStreak).toBe(3);
  });

  it('中断后重新学习 → 重置为1，但峰值保留（温柔中断）', async () => {
    // 先冲到 4 天
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']) {
      await svc.recordActivity(USER, d);
    }
    const peakState = await readStreak(svc, USER, '2026-10-04');
    expect(peakState.currentStreak).toBe(4);
    expect(peakState.peakStreak).toBe(4);

    // 跳过 10-05、10-06，10-07 回归
    const back = await svc.recordActivity(USER, '2026-10-07');
    expect(back.currentStreak).toBe(1); // 重新计数
    expect(back.peakStreak).toBe(4); // 峰值不被抹掉
  });

  it('evaluateDaily：今日与昨日均未活跃 → broken，峰值保留', async () => {
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03']) {
      await svc.recordActivity(USER, d);
    }
    // 04、05 均无记录 → 06 天评估
    const state = await svc.evaluateDaily(USER, '2026-10-06');
    expect(state.status).toBe('broken');
    expect(state.currentStreak).toBe(0);
    expect(state.peakStreak).toBe(3); // 历史峰值仍在
  });

  it('今日已活跃但昨日无 → 仍视为 active（刚回归）', async () => {
    await seedCheckins(svc, USER, ['2026-10-01']);
    const state = await svc.evaluateDaily(USER, '2026-10-02');
    expect(state.status).toBe('active');
  });

  it('达到 7 天里程碑 → peak（中性回顾，非奖励）', async () => {
    const dates = [
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ];
    for (const d of dates) await svc.recordActivity(USER, d);
    const s = await readStreak(svc, USER, '2026-10-07');
    expect(s.currentStreak).toBe(7);
    expect(s.status).toBe('peak');
  });
});

describe('buildSnapshotFromMistakes（成长快照真实值）', () => {
  it('空错题 → 全零，不插值膨胀', () => {
    const snap = buildSnapshotFromMistakes([], '2026-10-01');
    expect(snap).toEqual({
      date: '2026-10-01',
      masteryPercent: 0,
      mistakeTotal: 0,
      reviewedCount: 0,
      weakCount: 0,
    });
  });

  it('真实统计错题总数/已攻克数，不做平滑', () => {
    const snap = buildSnapshotFromMistakes(
      [
        { id: 'm1', knowledgePoints: ['函数'], reviewCount: 3, reviewed: true },
        { id: 'm2', knowledgePoints: ['函数'], reviewCount: 1, reviewed: false },
        { id: 'm3', knowledgePoints: ['导数'], reviewCount: 2, reviewed: false },
      ],
      '2026-10-01',
    );
    expect(snap.mistakeTotal).toBe(3);
    expect(snap.reviewedCount).toBe(1);
    expect(snap.masteryPercent).toBeGreaterThanOrEqual(0);
    expect(snap.masteryPercent).toBeLessThanOrEqual(100);
    expect(snap.date).toBe('2026-10-01');
  });
});
