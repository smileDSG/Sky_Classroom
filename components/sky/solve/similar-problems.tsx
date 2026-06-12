'use client';

import { useState } from 'react';
import { BookOpen, ChevronRight, RotateCcw, Target, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MathRenderer } from './math-renderer';
import type { FourPartOutput } from '@/lib/solve/types';

interface SimilarProblemsProps {
  similarQuestions: FourPartOutput['similarQuestions'];
  onQuestionClick?: (problem: string) => void;
  onPracticeClick?: () => void;
  className?: string;
}

export function SimilarProblems({
  similarQuestions,
  onQuestionClick,
  onPracticeClick,
  className,
}: SimilarProblemsProps) {
  const [completedQuestions, setCompletedQuestions] = useState<Set<number>>(new Set());
  const [showingAnswer, setShowingAnswer] = useState<Set<number>>(new Set());

  const toggleCompleted = (index: number) => {
    setCompletedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAnswer = (index: number) => {
    setShowingAnswer((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleQuestionClick = (_problem: string, index: number) => {
    // Clicking the question text toggles the answer display
    toggleAnswer(index);
  };

  return (
    <Card className={cn('overflow-hidden probe-panel', className)}>
      <CardHeader className="probe-header-gradient">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg text-[var(--probe-text)]">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--probe-warm)]/25 to-[var(--probe-primary)]/15 border border-[var(--probe-warm)]/20 shadow-[0_0_8px_rgba(251,146,60,0.2)]">
                <RotateCcw className="h-4 w-4 text-[var(--probe-warm)]" />
              </div>
              同类星题
            </CardTitle>
            <CardDescription className="mt-1 text-[var(--probe-muted)]">巩固知识，多做同类题目加深理解</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--probe-primary-bright)]">
            <Target className="h-4 w-4" />
            {completedQuestions.size}/{similarQuestions.length} 已完成
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-[var(--probe-border)]">
          {similarQuestions.map((question, index) => {
            const isCompleted = completedQuestions.has(index);
            const isShowingAnswer = showingAnswer.has(index);

            return (
              <div
                key={index}
                className={cn(
                  'group transition-all',
                  isCompleted
                    ? 'bg-[var(--probe-success)]/5 shadow-[inset_0_0_16px_rgba(52,211,153,0.05)]'
                    : 'hover:bg-[var(--probe-primary)]/8 hover:shadow-[inset_0_0_12px_var(--probe-glow)]',
                )}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all border',
                        isCompleted
                          ? 'bg-gradient-to-br from-[var(--probe-success)] to-emerald-400 text-white border-[var(--probe-success)]/40 shadow-[0_0_10px_rgba(52,211,153,0.35)]'
                          : 'bg-gradient-to-br from-[var(--probe-primary)]/20 to-[var(--probe-primary)]/10 text-[var(--probe-primary-bright)] border-[var(--probe-primary)]/30',
                      )}
                    >
                      {isCompleted ? (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'text-sm leading-normal cursor-pointer transition-colors',
                          isCompleted
                            ? 'text-[var(--probe-success)]'
                            : 'text-[var(--probe-text)] hover:text-[var(--probe-primary)]',
                        )}
                        onClick={() => handleQuestionClick(question.problem, index)}
                      >
                        <MathRenderer content={question.problem} />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            question.difficulty <= 3 && 'border-green-500/30 text-green-400',
                            question.difficulty > 3 &&
                              question.difficulty <= 6 &&
                              'border-yellow-500/30 text-yellow-400',
                            question.difficulty > 6 && 'border-red-500/30 text-red-400',
                          )}
                        >
                          难度 {question.difficulty}/10
                        </Badge>
                        <Badge variant="secondary" className="text-xs bg-[var(--probe-primary)]/10 text-[var(--probe-primary)] border border-[var(--probe-primary)]/20">
                          {question.knowledgePoint}
                        </Badge>
                      </div>

                      {isShowingAnswer && (
                        <div className="mt-3 probe-panel-elevated rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--probe-primary-bright)]">
                            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--probe-primary)]/20">
                              <Lightbulb className="h-3 w-3" />
                            </div>
                            参考答案
                          </div>
                          <div className="mt-2 text-sm text-[var(--probe-text)]">
                            {question.answer ? (
                              <MathRenderer content={question.answer} />
                            ) : (
                              '点击"解题"按钮查看完整解析'
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-7 text-xs',
                            isCompleted
                              ? 'text-[var(--probe-success)] hover:bg-[var(--probe-success)]/10'
                              : 'text-[var(--probe-muted)] hover:text-[var(--probe-primary)] hover:bg-[var(--probe-primary)]/10',
                          )}
                          onClick={() => toggleCompleted(index)}
                        >
                          {isCompleted ? '标记未完成' : '标记完成'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-[var(--probe-muted)] hover:text-[var(--probe-primary)] hover:bg-[var(--probe-primary)]/10"
                          onClick={() => toggleAnswer(index)}
                        >
                          {isShowingAnswer ? '收起答案' : '查看答案'}
                        </Button>
                        {onQuestionClick && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-[var(--probe-muted)] hover:text-[var(--probe-primary)] hover:bg-[var(--probe-primary)]/10"
                            onClick={() => onQuestionClick(question.problem)}
                          >
                            <ChevronRight className="mr-1 h-3 w-3" />
                            解题
                          </Button>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      className={cn(
                        'h-5 w-5 shrink-0 transition-colors',
                        isCompleted
                          ? 'text-[var(--probe-success)]'
                          : 'text-[var(--probe-muted)] group-hover:text-[var(--probe-primary)]',
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {similarQuestions.length > 0 && (
          <div className="border-t border-[var(--probe-border)] p-4 bg-gradient-to-r from-[var(--probe-primary)]/5 to-transparent">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-[var(--probe-primary-bright)]">
                {completedQuestions.size === similarQuestions.length
                  ? '✦ 所有星题已完成！'
                  : `还有 ${similarQuestions.length - completedQuestions.size} 道题目待练习`}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-[var(--probe-border-strong)] text-[var(--probe-text)] hover:bg-[var(--probe-primary)]/15 hover:border-[var(--probe-primary)] hover:shadow-[0_0_8px_var(--probe-glow)]"
                onClick={onPracticeClick}
              >
                <BookOpen className="h-4 w-4" />
                更多练习
              </Button>
            </div>
          </div>
        )}

        {similarQuestions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--probe-primary)]/15 to-[var(--probe-accent)]/10 border border-[var(--probe-border)]">
              <BookOpen className="h-6 w-6 text-[var(--probe-muted)]" />
            </div>
            <p className="mt-4 text-sm text-[var(--probe-muted)]">暂无同类星题推荐</p>
            <p className="text-xs text-[var(--probe-muted)]">完成题目后将自动推荐相似题目</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
