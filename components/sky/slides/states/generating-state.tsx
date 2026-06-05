'use client';

import { useEffect, useState } from 'react';
import { AmbientGlow } from '../design-system/ambient-glow';
import { ShimmerBar } from '../design-system/shimmer-bar';

const STAGES = [
  { key: 'planning', label: '规划大纲', desc: '分析主题结构' },
  { key: 'sections_generating', label: '生成内容', desc: '撰写各章节内容' },
  { key: 'pages_designing', label: '设计排版', desc: '布局与视觉设计' },
  { key: 'qa_reviewing', label: '质量检查', desc: 'AI 质检与评分' },
  { key: 'repairing', label: '修复优化', desc: '自动修复问题' },
  { key: 'merging', label: '合并导出', desc: '生成最终文件' },
  { key: 'done', label: '完成', desc: '课件已就绪' },
] as const;

interface GeneratingStateProps {
  stage: string;
  progress: number;
  status?: string;
}

export function GeneratingState({ stage, progress, status }: GeneratingStateProps) {
  const currentIdx = STAGES.findIndex((s) => s.key === stage);
  const activeIdx = Math.max(0, currentIdx >= 0 ? currentIdx : 0);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowCancel(true), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden">
      {/* Upgraded ambient background */}
      <AmbientGlow color="#722ed1" accentColor="#6366f1" intensity="high" variant="generating" />

      {/* Animated node cluster */}
      <div className="relative flex flex-col items-center gap-5">
        {/* Orbiting system with truly moving particles */}
        <div className="relative h-24 w-24">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border border-primary/15 animate-[spin_10s_linear_infinite]" />
          {/* Middle ring */}
          <div className="absolute inset-2 rounded-full border border-primary/10 animate-[spin_7s_linear_infinite_reverse]" />
          {/* Inner ring */}
          <div className="absolute inset-4 rounded-full border border-primary/10 animate-[spin_4s_linear_infinite]" />

          {/* Center pulsing dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-primary animate-soft-pulse" />
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-primary/50 animate-ring-expand" />
            </div>
          </div>

          {/* Orbiting particles — now truly orbiting via rotation containers */}
          <div className="absolute inset-0 animate-[spin_10s_linear_infinite]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
              <div className="h-1.5 w-1.5 rounded-full bg-primary/80 shadow-[0_0_8px_2px_rgba(114,46,209,0.4)]" />
            </div>
          </div>
          <div className="absolute inset-0 animate-[spin_7s_linear_infinite_reverse]">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1">
              <div className="h-1 w-1 rounded-full bg-sky-400/70 shadow-[0_0_6px_2px_rgba(14,165,233,0.3)]" />
            </div>
          </div>
          <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2">
              <div className="h-1 w-1 rounded-full bg-primary/60 shadow-[0_0_6px_2px_rgba(114,46,209,0.3)]" />
            </div>
          </div>
          <div className="absolute inset-0 animate-[spin_12s_linear_infinite_reverse]">
            <div className="absolute right-0 top-1/2 translate-x-1 -translate-y-1/2">
              <div className="h-1.5 w-1.5 rounded-full bg-violet-400/70 shadow-[0_0_8px_2px_rgba(139,92,246,0.3)]" />
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center animate-fade-in-up">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {status || STAGES[activeIdx]?.label || '准备中'}
          </p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {STAGES[activeIdx]?.desc}
          </p>
        </div>
      </div>

      {/* Stage timeline — refined */}
      <div className="flex flex-col gap-1.5 w-64">
        {STAGES.map((s, i) => {
          const isDone = i < activeIdx;
          const isActive = i === activeIdx;
          const isFuture = i > activeIdx;

          return (
            <div
              key={s.key}
              className={`flex items-center gap-3 py-0.5 transition-all duration-500 ${isFuture ? 'hidden' : ''}`}
              style={{
                opacity: isFuture ? 0 : isActive ? 1 : 0.7,
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {/* Node */}
              <div className="relative flex-shrink-0">
                <div
                  className={`h-2 w-2 rounded-full transition-all duration-500 ${
                    isActive
                      ? 'bg-primary animate-node-pulse'
                      : isDone
                        ? 'bg-primary/70'
                        : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
                {isActive && (
                  <div className="absolute inset-0 h-2 w-2 rounded-full bg-primary animate-ring-expand" />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-xs font-medium transition-colors duration-300 ${
                  isActive
                    ? 'text-primary'
                    : isDone
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-slate-300 dark:text-slate-600'
                }`}
              >
                {s.label}
              </span>

              {/* Connector line to next */}
              {i < STAGES.length - 1 && (
                <div className="flex-1 h-px mx-1">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      background: isDone
                        ? 'linear-gradient(90deg, rgba(114,46,209,0.6), rgba(114,46,209,0.25))'
                        : 'rgba(0,0,0,0.04)',
                      width: isDone ? '100%' : isActive ? `${Math.min((progress % 15) / 15 * 100, 100)}%` : '0%',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Shimmer progress bar */}
      <div className="w-64 flex flex-col gap-2">
        <ShimmerBar progress={progress} height={5} color="#722ed1" />
        <p className="text-center text-[11px] font-medium text-slate-400 tabular-nums">
          {Math.round(progress)}%
        </p>
      </div>
    </div>
  );
}
