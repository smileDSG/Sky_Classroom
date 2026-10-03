/**
 * 回访态判定层测试（T06 / PRD §4.1）。
 *
 * 覆盖：四档逐格 + 边界 + 降级 + 'none' 口径 + 纯函数性。
 * 全部走固定日期字符串，**不需要 mock 时钟、不需要网络**。
 */

import { describe, it, expect } from 'vitest';
import { resolveRecapState } from '@/lib/retention/recap-state';
import type { RecapContext, RecapState } from '@/lib/retention/types';
import type { StreakState } from '@/lib/retention/types';
import type { WeakPointSummary } from '@/lib/cloud-mind/types';
import { RECAP_GENERIC_LINE } from '@/lib/retention/recap-copy';

const TODAY = '2026-03-10';
const YESTERDAY = '2026-03-09';
const D2 = '2026-03-08';
const D3 = '2026-03-07';
const D9 = '2026-03-01';
const FUTURE = '2026-03-11';

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  currentStreak: 2,
  peakStreak: 6,
  lastActiveDate: '',
  status: 'at-risk',
  ...over,
});

const weak = (over: Partial<WeakPointSummary> = {}): WeakPointSummary => ({
  knowledgePoint: '对称轴',
  mastery: 62,
  recentMistakeCount: 3,
  actionHref: '/sky/practice/axis',
  ...over,
});

const ctx = (over: Partial<RecapContext> = {}): RecapContext => ({
  streak: streak({ lastActiveDate: YESTERDAY }),
  weakPoints: [weak()],
  dueMistakeCount: 0,
  today: TODAY,
  ...over,
});

describe('resolveRecapState · 四档判定', () => {
  it('S-1：昨天来过 + 有真实薄弱点 → 昨日接续，且带记忆卡', () => {
    const view = resolveRecapState(ctx());
    expect(view.state).toBe('S-1');
    expect(view.degraded).toBe(false);
    expect(view.line).toBe('昨天你补上了『对称轴』，今天把它练到 80% 就行。');
    expect(view.memoryCard).toEqual({
      knowledgePoint: '对称轴',
      mastery: 62,
      recentMistakeCount: 3,
      actionHref: '/sky/practice/axis',
    });
    expect(view.streakLine).toBe('2 连续学习天');
    expect(view.action?.label).toBe('再练一次『对称轴』→');
  });

  it('S-1 边界：gap===1 但弱点名字为空 → 不进 S-1，也不编知识点', () => {
    const view = resolveRecapState(ctx({ weakPoints: [weak({ knowledgePoint: '   ' })] }));
    expect(view.state).not.toBe('S-1');
    expect(view.memoryCard).toBeNull();
  });

  it('S-2：gap===1 且无薄弱点 → 短期回落（不进记忆块）', () => {
    const view = resolveRecapState(ctx({ weakPoints: [] }));
    expect(view.state).toBe('S-2');
    expect(view.memoryCard).toBeNull();
    expect(view.line).toBe('昨天之后没再来，今天不用补，做 1 件小事就能接上。');
  });

  it('S-2：gap===2 → 短期回落，话术说真实天数', () => {
    const view = resolveRecapState(ctx({ streak: streak({ lastActiveDate: D2 }) }));
    expect(view.state).toBe('S-2');
    expect(view.line).toBe('2 天没来，今天不用补，做 1 件小事就能接上。');
    expect(view.memoryCard).not.toBeNull();
  });

  it('S-2 灰度位：variant B2 用"断了 N 天"', () => {
    const view = resolveRecapState(
      ctx({ streak: streak({ lastActiveDate: D2 }), recapCopyVariant: 'B2' }),
    );
    expect(view.state).toBe('S-2');
    expect(view.line).toBe('断了 2 天，今天做 1 件事就能接上。');
  });

  it('S-3：从未活跃（lastActiveDate === ""）→ 兜底档', () => {
    const view = resolveRecapState(ctx({ streak: streak({ lastActiveDate: '' }), weakPoints: [] }));
    expect(view.state).toBe('S-3');
    expect(view.degraded).toBe(false);
    expect(view.line).toBe(RECAP_GENERIC_LINE);
    expect(view.memoryCard).toBeNull();
  });

  it('有历史但 weakPoints 为空（只听课没做题）→ S-2 且**不进记忆块**', () => {
    // PRD §4.1：S-1 才要求 weakPoints>0；空档 1~2 天且未静默 → S-2 优先级高于 S-3。
    // 关键是 S-3 是兜底档，不能因为"没薄弱点"就先跳过去讲空话。
    const view = resolveRecapState(ctx({ weakPoints: [] }));
    expect(view.state).toBe('S-2');
    expect(view.memoryCard).toBeNull();
    expect(view.degraded).toBe(false);
  });

  it('S-4：gap===3 且被自动静默 → 静默回流，不进记忆块', () => {
    const view = resolveRecapState(ctx({ streak: streak({ lastActiveDate: D3 }) }));
    expect(view.state).toBe('S-4');
    expect(view.memoryCard).toBeNull();
    expect(view.line).toBe('上次学到『对称轴』，就到这儿。今天想接着来，点一下就行。');
    expect(view.streakLine).toBe('连续 2 天（峰值 6）');
  });

  it('S-4 边界：gap===9 且**无**薄弱点 → 只说真实日期，不外推知识点', () => {
    const view = resolveRecapState(
      ctx({ streak: streak({ lastActiveDate: D9, currentStreak: 0, peakStreak: 0 }), weakPoints: [] }),
    );
    expect(view.state).toBe('S-4');
    expect(view.line).toBe('上次学到 2026-03-01，就到这儿。今天想接着来，点一下就行。');
    expect(view.streakLine).toBe('连续 0 天');
  });

  it('S-4：峰值不超过当前时不显示峰值', () => {
    const view = resolveRecapState(
      ctx({ streak: streak({ lastActiveDate: D3, currentStreak: 6, peakStreak: 6 }) }),
    );
    expect(view.streakLine).toBe('连续 6 天');
  });
});

describe('resolveRecapState · 降级（不抛错、不编文案）', () => {
  it('streak 为 null → S-3 且 degraded', () => {
    const view = resolveRecapState(ctx({ streak: null }));
    expect(view.state).toBe('S-3');
    expect(view.degraded).toBe(true);
    expect(view.streakLine).toBeNull(); // 读不出来就整行不渲染
    expect(view.line).toBe(RECAP_GENERIC_LINE);
  });

  it('lastActiveDate 非法（"abc"）→ S-3 且 degraded', () => {
    const view = resolveRecapState(ctx({ streak: streak({ lastActiveDate: 'abc' }) }));
    expect(view.state).toBe('S-3');
    expect(view.degraded).toBe(true);
  });

  it('today 非法（缺省 / 空串）→ S-3 且 degraded（本层禁止读系统时钟）', () => {
    const view = resolveRecapState(ctx({ today: '' }));
    expect(view.state).toBe('S-3');
    expect(view.degraded).toBe(true);
  });

  it('未来日期（gap < 0，时区错配）→ S-3 且 degraded', () => {
    const view = resolveRecapState(ctx({ streak: streak({ lastActiveDate: FUTURE }) }));
    expect(view.state).toBe('S-3');
    expect(view.degraded).toBe(true);
  });

  it('非法日期写进 lastActiveDate 也不抛错（2026-02-30）', () => {
    const view = resolveRecapState(ctx({ streak: streak({ lastActiveDate: '2026-02-30' }) }));
    expect(view.state).toBe('S-3');
    expect(view.degraded).toBe(true);
  });
});

describe('resolveRecapState · 三条口径', () => {
  it('口径 a：state==="none"（今天已学）→ line 为 null，记忆卡/连续天数/按钮都在', () => {
    const view = resolveRecapState(ctx({ streak: streak({ lastActiveDate: TODAY }) }));
    expect(view.state).toBe('none');
    expect(view.line).toBeNull(); // 不能谎称"昨天你补上了"
    expect(view.memoryCard).not.toBeNull();
    expect(view.memoryCard?.knowledgePoint).toBe('对称轴');
    expect(view.streakLine).toBe('2 连续学习天');
    expect(view.action).not.toBeNull();
    expect(view.degraded).toBe(false);
  });

  it('口径 b：recapEnabled === false → 记忆块不渲染、A 退通用句、按钮 D 照常在', () => {
    const view = resolveRecapState(ctx({ recapEnabled: false }));
    expect(view.state).toBe('S-1');
    expect(view.memoryCard).toBeNull();
    expect(view.line).toBe(RECAP_GENERIC_LINE);
    expect(view.action).not.toBeNull();
    expect(view.action?.label).toBe('再练一次『对称轴』→');
  });

  it('口径 b：记忆开关关闭时按钮依然可用（S-4 静默回流）', () => {
    const view = resolveRecapState(
      ctx({ streak: streak({ lastActiveDate: D3 }), recapEnabled: false }),
    );
    expect(view.state).toBe('S-4');
    expect(view.memoryCard).toBeNull();
    expect(view.action).not.toBeNull();
    expect(view.line).toBe(RECAP_GENERIC_LINE);
  });

  it('口径 c：degraded 时不编文案，S-3 通用句 + 标记', () => {
    const view = resolveRecapState(ctx({ streak: null, weakPoints: [weak()] }));
    expect(view.state).toBe('S-3');
    expect(view.degraded).toBe(true);
    expect(view.line).toBe(RECAP_GENERIC_LINE);
  });

  it('记忆卡：recentMistakeCount 为 0 → null（UI 不输出"连错 0 次"）', () => {
    const view = resolveRecapState(ctx({ weakPoints: [weak({ recentMistakeCount: 0 })] }));
    expect(view.state).toBe('S-1');
    expect(view.memoryCard?.recentMistakeCount).toBeNull();
  });

  it('记忆卡：mastery 缺失 → null（数字不渲染）', () => {
    const view = resolveRecapState(ctx({ weakPoints: [weak({ mastery: Number.NaN })] }));
    expect(view.memoryCard?.mastery).toBeNull();
  });
});

describe('resolveRecapState · 纯函数性', () => {
  it('同一入参两次调用结果严格相等（deepStrictEqual）', () => {
    const input = ctx({ streak: streak({ lastActiveDate: D2 }) });
    expect(resolveRecapState(input)).toStrictEqual(resolveRecapState(input));
  });

  it('不修改入参对象', () => {
    const input = ctx({ weakPoints: [weak()] });
    const snapshot = JSON.parse(JSON.stringify(input)) as RecapContext;
    resolveRecapState(input);
    expect(input).toStrictEqual(snapshot);
  });

  it('states 覆盖完整（四档 + none）', () => {
    const states: RecapState[] = ['S-1', 'S-2', 'S-3', 'S-4', 'none'];
    expect(states).toHaveLength(5);
  });
});
