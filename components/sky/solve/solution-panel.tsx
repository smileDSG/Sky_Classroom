'use client';

import { useState } from 'react';
import { BookOpen, Lightbulb, ListOrdered, Target, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { MathRenderer } from './math-renderer';
import type { FourPartOutput, GradedFourPartOutput } from '@/lib/solve/types';

interface SolutionPanelProps {
  output: FourPartOutput | GradedFourPartOutput;
  className?: string;
}

export function SolutionPanel({ output, className }: SolutionPanelProps) {
  const [activeTab, setActiveTab] = useState('steps');
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({ 0: true });

  const isGraded = 'gradeResult' in output;
  const { answer, steps, knowledgePoints, similarQuestions } = output;

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="border-b bg-gradient-to-r from-[#4A90D9]/5 to-transparent pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-[#4A90D9]" />
              解题详解
            </CardTitle>
            <CardDescription>四段式输出：答案、步骤、知识点、同类练习</CardDescription>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 rounded-none border-b bg-muted/50 p-0">
          <TabsTrigger
            value="answer"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#4A90D9] data-[state=active]:bg-background data-[state=active]:shadow-none"
          >
            <Target className="mr-1 h-4 w-4" />
            答案
          </TabsTrigger>
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
          <TabsContent value="answer" className="mt-0 p-6">
            <div className="space-y-4">
              <div className="text-center">
                <div className="mb-2 text-sm text-muted-foreground">最终答案</div>
                <div className="inline-flex items-center justify-center rounded-xl bg-[#4A90D9]/10 px-8 py-4">
                  <MathRenderer content={answer} className="text-2xl font-bold text-[#4A90D9]" />
                </div>
              </div>
              {isGraded && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    错因分析
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(output as GradedFourPartOutput).mistakeAnalysis}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="steps" className="mt-0">
            <div className="divide-y">
              {steps.length === 0 && (
                <div className="flex items-center justify-center gap-3 py-12">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#4A90D9] border-t-transparent" />
                  <span className="text-sm text-muted-foreground">正在生成解题步骤...</span>
                </div>
              )}
              {steps.map((step, index) => (
                <Collapsible
                  key={index}
                  open={expandedSteps[index] ?? false}
                  onOpenChange={() => toggleStep(index)}
                  className="group"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4A90D9]/10 text-sm font-bold text-[#4A90D9]">
                        {index + 1}
                      </div>
                      <span className="font-medium">{step.label}</span>
                    </div>
                    {expandedSteps[index] ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 animate-step-fade-in">
                      <div className="ml-11 space-y-3">
                        <MathRenderer content={step.content} className="text-sm leading-relaxed" />
                        {step.keyPoints && step.keyPoints.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {step.keyPoints.map((point, pidx) => (
                              <Badge
                                key={pidx}
                                variant="secondary"
                                className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                              >
                                <Lightbulb className="mr-1 h-3 w-3" />
                                <MathRenderer content={point} />
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="knowledge" className="mt-0 p-6">
            <div className="space-y-4">
              {knowledgePoints.map((point, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border p-4 transition-colors hover:border-[#4A90D9]/30 hover:bg-[#4A90D9]/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold"><MathRenderer content={point.name} /></h4>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            point.difficulty === 'easy' && 'bg-green-50 text-green-700 dark:bg-green-900/20',
                            point.difficulty === 'medium' && 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20',
                            point.difficulty === 'hard' && 'bg-red-50 text-red-700 dark:bg-red-900/20'
                          )}
                        >
                          {point.difficulty === 'easy' && '基础'}
                          {point.difficulty === 'medium' && '进阶'}
                          {point.difficulty === 'hard' && '困难'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground"><MathRenderer content={point.description} /></p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="similar" className="mt-0 p-6">
            <div className="space-y-4">
              {similarQuestions.map((q, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border p-4 transition-colors hover:border-[#4A90D9]/30 hover:bg-[#4A90D9]/5 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4A90D9]/10 text-xs font-bold text-[#4A90D9]">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <MathRenderer content={q.problem} className="text-sm leading-relaxed" />
                      <div className="mt-2 flex items-center gap-2">
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
              <div className="mt-6 border-t pt-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Lightbulb className="h-4 w-4 text-[#4A90D9]" />
                  推荐练习
                </div>
                <div className="space-y-3">
                  {(output as GradedFourPartOutput).recommendedPractice.map((rec, index) => (
                    <div key={index} className="rounded-lg bg-muted/50 p-3">
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
