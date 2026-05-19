'use client';

import { useState, useCallback } from 'react';
import { Sparkles, AlertCircle, RotateCcw, Image as ImageIcon, Wand2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MultimodalInput } from './multimodal-input';
import { GradeResultCard } from './grade-result';
import { SolutionPanel } from './solution-panel';
import { SimilarProblems } from './similar-problems';
import type { GradeResult, FourPartOutput, GradedFourPartOutput } from '@/lib/solve/types';

type SolvePageState =
  | 'idle'
  | 'recognizing'
  | 'solving'
  | 'grading'
  | 'success'
  | 'graded'
  | 'error';

interface SolveResult {
  problem: string;
  problemImage?: string;
  solution: FourPartOutput | GradedFourPartOutput;
  gradeResult?: GradeResult;
  fromQuestionBank: boolean;
}

export function SolvePage() {
  const [state, setState] = useState<SolvePageState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);

  const handleSubmit = useCallback(
    async (input: { type: 'image' | 'voice' | 'text'; content: string | File }) => {
      setError(null);
      setResult(null);

      try {
        if (input.type === 'image') {
          setState('recognizing');
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        setState('solving');
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const mockResult: SolveResult = {
          problem: input.type === 'text' ? (input.content as string) : '3x + 5 = 20，求 x 的值',
          problemImage: input.type === 'image' ? (input.content as string) : undefined,
          solution: {
            answer: 'x = 5',
            steps: [
              {
                label: '移项',
                content: '将常数项 5 移到等式右边，得到 3x = 20 - 5',
                keyPoints: ['移项变号'],
              },
              {
                label: '合并',
                content: '计算右边：20 - 5 = 15，得到 3x = 15',
              },
              {
                label: '求解',
                content: '两边同时除以 3，得到 x = 15 ÷ 3 = 5',
                keyPoints: ['等式两边同时运算'],
              },
            ],
            knowledgePoints: [
              {
                name: '一元一次方程',
                description: '只含有一个未知数，且未知数的最高次数为 1 的方程',
                difficulty: 'easy',
              },
              {
                name: '移项法则',
                description: '等式两边同时加减相同的数，等式仍然成立',
                difficulty: 'easy',
              },
            ],
            similarQuestions: [
              {
                problem: '2x + 7 = 15，求 x 的值',
                difficulty: 3,
                knowledgePoint: '一元一次方程',
              },
              {
                problem: '4x - 3 = 9，求 x 的值',
                difficulty: 4,
                knowledgePoint: '一元一次方程',
              },
              {
                problem: '5(x + 2) = 25，求 x 的值',
                difficulty: 6,
                knowledgePoint: '一元一次方程',
              },
            ],
          },
          fromQuestionBank: Math.random() > 0.5,
        };

        setResult(mockResult);
        setState('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : '解题过程中出现错误');
        setState('error');
      }
    },
    []
  );

  const handleGrade = useCallback(
    async (input: { problem: string; userAnswer: string }) => {
      setError(null);

      try {
        setState('grading');
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const isCorrect = input.userAnswer.includes('5');
        const gradeResult: GradeResult = {
          isCorrect,
          score: isCorrect ? 100 : 0,
          correctAnswer: 'x = 5',
          userAnswer: input.userAnswer,
          errorAnalysis: isCorrect
            ? '回答正确！'
            : '你没有按照解一元一次方程的标准步骤进行计算，建议回顾移项法则。',
          cause: isCorrect ? 'careless' : 'method-wrong',
        };

        const gradedSolution: GradedFourPartOutput = {
          ...((result?.solution as FourPartOutput) || {
            answer: 'x = 5',
            steps: [],
            knowledgePoints: [],
            similarQuestions: [],
          }),
          gradeResult,
          mistakeAnalysis: gradeResult.errorAnalysis,
          recommendedPractice: isCorrect
            ? []
            : [
                {
                  problem: '2x + 4 = 10，求 x 的值',
                  reason: '巩固移项法则',
                },
              ],
        };

        setResult({
          problem: input.problem,
          solution: gradedSolution,
          gradeResult,
          fromQuestionBank: false,
        });
        setState('graded');
      } catch (err) {
        setError(err instanceof Error ? err.message : '批改过程中出现错误');
        setState('error');
      }
    },
    [result]
  );

  const handleReset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
  }, []);

  const handleSimilarQuestionClick = useCallback((problem: string) => {
    console.log('Clicked similar question:', problem);
  }, []);

  const isLoading = state === 'recognizing' || state === 'solving' || state === 'grading';

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">搜题批改</h1>
          <p className="text-sm text-muted-foreground">拍照、语音或输入题目，AI 帮你解答</p>
        </div>
        {(state === 'success' || state === 'graded' || state === 'error') && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            重新搜题
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-[#4A90D9]/5 to-transparent">
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4 text-[#4A90D9]" />
                题目输入
              </CardTitle>
              <CardDescription>支持拍照、语音和文字输入</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <MultimodalInput
                onSubmit={handleSubmit}
                onGrade={state === 'success' ? handleGrade : undefined}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {state === 'idle' && (
            <div className="rounded-lg border border-[#4A90D9]/20 bg-[#4A90D9]/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#4A90D9]">
                <Sparkles className="h-4 w-4" />
                使用技巧
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>• 拍照时尽量保持光线充足、文字清晰</li>
                <li>• 语音输入支持数学公式朗读</li>
                <li>• 输入答案后可获得 AI 批改</li>
                <li>• 系统会自动推荐相似题目</li>
              </ul>
            </div>
          )}

          {state === 'recognizing' && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-[#4A90D9]/20 bg-[#4A90D9]/5 p-8">
              <div className="relative">
                <div className="h-12 w-12 animate-pulse rounded-full bg-[#4A90D9]/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-[#4A90D9]" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-[#4A90D9]">正在识别图片...</p>
              <p className="text-xs text-muted-foreground">请稍候</p>
            </div>
          )}

          {(state === 'solving' || state === 'grading') && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-[#4A90D9]/20 bg-[#4A90D9]/5 p-8">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#4A90D9] border-t-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-[#4A90D9]" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-[#4A90D9]">
                {state === 'grading' ? '正在批改...' : '正在解题...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {state === 'grading' ? 'AI 正在分析你的答案' : 'AI 正在思考解题思路'}
              </p>
            </div>
          )}

          {(state === 'success' || state === 'graded') && result && (
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-sm font-medium">题目预览</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {result.problemImage && (
                  <img
                    src={result.problemImage}
                    alt="Problem"
                    className="mb-3 w-full rounded-lg border object-contain"
                  />
                )}
                <p className="text-sm text-foreground">{result.problem}</p>
                {result.fromQuestionBank && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#4A90D9]">
                    <Sparkles className="h-3 w-3" />
                    来自题库，秒速响应
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {state === 'error' && error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>出错了</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {state === 'idle' && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4A90D9]/10">
                <Sparkles className="h-8 w-8 text-[#4A90D9]" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-foreground">开始搜题</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                在左侧输入题目，AI 将为你提供详细的解题步骤
              </p>
            </div>
          )}

          {state === 'graded' && result?.gradeResult && (
            <GradeResultCard result={result.gradeResult} />
          )}

          {(state === 'success' || state === 'graded') && result && (
            <>
              <SolutionPanel output={result.solution} />
              <SimilarProblems
                similarQuestions={result.solution.similarQuestions}
                onQuestionClick={handleSimilarQuestionClick}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function SolvePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="space-y-6">
          <div className="h-[400px] animate-pulse rounded-xl bg-gray-100" />
        </div>
        <div className="space-y-6">
          <div className="h-[300px] animate-pulse rounded-xl bg-gray-100" />
          <div className="h-[200px] animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
