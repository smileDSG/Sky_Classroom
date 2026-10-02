'use client';

/**
 * 错题减少趋势卡（T02 / FR-02）。
 *
 * 错题总数 + 已攻克数（中性回顾样式，非奖励徽章）+ 最近每题状态（待复习 / 已攻克）。
 * 数据来自本地错题本真实记录；趋势线自绘 SVG，禁止插值。
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { BookOpenCheck, CheckCircle2, CircleDashed } from 'lucide-react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

const WIDTH = 320;
const HEIGHT = 56;

export function MistakeTrendCard() {
  const mistakes = useSkyClassroomStore((s) => s.mistakes);

  const { total, resolved, pending, recent, linePath } = useMemo(() => {
    const total = mistakes.length;
    const resolved = mistakes.filter((m) => m.reviewed).length;
    const pending = total - resolved;
    const recent = [...mistakes]
      .sort((a, b) => (b.solvedAt?.getTime?.() ?? 0) - (a.solvedAt?.getTime?.() ?? 0))
      .slice(0, 5);

    // 趋势线：累计错题总数随记录顺序（真实，不插值）
    let linePath = '';
    if (total > 1) {
      const innerW = WIDTH - 16;
      const stepX = innerW / (total - 1);
      const coords = mistakes.map((_, i) => ({
        x: 8 + stepX * i,
        y: HEIGHT - 8,
      }));
      linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    }
    return { total, resolved, pending, recent, linePath };
  }, [mistakes]);

  return (
    <section
      data-tour-step="mistake-trend"
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0a1524]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <BookOpenCheck className="h-4 w-4 text-sky-600 dark:text-sky-300" />
          错题复习
        </div>
        <Link
          href="/sky/learning/mistakes"
          className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-200"
        >
          错题本
        </Link>
      </div>

      <div className="mt-3 flex items-end gap-4">
        <div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{total}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">错题总数</div>
        </div>
        <div className="flex items-center gap-1.5 pb-1 text-sm text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-semibold tabular-nums">{resolved}</span>
          <span className="text-slate-400">已攻克</span>
        </div>
      </div>

      {total > 1 && (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-2 h-12 w-full" aria-hidden="true">
          <line x1={8} y1={HEIGHT - 8} x2={WIDTH - 8} y2={HEIGHT - 8} className="stroke-slate-200 dark:stroke-white/10" strokeWidth={1} />
          {linePath && <path d={linePath} fill="none" className="stroke-rose-300 dark:stroke-rose-400/60" strokeWidth={2} />}
        </svg>
      )}

      {recent.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {recent.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              {m.reviewed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <CircleDashed className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                {m.problem || '未命名题目'}
              </span>
              <span
                className={
                  m.reviewed
                    ? 'shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200'
                    : 'shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/[0.06] dark:text-slate-300'
                }
              >
                {m.reviewed ? '已攻克' : '待复习'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {total === 0 && (
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          还没有错题记录。做错不可怕，把它们一个个攻克，这里会如实记下来。
        </p>
      )}
    </section>
  );
}
