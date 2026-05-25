'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SolutionSkeletonProps {
  phase?: string;
  className?: string;
}

const phaseMessages: Record<string, string> = {
  checking: '正在检索题库...',
  routing: '正在分析题目类型...',
  solving: 'AI 正在解题中...',
  grading: '正在批改...',
};

export function SolutionSkeleton({ phase, className }: SolutionSkeletonProps) {
  const message = phase ? phaseMessages[phase] ?? '处理中...' : '处理中...';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="border-b bg-gradient-to-r from-[#4A90D9]/5 to-transparent pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-5 w-28 animate-pulse rounded bg-[#4A90D9]/20" />
            <div className="mt-1 h-4 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4A90D9] border-t-transparent" />
          <span className="text-sm text-muted-foreground">{message}</span>
        </div>

        {/* Step placeholders */}
        <div className="space-y-4">
          {/* Answer placeholder */}
          <div className="flex flex-col items-center gap-2 py-3">
            <div className="h-3 w-12 animate-pulse rounded bg-muted" />
            <div className="h-10 w-48 animate-pulse rounded-xl bg-[#4A90D9]/10" />
          </div>

          {/* Step content placeholders */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4A90D9]/10">
                <div className="h-4 w-4 animate-pulse rounded bg-[#4A90D9]/30" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted/30" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom shimmer bar */}
        <div className="mt-6 h-1 w-full animate-pulse rounded-full bg-gradient-to-r from-transparent via-[#4A90D9]/30 to-transparent" />
      </CardContent>
    </Card>
  );
}
