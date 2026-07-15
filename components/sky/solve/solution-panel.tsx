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
 * Check if two texts are largely the same content.
 */
function isDuplicateContent(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (na.length < 10 || nb.length < 10) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Character overlap ratio
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  const overlap = [...shorter].filter((ch) => longer.includes(ch)).length;
  return overlap / shorter.length > 0.7;
}

/**
 * Remove steps whose content is largely duplicated in the solution text.
 * This prevents the user from seeing the same derivation twice — once in
 * the "解题详解" block and again in the "步骤" tab.
 * Always keeps at least the first step so the tab is never empty.
 */
function deduplicateSteps(
  solution: string,
  steps: { label: string; content: string; keyPoints?: string[] }[],
): { label: string; content: string; keyPoints?: string[] }[] {
  if (!solution || steps.length === 0) return steps;

  const normSolution = normalizeForCompare(solution);
  if (normSolution.length < 20) return steps; // too short to compare

  const kept = steps.filter((step, index) => {
    // Always keep the first step — never leave the tab empty
    if (index === 0) return true;

    const normStep = normalizeForCompare(step.content);
    if (normStep.length < 10) return true; // keep very short steps

    // Check bidirectional overlap:
    if (normSolution.includes(normStep)) return false;
    if (normStep.includes(normSolution)) return false;

    // Character overlap ratio
    const overlap = [...normStep].filter((ch) => normSolution.includes(ch)).length;
    if (overlap / normStep.length > 0.8) return false;

    return true;
  });

  return kept;
}

export function SolutionPanel({ output, className }: SolutionPanelProps) {
  const [activeTab, setActiveTab] = useState('steps');

  const isGraded = 'gradeResult' in output;
  const { solution, answer, knowledgePoints, similarQuestions } = output;

  // Deduplicate steps against the solution to avoid showing the same text twice
  const steps = useMemo(() => deduplicateSteps(solution, output.steps), [solution, output.steps]);

  const hasSteps = steps.length > 0;
  const isComplete = hasSteps && answer; // 解题完成 = 有步骤且有答案

  // Hide solution block when it largely duplicates the answer
  const showSolution = solution && !isDuplicateContent(solution, answer);

  return (
    <Card className={cn('overflow-hidden probe-panel', className)}>
      <CardHeader className="probe-header-gradient pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg text-[var(--probe-text)]">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--probe-primary)]/25 to-[var(--probe-accent)]/15 border border-[var(--probe-border)] shadow-[0_0_12px_var(--probe-glow)]">
                <BookOpen className="h-4 w-4 text-[var(--probe-primary-bright)]" />
              </div>
              解码报告
            </CardTitle>
            <CardDescription className="mt-1 text-[var(--probe-muted)]">
              步骤 · 知识点碎片 · 同类星题
            </CardDescription>
          </div>
          {isGraded && (
            <Badge
              variant={output.gradeResult.isCorrect ? 'default' : 'destructive'}
              className={cn(
                'shadow-sm',
                output.gradeResult.isCorrect
                  ? 'bg-[var(--probe-success)] shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                  : 'shadow-[0_0_8px_rgba(248,113,113,0.3)]',
              )}
            >
              {output.gradeResult.isCorrect ? '信号匹配' : '需要订正'}
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* ── 答案栏：解题完成后直接显示在顶部 ── */}
      {isComplete && (
        <div className="border-b border-[var(--probe-border)] bg-gradient-to-r from-[var(--probe-primary)]/10 via-[var(--probe-accent)]/5 to-[var(--probe-primary)]/10 px-5 py-3">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--probe-success)] shrink-0" />
            <span className="text-xs font-semibold text-[var(--probe-muted)]">解码答案</span>
            <span className="inline-flex items-center rounded-lg bg-[var(--probe-void)] px-4 py-1 border border-[var(--probe-border-strong)] shadow-[0_0_8px_var(--probe-glow)]">
              <MathRenderer
                content={answer}
                className="text-sm font-bold text-[var(--probe-primary-bright)]"
              />
            </span>
          </div>
        </div>
      )}

      {/* ─ 解题详解：详细推导过程（仅当与答案不重复时显示） ─ */}
      {showSolution && (
        <div className="px-6 py-4 border-b border-[var(--probe-border)] bg-gradient-to-b from-transparent to-[var(--probe-primary)]/3">
          <div className="mx-auto max-w-3xl">
            <MathRenderer
              content={solution}
              className="text-sm leading-loose text-[var(--probe-text)] whitespace-pre-wrap"
            />
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-none probe-header-gradient p-0">
          <TabsTrigger
            value="steps"
            className="rounded-none border-b-2 border-transparent text-[var(--probe-muted)] data-[state=active]:border-[var(--probe-primary-bright)] data-[state=active]:bg-[var(--probe-primary)]/10 data-[state=active]:text-[var(--probe-primary-bright)] data-[state=active]:shadow-[0_0_8px_var(--probe-glow)]"
          >
            <ListOrdered className="mr-1 h-4 w-4" />
            步骤
          </TabsTrigger>
          <TabsTrigger
            value="knowledge"
            className="rounded-none border-b-2 border-transparent text-[var(--probe-muted)] data-[state=active]:border-[var(--probe-accent)] data-[state=active]:bg-[var(--probe-accent)]/10 data-[state=active]:text-[var(--probe-accent)] data-[state=active]:shadow-[0_0_8px_var(--probe-accent-glow)]"
          >
            <Lightbulb className="mr-1 h-4 w-4" />
            知识点
          </TabsTrigger>
          <TabsTrigger
            value="similar"
            className="rounded-none border-b-2 border-transparent text-[var(--probe-muted)] data-[state=active]:border-[var(--probe-warm)] data-[state=active]:bg-[var(--probe-warm)]/10 data-[state=active]:text-[var(--probe-warm)] data-[state=active]:shadow-[0_0_8px_rgba(251,146,60,0.3)]"
          >
            <BookOpen className="mr-1 h-4 w-4" />
            同类题
          </TabsTrigger>
        </TabsList>

        <CardContent className="p-0">
          {/* ── 步骤栏：每步换行，末尾显示正确答案 ── */}
          <TabsContent value="steps" className="mt-0">
            <div className="divide-y divide-[var(--probe-border)]">
              {steps.length === 0 && (
                <div className="flex items-center justify-center gap-3 py-8">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--probe-primary)] border-t-transparent" />
                  <span className="text-sm text-[var(--probe-muted)]">正在解码步骤...</span>
                </div>
              )}
              {steps.map((step, index) => (
                <div key={index} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--probe-primary)]/25 to-[var(--probe-primary)]/10 text-[10px] font-bold text-[var(--probe-primary-bright)] mt-0.5 border border-[var(--probe-primary)]/30 shadow-[0_0_8px_var(--probe-glow)]">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm mb-2 text-[var(--probe-text)]">
                        {step.label}
                      </div>
                      <MathRenderer
                        content={step.content}
                        className="text-sm leading-loose text-[var(--probe-text)]"
                      />
                      {step.keyPoints && step.keyPoints.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {step.keyPoints.map((point, pidx) => (
                            <Badge
                              key={pidx}
                              variant="secondary"
                              className="bg-[var(--probe-primary)]/15 text-[var(--probe-primary-bright)] border border-[var(--probe-primary)]/30 text-xs shadow-[0_0_4px_var(--probe-glow)]"
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
                <div className="text-center text-sm text-[var(--probe-muted)] py-6">
                  <Lightbulb className="h-5 w-5 mx-auto mb-2 opacity-50" />
                  暂无知识点碎片
                </div>
              )}
              {knowledgePoints.map((point, index) => (
                <div
                  key={index}
                  className="probe-panel rounded-lg p-3 transition-all hover:border-[var(--probe-primary)]/40 hover:shadow-[0_0_12px_var(--probe-glow)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--probe-accent)]/15 border border-[var(--probe-accent)]/20">
                          <Lightbulb className="h-3 w-3 text-[var(--probe-accent)]" />
                        </div>
                        <h4 className="font-semibold text-sm text-[var(--probe-text)]">
                          <MathRenderer content={point.name} />
                        </h4>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            point.difficulty === 'easy' &&
                              'bg-[var(--probe-success)]/15 text-[var(--probe-success)] border border-[var(--probe-success)]/25',
                            point.difficulty === 'medium' &&
                              'bg-[var(--probe-warm)]/15 text-[var(--probe-warm)] border border-[var(--probe-warm)]/25',
                            point.difficulty === 'hard' &&
                              'bg-[var(--probe-error)]/15 text-[var(--probe-error)] border border-[var(--probe-error)]/25',
                          )}
                        >
                          {point.difficulty === 'easy' && '基础'}
                          {point.difficulty === 'medium' && '进阶'}
                          {point.difficulty === 'hard' && '困难'}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-[var(--probe-muted)] leading-normal">
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
                  className="probe-panel rounded-lg p-3 transition-all hover:border-[var(--probe-warm)]/40 hover:shadow-[0_0_12px_rgba(251,146,60,0.15)] cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--probe-warm)]/25 to-[var(--probe-warm)]/10 text-[10px] font-bold text-[var(--probe-warm)] mt-0.5 border border-[var(--probe-warm)]/30">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <MathRenderer
                        content={q.problem}
                        className="text-sm leading-normal text-[var(--probe-text)]"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            q.difficulty <= 3 &&
                              'border-[var(--probe-success)]/30 text-[var(--probe-success)]',
                            q.difficulty > 3 &&
                              q.difficulty <= 6 &&
                              'border-[var(--probe-warm)]/30 text-[var(--probe-warm)]',
                            q.difficulty > 6 &&
                              'border-[var(--probe-error)]/30 text-[var(--probe-error)]',
                          )}
                        >
                          难度: {q.difficulty}/10
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-xs bg-[var(--probe-accent)]/15 text-[var(--probe-accent)] border border-[var(--probe-accent)]/25"
                        >
                          {q.knowledgePoint}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {isGraded && (output as GradedFourPartOutput).recommendedPractice.length > 0 && (
              <div className="mt-4 border-t border-[var(--probe-border)] pt-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--probe-text)]">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--probe-warm)]/15">
                    <Lightbulb className="h-3 w-3 text-[var(--probe-warm)]" />
                  </div>
                  推荐练习
                </div>
                <div className="space-y-2">
                  {(output as GradedFourPartOutput).recommendedPractice.map((rec, index) => (
                    <div key={index} className="probe-panel rounded-lg p-3">
                      <MathRenderer
                        content={rec.problem}
                        className="text-sm font-medium text-[var(--probe-text)]"
                      />
                      <div className="text-xs text-[var(--probe-muted)]">{rec.reason}</div>
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
