'use client';

import { RippleLoader } from '../design-system/ripple-loader';
import { ShimmerBar } from '../design-system/shimmer-bar';

interface SuggestingStateProps {
  progress: number;
  status?: string;
}

export function SuggestingState({ progress, status }: SuggestingStateProps) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-7 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[100px] opacity-[0.05] bg-primary" />
      </div>

      {/* Ripple loader */}
      <RippleLoader size={72} color="#722ed1" count={3} />

      {/* Status */}
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 animate-fade-in-up">
          {status || '正在分析主题风格…'}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          AI 正在为您匹配最佳设计方案
        </p>
      </div>

      {/* Progress */}
      <div className="w-56 flex flex-col gap-2">
        <ShimmerBar progress={Math.min(progress, 100)} height={4} color="#722ed1" />
        <p className="text-center text-[11px] font-medium text-slate-400 tabular-nums">
          {Math.round(Math.min(progress, 100))}%
        </p>
      </div>
    </div>
  );
}
