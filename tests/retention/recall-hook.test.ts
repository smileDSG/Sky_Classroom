/**
 * 召回钩子决策测试（T05 / FR-11、FR-12）。
 *
 * 重点锁定**克制**规则（PRD R-3）：
 * - 每日至多 1 次提醒
 * - 连续多日未打开自动静默（越不来越不打扰）
 * - 悬念必须来自真实薄弱点，没数据就不编造
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateRecall,
  isAutoSilenced,
  isActiveToday,
  buildSuspense,
  pickWeakest,
  daysBetween,
} from '@/lib/retention/recall-hook';
import type { StreakState } from '@/lib/retention/types';
import type { WeakPointSummary } from '@/lib/cloud-mind/types';

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  currentStreak: 0,
  peakStreak: 0,
  lastActiveDate: '',
  status: 'inactive',
  ...over,
});

const TODAY = '2026-10-02';

describe('evaluateRecall（召回决策）', () => {
  it('用户关闭提醒 → 不打扰', () => {
    const d = evaluateRecall(streak(), { enabled: false, lastNotifiedDate: '' }, TODAY);
    expect(d.shouldSend).toBe(false);
    expect(d.reason).toBe('disabled');
  });

  it('今天已学 → 不提醒（最好的状态，不去戳用户）', () => {
    const d = evaluateRecall(
      streak({ lastActiveDate: TODAY, currentStreak: 3, status: 'active' }),
      { enabled: true, lastNotifiedDate: '' },
      TODAY,
    );
    expect(d.shouldSend).toBe(false);
    expect(d.reason).toBe('active-today');
  });

  it('今天已提醒过 → 不重复提醒（每日至多 1 次）', () => {
    const d = evaluateRecall(
      streak({ lastActiveDate: '2026-10-01' }),
      { enabled: true, lastNotifiedDate: TODAY },
      TODAY,
    );
    expect(d.shouldSend).toBe(false);
    expect(d.reason).toBe('sent-today');
  });

  it('连续多日未打开 → 自动静默（越不来越不打扰）', () => {
    const d = evaluateRecall(
      streak({ lastActiveDate: '2026-09-28' }),
      { enabled: true, lastNotifiedDate: '' },
      TODAY,
    );
    expect(d.shouldSend).toBe(false);
    expect(d.reason).toBe('auto-silenced');
  });

  it('从未学习过 → 静默（不做拉新式打扰）', () => {
    const d = evaluateRecall(streak(), { enabled: true, lastNotifiedDate: '' }, TODAY);
    expect(d.shouldSend).toBe(false);
    expect(d.reason).toBe('auto-silenced');
  });

  it('昨天没学、今天还没学、也没提醒过 → 可以提醒', () => {
    const d = evaluateRecall(
      streak({ lastActiveDate: '2026-10-01' }),
      { enabled: true, lastNotifiedDate: '' },
      TODAY,
    );
    expect(d.shouldSend).toBe(true);
  });

  it('打断1 天（2天前学过）仍可提醒，未达静默阈值', () => {
    const d = evaluateRecall(
      streak({ lastActiveDate: '2026-09-30' }),
      { enabled: true, lastNotifiedDate: '' },
      TODAY,
    );
    expect(d.shouldSend).toBe(true);
  });
});

describe('isActiveToday / isAutoSilenced', () => {
  it('lastActiveDate === 今天 → 今天已学', () => {
    expect(isActiveToday(streak({ lastActiveDate: TODAY }), TODAY)).toBe(true);
    expect(isActiveToday(streak({ lastActiveDate: '2026-10-01' }), TODAY)).toBe(false);
  });

  it('达到阈值天数才静默', () => {
    // 今天固定为 2026-10-02往前推 N 天要跨月，直接用9 月日期表达，避免日期拼接算错
    // 距今 2 天（09-30）→ 未达阈值(3)，可提醒
    expect(isAutoSilenced(streak({ lastActiveDate: '2026-09-30' }), TODAY)).toBe(false);
    // 距今 3 天（09-29）→ 刚好达阈值，静默
    expect(isAutoSilenced(streak({ lastActiveDate: '2026-09-29' }), TODAY)).toBe(true);
  });
});

describe('daysBetween（本地日期差）', () => {
  it('同一天为 0', () => expect(daysBetween(TODAY, TODAY)).toBe(0));
  it('跨天正确', () => expect(daysBetween('2026-10-01', '2026-10-02')).toBe(1));
  it('跨月正确', () => expect(daysBetween('2026-09-28', '2026-10-02')).toBe(4));
  it('非法输入返回 0（不抛异常）', () => expect(daysBetween('bad', TODAY)).toBe(0));
});

describe('buildSuspense（悬念来自真实薄弱点）', () => {
  const wp = (knowledgePoint: string, mastery: number, recentMistakeCount = 1): WeakPointSummary => ({
    knowledgePoint,
    mastery,
    recentMistakeCount,
    actionHref: '/x',
  });

  it('无薄弱点 → 不给悬念（不编造）', () => {
    expect(buildSuspense([])).toBeUndefined();
  });

  it('薄弱点列表为空/非法 → 不给悬念', () => {
    expect(buildSuspense(undefined as unknown as WeakPointSummary[])).toBeUndefined();
    expect(buildSuspense([{ knowledgePoint: '  ' } as WeakPointSummary])).toBeUndefined();
  });

  it('掌握度低 → 换角度重来', () => {
    const s = buildSuspense([wp('导数', 30)]);
    expect(s).toContain('导数');
    expect(s).toContain('换个角度');
  });

  it('掌握度中 → 再练两道', () => {
    const s = buildSuspense([wp('导数', 60)]);
    expect(s).toContain('导数');
    expect(s).toContain('再练两道');
  });

  it('掌握度高 → 顺手复习', () => {
    const s = buildSuspense([wp('导数', 90)]);
    expect(s).toContain('导数');
    expect(s).toContain('顺手');
  });
});

describe('pickWeakest（选最该关注的薄弱点）', () => {
  const wp = (knowledgePoint: string, mastery: number, recentMistakeCount = 1): WeakPointSummary => ({
    knowledgePoint,
    mastery,
    recentMistakeCount,
    actionHref: '/x',
  });

  it('空列表 → null', () => {
    expect(pickWeakest([])).toBeNull();
  });

  it('选掌握度最低的', () => {
    expect(pickWeakest([wp('A', 80), wp('B', 30), wp('C', 60)])?.knowledgePoint).toBe('B');
  });

  it('掌握度并列时选最近错题更多的', () => {
    expect(
      pickWeakest([wp('A', 50, 1), wp('B', 50, 9)])?.knowledgePoint,
    ).toBe('B');
  });
});
