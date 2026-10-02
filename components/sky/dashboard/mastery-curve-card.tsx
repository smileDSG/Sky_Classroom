'use client';

/**
 * 掌握度曲线卡（T02 / FR-01）。
 *
 * SVG 自绘掌握度曲线（已掌握 / 薄弱 / 未学 三态），联动错题本。
 * 曲线数据 = 服务端真实快照序列（getMasteryCurve）+ 当前错题本的实时点，
 * 经 lib/sky/learning-insights.buildGrowthCurve 派生，禁止插值膨胀。
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Network } from 'lucide-react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildGrowthCurve, type GrowthCurvePoint } from '@/lib/sky/learning-insights';
import { fetchGrowthHistory } from '@/lib/retention/growth-client';
import type { GrowthSnapshot } from '@/lib/retention/types';

const WIDTH = 320;
const HEIGHT = 140;
const PAD_X = 28;
const PAD_Y = 16;

export function MasteryCurveCard() {
  const mistakes = useSkyClassroomStore((s) => s.mistakes);
  const growthLocalCache = useSkyClassroomStore((s) => s.growthLocalCache);
  const [history, setHistory] = useState<GrowthSnapshot[]>(growthLocalCache);

  useEffect(() => {
    let active = true;
    void fetchGrowthHistory().then((res) => {
      if (active && res) {
        setHistory(res.curve);
        useSkyClassroomStore.setState({ growthLocalCache: res.curve });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const points: GrowthCurvePoint[] = useMemo(
    () => buildGrowthCurve(mistakes, history),
    [mistakes, history],
  );

  const latest = points[points.length - 1];

  const { path, lastX, lastY } = useMemo(() => {
    if (points.length === 0) return { path: '', lastX: 0, lastY: 0 };
    const maxVal = 100;
    const innerW = WIDTH - PAD_X * 2;
    const innerH = HEIGHT - PAD_Y * 2;
    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
    const coords = points.map((p, i) => {
      const x = PAD_X + stepX * i;
      const y = PAD_Y + innerH * (1 - Math.min(maxVal, Math.max(0, p.masteryPercent)) / maxVal);
      return { x, y };
    });
    const d = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(' ');
    const last = coords[coords.length - 1] ?? { x: 0, y: 0 };
    return { path: d, lastX: last.x, lastY: last.y };
  }, [points]);

  const weakLatest = latest?.weakCount ?? 0;

  return (
    <section
      data-tour-step="mastery-curve"
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0a1524]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Network className="h-4 w-4 text-sky-600 dark:text-sky-300" />
          掌握度曲线
        </div>
        <Link
          href="/sky/learning/graph"
          className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-200"
        >
          知识地图
        </Link>
      </div>

      <div className="mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-36 w-full"
          role="img"
          aria-label="掌握度随时间变化曲线"
        >
          {/* 基准网格：未学(0) / 薄弱(50) / 已掌握(80) 参考线 */}
          <line x1={PAD_X} y1={HEIGHT - PAD_Y} x2={WIDTH - PAD_X} y2={HEIGHT - PAD_Y} className="stroke-slate-200 dark:stroke-white/10" strokeWidth={1} />
          <line x1={PAD_X} y1={PAD_Y + (HEIGHT - PAD_Y * 2) * 0.5} x2={WIDTH - PAD_X} y2={PAD_Y + (HEIGHT - PAD_Y * 2) * 0.5} className="stroke-slate-100 dark:stroke-white/[0.06]" strokeWidth={1} strokeDasharray="3 3" />
          {path && (
            <path d={path} fill="none" className="stroke-sky-500 dark:stroke-sky-300" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {points.length > 0 && (
            <circle cx={lastX} cy={lastY} r={3.5} className="fill-sky-500 dark:fill-sky-300" />
          )}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> 掌握度（实时 {latest ? `${latest.masteryPercent}%` : '—'}）
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> 薄弱点 {weakLatest}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" /> 未学（图谱未覆盖）
        </span>
      </div>

      {points.length <= 1 && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          多做几道题，曲线会随真实记录慢慢长出来。
        </p>
      )}
    </section>
  );
}
