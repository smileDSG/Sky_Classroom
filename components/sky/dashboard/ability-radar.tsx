'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Brain, Target } from 'lucide-react';
import Link from 'next/link';

interface RadarDimension {
  name: string;
  value: number; // 0-100
}

interface AbilityRadarProps {
  data: RadarDimension[];
}

const CX = 140, CY = 130, R = 90; // center x, center y, max radius
const LEVELS = 4;

/** Generate polygon points for n vertices at given radius ratio */
function polygonPoints(n: number, ratio: number, cx = CX, cy = CY, r = R) {
  return Array.from({ length: n }).map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x: cx + r * ratio * Math.cos(angle),
      y: cy + r * ratio * Math.sin(angle),
    };
  });
}

function pointsToAttr(pts: { x: number; y: number }[]) {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

export function AbilityRadar({ data }: AbilityRadarProps) {
  const n = data.length;
  const allZero = data.every((d) => d.value === 0);

  if (allZero) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="group relative overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-gradient-to-br from-emerald-50/40 via-white/50 to-violet-50/25 dark:from-slate-900/40 dark:via-slate-900/40 dark:to-slate-800/40 backdrop-blur-sm"
      >
        {/* Decorative background */}
        <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-400/8 rounded-full blur-xl -translate-y-1/2 -translate-x-1/2" />
        <div className="absolute bottom-0 right-0 w-20 h-20 bg-violet-400/8 rounded-full blur-xl translate-y-1/2 translate-x-1/2" />

        <div className="relative z-10 flex flex-col items-center justify-center p-5">
          <div className="mb-3 relative">
            <div className="absolute inset-0 rounded-xl bg-emerald-500/15 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/8 ring-1 ring-emerald-400/20">
              <Target className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">能力雷达待激活</h4>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center max-w-[160px] leading-relaxed">
            完成更多练习后，这里会展示知识能力分布
          </p>
          <Link
            href="/sky/solve"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/8 hover:bg-emerald-500/15 px-3 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 transition-all hover:scale-[1.02]"
          >
            <Brain className="h-3 w-3" />
            开始练习
          </Link>
        </div>
      </motion.div>
    );
  }

  const gridLevels = useMemo(() =>
    Array.from({ length: LEVELS }).map((_, i) => ({
      ratio: (i + 1) / LEVELS,
      points: polygonPoints(n, (i + 1) / LEVELS),
    })), [n]);

  const valuePoints = useMemo(() =>
    data.map((d) => ({
      x: CX + R * (d.value / 100) * Math.cos((Math.PI * 2 * data.indexOf(d)) / n - Math.PI / 2),
      y: CY + R * (d.value / 100) * Math.sin((Math.PI * 2 * data.indexOf(d)) / n - Math.PI / 2),
    })), [data, n]);

  const labelPoints = useMemo(() =>
    polygonPoints(n, 1.18), [n]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-white/50 dark:bg-slate-900/40 px-4 py-3 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">能力雷达图</h3>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span className="text-[9px] text-slate-400">{n} 维度</span>
        </div>
      </div>

      {/* SVG Radar */}
      <svg viewBox="0 0 280 260" className="w-full h-auto" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.4} />
          </linearGradient>
        </defs>

        {/* Grid levels */}
        {gridLevels.map((level, i) => (
          <motion.polygon
            key={i}
            points={pointsToAttr(level.points)}
            fill="none"
            stroke="currentColor"
            className={i === LEVELS - 1 ? 'text-slate-400 dark:text-slate-500' : 'text-slate-300 dark:text-slate-600'}
            strokeWidth={i === LEVELS - 1 ? 1 : 0.5}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          />
        ))}

        {/* Axis lines */}
        {polygonPoints(n, 1).map((p, i) => (
          <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={0.5} />
        ))}

        {/* Data area */}
        <motion.polygon
          points={pointsToAttr(valuePoints)}
          fill="url(#radarGrad)"
          stroke="#8B5CF6"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6, type: 'spring', stiffness: 120 }}
        />

        {/* Data dots */}
        {valuePoints.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#8B5CF6"
            stroke="currentColor"
            className="text-white dark:text-slate-800"
            strokeWidth={1.5}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.08 }}
          />
        ))}

        {/* Labels */}
        {labelPoints.map((p, i) => {
          const anchor = Math.abs(p.x - CX) < 5 ? 'middle' : p.x > CX ? 'start' : 'end';
          return (
            <text
              key={i}
              x={p.x}
              y={p.y + 4}
              textAnchor={anchor}
              className="fill-slate-500 dark:fill-slate-400"
              fontSize={11}
              fontWeight={500}
            >
              {data[i].name}
            </text>
          );
        })}
      </svg>
    </motion.div>
  );
}
