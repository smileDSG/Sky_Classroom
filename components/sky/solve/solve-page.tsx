'use client';

import Link from 'next/link';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles,
  AlertCircle,
  RotateCcw,
  Image as ImageIcon,
  Wand2,
  Clock,
  BookOpen,
  CheckCircle2,
  Plus,
  X,
  Brain,
  Route,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { MultimodalInput } from './multimodal-input';
import { GradeResultCard } from './grade-result';
import { SolutionPanel } from './solution-panel';
import { SimilarProblems } from './similar-problems';
import { HistoryPanel } from './history-panel';
import { SolutionSkeleton } from './solution-skeleton';
import { MathRenderer } from './math-renderer';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useTaskStore } from '@/lib/store/use-task-store';
import type {
  GradeResult,
  FourPartOutput,
  GradedFourPartOutput,
  ProblemSpec,
  QuestionBankEntry,
} from '@/lib/solve/types';
import type { SearchRecord } from '@/lib/store/search-history';
import type { RecognitionAmbiguity } from '@/lib/recognition/recognition-quality';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import { completeLearningPlanTaskFromEvidence } from '@/lib/adaptive-learning/client/complete-learning-plan-task';

type SolvePageState =
  | 'idle'
  | 'recognizing'
  | 'confirming'
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

interface SolveProfileImpact {
  nodeId: string;
  displayName: string;
  masteryBefore: number | null;
  masteryAfter: number;
  confidenceBefore: number | null;
  confidenceAfter: number;
  evidenceAdded: number;
  repeatedErrorCount: number;
}

interface SolveGradeResponse extends GradeResult {
  evidence?: {
    matchedNodes: boolean;
    updatedStates: number;
    recordedEvent: boolean;
  };
  profileImpact?: SolveProfileImpact[];
  nextDecision?: PersonalizationContext['learnerDecision'];
}

/** Call recognition API, return extracted problem text */
interface RecognizedImageResult {
  text: string;
  latex: string;
  confidence: number;
  ambiguities: RecognitionAmbiguity[];
  needsConfirmation: boolean;
  problems: { image?: string; text: string; latex: string }[];
  structuredProblems: ProblemSpec[];
}

async function recognizeImage(file: File): Promise<RecognizedImageResult> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/sky/solve/recognize', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('图片识别失败');
  const json = await res.json();
  return {
    text: json.text ?? '',
    latex: json.latex ?? '',
    confidence: typeof json.confidence === 'number' ? json.confidence : 0,
    ambiguities: Array.isArray(json.ambiguities) ? json.ambiguities : [],
    needsConfirmation: json.needsConfirmation === true,
    problems: Array.isArray(json.problems) ? json.problems : [],
    structuredProblems: Array.isArray(json.structuredProblems) ? json.structuredProblems : [],
  };
}

/** Call grade API */
async function gradeProblem(
  problem: string,
  correctAnswer: string,
  userAnswer: string,
  stepByStep: FourPartOutput['steps'],
  knowledgePoints: string[],
): Promise<SolveGradeResponse> {
  const res = await fetch('/api/sky/solve/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem, correctAnswer, userAnswer, stepByStep, knowledgePoints }),
  });
  if (!res.ok) throw new Error('批改失败');
  const json = await res.json();
  void completeLearningPlanTaskFromEvidence(knowledgePoints, ['practice', 'diagnostic']);
  return json as SolveGradeResponse;
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
  problemSpec: ProblemSpec | null,
  onPhase: (phase: StreamPhase) => void,
  onUpdate: (partial: Partial<StreamState>) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/sky/solve/explain-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem: problemText, problemImage, problemSpec }),
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
              accumulated.steps = [
                ...accumulated.steps,
                {
                  label: event.label,
                  content: event.content,
                  keyPoints: event.keyPoints || [],
                },
              ];
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
              accumulated.knowledgePoints = event.points.map(
                (p: { name?: string; description?: string; difficulty?: string }) => ({
                  name: p.name || '',
                  description: p.description || '',
                  difficulty: p.difficulty || 'medium',
                }),
              );
              onUpdate({ knowledgePoints: accumulated.knowledgePoints });
              break;

            case 'similar':
              accumulated.similarQuestions = event.questions.map(
                (q: {
                  problem?: string;
                  difficulty?: number;
                  knowledgePoint?: string;
                  answer?: string;
                }) => ({
                  problem: q.problem || '',
                  difficulty: typeof q.difficulty === 'number' ? q.difficulty : 5,
                  knowledgePoint: q.knowledgePoint || '',
                  ...(q.answer ? { answer: q.answer } : {}),
                }),
              );
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

// ── Background job polling ────────────────────────────────────────

interface JobState {
  answer: string;
  steps: { label: string; content: string; keyPoints: string[] }[];
  knowledgePoints: { name: string; description: string; difficulty: string }[];
  similarQuestions: { problem: string; difficulty: number; knowledgePoint: string }[];
  fromQuestionBank: boolean;
  solvingTime: number;
}

async function pollSolveJob(
  jobId: string,
  onPhase: (phase: StreamPhase) => void,
  onUpdate: (partial: Partial<JobState>) => void,
  signal: AbortSignal,
): Promise<void> {
  const pollUrl = `/api/sky/solve/jobs/${jobId}`;

  while (!signal.aborted) {
    const res = await fetch(pollUrl, { signal });
    if (!res.ok) throw new Error(`作业查询失败 (${res.status})`);

    const json = await res.json();
    const job = json.data ?? json;
    onPhase(job.phase as StreamPhase);

    if (job.result) {
      onUpdate({
        answer: job.result.answer,
        steps: job.result.steps,
        knowledgePoints: job.result.knowledgePoints,
        similarQuestions: job.result.similarQuestions,
        fromQuestionBank: job.result.fromQuestionBank,
        solvingTime: job.result.solvingTime,
      });
    }

    if (job.done) {
      if (job.status === 'failed') {
        throw new Error(job.error || '解题失败');
      }
      return;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/** Submit a solve job and return jobId */
async function submitSolveJob(
  problem: string,
  problemImage: string | null,
  problemSpec: ProblemSpec | null,
): Promise<string> {
  const res = await fetch('/api/sky/solve/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem, problemImage, problemSpec }),
  });
  if (!res.ok) throw new Error('提交解题作业失败');
  const json = await res.json();
  return json.data?.jobId ?? json.jobId;
}

function phaseLabel(phase: StreamPhase): string {
  const labels: Record<StreamPhase, string> = {
    checking: '正在查询题库...',
    routing: '正在分析题目类型...',
    solving: 'AI 正在解题中...',
    done: '解题完成',
  };
  return labels[phase] ?? '处理中...';
}

function phaseProgress(phase: StreamPhase): string {
  const prog: Record<StreamPhase, string> = {
    checking: '15%',
    routing: '35%',
    solving: '70%',
    done: '100%',
  };
  return prog[phase] ?? '10%';
}

const SOLVE_ACTION_LABELS = {
  diagnostic: '先确认前置断点',
  teach: '先补概念再解题',
  review: '先唤醒旧方法',
  quiz: '精炼讲解并迁移',
} as const;

function getSolveNextAction(decision: NonNullable<SolveGradeResponse['nextDecision']>): {
  label: string;
  href: string;
} {
  const topic = decision.topic ? encodeURIComponent(decision.topic) : '';
  if (decision.action === 'teach') {
    return {
      label: '按最新学习情况补概念',
      href: `/sky/cloud-mind/teaching${topic ? `?topic=${topic}` : ''}`,
    };
  }
  if (decision.action === 'review') {
    return {
      label: '按最新学习情况去复习',
      href: `/sky/cloud-mind/memory${topic ? `?topic=${topic}` : ''}`,
    };
  }
  const quizParams = new URLSearchParams({
    difficulty: decision.difficulty,
    count: String(decision.questionCount),
  });
  if (decision.topic) quizParams.set('topic', decision.topic);
  return {
    label: decision.action === 'diagnostic' ? '继续做针对练习' : '进入进阶测验',
    href: `/sky/cloud-mind/quiz?${quizParams.toString()}`,
  };
}

function SolveProfileFeedback({ feedback }: { feedback: SolveGradeResponse }) {
  const impacts = feedback.profileImpact ?? [];
  const evidence = feedback.evidence;
  const decision = feedback.nextDecision;
  const nextAction = decision ? getSolveNextAction(decision) : null;

  return (
    <section className="overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50/60 dark:border-emerald-800/50 dark:from-emerald-950/35 dark:via-slate-950/70 dark:to-sky-950/25">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-200/70 px-4 py-3 dark:border-emerald-900/60">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <Brain className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              学习情况已记录本次批改
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              分数不是终点：答案记录会帮助更新学习情况，并安排下一步学习。
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200">
          {evidence?.updatedStates ? `更新 ${evidence.updatedStates} 个知识点情况` : '结果已记录'}
        </span>
      </div>

      <div className="space-y-3 p-4">
        {impacts.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {impacts.slice(0, 3).map((impact) => (
              <div
                key={impact.nodeId}
                className="rounded-xl border border-emerald-200/70 bg-white/75 p-3 dark:border-emerald-900/50 dark:bg-slate-950/35"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                    {impact.displayName}
                  </span>
                  <span className="text-[10px] text-slate-400">+{impact.evidenceAdded} 条记录</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                  <div>
                    <span className="block">掌握情况</span>
                    <strong className="mt-0.5 block text-sm text-slate-800 dark:text-white">
                      {impact.masteryBefore === null
                        ? '新建'
                        : `${Math.round(impact.masteryBefore * 100)}%`}
                      <span className="mx-1 text-emerald-500">→</span>
                      {Math.round(impact.masteryAfter * 100)}%
                    </strong>
                  </div>
                  <div>
                    <span className="block">判断把握</span>
                    <strong className="mt-0.5 block text-sm text-slate-800 dark:text-white">
                      {impact.confidenceBefore === null
                        ? '新建'
                        : `${Math.round(impact.confidenceBefore * 100)}%`}
                      <span className="mx-1 text-emerald-500">→</span>
                      {Math.round(impact.confidenceAfter * 100)}%
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs leading-5 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
            {evidence?.matchedNodes === false
              ? '本题还没有关联到课程知识点；分数和错题已保留，但暂时无法显示掌握情况变化。'
              : '本次答题记录已保存，继续完成同类题后会更准确地更新掌握情况。'}
          </div>
        )}

        {decision && nextAction && (
          <div className="flex flex-col gap-3 rounded-xl border border-sky-200/70 bg-sky-50/75 p-3 dark:border-sky-900/50 dark:bg-sky-950/30 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-sky-700 dark:text-sky-300">
                <Route className="h-3.5 w-3.5" /> 根据本次答题更新
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {decision.topic ?? '下一学习节点'} · {SOLVE_ACTION_LABELS[decision.action]}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {decision.summary}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href="/sky/learning/path"
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:bg-slate-950/50 dark:text-sky-300"
              >
                查看路线
              </Link>
              <Link
                href={nextAction.href}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
              >
                {nextAction.label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Component ────────────────────────────────────────────────────────

export function SolvePage() {
  const [state, setState] = useState<SolvePageState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [recognitionConfidence, setRecognitionConfidence] = useState<number | null>(null);
  const [recognitionAmbiguities, setRecognitionAmbiguities] = useState<RecognitionAmbiguity[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>('checking');
  const [showHistory, setShowHistory] = useState(false);
  const [mistakeSaved, setMistakeSaved] = useState(false);
  const [mistakeBookState, setMistakeBookState] = useState<
    'idle' | 'prompt' | 'saving' | 'saved' | 'dismissed'
  >('idle');
  const [profileFeedback, setProfileFeedback] = useState<SolveGradeResponse | null>(null);
  const addMistake = useSkyClassroomStore((s) => s.addMistake);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  // ── Subscribe to the single active solve task ──────────────────────

  const activeSolveTaskId = useTaskStore((s) => s.activeSolveTaskId);
  const tasks = useTaskStore((s) => s.tasks);
  const setActiveSolveTask = useTaskStore((s) => s.setActiveSolveTask);
  const updateTask = useTaskStore((s) => s.updateTask);

  // On mount: restore state from active task (survives navigation)
  useEffect(() => {
    if (!activeSolveTaskId) return;
    const task = tasks[activeSolveTaskId];
    if (!task) {
      setActiveSolveTask(null);
      return;
    }

    // Restore image preview and recognized text
    if (task.previewUrl) setPreviewImage(task.previewUrl);
    if (task.recognizedText) setRecognizedText(task.recognizedText);

    if (task.status === 'running') {
      setStreamPhase(
        task.phase?.includes('路由')
          ? 'routing'
          : task.phase?.includes('查')
            ? 'checking'
            : 'solving',
      );
      setState('solving');
    } else if (task.status === 'completed' && task.result) {
      setResult(task.result as SolveResult);
      setState('success');
      setMistakeBookState('prompt');
    } else if (task.status === 'failed') {
      setError(task.error || '解题失败');
      setState('error');
    }
  }, []);

  // Watch the active task for changes while on this page
  useEffect(() => {
    if (!activeSolveTaskId) return;
    const task = tasks[activeSolveTaskId];
    if (!task) return;

    if (task.status === 'running') {
      setStreamPhase(
        task.phase?.includes('路由')
          ? 'routing'
          : task.phase?.includes('查')
            ? 'checking'
            : 'solving',
      );
      setState('solving');
    } else if (task.status === 'completed' && task.result) {
      const r = task.result as SolveResult;
      setResult(r);
      setState('success');
      setMistakeBookState('prompt');
    } else if (task.status === 'failed') {
      setError(task.error || '解题失败');
      setState('error');
    }
  }, [activeSolveTaskId, tasks]);

  // ── Background solve launcher ─────────────────────────────────────

  async function startBackgroundPoll(
    taskId: string,
    problemText: string,
    problemImage: string | null,
    problemSpec: ProblemSpec | null,
  ): Promise<void> {
    const store = useTaskStore.getState;
    const abortController = new AbortController();
    abortRefs.current.set(taskId, abortController);

    try {
      const jobId = await submitSolveJob(problemText, problemImage, problemSpec);

      let latestPartial: Partial<{
        answer: string;
        steps: { label: string; content: string; keyPoints: string[] }[];
        knowledgePoints: { name: string; description: string; difficulty: string }[];
        similarQuestions: { problem: string; difficulty: number; knowledgePoint: string }[];
        fromQuestionBank: boolean;
      }> = {};

      await pollSolveJob(
        jobId,
        (phase) => {
          const progress =
            phase === 'checking'
              ? 15
              : phase === 'routing'
                ? 35
                : phase === 'solving'
                  ? 70
                  : phase === 'done'
                    ? 100
                    : 10;
          const phaseLabel =
            phase === 'checking'
              ? '正在查询题库...'
              : phase === 'routing'
                ? '正在分析题目类型...'
                : phase === 'solving'
                  ? 'AI 正在解题中...'
                  : phase === 'done'
                    ? '解题完成'
                    : '处理中...';
          store().updateTask(taskId, { phase: phaseLabel, progress, jobId });
        },
        (partial) => {
          latestPartial = { ...latestPartial, ...partial };
          store().updateTask(taskId, { progress: 70, phase: 'AI 正在解题中...' });
        },
        abortController.signal,
      );

      // Build SolveResult from polled data
      const solution: FourPartOutput = {
        answer: latestPartial.answer || '',
        solution: latestPartial.answer || '',
        steps: latestPartial.steps || [],
        knowledgePoints: (latestPartial.knowledgePoints || []).map((k) => ({
          name: k.name,
          description: k.description,
          difficulty: k.difficulty as 'easy' | 'medium' | 'hard',
        })),
        similarQuestions: (latestPartial.similarQuestions || []).map((q) => ({
          problem: q.problem,
          difficulty: q.difficulty,
          knowledgePoint: q.knowledgePoint,
        })),
      };

      const solveResult: SolveResult = {
        problem: problemText,
        problemImage: problemImage ?? undefined,
        solution,
        fromQuestionBank: latestPartial.fromQuestionBank || false,
      };

      store().updateTask(taskId, {
        status: 'completed',
        progress: 100,
        phase: '解题完成',
        result: solveResult,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      store().updateTask(taskId, {
        status: 'failed',
        progress: 0,
        phase: '解题失败',
        error: err instanceof Error ? err.message : '解题失败',
      });
    } finally {
      abortRefs.current.delete(taskId);
    }
  }

  const handleSubmit = useCallback(
    async (input: {
      type: 'image' | 'voice' | 'text';
      content: string | File;
      previewUrl?: string;
    }) => {
      // Cancel previous in-flight task
      const prevId = useTaskStore.getState().activeSolveTaskId;
      if (prevId) {
        abortRefs.current.get(prevId)?.abort();
        abortRefs.current.delete(prevId);
      }

      setError(null);
      setResult(null);
      setMistakeSaved(false);
      setMistakeBookState('idle');
      setProfileFeedback(null);
      setStreamPhase('checking');

      try {
        let problemText = '';
        let problemImage: string | null = null;
        let previewUrl: string | undefined;
        let problemSpec: ProblemSpec | null = null;

        if (input.type === 'image') {
          setState('recognizing');
          previewUrl = input.previewUrl;
          setPreviewImage(previewUrl ?? null);
          const recognized = await recognizeImage(input.content as File);
          problemSpec = recognized.structuredProblems?.[0] ?? null;
          problemText = problemSpec?.stem || recognized.text || recognized.latex;
          problemImage = recognized.problems?.[0]?.image ?? null;
          setRecognizedText(problemText);
          setRecognitionConfidence(recognized.confidence);
          setRecognitionAmbiguities(recognized.ambiguities);

          if (
            recognized.needsConfirmation ||
            recognized.confidence < 0.8 ||
            recognized.ambiguities.length > 0
          ) {
            setState('confirming');
            return;
          }
        } else if (input.type === 'text') {
          problemSpec = null;
          problemText = input.content as string;
          setRecognizedText(problemText);
        }

        if (!problemText) {
          setError('未能识别到题目文字');
          setState('error');
          return;
        }

        // Create background task — only one solve at a time
        const taskId = `solve_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setActiveSolveTask(taskId);

        useTaskStore.getState().addTask({
          id: taskId,
          type: 'solve',
          label: `搜题: ${problemText.slice(0, 20)}${problemText.length > 20 ? '...' : ''}`,
          status: 'running',
          progress: 10,
          phase: '正在提交...',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          resultRoute: '/sky/solve',
          previewUrl,
          recognizedText: problemText,
        });

        startBackgroundPoll(taskId, problemText, problemImage, problemSpec);
        setState('solving');
      } catch (err) {
        setError(err instanceof Error ? err.message : '解题过程中出现错误');
        setState('error');
      }
    },
    [setActiveSolveTask],
  );

  const handleConfirmRecognition = useCallback(() => {
    const text = recognizedText.trim();
    if (!text) {
      setError('请先补充识别后的题目内容');
      return;
    }
    void handleSubmit({ type: 'text', content: text, previewUrl: previewImage ?? undefined });
  }, [handleSubmit, previewImage, recognizedText]);

  const handleGrade = useCallback(
    async (input: { problem: string; userAnswer: string }) => {
      setError(null);

      try {
        setState('grading');
        const correctAnswer = result?.solution.answer ?? '';
        const gradeResult = await gradeProblem(
          input.problem,
          correctAnswer,
          input.userAnswer,
          result?.solution.steps ?? [],
          result?.solution.knowledgePoints?.map((point) => point.name) ?? [],
        );
        setProfileFeedback(gradeResult);

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
    [result],
  );

  const handleReset = useCallback(() => {
    abortRefs.current.forEach((c) => c.abort());
    abortRefs.current.clear();
    setActiveSolveTask(null);
    setState('idle');
    setResult(null);
    setError(null);
    setRecognizedText('');
    setRecognitionConfidence(null);
    setRecognitionAmbiguities([]);
    setPreviewImage(null);
    setStreamPhase('checking');
    setMistakeBookState('idle');
    setProfileFeedback(null);
  }, [setActiveSolveTask]);

  const handleSimilarQuestionClick = useCallback(
    (problem: string) => {
      handleSubmit({ type: 'text', content: problem });
    },
    [handleSubmit],
  );

  const handleSaveToMistakeBook = useCallback(async () => {
    if (!result) return;
    setMistakeBookState('saving');
    try {
      const res = await fetch('/api/sky/mistakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemText: result.problem,
          problemImage: result.problemImage,
          userAnswer: '',
          correctAnswer: result.solution.answer,
          errorType: 'concept',
          knowledgePoints: result.solution.knowledgePoints?.map((kp) => kp.name) ?? [],
        }),
      });
      if (!res.ok) throw new Error('保存失败');
      setMistakeBookState('saved');
    } catch {
      setMistakeBookState('prompt'); // retry allowed
    }
  }, [result]);

  const handleLoadFromHistory = useCallback((entry: QuestionBankEntry | SearchRecord) => {
    if (!('answer' in entry)) return;
    const solution: FourPartOutput = {
      answer: entry.answer,
      solution: '',
      steps: [],
      knowledgePoints: (entry.knowledgePoints ?? []).map((kp) => ({
        name: kp.name,
        description: kp.description,
        difficulty: (kp.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
      })),
      similarQuestions: entry.similarQuestions ?? [],
    };
    setResult({
      problem: entry.problemText,
      solution,
      fromQuestionBank: true,
    });
    setRecognizedText(entry.problemText);
    setState('success');
    setMistakeBookState('idle');
    setShowHistory(false);
  }, []);

  const isLoading = state === 'recognizing' || state === 'solving' || state === 'grading';

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
            搜题批改
          </h1>
          <p className="text-sm text-muted-foreground">拍照、语音或输入题目，AI 帮你解答</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showHistory ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => {
              setShowHistory((v) => !v);
              if (!showHistory) setError(null);
            }}
          >
            <Clock className="h-4 w-4" />
            历史记录
          </Button>
          {(state === 'success' ||
            state === 'graded' ||
            state === 'error' ||
            state === 'solving' ||
            state === 'confirming') && (
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
                initialPreviewUrl={previewImage}
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
              <p className="mt-4 text-sm font-medium text-sky-600 dark:text-sky-400">
                正在识别图片...
              </p>
              <p className="text-xs text-muted-foreground">请稍候</p>
            </div>
          )}

          {state === 'confirming' && (
            <Card className="border-amber-200/60 dark:border-amber-800/40">
              <CardHeader className="border-b bg-amber-50/60 dark:bg-amber-950/20">
                <CardTitle className="text-base text-amber-700 dark:text-amber-300">
                  请核对识别结果
                </CardTitle>
                <CardDescription>
                  手写内容存在不确定字符，请修正后再开始搜题。当前识别把握{' '}
                  {Math.round((recognitionConfidence ?? 0) * 100)}%
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <Textarea
                  aria-label="识别结果"
                  value={recognizedText}
                  onChange={(event) => setRecognizedText(event.target.value)}
                  className="min-h-[140px] resize-y"
                />
                {recognitionAmbiguities.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>需要确认的内容</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-1 space-y-1">
                        {recognitionAmbiguities.map((ambiguity, index) => (
                          <li key={`${ambiguity.field}-${index}`}>
                            {ambiguity.reason}（{ambiguity.candidates.join(' / ')}）
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-[#4A90D9] hover:bg-[#4A90D9]/90"
                    onClick={handleConfirmRecognition}
                  >
                    确认并搜题
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    重新识别
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {(state === 'solving' || state === 'grading') && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-sky-200/40 dark:border-sky-800/30 bg-sky-50/50 dark:bg-sky-950/20 p-8">
              {previewImage && (
                <img
                  src={previewImage}
                  alt="题目图片"
                  className="mb-4 max-h-32 rounded-md border object-contain"
                />
              )}
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-sky-500" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-sky-600 dark:text-sky-400">
                {state === 'grading' ? '正在批改...' : phaseLabel(streamPhase)}
              </p>
              <p className="text-xs text-muted-foreground">
                {state === 'grading' ? 'AI 正在分析你的答案' : '后台处理中，结果即将呈现'}
              </p>
              {recognizedText && (
                <p className="mt-2 text-xs text-muted-foreground max-w-[280px] truncate">
                  识别：{recognizedText}
                </p>
              )}
              {/* Progress bar */}
              <div className="mt-4 w-full max-w-[200px]">
                <div className="h-1.5 rounded-full bg-sky-200 dark:bg-sky-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-700 ease-in-out"
                    style={{ width: phaseProgress(streamPhase) }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                  <span>查库</span>
                  <span>安排</span>
                  <span>解题</span>
                  <span>完成</span>
                </div>
              </div>
            </div>
          )}

          {(state === 'success' || state === 'graded') && result && (
            <Card className="overflow-hidden border-sky-200/50 dark:border-sky-800/40">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-sm font-medium">题目预览</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {previewImage && (
                  <div className="mb-3">
                    <img
                      src={previewImage}
                      alt="题目图片"
                      className="max-h-40 rounded-md border object-contain"
                    />
                  </div>
                )}
                {recognizedText && (
                  <div className="mb-2 text-sm text-muted-foreground">
                    识别结果：
                    <MathRenderer content={recognizedText} />
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
            <HistoryPanel onLoad={handleLoadFromHistory} onClose={() => setShowHistory(false)} />
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
                  {profileFeedback && <SolveProfileFeedback feedback={profileFeedback} />}
                  {!result.gradeResult.isCorrect && (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                      {mistakeSaved ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
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
                        <a href="/sky/learning" className="ml-1 underline">
                          学习数据
                        </a>{' '}
                        查看
                      </Badge>
                    </div>
                  )}
                </>
              )}

              {/* Mistake book prompt — shown after solve completes */}
              {state === 'success' &&
                mistakeBookState !== 'idle' &&
                mistakeBookState !== 'dismissed' && (
                  <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm text-amber-700 dark:text-amber-300">
                        {mistakeBookState === 'saved' ? '已加入错题本' : '是否将此题加入错题本？'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {mistakeBookState === 'prompt' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={handleSaveToMistakeBook}
                          >
                            <Plus className="h-3 w-3" />
                            加入
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            onClick={() => setMistakeBookState('dismissed')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {mistakeBookState === 'saving' && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                      )}
                      {mistakeBookState === 'saved' && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                  </div>
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
