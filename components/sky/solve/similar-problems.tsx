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
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="border-b bg-gradient-to-r from-[#4A90D9]/5 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RotateCcw className="h-5 w-5 text-[#4A90D9]" />
              同类练习
            </CardTitle>
            <CardDescription>巩固知识，多做同类题目加深理解</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            {completedQuestions.size}/{similarQuestions.length} 已完成
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y">
          {similarQuestions.map((question, index) => {
            const isCompleted = completedQuestions.has(index);
            const isShowingAnswer = showingAnswer.has(index);

            return (
              <div
                key={index}
                className={cn(
                  'group transition-colors',
                  isCompleted ? 'bg-green-50/50 dark:bg-green-900/10' : 'hover:bg-muted/30',
                )}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors',
                        isCompleted ? 'bg-green-500 text-white' : 'bg-[#4A90D9]/10 text-[#4A90D9]',
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
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-foreground hover:text-[#4A90D9]',
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
                            question.difficulty <= 3 && 'border-green-200 text-green-600',
                            question.difficulty > 3 &&
                              question.difficulty <= 6 &&
                              'border-yellow-200 text-yellow-600',
                            question.difficulty > 6 && 'border-red-200 text-red-600',
                          )}
                        >
                          难度 {question.difficulty}/10
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {question.knowledgePoint}
                        </Badge>
                      </div>

                      {isShowingAnswer && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-900/20">
                          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                            <Lightbulb className="h-4 w-4" />
                            参考答案
                          </div>
                          <div className="mt-1 text-sm text-amber-700 dark:text-amber-300">
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
                              ? 'text-green-600 hover:bg-green-100 hover:text-green-700'
                              : 'text-muted-foreground hover:text-[#4A90D9]',
                          )}
                          onClick={() => toggleCompleted(index)}
                        >
                          {isCompleted ? '标记未完成' : '标记完成'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-[#4A90D9]"
                          onClick={() => toggleAnswer(index)}
                        >
                          {isShowingAnswer ? '收起答案' : '查看答案'}
                        </Button>
                        {onQuestionClick && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-[#4A90D9]"
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
                          ? 'text-green-400'
                          : 'text-muted-foreground group-hover:text-[#4A90D9]',
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {similarQuestions.length > 0 && (
          <div className="border-t p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {completedQuestions.size === similarQuestions.length
                  ? '太棒了！所有同类练习都已完成'
                  : `还有 ${similarQuestions.length - completedQuestions.size} 道题目待练习`}
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={onPracticeClick}>
                <BookOpen className="h-4 w-4" />
                更多练习
              </Button>
            </div>
          </div>
        )}

        {similarQuestions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">暂无同类练习推荐</p>
            <p className="text-xs text-muted-foreground">完成题目后将自动推荐相似题目</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
