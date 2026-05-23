'use client';

import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { GradeResult, MistakeCause } from '@/lib/solve/types';

interface GradeResultCardProps {
  result: GradeResult;
  className?: string;
}

const causeLabels: Record<MistakeCause, { label: string; color: string; bgColor: string }> = {
  'concept-unclear': {
    label: '概念不清',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  'calculation-error': {
    label: '计算失误',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
  },
  misreading: {
    label: '审题错误',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  'method-wrong': {
    label: '方法错误',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  careless: {
    label: '粗心大意',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
  },
  'format-error': {
    label: '格式错误',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
  },
};

export function GradeResultCard({ result, className }: GradeResultCardProps) {
  const { isCorrect, score, correctAnswer, userAnswer, errorAnalysis, cause, partialCredit } =
    result;
  const causeInfo = causeLabels[cause];

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className={cn('pb-4', isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isCorrect ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white">
                <XCircle className="h-6 w-6" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">
                {isCorrect ? '回答正确！' : '回答有误'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {isCorrect ? '继续保持，你已经掌握了这个知识点' : '别担心，我们来看看错在哪里'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={cn('text-3xl font-bold', isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              {score}分
            </div>
            <div className="text-xs text-muted-foreground">满分100分</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">得分情况</span>
            <span className={cn('font-medium', score >= 60 ? 'text-green-600' : 'text-red-600')}>
              {score >= 60 ? '及格' : '不及格'}
            </span>
          </div>
          <Progress
            value={score}
            className="h-2"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Info className="h-4 w-4" />
              你的答案
            </label>
            <div className={cn('rounded-lg border p-3 font-mono text-sm', isCorrect ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20', isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}>
              {userAnswer}
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              正确答案
            </label>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 font-mono text-sm text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300">
              {correctAnswer}
            </div>
          </div>
        </div>

        {!isCorrect && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">错因分析</span>
            </div>
            <div className="space-y-2">
              <Badge
                variant="secondary"
                className={cn(causeInfo.bgColor, causeInfo.color, 'border-none')}
              >
                {causeInfo.label}
              </Badge>
              <p className="text-sm text-muted-foreground">{errorAnalysis}</p>
            </div>
          </div>
        )}

        {partialCredit && partialCredit.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium">分步得分</div>
            <div className="space-y-2">
              {partialCredit.map((step, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">{step.step}</div>
                    {step.comment && (
                      <div className="text-xs text-muted-foreground">{step.comment}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div
                      className={cn(
                        'text-sm font-bold',
                        step.earnedScore >= step.maxScore
                          ? 'text-green-600'
                          : step.earnedScore > 0
                            ? 'text-amber-600'
                            : 'text-red-600'
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
