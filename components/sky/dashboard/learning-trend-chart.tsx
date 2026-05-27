'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { useAnimatedNumber } from '@/lib/hooks/use-animated-number';

interface DayData {
  day: string;
  count: number;
}

interface LearningTrendChartProps {
  data: DayData[];
}

const CHART = { width: 480, height: 220, padL: 45, padR: 15, padT: 20, padB: 35 };

function buildPoints(data: DayData[]) {
  const { width: W, height: H, padL, padR, padT, padB } = CHART;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;

  return data.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + chartH - (d.count / maxVal) * chartH,
    ...d,
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
            <line x1={padL} y1={y} x2={W - padR} y2={y} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={0.5} strokeDasharray="4,4" />
            <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 dark:fill-slate-500" fontSize={10}>
              {val}
            </text>
          </g>
        );
      })}
    </>
  );
}

function Tooltip({ x, y, count, day }: { x: number; y: number; count: number; day: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={10} fill="#8B5CF6" fillOpacity={0.2} />
      <circle cx={x} cy={y} r={4} fill="#8B5CF6" />
      <rect x={x - 25} y={y - 30} width={50} height={22} rx={6} className="fill-slate-800 dark:fill-slate-700" stroke="#475569" />
      <text x={x} y={y - 15} textAnchor="middle" className="fill-slate-100 dark:fill-slate-200" fontSize={11} fontWeight={600}>
        {count} 题 · {day}
      </text>
    </g>
  );
}

export function LearningTrendChart({ data }: LearningTrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const points = useMemo(() => buildPoints(data), [data]);
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);
  const total = useAnimatedNumber(data.reduce((s, d) => s + d.count, 0), { duration: 1500 });

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm">
        <p className="text-slate-500">暂无数据</p>
      </div>
    );
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const chartBottom = CHART.padT + CHART.height - CHART.padT - CHART.padB;
  const areaD = `${pathD} L${points[points.length - 1].x},${chartBottom} L${points[0].x},${chartBottom} Z`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-5 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">近7天学习趋势</h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">共 <span className="text-cyan-500 dark:text-cyan-400 font-bold">{Math.round(total.value)}</span> 题</span>
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <GridLines maxVal={maxVal} />

        {/* X axis labels */}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={CHART.height - 6} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" fontSize={10}>
            {p.day}
          </text>
        ))}

        {/* Area fill */}
        <motion.path
          d={areaD}
          fill="url(#areaGrad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        />

        {/* Line */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{ pathLength: 1 }}
        />

        {/* Data dots */}
        {points.map((p, i) => (
          <g
            key={i}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            className="cursor-pointer"
          >
            <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={4}
              fill="#8B5CF6"
              stroke="currentColor"
              className="text-white dark:text-slate-800"
              strokeWidth={2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            />
            {hoverIdx === i && <Tooltip x={p.x} y={p.y} count={p.count} day={p.day} />}
          </g>
        ))}
      </svg>
    </motion.div>
  );
}
