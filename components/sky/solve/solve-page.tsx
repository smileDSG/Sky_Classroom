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

/** Call recognition API, return extracted problem text */
async function recognizeImage(file: File): Promise<{ text: string; latex: string }> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/sky/solve/recognize', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('图片识别失败');
  const json = await res.json();
  return { text: json.text ?? '', latex: json.latex ?? '' };
}

/** Call explain API, return four-part solution */
async function explainProblem(problem: string): Promise<FourPartOutput & { fromQuestionBank: boolean }> {
  const res = await fetch('/api/sky/solve/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem }),
  });
  if (!res.ok) throw new Error('解题失败');
  const json = await res.json();
  return {
    answer: json.answer ?? '',
    steps: json.steps ?? [],
    knowledgePoints: json.knowledgePoints ?? [],
    similarQuestions: json.similarQuestions ?? [],
    fromQuestionBank: json.fromQuestionBank ?? false,
  };
}

/** Call grade API */
async function gradeProblem(problem: string, correctAnswer: string, userAnswer: string): Promise<GradeResult> {
  const res = await fetch('/api/sky/solve/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem, correctAnswer, userAnswer }),
  });
  if (!res.ok) throw new Error('批改失败');
  const json = await res.json();
  return json as GradeResult;
}

export function SolvePage() {
  const [state, setState] = useState<SolvePageState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');

  const handleSubmit = useCallback(
    async (input: { type: 'image' | 'voice' | 'text'; content: string | File }) => {
      setError(null);
      setResult(null);

      try {
        let problemText = '';

        // Step 1: Recognize image if needed
        if (input.type === 'image') {
          setState('recognizing');
          const recognized = await recognizeImage(input.content as File);
          problemText = recognized.text || recognized.latex;
          setRecognizedText(problemText);
        } else if (input.type === 'text') {
          problemText = input.content as string;
          setRecognizedText(problemText);
        }

        // Step 2: Solve
        setState('solving');
        const solution = await explainProblem(problemText);

        setResult({
          problem: problemText,
          problemImage: input.type === 'image' ? (input.content as File).name : undefined,
          solution,
          fromQuestionBank: solution.fromQuestionBank,
        });
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
        const correctAnswer = result?.solution.answer ?? '';
        const gradeResult = await gradeProblem(input.problem, correctAnswer, input.userAnswer);

        const gradedSolution: GradedFourPartOutput = {
          ...((result?.solution as FourPartOutput) || {
            answer: '',
            steps: [],
            knowledgePoints: [],
            similarQuestions: [],
          }),
          gradeResult,
          mistakeAnalysis: gradeResult.errorAnalysis,
          recommendedPractice: gradeResult.isCorrect
            ? []
            : [
                {
                  problem: '相关练习题',
                  reason: `错因：${gradeResult.cause}`,
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
    setRecognizedText('');
  }, []);

  const handleSimilarQuestionClick = useCallback((problem: string) => {
    console.log('Clicked similar question:', problem);
  }, []);

  const isLoading = state === 'recognizing' || state === 'solving' || state === 'grading';

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">搜题批改</h1>
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
          <Card className="overflow-hidden border-sky-200/50 dark:border-sky-800/40 shadow-md shadow-sky-100/50 dark:shadow-sky-900/20">
            <CardHeader className="border-b bg-gradient-to-r from-sky-50 to-transparent dark:from-sky-950/30 dark:to-transparent">
              <CardTitle className="flex items-center gap-2 text-base text-sky-700 dark:text-sky-300">
                <ImageIcon className="h-4 w-4 text-sky-500" />
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
            <div className="rounded-lg border border-sky-200/40 dark:border-sky-800/30 bg-sky-50/50 dark:bg-sky-950/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-400">
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
            <div className="flex flex-col items-center justify-center rounded-lg border border-sky-200/40 dark:border-sky-800/30 bg-sky-50/50 dark:bg-sky-950/20 p-8">
              <div className="relative">
                <div className="h-12 w-12 animate-pulse rounded-full bg-sky-200/50 dark:bg-sky-800/50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-sky-500" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-sky-600 dark:text-sky-400">正在识别图片...</p>
              <p className="text-xs text-muted-foreground">请稍候</p>
            </div>
          )}

          {(state === 'solving' || state === 'grading') && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-sky-200/40 dark:border-sky-800/30 bg-sky-50/50 dark:bg-sky-950/20 p-8">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-sky-500" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-sky-600 dark:text-sky-400">
                {state === 'grading' ? '正在批改...' : '正在解题...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {state === 'grading' ? 'AI 正在分析你的答案' : 'AI 正在思考解题思路'}
              </p>
            </div>
          )}

          {(state === 'success' || state === 'graded') && result && (
            <Card className="overflow-hidden border-sky-200/50 dark:border-sky-800/40">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-sm font-medium">题目预览</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {recognizedText && (
                  <p className="mb-2 text-sm text-muted-foreground">识别结果：{recognizedText}</p>
                )}
                <p className="text-sm text-foreground">{result.problem}</p>
                {result.fromQuestionBank && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400">
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
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-200/40 dark:border-sky-800/30 bg-sky-50/30 dark:bg-sky-950/10 py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40">
                <Sparkles className="h-8 w-8 text-sky-500" />
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
        <div className="h-8 w-48 animate-pulse rounded bg-sky-100 dark:bg-sky-900/30" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-sky-50 dark:bg-sky-900/20" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="space-y-6">
          <div className="h-[400px] animate-pulse rounded-xl bg-sky-50 dark:bg-sky-900/20" />
        </div>
        <div className="space-y-6">
          <div className="h-[300px] animate-pulse rounded-xl bg-sky-50 dark:bg-sky-900/20" />
          <div className="h-[200px] animate-pulse rounded-xl bg-sky-50 dark:bg-sky-900/20" />
        </div>
      </div>
    </div>
  );
}
