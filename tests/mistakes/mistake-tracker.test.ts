/**
 * tests/mistakes/mistake-tracker.test.ts
 * Sky Classroom — 错题追踪器测试
 *
 * 测试模块：
 *   - lib/mistakes/db.ts          (IndexedDB CRUD)
 *   - lib/mistakes/mistake-tracker.ts  (高级追踪器)
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import type { MistakeRecord, MistakeFilter, MistakeStats } from '@/lib/mistakes/types';
import type { MistakeCause } from '@/lib/solve/types';
import {
  getDB,
  addMistake,
  getAllMistakes,
  updateMistake,
  deleteMistake as dbDeleteMistake,
  clearAll,
} from '@/lib/mistakes/db';
import {
  trackMistake,
  getMistakes,
  markReviewed,
  deleteMistake,
  getMistakeStats,
  exportMistakes,
} from '@/lib/mistakes/mistake-tracker';

// ── Helpers ────────────────────────────────────────────────────────────

function makeTestMistake(overrides?: Partial<MistakeRecord>): MistakeRecord {
  const defaults: MistakeRecord = {
    id: `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    problem: '1 + 1 = ?',
    userAnswer: '3',
    correctAnswer: '2',
    cause: 'calculation-error',
    solvedAt: new Date(),
    reviewed: false,
    reviewCount: 0,
    knowledgePoints: ['addition', 'elementary-math'],
  };
  return { ...defaults, ...overrides };
}

/**
 * Insert a batch of records directly into the DB.
 */
async function seedMistakes(records: MistakeRecord[]): Promise<void> {
  for (const r of records) {
    await addMistake(r);
  }
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('mistake-tracker', () => {
  beforeEach(async () => {
    // 每个测试前清空 IndexedDB，保证隔离
    await clearAll();
  });

  // ======================================================================
  // IndexedDB CRUD (lib/mistakes/db.ts)
  // ======================================================================
  describe('IndexedDB CRUD', () => {
    it('addMistake → getAllMistakes 返回已存储记录', async () => {
      const record = makeTestMistake();
      await addMistake(record);

      const all = await getAllMistakes();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(record.id);
      expect(all[0].problem).toBe(record.problem);
      expect(all[0].cause).toBe('calculation-error');
    });

    it('updateMistake 更新 reviewed 状态', async () => {
      const record = makeTestMistake({ reviewed: false });
      await addMistake(record);

      await updateMistake(record.id, { reviewed: true });
      const all = await getAllMistakes();
      expect(all[0].reviewed).toBe(true);
    });

    it('updateMistake 更新多个字段', async () => {
      const record = makeTestMistake();
      await addMistake(record);

      await updateMistake(record.id, {
        reviewed: true,
        reviewCount: 3,
        knowledgePoints: ['addition', 'subtraction'],
      });
      const all = await getAllMistakes();
      expect(all[0].reviewed).toBe(true);
      expect(all[0].reviewCount).toBe(3);
      expect(all[0].knowledgePoints).toEqual(['addition', 'subtraction']);
    });

    it('updateMistake 对不存在的 id 抛出错误', async () => {
      await expect(updateMistake('nonexistent-id', { reviewed: true })).rejects.toThrow(
        'Mistake record not found',
      );
    });

    it('deleteMistake 删除后查询为空', async () => {
      const record = makeTestMistake();
      await addMistake(record);
      await dbDeleteMistake(record.id);

      const all = await getAllMistakes();
      expect(all).toHaveLength(0);
    });

    it('clearAll 清空所有记录', async () => {
      const r1 = makeTestMistake();
      const r2 = makeTestMistake();
      await addMistake(r1);
      await addMistake(r2);

      await clearAll();
      const all = await getAllMistakes();
      expect(all).toHaveLength(0);
    });

    it('getDB 返回同一数据库实例（重复调用复用）', async () => {
      const db1 = await getDB();
      const db2 = await getDB();
      expect(db1.name).toBe(db2.name);
    });
  });

  // ======================================================================
  // trackMistake (lib/mistakes/mistake-tracker.ts)
  // ======================================================================
  describe('trackMistake', () => {
    it('自动设置 solvedAt 为当前时间', async () => {
      const before = new Date();
      const record = makeTestMistake({ solvedAt: undefined as unknown as Date });
      await trackMistake(record);

      const all = await getAllMistakes();
      expect(all[0].solvedAt).toBeInstanceOf(Date);
      // solvedAt 应在调用前后合理范围内
      const after = new Date();
      const solvedAt = new Date(all[0].solvedAt).getTime();
      // IndexedDB 序列化后有轻微时差，允许合理偏差
      expect(solvedAt).toBeGreaterThanOrEqual(before.getTime() - 5000);
      expect(solvedAt).toBeLessThanOrEqual(after.getTime() + 5000);
    });

    it('记录完整保存，所有字段一致', async () => {
      const record = makeTestMistake({
        problem: '2 × 3 = ?',
        userAnswer: '5',
        correctAnswer: '6',
        cause: 'misreading',
        knowledgePoints: ['multiplication'],
      });
      await trackMistake(record);

      const all = await getMistakes();
      expect(all).toHaveLength(1);
      const saved = all[0];
      expect(saved.id).toBe(record.id);
      expect(saved.problem).toBe('2 × 3 = ?');
      expect(saved.userAnswer).toBe('5');
      expect(saved.correctAnswer).toBe('6');
      expect(saved.cause).toBe('misreading');
      expect(saved.reviewed).toBe(false);
      expect(saved.reviewCount).toBe(0);
      expect(saved.knowledgePoints).toEqual(['multiplication']);
    });
  });

  // ======================================================================
  // getMistakes 筛选
  // ======================================================================
  describe('getMistakes 筛选', () => {
    const oldDate = new Date('2024-01-15');
    const midDate = new Date('2025-06-01');
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);  // 2 days ago

    beforeEach(async () => {
      const base: MistakeRecord[] = [
        makeTestMistake({
          id: 'r1',
          cause: 'calculation-error',
          knowledgePoints: ['addition'],
          solvedAt: oldDate,
          reviewed: false,
        }),
        makeTestMistake({
          id: 'r2',
          cause: 'misreading',
          knowledgePoints: ['subtraction'],
          solvedAt: midDate,
          reviewed: true,
        }),
        makeTestMistake({
          id: 'r3',
          cause: 'calculation-error',
          knowledgePoints: ['addition', 'multiplication'],
          solvedAt: recentDate,
          reviewed: false,
        }),
      ];
      await seedMistakes(base);
    });

    it('无筛选返回全部', async () => {
      const results = await getMistakes();
      expect(results).toHaveLength(3);
    });

    it('cause 筛选正确过滤', async () => {
      const filter: MistakeFilter = { type: 'cause', value: 'calculation-error' };
      const results = await getMistakes(filter);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.cause === 'calculation-error')).toBe(true);
    });

    it('knowledgePoint 筛选正确过滤', async () => {
      const filter: MistakeFilter = { type: 'knowledgePoint', value: 'addition' };
      const results = await getMistakes(filter);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id).sort()).toEqual(['r1', 'r3']);
    });

    it('knowledgePoint 筛选无匹配时返回空数组', async () => {
      const filter: MistakeFilter = { type: 'knowledgePoint', value: 'calculus' };
      const results = await getMistakes(filter);
      expect(results).toHaveLength(0);
    });

    it('dateRange 筛选正确过滤', async () => {
      const filter: MistakeFilter = {
        type: 'dateRange',
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31'),
      };
      const results = await getMistakes(filter);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('r1');
    });

    it('reviewed 筛选正确过滤', async () => {
      const filter: MistakeFilter = { type: 'reviewed', value: true };
      const results = await getMistakes(filter);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('r2');
    });

    it('reviewed=false 筛选未复习的记录', async () => {
      const filter: MistakeFilter = { type: 'reviewed', value: false };
      const results = await getMistakes(filter);
      expect(results).toHaveLength(2);
    });
  });

  // ======================================================================
  // markReviewed
  // ======================================================================
  describe('markReviewed', () => {
    it('reviewed 变为 true', async () => {
      const record = makeTestMistake({ reviewed: false });
      await addMistake(record);

      await markReviewed(record.id);
      const all = await getAllMistakes();
      expect(all[0].reviewed).toBe(true);
    });

    it('reviewCount 从 0 递增为 1', async () => {
      const record = makeTestMistake({ reviewed: false, reviewCount: 0 });
      await addMistake(record);

      await markReviewed(record.id);
      const all = await getAllMistakes();
      expect(all[0].reviewCount).toBe(1);
    });

    it('多次 markReviewed 使 reviewCount 持续递增', async () => {
      const record = makeTestMistake({ reviewed: false, reviewCount: 0 });
      await addMistake(record);

      await markReviewed(record.id);
      await markReviewed(record.id);
      await markReviewed(record.id);

      const all = await getAllMistakes();
      expect(all[0].reviewed).toBe(true);
      expect(all[0].reviewCount).toBe(3);
    });

    it('reviewCount 基于数据库中当前值递增（非局部 stale 值）', async () => {
      const record = makeTestMistake({ reviewed: false, reviewCount: 5 });
      await addMistake(record);

      await markReviewed(record.id);
      const all = await getAllMistakes();
      expect(all[0].reviewCount).toBe(6);
    });

    it('不存在的 id 抛出错误', async () => {
      await expect(markReviewed('nonexistent-id')).rejects.toThrow(
        'Mistake record not found',
      );
    });
  });

  // ======================================================================
  // getMistakeStats
  // ======================================================================
  describe('getMistakeStats', () => {
    it('totalCount / reviewedCount 正确', async () => {
      const r1 = makeTestMistake({ reviewed: false });
      const r2 = makeTestMistake({ reviewed: true });
      const r3 = makeTestMistake({ reviewed: false });
      await seedMistakes([r1, r2, r3]);

      const stats = await getMistakeStats();
      expect(stats.totalCount).toBe(3);
      expect(stats.reviewedCount).toBe(1);
    });

    it('causeDistribution 各错因计数正确', async () => {
      const records: MistakeRecord[] = [
        makeTestMistake({ cause: 'calculation-error' }),
        makeTestMistake({ cause: 'calculation-error' }),
        makeTestMistake({ cause: 'misreading' }),
        makeTestMistake({ cause: 'careless' }),
        makeTestMistake({ cause: 'concept-unclear' }),
      ];
      await seedMistakes(records);

      const stats = await getMistakeStats();
      expect(stats.causeDistribution['calculation-error']).toBe(2);
      expect(stats.causeDistribution['misreading']).toBe(1);
      expect(stats.causeDistribution['careless']).toBe(1);
      expect(stats.causeDistribution['concept-unclear']).toBe(1);
    });

    it('causeDistribution 未出现的错因默认为 undefined', async () => {
      const records: MistakeRecord[] = [
        makeTestMistake({ cause: 'calculation-error' }),
      ];
      await seedMistakes(records);

      const stats = await getMistakeStats();
      expect(stats.causeDistribution['format-error']).toBeUndefined();
      expect(stats.causeDistribution['method-wrong']).toBeUndefined();
    });

    it('recentCount（7天内）正确', async () => {
      const now = Date.now();
      const within7Days = new Date(now - 3 * 24 * 60 * 60 * 1000);   // 3 天前
      const outside7Days = new Date(now - 10 * 24 * 60 * 60 * 1000); // 10 天前

      const records: MistakeRecord[] = [
        makeTestMistake({ solvedAt: within7Days }),
        makeTestMistake({ solvedAt: within7Days }),
        makeTestMistake({ solvedAt: outside7Days }),
      ];
      await seedMistakes(records);

      const stats = await getMistakeStats();
      expect(stats.recentCount).toBe(2);
    });

    it('空数据库返回全零统计', async () => {
      const stats = await getMistakeStats();
      expect(stats.totalCount).toBe(0);
      expect(stats.reviewedCount).toBe(0);
      expect(stats.recentCount).toBe(0);
      // causeDistribution 为空对象
      const distributions = Object.values(stats.causeDistribution).filter(
        (v) => v !== undefined,
      );
      expect(distributions).toHaveLength(0);
    });
  });

  // ======================================================================
  // exportMistakes
  // ======================================================================
  describe('exportMistakes', () => {
    beforeEach(async () => {
      const records: MistakeRecord[] = [
        makeTestMistake({ id: 'e1', cause: 'calculation-error', reviewed: false }),
        makeTestMistake({ id: 'e2', cause: 'misreading', reviewed: true }),
        makeTestMistake({ id: 'e3', cause: 'calculation-error', reviewed: false }),
      ];
      await seedMistakes(records);
    });

    it('导出全部（无 filter）', async () => {
      const exported = await exportMistakes();
      expect(exported).toHaveLength(3);
      expect(exported.every((r) => r.solvedAt instanceof Date)).toBe(true);
    });

    it('导出全部时 solvedAt 保持 Date 实例', async () => {
      const exported = await exportMistakes();
      for (const r of exported) {
        expect(r.solvedAt).toBeInstanceOf(Date);
      }
    });

    it('导出筛选后（按 cause 过滤）', async () => {
      const filter: MistakeFilter = { type: 'cause', value: 'calculation-error' };
      const exported = await exportMistakes(filter);
      expect(exported).toHaveLength(2);
      expect(exported.every((r) => r.cause === 'calculation-error')).toBe(true);
    });

    it('导出筛选后（按 reviewed 过滤）', async () => {
      const filter: MistakeFilter = { type: 'reviewed', value: true };
      const exported = await exportMistakes(filter);
      expect(exported).toHaveLength(1);
      expect(exported[0].id).toBe('e2');
    });

    it('导出不修改原数据库记录', async () => {
      await exportMistakes();
      const all = await getAllMistakes();
      expect(all).toHaveLength(3);
    });
  });

  // ======================================================================
  // 集成场景
  // ======================================================================
  describe('集成场景', () => {
    it('trackMistake → getMistakes → markReviewed → getMistakeStats 完整流程', async () => {
      // 1. 记录错题
      const r1 = makeTestMistake({ id: 'flow-1', cause: 'careless', reviewed: false });
      await trackMistake(r1);

      // 2. 查询确认已入库
      const mistakes = await getMistakes();
      expect(mistakes).toHaveLength(1);
      expect(mistakes[0].id).toBe('flow-1');

      // 3. 标记为已复习
      await markReviewed('flow-1');

      // 4. 统计更新
      const stats = await getMistakeStats();
      expect(stats.totalCount).toBe(1);
      expect(stats.reviewedCount).toBe(1);
      expect(stats.causeDistribution['careless']).toBe(1);

      // 5. 删除
      await deleteMistake('flow-1');
      const afterDelete = await getMistakes();
      expect(afterDelete).toHaveLength(0);
    });

    it('多错题多错因的统计完整性', async () => {
      const allCauses: MistakeCause[] = [
        'concept-unclear',
        'calculation-error',
        'misreading',
        'method-wrong',
        'careless',
        'format-error',
      ];
      const records = allCauses.map((cause, i) =>
        makeTestMistake({ id: `multi-${i}`, cause, reviewed: i % 2 === 0 }),
      );
      await seedMistakes(records);

      const stats = await getMistakeStats();
      expect(stats.totalCount).toBe(6);
      expect(stats.reviewedCount).toBe(3); // i=0,2,4 的 reviewed 为 true

      for (const cause of allCauses) {
        expect(stats.causeDistribution[cause]).toBe(1);
      }
    });
  });
});
