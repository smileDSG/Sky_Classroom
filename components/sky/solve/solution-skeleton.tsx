'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SolutionSkeletonProps {
  phase?: string;
  className?: string;
}

const phaseMessages: Record<string, string> = {
  checking: '正在查找题库...',
  routing: '正在分析题目类型...',
  solving: 'AI 正在解题中...',
  grading: '正在批改...',
};

export function SolutionSkeleton({ phase, className }: SolutionSkeletonProps) {
  const message = phase ? phaseMessages[phase] ?? '处理中...' : '处理中...';

  return (
    <Card className={cn('overflow-hidden probe-panel', className)}>
      <CardHeader className="probe-header-gradient pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-5 w-28 animate-pulse rounded bg-[var(--probe-primary)]/25" />
            <div className="mt-1 h-4 w-48 animate-pulse rounded bg-[var(--probe-primary)]/15" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-3">
          <div className="relative h-6 w-6">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-[var(--probe-primary)] border-t-transparent shadow-[0_0_8px_var(--probe-glow)]" />
          </div>
          <span className="text-sm font-medium text-[var(--probe-primary-bright)]">{message}</span>
        </div>

        {/* Step placeholders */}
        <div className="space-y-4">
          {/* Answer placeholder */}
          <div className="flex flex-col items-center gap-2 py-3">
            <div className="h-3 w-12 animate-pulse rounded bg-[var(--probe-primary)]/15" />
            <div className="h-10 w-48 animate-pulse rounded-xl bg-[var(--probe-primary)]/15 border border-[var(--probe-border)]" />
          </div>

          {/* Step content placeholders */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--probe-primary)]/20 to-[var(--probe-primary)]/10 border border-[var(--probe-primary)]/25">
                <div className="h-4 w-4 animate-pulse rounded bg-[var(--probe-primary)]/40" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-[var(--probe-primary)]/20" />
                <div className="h-3 w-full animate-pulse rounded bg-[var(--probe-primary)]/12" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--probe-primary)]/8" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom shimmer bar */}
        <div className="mt-6 h-1 w-full animate-pulse rounded-full bg-gradient-to-r from-transparent via-[var(--probe-primary)]/40 to-transparent shadow-[0_0_6px_var(--probe-glow)]" />
      </CardContent>
    </Card>
  );
}
