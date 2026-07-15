'use client';

import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { MathRenderer } from './math-renderer';
import type { GradeResult, MistakeCause } from '@/lib/solve/types';

interface GradeResultCardProps {
  result: GradeResult;
  className?: string;
}

const causeLabels: Record<MistakeCause, { label: string; color: string; bgColor: string }> = {
  'concept-unclear': {
    label: '概念不清',
    color: 'text-[var(--probe-warm)]',
    bgColor: 'bg-[var(--probe-warm)]/15 border border-[var(--probe-warm)]/25',
  },
  'calculation-error': {
    label: '计算失误',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/15 border border-orange-400/25',
  },
  misreading: {
    label: '审题错误',
    color: 'text-[var(--probe-accent)]',
    bgColor: 'bg-[var(--probe-accent)]/15 border border-[var(--probe-accent)]/25',
  },
  'method-wrong': {
    label: '方法错误',
    color: 'text-[var(--probe-error)]',
    bgColor: 'bg-[var(--probe-error)]/15 border border-[var(--probe-error)]/25',
  },
  careless: {
    label: '粗心大意',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/15 border border-yellow-400/25',
  },
  'format-error': {
    label: '格式错误',
    color: 'text-[var(--probe-primary-bright)]',
    bgColor: 'bg-[var(--probe-primary)]/15 border border-[var(--probe-primary)]/25',
  },
};

export function GradeResultCard({ result, className }: GradeResultCardProps) {
  const { isCorrect, score, correctAnswer, userAnswer, errorAnalysis, cause, partialCredit } =
    result;
  const causeInfo = causeLabels[cause];

  return (
    <Card className={cn('overflow-hidden probe-panel', className)}>
      <CardHeader
        className={cn(
          'pb-4',
          isCorrect
            ? 'bg-gradient-to-r from-[var(--probe-success)]/15 via-[var(--probe-success)]/10 to-transparent'
            : 'bg-gradient-to-r from-[var(--probe-error)]/15 via-[var(--probe-error)]/10 to-transparent',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isCorrect ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--probe-success)] to-emerald-400 text-white shadow-[0_0_16px_rgba(52,211,153,0.4)]">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--probe-error)] to-rose-400 text-white shadow-[0_0_16px_rgba(248,113,113,0.4)]">
                <XCircle className="h-6 w-6" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg text-[var(--probe-text)]">
                {isCorrect ? '信号匹配成功！' : '信号异常'}
              </CardTitle>
              <p className="text-sm text-[var(--probe-muted)]">
                {isCorrect
                  ? '继续保持，你已经掌握了这个知识点'
                  : '别担心，我们来看看信号偏差在哪里'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                'text-3xl font-bold',
                isCorrect ? 'text-[var(--probe-success)]' : 'text-[var(--probe-error)]',
              )}
              style={{
                textShadow: isCorrect
                  ? '0 0 16px rgba(52,211,153,0.4)'
                  : '0 0 16px rgba(248,113,113,0.4)',
              }}
            >
              {score}分
            </div>
            <div className="text-xs text-[var(--probe-muted)]">满分100分</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--probe-muted)]">信号匹配度</span>
            <span
              className={cn(
                'font-semibold',
                score >= 60 ? 'text-[var(--probe-success)]' : 'text-[var(--probe-error)]',
              )}
            >
              {score >= 60 ? '匹配' : '未匹配'}
            </span>
          </div>
          <Progress
            value={score}
            className={cn(
              'h-2.5',
              'bg-[var(--probe-primary)]/15',
              score >= 60
                ? '[&>div]:bg-gradient-to-r [&>div]:from-[var(--probe-success)] [&>div]:to-emerald-400'
                : '[&>div]:bg-gradient-to-r [&>div]:from-[var(--probe-error)] [&>div]:to-rose-400',
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--probe-muted)]">
              <Info className="h-4 w-4" />
              你的信号
            </label>
            <div
              className={cn(
                'probe-panel rounded-lg p-3',
                isCorrect ? 'border-[var(--probe-success)]/30' : 'border-[var(--probe-error)]/30',
              )}
            >
              <MathRenderer
                content={userAnswer}
                className={cn(
                  'text-sm leading-normal',
                  isCorrect ? 'text-[var(--probe-success)]' : 'text-[var(--probe-error)]',
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--probe-muted)]">
              <CheckCircle2 className="h-4 w-4" />
              正确信号
            </label>
            <div className="probe-panel rounded-lg p-3 border-[var(--probe-success)]/30">
              <MathRenderer
                content={correctAnswer}
                className="text-sm leading-normal text-[var(--probe-success)]"
              />
            </div>
          </div>
        </div>

        {!isCorrect && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[var(--probe-warm)]" />
              <span className="text-sm font-semibold text-[var(--probe-text)]">异常分析</span>
            </div>
            <div className="space-y-2">
              <Badge variant="secondary" className={cn(causeInfo.bgColor, causeInfo.color)}>
                {causeInfo.label}
              </Badge>
              <p className="text-sm text-[var(--probe-muted)]">{errorAnalysis}</p>
            </div>
          </div>
        )}

        {partialCredit && partialCredit.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-[var(--probe-text)]">分步得分</div>
            <div className="space-y-2">
              {partialCredit.map((step, index) => (
                <div
                  key={index}
                  className="probe-panel flex items-center justify-between rounded-lg p-3"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--probe-text)]">{step.step}</div>
                    {step.comment && (
                      <div className="text-xs text-[var(--probe-muted)]">{step.comment}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div
                      className={cn(
                        'text-sm font-bold',
                        step.earnedScore >= step.maxScore
                          ? 'text-[var(--probe-success)]'
                          : step.earnedScore > 0
                            ? 'text-[var(--probe-warm)]'
                            : 'text-[var(--probe-error)]',
                      )}
                    >
                      {step.earnedScore}/{step.maxScore}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
