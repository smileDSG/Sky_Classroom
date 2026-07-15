'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Search } from 'lucide-react';
import Link from 'next/link';
import { useAnimatedNumber } from '@/lib/hooks/use-animated-number';

interface DayData {
  day: string;
  total: number;
  reviewed: number;
}

interface LearningTrendChartProps {
  data: DayData[];
}

const CHART = { width: 480, height: 220, padL: 45, padR: 15, padT: 20, padB: 35 };

function buildPoints(data: DayData[], key: 'total' | 'reviewed') {
  const { width: W, height: H, padL, padR, padT, padB } = CHART;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...data.map((d) => Math.max(d.total, d.reviewed)), 1);
  const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;

  return data.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + chartH - (d[key] / maxVal) * chartH,
    day: d.day,
    value: d[key],
  }));
}

function GridLines({ maxVal }: { maxVal: number }) {
  const { padL, padT, padB, width: W, padR } = CHART;
  const chartH = CHART.height - padT - padB;
  const lines = 4;
  return (
    <>
      {Array.from({ length: lines + 1 }).map((_, i) => {
        const y = padT + (i / lines) * chartH;
        const val = Math.round(maxVal - (i / lines) * maxVal);
        return (
          <g key={i}>
            <line
              x1={padL}
              y1={y}
              x2={W - padR}
              y2={y}
              className="stroke-slate-300 dark:stroke-slate-600"
              strokeWidth={0.5}
              strokeDasharray="4,4"
            />
            <text
              x={padL - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-slate-400 dark:fill-slate-500"
              fontSize={10}
            >
              {val}
            </text>
          </g>
        );
      })}
    </>
  );
}

function buildPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
}

function buildArea(pathD: string, points: { x: number }[]): string {
  const bottom = CHART.padT + CHART.height - CHART.padT - CHART.padB;
  return `${pathD} L${points[points.length - 1].x},${bottom} L${points[0].x},${bottom} Z`;
}

export function LearningTrendChart({ data }: LearningTrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const maxVal = useMemo(
    () => Math.max(...data.map((d) => Math.max(d.total, d.reviewed)), 1),
    [data],
  );
  const totalPoints = useMemo(() => buildPoints(data, 'total'), [data]);
  const reviewedPoints = useMemo(() => buildPoints(data, 'reviewed'), [data]);

  const totalPath = useMemo(() => buildPath(totalPoints), [totalPoints]);
  const reviewedPath = useMemo(() => buildPath(reviewedPoints), [reviewedPoints]);

  const totalCount = useAnimatedNumber(
    data.reduce((s, d) => s + d.total, 0),
    { duration: 1500 },
  );
  const reviewedCount = useAnimatedNumber(
    data.reduce((s, d) => s + d.reviewed, 0),
    { duration: 1500 },
  );

  if (data.length === 0 || data.every((d) => d.total === 0)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-gradient-to-br from-violet-50/40 via-white/50 to-cyan-50/25 dark:from-slate-900/40 dark:via-slate-900/40 dark:to-slate-800/40 backdrop-blur-sm"
      >
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-28 h-28 bg-violet-400/8 rounded-full blur-xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-cyan-400/8 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 flex flex-col items-center justify-center p-5">
          {/* Animated chart icon */}
          <div className="mb-3 relative">
            <div className="absolute inset-0 rounded-xl bg-violet-500/15 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/8 ring-1 ring-violet-400/20">
              <TrendingUp className="h-6 w-6 text-violet-500" />
            </div>
          </div>
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            学习趋势即将呈现
          </h4>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center max-w-[180px]">
            完成搜题后，这里会展示近14天的学习曲线
          </p>
          <Link
            href="/sky/cloud-mind/solve"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-violet-500/8 hover:bg-violet-500/15 px-3 py-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 transition-all hover:scale-[1.02]"
          >
            <Search className="h-3 w-3" />
            开始搜题
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-white/50 dark:bg-slate-900/40 px-4 py-3 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            近14天学习趋势
          </h3>
        </div>
        <div className="flex items-center gap-2.5 text-[10px]">
          <span className="text-slate-500 dark:text-slate-400">
            错题{' '}
            <span className="text-violet-500 dark:text-violet-400 font-bold">
              {Math.round(totalCount.value)}
            </span>
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            已复习{' '}
            <span className="text-emerald-500 dark:text-emerald-400 font-bold">
              {Math.round(reviewedCount.value)}
            </span>
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-2 ml-10">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500" />
          <span className="text-[10px] text-slate-400">错题数</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-slate-400">已复习</span>
        </div>
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        className="w-full h-auto"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="totalLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="totalAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="reviewedAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <GridLines maxVal={maxVal} />

        {/* X axis labels */}
        {totalPoints.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={CHART.height - 6}
            textAnchor="middle"
            className="fill-slate-500 dark:fill-slate-400"
            fontSize={10}
          >
            {p.day}
          </text>
        ))}

        {/* Area fills */}
        <motion.path
          d={buildArea(totalPath, totalPoints)}
          fill="url(#totalAreaGrad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        />
        <motion.path
          d={buildArea(reviewedPath, reviewedPoints)}
          fill="url(#reviewedAreaGrad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        />

        {/* Reviewed line (behind) */}
        <motion.path
          d={reviewedPath}
          fill="none"
          stroke="#10B981"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.1 }}
          style={{ pathLength: 1 }}
        />

        {/* Total line (front) */}
        <motion.path
          d={totalPath}
          fill="none"
          stroke="url(#totalLineGrad)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{ pathLength: 1 }}
        />

        {/* Data dots — total line */}
        {totalPoints.map((p, i) => (
          <g
            key={`t-${i}`}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            className="cursor-pointer"
          >
            <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill="#8B5CF6"
              stroke="currentColor"
              className="text-white dark:text-slate-800"
              strokeWidth={2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + i * 0.06 }}
            />
          </g>
        ))}

        {/* Data dots — reviewed line */}
        {reviewedPoints.map((p, i) => (
          <g
            key={`r-${i}`}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            className="cursor-pointer"
          >
            <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={3}
              fill="#10B981"
              stroke="currentColor"
              className="text-white dark:text-slate-800"
              strokeWidth={1.5}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.35 + i * 0.06 }}
            />
          </g>
        ))}

        {/* Tooltip */}
        {hoverIdx !== null &&
          (() => {
            const tp = totalPoints[hoverIdx];
            const rp = reviewedPoints[hoverIdx];
            const tipY = Math.min(tp.y, rp.y) - 28;
            return (
              <g>
                <rect
                  x={tp.x - 40}
                  y={tipY}
                  width={80}
                  height={28}
                  rx={6}
                  className="fill-slate-800 dark:fill-slate-700"
                  stroke="#475569"
                />
                <text
                  x={tp.x}
                  y={tipY + 12}
                  textAnchor="middle"
                  className="fill-slate-100"
                  fontSize={10}
                  fontWeight={600}
                >
                  错题 {data[hoverIdx].total}
                </text>
                <text
                  x={tp.x}
                  y={tipY + 23}
                  textAnchor="middle"
                  className="fill-emerald-300"
                  fontSize={10}
                >
                  已复习 {data[hoverIdx].reviewed}
                </text>
              </g>
            );
          })()}
      </svg>
    </motion.div>
  );
}
