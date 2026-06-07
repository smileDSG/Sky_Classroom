'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Palette, Layout } from 'lucide-react';
import { CelestialCanvas } from '../design-system/celestial-canvas';
import { SuggestingSkeleton } from './suggesting-skeleton';

interface SuggestingStateProps {
  progress: number;
  status?: string;
}

const STEPS = [
  { key: 'analyzing', label: '分析主题语义', desc: '提取学科关键词与风格倾向', icon: Sparkles, threshold: 30, angle: -90 },
  { key: 'matching', label: '匹配视觉风格', desc: '从风格库中筛选最佳候选', icon: Palette, threshold: 60, angle: 30 },
  { key: 'rendering', label: '生成封面方案', desc: '实时渲染3套推荐封面', icon: Layout, threshold: 100, angle: 150 },
] as const;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const a = toRad(angleDeg);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export function SuggestingState({ progress, status }: SuggestingStateProps) {
  const activeStep = useMemo(() => {
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (progress >= STEPS[i].threshold - 10) return i;
    }
    return 0;
  }, [progress]);

  const clampedProgress = Math.min(progress, 100);
  const isComplete = clampedProgress >= 100;

  // Star chart geometry
  const cx = 100;
  const cy = 100;
  const orbitR = 70;

  const nodePositions = STEPS.map((s) => polarPoint(cx, cy, orbitR, s.angle));

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 overflow-hidden">
      {/* Deep space background */}
      <CelestialCanvas starCount={60} parallax={false} nebula grid={false} />

      {/* Ambient nebula glow */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full animate-nebula-drift"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06), transparent 70%)', filter: 'blur(60px)' }}
        />
      </div>

      {/* Completion warp-flash */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 z-20"
            style={{ background: 'radial-gradient(circle, rgba(255,140,105,0.15), transparent 60%)' }}
          />
        )}
      </AnimatePresence>

      {/* Star chart */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative" style={{ width: 220, height: 220 }}>
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            {/* Rotating outer ring */}
            <g className="animate-orbit-slow" style={{ transformOrigin: '100px 100px' }}>
              <circle cx={cx} cy={cy} r={orbitR + 18} fill="none" stroke="rgba(245,230,200,0.06)" strokeWidth="0.5" strokeDasharray="4 6" />
            </g>

            {/* Inner dashed ring */}
            <circle cx={cx} cy={cy} r={orbitR - 12} fill="none" stroke="rgba(245,230,200,0.04)" strokeWidth="0.5" strokeDasharray="2 8" />

            {/* Connection lines between nodes */}
            {nodePositions.map((p, i) => {
              const next = nodePositions[(i + 1) % nodePositions.length];
              const isDone = clampedProgress >= STEPS[i].threshold;
              return (
                <line
                  key={`line-${i}`}
                  x1={p.x} y1={p.y} x2={next.x} y2={next.y}
                  stroke={isDone ? 'rgba(245,230,200,0.25)' : 'rgba(45,53,97,0.4)'}
                  strokeWidth={isDone ? 1 : 0.5}
                  strokeDasharray={isDone ? 'none' : '3 4'}
                  style={{ transition: 'all 0.8s ease-out' }}
                />
              );
            })}

            {/* Nodes */}
            {STEPS.map((step, i) => {
              const p = nodePositions[i];
              const isDone = clampedProgress >= step.threshold;
              const isActive = i === activeStep && !isDone;

              return (
                <g key={step.key}>
                  {/* Cross flare for active/done */}
                  {(isActive || isDone) && (
                    <g style={{ transformOrigin: `${p.x}px ${p.y}px` }} className={isActive ? 'animate-cross-flare' : ''}>
                      <line x1={p.x - 10} y1={p.y} x2={p.x + 10} y2={p.y} stroke={isActive ? 'rgba(255,140,105,0.4)' : 'rgba(245,230,200,0.15)'} strokeWidth="0.5" />
                      <line x1={p.x} y1={p.y - 10} x2={p.x} y2={p.y + 10} stroke={isActive ? 'rgba(255,140,105,0.4)' : 'rgba(245,230,200,0.15)'} strokeWidth="0.5" />
                    </g>
                  )}

                  {/* Outer ring for active */}
                  {isActive && (
                    <circle cx={p.x} cy={p.y} r="12" fill="none" stroke="rgba(255,140,105,0.3)" strokeWidth="0.5" className="animate-ring-expand" style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
                  )}

                  {/* Node dot */}
                  <circle
                    cx={p.x} cy={p.y} r={isActive ? 5 : isDone ? 4 : 3}
                    fill={isActive ? '#FF8C69' : isDone ? '#F5E6C8' : 'none'}
                    stroke={isDone || isActive ? 'none' : 'rgba(45,53,97,0.6)'}
                    strokeWidth={isDone || isActive ? 0 : 1}
                    style={{ transition: 'all 0.5s ease-out' }}
                  />

                  {/* Glow for active/done */}
                  {(isActive || isDone) && (
                    <circle
                      cx={p.x} cy={p.y} r={isActive ? 10 : 6}
                      fill={isActive ? 'rgba(255,140,105,0.15)' : 'rgba(245,230,200,0.1)'}
                      style={{ filter: 'blur(3px)', transition: 'all 0.5s ease-out' }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Floating icons at node positions (rotated back since SVG is rotated -90deg) */}
          <div className="absolute inset-0" style={{ transform: 'rotate(0deg)' }}>
            {STEPS.map((step, i) => {
              const p = nodePositions[i];
              const isDone = clampedProgress >= step.threshold;
              const isActive = i === activeStep && !isDone;
              const Icon = step.icon;

              return (
                <div
                  key={`icon-${step.key}`}
                  className="absolute flex flex-col items-center gap-1"
                  style={{
                    left: `${(p.x / 200) * 100}%`,
                    top: `${(p.y / 200) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <Icon
                    className={`h-3.5 w-3.5 transition-colors duration-500 ${
                      isActive ? 'text-[var(--celestial-dawn)]' : isDone ? 'text-[var(--celestial-starlight)]/60' : 'text-[var(--celestial-haze)]'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Step labels around the chart */}
        <div className="flex items-center gap-6">
          {STEPS.map((step, i) => {
            const isDone = clampedProgress >= step.threshold;
            const isActive = i === activeStep && !isDone;
            return (
              <motion.div
                key={`label-${step.key}`}
                className="flex flex-col items-center gap-1"
                animate={isActive ? { y: [0, -2, 0] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span
                  className={`text-[11px] font-medium transition-colors duration-500 ${
                    isActive ? 'text-[var(--celestial-dawn)]' : isDone ? 'text-[var(--celestial-starlight)]/70' : 'text-[var(--celestial-starlight)]/20'
                  }`}
                >
                  {step.label}
                </span>
                <div
                  className={`h-[2px] rounded-full transition-all duration-700 ${
                    isDone ? 'w-8 bg-[var(--celestial-starlight)]/30' : isActive ? 'w-4 bg-[var(--celestial-dawn)]/40' : 'w-2 bg-[var(--celestial-starlight)]/10'
                  }`}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Current step detail — data stream style */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isComplete ? 'complete' : STEPS[activeStep].key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-center font-mono"
          >
            <p className={`text-xs font-semibold tracking-wide ${isComplete ? 'text-[var(--celestial-dawn)]' : 'text-[var(--celestial-starlight)]/80'}`}>
              <span className={isComplete ? 'animate-pulse' : ''}>
                <span className="text-[var(--celestial-nebula)]">{'>'}{'>'}</span>{' '}
                {isComplete ? '风格引擎就绪' : status || STEPS[activeStep].label}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-[var(--celestial-starlight)]/30">
              {isComplete ? '正在进入封面预览…' : STEPS[activeStep].desc}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Cover nebulae skeletons */}
      <div className="relative z-10 w-full max-w-md px-4">
        <SuggestingSkeleton progress={clampedProgress} />
      </div>

      {/* Progress bar — star trail */}
      <div className="relative z-10 w-64 flex flex-col gap-2">
        <div className="w-full h-[2px] rounded-full overflow-hidden bg-[var(--celestial-haze)]/20">
          <motion.div
            className={`h-full rounded-full ${isComplete ? 'animate-pulse' : ''}`}
            style={{
              background: 'linear-gradient(90deg, var(--celestial-nebula), var(--celestial-dawn))',
              boxShadow: isComplete
                ? '0 0 16px rgba(255,140,105,0.55), 0 0 6px rgba(139,92,246,0.4)'
                : '0 0 8px rgba(255,140,105,0.3)',
            }}
            animate={{ width: `${clampedProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <div className="flex items-center justify-between font-mono">
          <p className="text-[11px] text-[var(--celestial-starlight)]/30 tabular-nums tracking-wide">
            {Math.round(clampedProgress)}%
          </p>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--celestial-nebula)] animate-pulse" />
            <span className="text-[10px] text-[var(--celestial-starlight)]/25">AI 风格引擎</span>
          </div>
        </div>
      </div>
    </div>
  );
}
