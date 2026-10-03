/**
 * 动态措辞测试（T06）。
 *
 * 锁定 PRD §6.2 的变量填充规则，重点是"什么时候必须闭嘴"：
 * - 连错 0 次 → 不输出（禁废话）
 * - gap===1 → 不出现空档数字
 * - 到期题 0/未知 → 退到薄弱点或通用入口，不能造一个按钮
 */

import { describe, it, expect } from 'vitest';
import {
  buildRecapLine,
  buildStreakLine,
  buildAction,
  buildS2GapBreakLabel,
  buildS2GapLabel,
} from '@/lib/retention/recap-line';
import { resolveRecapState } from '@/lib/retention/recap-state';
import { isRedlineFree } from '@/lib/retention/recap-copy';
import type { RecapContext, RecapState, StreakState } from '@/lib/retention/types';
import type { WeakPointSummary } from '@/lib/cloud-mind/types';

const TODAY = '2026-10-03';
const YESTERDAY = '2026-10-02';

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  currentStreak: 2,
  peakStreak: 6,
  lastActiveDate: YESTERDAY,
  status: 'active',
  ...over,
});

const weak = (over: Partial<WeakPointSummary> = {}): WeakPointSummary => ({
  knowledgePoint: '对称轴',
  mastery: 62,
  recentMistakeCount: 3,
  actionHref: '/sky/learning/mistakes',
  ...over,
});

const ctx = (over: Partial<RecapContext> = {}): RecapContext => ({
  streak: streak(),
  weakPoints: [weak()],
  dueMistakeCount: 2,
  today: TODAY,
  ...over,
});

describe('buildRecapLine · 变量填充', () => {
  it('S-1：知识点名截断到 8 字（完整名留给记忆块）', () => {
    const long = weak({ knowledgePoint: '二次函数对称轴与顶点式的辨析' });
    const v = resolveRecapState(ctx({ weakPoints: [long] }));
    expect(v.line).toBe('昨天你补上了『二次函数对称轴与…』，今天把它练到 80% 就行。');
    expect(v.memoryCard?.knowledgePoint).toBe('二次函数对称轴与顶点式的辨析');
  });

  it('S-1：掌握度 ≥80 换陈述句，数值来自真实数据', () => {
    expect(buildRecapLine(ctx({ weakPoints: [weak({ mastery: 80 })] }), 'S-1')).toBe(
      '『对称轴』你已经练到 80%，今天顺手巩固一下。',
    );
    expect(buildRecapLine(ctx({ weakPoints: [weak({ mastery: 99 })] }), 'S-1')).toBe(
      '『对称轴』你已经练到 99%，今天顺手巩固一下。',
    );
  });

  it('S-2：gap===1 走无数字表述（两种灰度位都不带数字）', () => {
    const one = ctx({ streak: streak({ lastActiveDate: YESTERDAY }) });
    expect(buildRecapLine(one, 'S-2')).toBe('昨天之后没再来，今天不用补，做 1 件小事就能接上。');
    expect(buildRecapLine({ ...one, recapCopyVariant: 'B2' }, 'S-2')).toBe(
      '昨天之后没再来，今天做 1 件事就能接上。',
    );
  });

  it('S-2：gap≥2 才出现真实空档数字', () => {
    const two = ctx({ streak: streak({ lastActiveDate: '2026-10-01' }) });
    expect(buildRecapLine(two, 'S-2')).toBe('2 天没来，今天不用补，做 1 件小事就能接上。');
    expect(buildS2GapLabel(4)).toBe('4 天没来，');
    expect(buildS2GapBreakLabel(4)).toBe('断了 4 天，');
    expect(buildS2GapLabel(null)).toBe('昨天之后没再来，');
  });

  it('S-4：有薄弱点说知识点，没有就说日期', () => {
    expect(buildRecapLine(ctx({ streak: streak({ lastActiveDate: '2026-09-28' }) }), 'S-4')).toBe(
      '上次学到『对称轴』，就到这儿。今天想接着来，点一下就行。',
    );
    expect(
      buildRecapLine(
        ctx({ streak: streak({ lastActiveDate: '2026-09-28' }), weakPoints: [] }),
        'S-4',
      ),
    ).toBe('上次学到 2026-09-28，就到这儿。今天想接着来，点一下就行。');
  });

  it('关掉记忆 → 不个性化，退成 S-3 通用句', () => {
    expect(buildRecapLine(ctx({ recapEnabled: false }), 'S-1')).toBe(
      '今天先做一道题，连续学习就从这开始。',
    );
  });

  it("'none'（今天已学）→ null，不谎称昨天", () => {
    expect(buildRecapLine(ctx({ streak: streak({ lastActiveDate: TODAY }) }), 'none')).toBeNull();
  });
});

describe('buildStreakLine · 读不出来就整行不渲染', () => {
  it('正常态给真实连续天数', () => {
    expect(buildStreakLine(ctx(), 'S-1')).toBe('2 连续学习天');
  });

  it('S-4 中性说法，且只在峰值更高时才提峰值', () => {
    expect(buildStreakLine(ctx({ streak: streak({ currentStreak: 3 }) }), 'S-4')).toBe(
      '连续 3 天（峰值 6）',
    );
    expect(buildStreakLine(ctx({ streak: streak({ currentStreak: 6 }) }), 'S-4')).toBe(
      '连续 6 天',
    );
  });

  it('streak 为 null → null（不许造数）', () => {
    expect(buildStreakLine(ctx({ streak: null }), 'S-1')).toBeNull();
  });
});

describe('buildAction · 按钮文案按真实到期数分档', () => {
  // 按钮文案与档位无关（PRD §4.2 D），这里统一传 S-1 作为代表档
  const ST: RecapState = 'S-1';

  it('N === 1', () => {
    expect(buildAction(ctx({ dueMistakeCount: 1 }), ST).action.label).toBe('复习这 1 道 →');
  });

  it('N === 3 → 全报，不出现"还有"小字', () => {
    const r = buildAction(ctx({ dueMistakeCount: 3 }), ST);
    expect(r.action.label).toBe('复习这 3 道 →');
    expect(r.actionHint).toBeUndefined();
  });

  it('N === 5 → 只报 3 道 + 还剩的小字', () => {
    const r = buildAction(ctx({ dueMistakeCount: 5 }), ST);
    expect(r.action.label).toBe('复习这 3 道 →');
    expect(r.actionHint).toBe('还有 2 道在错题本');
  });

  it('N === 0 且有薄弱点 → 再练一次那个点', () => {
    expect(buildAction(ctx({ dueMistakeCount: 0 }), ST).action.label).toBe('再练一次『对称轴』→');
  });

  it('N === 0 且无薄弱点 → 退回通用入口', () => {
    const r = buildAction(ctx({ dueMistakeCount: 0, weakPoints: [] }), ST);
    expect(r.action.label).toBe('开始 →');
    expect(r.action.href).toBe('/sky/learning/today');
  });

  it('actionHref 为空串 → 兜到通用入口', () => {
    const r = buildAction(ctx({ weakPoints: [weak({ actionHref: '' })] }), ST);
    expect(r.action.href).toBe('/sky/learning/today');
  });

  it('档位非法（undefined）→ 不炸，仍给一个可点的入口', () => {
    const r = buildAction(ctx({ dueMistakeCount: 4 }), undefined as unknown as RecapState);
    expect(r.action.label).toBeTruthy();
  });
});

describe('buildRecapLine · 红线全绿（四档 × 变量边界）', () => {
  const states: RecapState[] = ['S-1', 'S-2', 'S-3', 'S-4'];
  const variants = ['B1', 'B2'] as const;
  const gaps = [
    { streak: streak({ lastActiveDate: YESTERDAY }) },
    { streak: streak({ lastActiveDate: '2026-10-01' }) },
    { streak: streak({ lastActiveDate: '2026-09-28' }) },
  ];
  const weakSets = [
    [weak()],
    [weak({ mastery: 0, recentMistakeCount: 0 })],
    [weak({ mastery: 80, recentMistakeCount: 1 })],
    [weak({ knowledgePoint: '函数与方程的几何意义辨析' })],
    [],
    [weak({ mastery: 62 }), weak({ knowledgePoint: '配方法', mastery: 20 })],
  ];

  let checked = 0;
  for (const st of states) {
    for (const variant of variants) {
      for (const g of gaps) {
        for (const ws of weakSets) {
          const c = ctx({ ...g, weakPoints: ws, recapCopyVariant: variant });
          const line = buildRecapLine(c, st);
          const sLine = buildStreakLine(c, st);
          const { action } = buildAction(c, st);
          if (line) {
            expect(isRedlineFree(line), `踩红线：${st}/${variant} → ${line}`).toBe(true);
          }
          expect(isRedlineFree(String(sLine ?? '')), `踩红线：${st}/${variant} → ${sLine}`).toBe(
            true,
          );
          expect(isRedlineFree(action.label), `踩红线：${st}/${variant} → ${action.label}`).toBe(
            true,
          );
          checked += 1;
        }
      }
    }
  }

  it(`矩阵至少覆盖 100 组组合（实际 ${checked} 组）`, () => {
    expect(checked).toBeGreaterThanOrEqual(100);
  });
});
