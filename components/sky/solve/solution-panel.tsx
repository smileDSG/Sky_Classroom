'use client';

import { useState, useMemo } from 'react';
import {
  BookOpen,
  Lightbulb,
  ListOrdered,
  Target,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { MathRenderer } from './math-renderer';
import type { FourPartOutput, GradedFourPartOutput } from '@/lib/solve/types';

interface SolutionPanelProps {
  output: FourPartOutput | GradedFourPartOutput;
  className?: string;
}

/**
 * Strip math delimiters, whitespace and punctuation for rough comparison.
 */
function normalizeForCompare(text: string): string {
  return text
    .replace(/\$\$?/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[\s{}()（）、，。：；""''【】《》\-—·=+*/<>]/g, '')
    .toLowerCase();
}

/**
 * Remove steps whose content is largely duplicated in the solution text.
 * This prevents the user from seeing the same derivation twice — once in
 * the "解题详解" block and again in the "步骤" tab.
 */
function deduplicateSteps(
  solution: string,
  steps: { label: string; content: string; keyPoints?: string[] }[],
): { label: string; content: string; keyPoints?: string[] }[] {
  if (!solution || steps.length === 0) return steps;

  const normSolution = normalizeForCompare(solution);
  if (normSolution.length < 20) return steps; // too short to compare

  return steps.filter((step) => {
    const normStep = normalizeForCompare(step.content);
    if (normStep.length < 10) return true; // keep very short steps

    // Check bidirectional overlap:
    // 1. Step content is a substring of solution
    // 2. Solution is a substring of step content
    // 3. 80%+ of step chars appear in solution (order-independent)
    if (normSolution.includes(normStep)) return false;
    if (normStep.includes(normSolution)) return false;

    // Character overlap ratio
    const overlap = [...normStep].filter((ch) => normSolution.includes(ch)).length;
    if (overlap / normStep.length > 0.8) return false;

    return true;
  });
}

export function SolutionPanel({ output, className }: SolutionPanelProps) {
  const [activeTab, setActiveTab] = useState('steps');

  const isGraded = 'gradeResult' in output;
  const { solution, answer, knowledgePoints, similarQuestions } = output;

  // Deduplicate steps against the solution to avoid showing the same text twice
  const steps = useMemo(
    () => deduplicateSteps(solution, output.steps),
    [solution, output.steps],
  );

  const hasSteps = steps.length > 0;
  const isComplete = hasSteps && answer; // 解题完成 = 有步骤且有答案

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="border-b bg-gradient-to-r from-[#4A90D9]/5 to-transparent pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-[#4A90D9]" />
              解题详解
            </CardTitle>
            <CardDescription>步骤 · AI 知识点总结 · 同类练习</CardDescription>
          </div>
          {isGraded && (
            <Badge
              variant={output.gradeResult.isCorrect ? 'default' : 'destructive'}
              className={output.gradeResult.isCorrect ? 'bg-green-500' : undefined}
            >
              {output.gradeResult.isCorrect ? '批改通过' : '需要订正'}
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* ── 答案栏：解题完成后直接显示在顶部 ── */}
      {isComplete && (
        <div className="border-b bg-muted/30 px-5 py-2">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">答案</span>
            <span className="inline-flex items-center rounded-md bg-background px-3 py-0.5 border border-border">
              <MathRenderer content={answer} className="text-sm font-semibold text-foreground" />
            </span>
          </div>
        </div>
      )}

      {/* ─ 解题详解：详细推导过程 ─ */}
      {solution && (
        <div className="px-6 py-4">
          <div className="mx-auto max-w-3xl">
            <MathRenderer
              content={solution}
              className="text-sm leading-loose text-foreground whitespace-pre-wrap"
            />
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-none border-b bg-muted/50 p-0">
          <TabsTrigger
            value="steps"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#4A90D9] data-[state=active]:bg-background data-[state=active]:shadow-none"
          >
            <ListOrdered className="mr-1 h-4 w-4" />
            步骤
          </TabsTrigger>
          <TabsTrigger
            value="knowledge"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#4A90D9] data-[state=active]:bg-background data-[state=active]:shadow-none"
          >
            <Lightbulb className="mr-1 h-4 w-4" />
            知识点
          </TabsTrigger>
          <TabsTrigger
            value="similar"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#4A90D9] data-[state=active]:bg-background data-[state=active]:shadow-none"
          >
            <BookOpen className="mr-1 h-4 w-4" />
            同类题
          </TabsTrigger>
        </TabsList>

        <CardContent className="p-0">
          {/* ── 步骤栏：每步换行，末尾显示正确答案 ── */}
          <TabsContent value="steps" className="mt-0">
            <div className="divide-y">
              {steps.length === 0 && (
                <div className="flex items-center justify-center gap-3 py-8">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#4A90D9] border-t-transparent" />
                  <span className="text-sm text-muted-foreground">正在生成解题步骤...</span>
                </div>
              )}
              {steps.map((step, index) => (
                <div key={index} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4A90D9]/10 text-[10px] font-bold text-[#4A90D9] mt-0.5">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm mb-2">{step.label}</div>
                      <MathRenderer content={step.content} className="text-sm leading-loose" />
                      {step.keyPoints && step.keyPoints.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {step.keyPoints.map((point, pidx) => (
                            <Badge
                              key={pidx}
                              variant="secondary"
                              className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 text-xs"
                            >
                              <Lightbulb className="mr-1 h-3 w-3" />
                              <MathRenderer content={point} />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── 知识点栏：AI 总结的知识点 ── */}
          <TabsContent value="knowledge" className="mt-0 p-4">
            <div className="space-y-2.5">
              {knowledgePoints.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-6">
                  <Lightbulb className="h-5 w-5 mx-auto mb-2 opacity-50" />
                  暂无知识点总结
                </div>
              )}
              {knowledgePoints.map((point, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border p-3 transition-colors hover:border-[#4A90D9]/30 hover:bg-[#4A90D9]/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm">
                          <MathRenderer content={point.name} />
                        </h4>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            point.difficulty === 'easy' &&
                              'bg-green-50 text-green-700 dark:bg-green-900/20',
                            point.difficulty === 'medium' &&
                              'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20',
                            point.difficulty === 'hard' &&
                              'bg-red-50 text-red-700 dark:bg-red-900/20',
                          )}
                        >
                          {point.difficulty === 'easy' && '基础'}
                          {point.difficulty === 'medium' && '进阶'}
                          {point.difficulty === 'hard' && '困难'}
                        </Badge>
                      </div>
                      <div className="mt-1.5 text-xs text-muted-foreground leading-normal">
                        <MathRenderer content={point.description} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── 同类题栏 ── */}
          <TabsContent value="similar" className="mt-0 p-4">
            <div className="space-y-2.5">
              {similarQuestions.map((q, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border p-3 transition-colors hover:border-[#4A90D9]/30 hover:bg-[#4A90D9]/5 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4A90D9]/10 text-[10px] font-bold text-[#4A90D9] mt-0.5">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <MathRenderer content={q.problem} className="text-sm leading-normal" />
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          难度: {q.difficulty}/10
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {q.knowledgePoint}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {isGraded && (output as GradedFourPartOutput).recommendedPractice.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Lightbulb className="h-4 w-4 text-[#4A90D9]" />
                  推荐练习
                </div>
                <div className="space-y-2">
                  {(output as GradedFourPartOutput).recommendedPractice.map((rec, index) => (
                    <div key={index} className="rounded-lg bg-muted/50 p-2.5">
                      <MathRenderer content={rec.problem} className="text-sm font-medium" />
                      <div className="text-xs text-muted-foreground">{rec.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
