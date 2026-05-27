'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Brain } from 'lucide-react';

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-5 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Brain className="w-4 h-4 text-violet-500 dark:text-violet-400" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">能力雷达图</h3>
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
