'use client';

import { useState, useCallback, useRef } from 'react';
import { Sparkles, AlertCircle, RotateCcw, Image as ImageIcon, Wand2, Clock, BookOpen, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MultimodalInput } from './multimodal-input';
import { GradeResultCard } from './grade-result';
import { SolutionPanel } from './solution-panel';
import { SimilarProblems } from './similar-problems';
import { HistoryPanel } from './history-panel';
import { SolutionSkeleton } from './solution-skeleton';
import { MathRenderer } from './math-renderer';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import type { GradeResult, FourPartOutput, GradedFourPartOutput, QuestionBankEntry } from '@/lib/solve/types';

type SolvePageState =
  | 'idle'
  | 'recognizing'
  | 'solving'
  | 'grading'
  | 'success'
  | 'graded'
  | 'error';

type StreamPhase = 'checking' | 'routing' | 'solving' | 'done';

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

// ── Streaming explain — consumes SSE, builds solution incrementally ──

interface StreamState {
  answer: string;
  steps: { label: string; content: string; keyPoints: string[] }[];
  knowledgePoints: { name: string; description: string; difficulty: string }[];
  similarQuestions: { problem: string; difficulty: number; knowledgePoint: string }[];
  fromQuestionBank: boolean;
}

async function streamExplain(
  problemText: string,
  problemImage: string | null,
  onPhase: (phase: StreamPhase) => void,
  onUpdate: (partial: Partial<StreamState>) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/sky/solve/explain-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem: problemText, problemImage }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`解题失败 (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('浏览器不支持流式响应');

  const decoder = new TextDecoder();
  let buffer = '';
  const accumulated: StreamState = {
    answer: '',
    steps: [],
    knowledgePoints: [],
    similarQuestions: [],
    fromQuestionBank: false,
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));

          switch (event.type) {
            case 'phase':
              onPhase(event.phase as StreamPhase);
              break;

            case 'step':
              accumulated.steps = [...accumulated.steps, {
                label: event.label,
                content: event.content,
                keyPoints: event.keyPoints || [],
              }];
              onUpdate({
                steps: accumulated.steps,
                answer: accumulated.answer || event.content, // fallback
              });
              break;

            case 'answer':
              accumulated.answer = event.answer;
              onUpdate({ answer: event.answer });
              break;

            case 'knowledge':
              accumulated.knowledgePoints = event.points.map((p: any) => ({
                name: p.name || '',
                description: p.description || '',
                difficulty: p.difficulty || 'medium',
              }));
              onUpdate({ knowledgePoints: accumulated.knowledgePoints });
              break;

            case 'similar':
              accumulated.similarQuestions = event.questions.map((q: any) => ({
                problem: q.problem || '',
                difficulty: typeof q.difficulty === 'number' ? q.difficulty : 5,
                knowledgePoint: q.knowledgePoint || '',
              }));
              onUpdate({ similarQuestions: accumulated.similarQuestions });
              break;

            case 'done':
              accumulated.fromQuestionBank = event.fromQuestionBank ?? false;
              onUpdate({ fromQuestionBank: accumulated.fromQuestionBank });
              onPhase('done');
              break;

            case 'error':
              throw new Error(event.message || '解题失败');
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue; // skip malformed JSON
          throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Component ────────────────────────────────────────────────────────

export function SolvePage() {
  const [state, setState] = useState<SolvePageState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [streamPhase, setStreamPhase] = useState<StreamPhase>('checking');
  const [showHistory, setShowHistory] = useState(false);
  const [mistakeSaved, setMistakeSaved] = useState(false);
  const addMistake = useSkyClassroomStore((s) => s.addMistake);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (input: { type: 'image' | 'voice' | 'text'; content: string | File }) => {
      // Cancel any in-flight streaming
      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      setError(null);
      setResult(null);
      setMistakeSaved(false);
      setStreamPhase('checking');

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

        // Step 2: Initialize empty solution state for progressive display
        setState('solving');
        const initialSolution: FourPartOutput = {
          answer: '',
          steps: [],
          knowledgePoints: [],
          similarQuestions: [],
        };
        setResult({
          problem: problemText,
          problemImage: input.type === 'image' ? (input.content as File).name : undefined,
          solution: initialSolution,
          fromQuestionBank: false,
        });

        // Step 3: Stream solve — progressively update solution
        await streamExplain(
          problemText,
          null,
          (phase) => setStreamPhase(phase),
          (partial) => {
            setResult((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                solution: {
                  answer: partial.answer ?? prev.solution.answer,
                  steps: partial.steps ?? prev.solution.steps,
                  knowledgePoints: partial.knowledgePoints ?? prev.solution.knowledgePoints,
                  similarQuestions: partial.similarQuestions ?? prev.solution.similarQuestions,
                },
                fromQuestionBank: partial.fromQuestionBank ?? prev.fromQuestionBank,
              };
            });
          },
          abortController.signal,
        );

        setState('success');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
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

        // 答案错误时自动加入错题本
        if (!gradeResult.isCorrect) {
          addMistake({
            id: `mistake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            problem: input.problem,
            userAnswer: input.userAnswer,
            correctAnswer,
            cause: gradeResult.cause,
            solvedAt: new Date(),
            reviewed: false,
            reviewCount: 0,
            knowledgePoints: result?.solution.knowledgePoints?.map((kp) => kp.name) ?? [],
          });
          setMistakeSaved(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '批改过程中出现错误');
        setState('error');
      }
    },
    [result]
  );

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setState('idle');
    setResult(null);
    setError(null);
    setRecognizedText('');
    setStreamPhase('checking');
  }, []);

  const handleSimilarQuestionClick = useCallback((problem: string) => {
    handleSubmit({ type: 'text', content: problem });
  }, [handleSubmit]);

  const handleLoadFromHistory = useCallback((entry: QuestionBankEntry) => {
    const solution: FourPartOutput = {
      answer: entry.answer,
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
    };
    setResult({
      problem: entry.problemText,
      solution,
      fromQuestionBank: true,
    });
    setRecognizedText(entry.problemText);
    setState('success');
    setShowHistory(false);
  }, []);

  const isLoading = state === 'recognizing' || state === 'solving' || state === 'grading';

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">搜题批改</h1>
          <p className="text-sm text-muted-foreground">拍照、语音或输入题目，AI 帮你解答</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showHistory ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => { setShowHistory((v) => !v); if (!showHistory) setError(null); }}
          >
            <Clock className="h-4 w-4" />
            历史记录
          </Button>
          {(state === 'success' || state === 'graded' || state === 'error') && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              重新搜题
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* ── LEFT COLUMN ── */}
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
                  <div className="mb-2 text-sm text-muted-foreground">
                    识别结果：<MathRenderer content={recognizedText} />
                  </div>
                )}
                <MathRenderer content={result.problem} className="text-sm text-foreground" />
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

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">
          {showHistory ? (
            <HistoryPanel
              onLoad={handleLoadFromHistory}
              onClose={() => setShowHistory(false)}
            />
          ) : (
            <>
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

              {/* Loading skeleton — shown during recognizing & early solving */}
              {(state === 'recognizing' || state === 'solving') && (
                <SolutionSkeleton phase={streamPhase} />
              )}

              {state === 'graded' && result?.gradeResult && (
                <>
                  <GradeResultCard result={result.gradeResult} />
                  {!result.gradeResult.isCorrect && (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                      {mistakeSaved ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-300">
                            已加入错题本
                          </span>
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">正在加入错题本...</span>
                        </>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        前往
                        <a href="/sky/learning" className="ml-1 underline">学习数据</a>
                        {' '}查看
                      </Badge>
                    </div>
                  )}
                </>
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
