'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import type { QuestionBankRow } from '@/lib/question-bank/types';
import { useTaskStore } from '@/lib/store/use-task-store';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import {
  FileQuestion,
  Sparkles,
  Wand2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Trophy,
  Target,
  BookOpen,
  Brain,
  Lightbulb,
  Loader2,
  Zap,
  Star,
  Clock3,
  Gauge,
  ListChecks,
  Route,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { deriveQuizParamsFromProfile } from '@/lib/student/quiz-param-deriver';
import {
  SUBJECT_CONFIG,
  DIFFICULTY_CONFIG,
  QUIZ_COUNT_OPTIONS,
  type DifficultyId,
} from '@/lib/student/profile-config';
import { MathRenderer } from '@/components/sky/solve/math-renderer';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import type { StudentProfile } from '@/lib/student/profile-types';
import { completeLearningPlanTaskFromEvidence } from '@/lib/adaptive-learning/client/complete-learning-plan-task';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import {
  createLearningDecision,
  reportLearningEvent,
  reportLearningOutcome,
  type LearningDecisionContext,
  type LearningDecisionPromise,
} from '@/lib/adaptive-learning/client/learning-session';

const SUBJECTS = SUBJECT_CONFIG.map((s) => ({ id: s.id, label: s.label, dot: s.dot }));

const DIFFICULTIES = DIFFICULTY_CONFIG.map((d, i) => ({
  id: d.id,
  label: d.label,
  desc: d.desc,
  star: '★'.repeat(i + 1),
}));

function isDifficultyId(value: string | null): value is DifficultyId {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

const SUBJECT_LABEL_BY_ID = Object.fromEntries(
  SUBJECTS.map((subject) => [subject.id, subject.label]),
);

const REASON_LABELS: Record<string, string> = {
  'no-evidence': '还没有足够的答题记录，先做基础摸底',
  'behavior-diagnostic': '需要先确认你的学习情况',
  'low-confidence': '还不太确定你的学习情况，先多做几道题',
  'low-mastery': '当前知识点还不熟悉',
  'repeated-errors': '同类错误重复出现',
  'low-retention': '学过但有些遗忘',
  'stable-mastery': '掌握和记忆都比较稳定，可以进入练习',
};

const ACTION_LABELS = {
  diagnostic: '基础摸底',
  teach: '先补概念',
  review: '优先复习',
  quiz: '针对练习',
} as const;

const PACING_LABELS = {
  remedial: '补基础节奏',
  steady: '稳步推进',
  sprint: '冲刺节奏',
} as const;

interface QuizQuestion {
  id: number;
  questionType: 'choice' | 'fill' | 'judge';
  question: string;
  options: string[];
  answer: number;
  answerText: string;
  explanation: string;
}

type QuizQuestionType = QuizQuestion['questionType'];

const QUESTION_TYPES: { id: QuizQuestionType; label: string; desc: string }[] = [
  { id: 'choice', label: '选择题', desc: '四选一' },
  { id: 'fill', label: '填空题', desc: '输入答案' },
  { id: 'judge', label: '判断题', desc: '正确/错误' },
];

const MATH_INSERT_SYMBOLS: { label: string; value: string }[] = [
  { label: 'x²', value: '²' },
  { label: 'x³', value: '³' },
  { label: 'xⁿ', value: 'ⁿ' },
  { label: '√', value: '√' },
  { label: 'π', value: 'π' },
  { label: '÷', value: '÷' },
  { label: '×', value: '×' },
  { label: '±', value: '±' },
  { label: '°', value: '°' },
  { label: '∞', value: '∞' },
];

type QuizState = 'idle' | 'generating' | 'answering' | 'done';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';
type QuestionSource = 'ai' | 'bank';

interface QuizBackfillStats {
  backfilled: number;
  duplicates: number;
  errors: number;
}

interface QuizEvidenceSummary {
  recordedEvents: number;
  updatedStates: number;
  skippedQuestions: number;
}

interface QuizProfileImpact {
  nodeId: string;
  displayName: string;
  masteryBefore: number | null;
  masteryAfter: number;
  confidenceBefore: number | null;
  confidenceAfter: number;
  evidenceAdded: number;
  repeatedErrorCount: number;
}

function stripOptionPrefix(option: string): string {
  return option.replace(/^\s*[A-DＡ-Ｄ][\.．、:]\s*/i, '').trim();
}

function answerIndexToLetter(index: number): string {
  return String.fromCharCode(65 + Math.min(Math.max(index, 0), 3));
}

function answerToIndex(answer: string, options: string[]): number | null {
  const normalized = answer.trim();
  const letterMatch = normalized.match(/[A-DＡ-Ｄ]/i);
  if (letterMatch) {
    const letter = letterMatch[0].toUpperCase();
    const index = 'ABCD'.indexOf(letter);
    if (index >= 0) return index;
  }

  if (/^[0-3]$/.test(normalized)) return Number(normalized);

  const optionIndex = options.findIndex(
    (option) => stripOptionPrefix(option) === stripOptionPrefix(normalized),
  );
  return optionIndex >= 0 ? optionIndex : null;
}

function normalizeQuizQuestions(rawQuestions: unknown): QuizQuestion[] {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions
    .map((raw, index) => {
      const item = raw as Partial<QuizQuestion>;
      if (!item.question) return null;

      const questionType: QuizQuestionType =
        item.questionType === 'fill' || item.questionType === 'judge'
          ? item.questionType
          : 'choice';

      if (questionType === 'fill') {
        const answerText = String(item.answerText ?? '').trim();
        if (!answerText) return null;
        return {
          id: index + 1,
          questionType: 'fill',
          question: String(item.question),
          options: [],
          answer: 0,
          answerText,
          explanation: String(item.explanation ?? '暂无解析'),
        };
      }

      if (questionType === 'judge') {
        const isTrue = item.answer === 0;
        return {
          id: index + 1,
          questionType: 'judge',
          question: String(item.question),
          options: ['正确', '错误'],
          answer: isTrue ? 0 : 1,
          answerText: String(item.answerText ?? (isTrue ? '正确' : '错误')),
          explanation: String(item.explanation ?? '暂无解析'),
        };
      }

      const options = Array.isArray(item.options)
        ? item.options.map((option) => stripOptionPrefix(String(option))).filter(Boolean)
        : [];
      const answer =
        typeof item.answer === 'number'
          ? item.answer
          : answerToIndex(String(item.answer ?? ''), options);

      if (options.length !== 4 || answer === null || answer < 0 || answer > 3) return null;

      return {
        id: index + 1,
        questionType: 'choice',
        question: String(item.question),
        options,
        answer,
        answerText: String(item.answerText ?? options[answer] ?? ''),
        explanation: String(item.explanation ?? '暂无解析'),
      };
    })
    .filter((question): question is QuizQuestion => question !== null);
}

function bankRowToQuizQuestion(row: QuestionBankRow, index: number): QuizQuestion | null {
  if (!row.options || row.options.length !== 4) return null;
  const options = row.options.map(stripOptionPrefix);
  const answer = answerToIndex(row.answer, options);
  if (answer === null || answer < 0 || answer > 3) return null;

  return {
    id: index + 1,
    questionType: 'choice',
    question: row.content,
    options,
    answer,
    answerText: options[answer],
    explanation: row.explanation || row.answer,
  };
}

function sampleQuestions(questions: QuizQuestion[], count: number): QuizQuestion[] {
  return [...questions]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((question, index) => ({ ...question, id: index + 1 }));
}

function mapBankRowToQuiz(row: QuestionBankRow, index: number): QuizQuestion {
  if (row.questionType === 'choice' && row.options && row.options.length >= 2) {
    const letterMatch = row.answer
      .trim()
      .toUpperCase()
      .match(/^[A-Z]/);
    const answerIndex = letterMatch ? letterMatch[0].charCodeAt(0) - 65 : 0;
    const answer = Math.min(Math.max(0, answerIndex), row.options.length - 1);
    return {
      id: index,
      questionType: 'choice',
      question: row.content,
      options: row.options,
      answer,
      answerText: row.options[answer],
      explanation: row.explanation || row.answer,
    };
  }
  if (row.questionType === 'judge') {
    const ans = row.answer.trim().toLowerCase();
    const isTrue = /^(正确|对|是|yes|true|1|√)$/.test(ans);
    return {
      id: index,
      questionType: 'judge',
      question: row.content,
      options: ['正确', '错误'],
      answer: isTrue ? 0 : 1,
      answerText: isTrue ? '正确' : '错误',
      explanation: row.explanation || row.answer,
    };
  }
  return {
    id: index,
    questionType: 'fill',
    question: row.content,
    options: ['查看答案'],
    answer: 0,
    answerText: row.answer,
    explanation: row.explanation || row.answer,
  };
}

export default function CloudMindQuizPage() {
  return (
    <SkyAppShell section="resources" fullBleed>
      <Suspense fallback={<CloudMindQuizFallback />}>
        <CloudMindQuizContent />
      </Suspense>
    </SkyAppShell>
  );
}

function CloudMindQuizFallback() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[var(--quiz-void)] text-[var(--quiz-text)]">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--quiz-border)] bg-[var(--quiz-surface)] px-5 py-4 text-sm text-[var(--quiz-muted)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--quiz-primary)]" />
          加载星际试炼场...
        </div>
      </div>
    </div>
  );
}

function CloudMindQuizContent() {
  const searchParams = useSearchParams();
  const querySubject = searchParams.get('subject');
  const queryDifficulty = searchParams.get('difficulty');
  const queryTopic = searchParams.get('topic');
  const queryCount = searchParams.get('count');
  const [quizMode, setQuizMode] = useState<'ai' | 'bank'>('ai');
  const [subject, setSubject] = useState('math');
  const [difficulty, setDifficulty] = useState<DifficultyId>('medium');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [questionType, setQuestionType] = useState<QuizQuestionType>('choice');
  const [state, setState] = useState<QuizState>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationMode, setExplanationMode] = useState<'immediate' | 'on-request'>('immediate');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [personalizationContext, setPersonalizationContext] =
    useState<PersonalizationContext | null>(null);
  const [nextDecision, setNextDecision] = useState<
    PersonalizationContext['learnerDecision'] | null
  >(null);
  const [quizEvidence, setQuizEvidence] = useState<QuizEvidenceSummary | null>(null);
  const [profileImpact, setProfileImpact] = useState<QuizProfileImpact[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [attemptSaved, setAttemptSaved] = useState(false);
  const [questionSource, setQuestionSource] = useState<QuestionSource>('ai');
  const [backfillStats, setBackfillStats] = useState<QuizBackfillStats | null>(null);
  const [bankDialog, setBankDialog] = useState<{ title: string; message: string } | null>(null);
  const [mistakeBookIds, setMistakeBookIds] = useState<Set<number>>(new Set());
  const [mistakeBookStatus, setMistakeBookStatus] = useState<
    'idle' | 'saving' | 'saved' | 'skipped'
  >('idle');
  const [mistakeBookResult, setMistakeBookResult] = useState<{ added: number } | null>(null);
  const [fillInput, setFillInput] = useState('');
  const [fillRevealed, setFillRevealed] = useState(false);
  const [fillSkipped, setFillSkipped] = useState(false);
  const [fillInputs, setFillInputs] = useState<Record<number, string>>({});
  const fillInputRef = useRef<HTMLInputElement>(null);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEditedTopicRef = useRef(false);
  const userEditedDifficultyRef = useRef(false);
  const userEditedCountRef = useRef(false);
  const learningDecisionRef = useRef<LearningDecisionContext | null>(null);
  const decisionPromiseRef = useRef<LearningDecisionPromise | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const quizStateRef = useRef<QuizState>('idle');
  const outcomeReportedRef = useRef(false);
  const answersRef = useRef<(number | null)[]>([]);
  const questionsRef = useRef<QuizQuestion[]>([]);
  const hintsRequestedRef = useRef(0);

  useEffect(() => {
    quizStateRef.current = state;
  }, [state]);

  const startLearningSession = useCallback(() => {
    if (learningDecisionRef.current) return Promise.resolve(learningDecisionRef.current);
    if (decisionPromiseRef.current) return decisionPromiseRef.current;
    sessionStartedAtRef.current = Date.now();
    const request = createLearningDecision({
      sessionId: `quiz:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      action: 'quiz',
      topic: topic.trim() || SUBJECT_LABEL_BY_ID[subject] || subject,
      difficulty,
      source: 'cloud-mind-quiz',
    });
    decisionPromiseRef.current = request.then((context) => {
      if (context) learningDecisionRef.current = context;
      return context;
    });
    return decisionPromiseRef.current;
  }, [difficulty, subject, topic]);

  const reportQuizExit = useCallback(async (reason: string) => {
    const startedAt = sessionStartedAtRef.current;
    const activeState = quizStateRef.current;
    const context = learningDecisionRef.current ?? (await decisionPromiseRef.current);
    if (!context || !startedAt || outcomeReportedRef.current || activeState !== 'answering') {
      return;
    }
    outcomeReportedRef.current = true;
    const currentQuestions = questionsRef.current;
    const currentAnswers = answersRef.current;
    const currentCorrectCount = currentAnswers.filter(
      (answer, index) => answer !== null && answer === currentQuestions[index]?.answer,
    ).length;
    void reportLearningOutcome({
      decisionId: context.decisionId,
      windowStart: new Date(startedAt).toISOString(),
      windowEnd: new Date().toISOString(),
      correctCount: currentCorrectCount,
      questionCount: currentQuestions.length,
      hintsRequested: hintsRequestedRef.current,
      durationSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
      completed: false,
      exited: true,
      errorTypes: [],
    });
    reportLearningEvent({
      type: 'session-exited',
      source: 'cloud-mind-quiz',
      correlationId: context.correlationId,
      payload: {
        decisionId: context.decisionId,
        durationSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
        reason,
      },
    });
  }, []);

  const startAnswering = useCallback(
    (nextQuestions: QuizQuestion[], source: QuestionSource) => {
      setQuestions(nextQuestions);
      questionsRef.current = nextQuestions;
      setAnswers(new Array(nextQuestions.length).fill(null));
      answersRef.current = new Array(nextQuestions.length).fill(null);
      setCurrentIdx(0);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setSaveStatus('idle');
      setAttemptSaved(false);
      setNextDecision(null);
      setQuizEvidence(null);
      setProfileImpact([]);
      setQuestionSource(source);
      setFillInput('');
      setFillRevealed(false);
      setFillSkipped(false);
      setFillInputs({});
      savePromiseRef.current = null;
      setState('answering');
      learningDecisionRef.current = null;
      decisionPromiseRef.current = null;
      sessionStartedAtRef.current = Date.now();
      outcomeReportedRef.current = false;
      hintsRequestedRef.current = 0;
      void startLearningSession();
    },
    [startLearningSession],
  );

  const insertFillSymbol = (symbol: string) => {
    const input = fillInputRef.current;
    const start = input?.selectionStart ?? fillInput.length;
    const end = input?.selectionEnd ?? fillInput.length;
    const next = fillInput.slice(0, start) + symbol + fillInput.slice(end);
    setFillInput(next);
    requestAnimationFrame(() => {
      const el = fillInputRef.current;
      if (el) {
        el.focus();
        const pos = start + symbol.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollQuizJob = useCallback(
    async (taskId: string, jobId: string) => {
      try {
        const res = await fetch(`/api/sky/cloud-mind/quiz?jobId=${encodeURIComponent(jobId)}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || '出题任务异常');
        }

        const task = useTaskStore.getState().getTask(taskId);
        if (task) {
          useTaskStore.getState().updateTask(taskId, {
            progress: typeof json.progress === 'number' ? json.progress : task.progress,
            phase: typeof json.phase === 'string' ? json.phase : task.phase,
          });
        }

        if (json.done) {
          stopPolling();
          if (json.status === 'completed' && json.result) {
            const generatedQuestions = normalizeQuizQuestions(json.result.questions);
            if (generatedQuestions.length === 0) throw new Error('AI 出题结果为空，请重试');
            if (json.result.backfill || json.backfill) {
              setBackfillStats(json.result.backfill ?? json.backfill);
            }
            startAnswering(generatedQuestions, 'ai');
            useTaskStore.getState().updateTask(taskId, {
              status: 'completed',
              progress: 100,
              phase: '出题完成',
              result: { questions: generatedQuestions, source: 'ai' },
            });
          } else {
            throw new Error(json.error || '出题任务异常');
          }
          useTaskStore.getState().removeTask(taskId);
          setActiveTaskId(null);
          return;
        }

        pollTimerRef.current = setTimeout(() => {
          void pollQuizJob(taskId, jobId);
        }, 2000);
      } catch (err) {
        stopPolling();
        const msg = err instanceof Error ? err.message : '出题失败';
        useTaskStore.getState().updateTask(taskId, {
          status: 'failed',
          progress: 0,
          phase: '出题失败',
          error: msg,
        });
        setError(msg);
        setState('idle');
      }
    },
    [startAnswering, stopPolling],
  );
  useEffect(() => {
    if (querySubject) setSubject(querySubject);
    if (isDifficultyId(queryDifficulty)) setDifficulty(queryDifficulty);
    if (queryTopic) setTopic(queryTopic);
    if (queryCount) setCount(Number(queryCount));
  }, [queryCount, queryDifficulty, querySubject, queryTopic]);

  // Auto-fill only fields the user did not explicitly choose.
  useEffect(() => {
    let cancelled = false;

    async function loadAutoParams() {
      try {
        const res = await fetch('/api/sky/cloud-mind/personalization-context');
        if (!res.ok) throw new Error('context unavailable');
        const json = (await res.json()) as {
          success?: boolean;
          data?: PersonalizationContext;
        };
        const context = json.data;
        if (cancelled || !json.success || !context) return;
        setPersonalizationContext(context);

        const recommendedTopic =
          context.toolPolicies?.quiz.targetTopic ??
          context.tutoringPolicy?.targetTopic ??
          context.weakPoints[0]?.knowledgePoint ??
          context.learningPath?.next;
        const quizPolicy = context.toolPolicies?.quiz;
        const recommendedDifficulty = quizPolicy?.difficulty ?? context.preferredDifficulty;
        if (!querySubject && !queryTopic && recommendedTopic && !userEditedTopicRef.current) {
          setTopic(recommendedTopic);
        }
        if (!queryDifficulty && !userEditedDifficultyRef.current) {
          setDifficulty(recommendedDifficulty);
        }
        if (!queryCount && !userEditedCountRef.current && quizPolicy) {
          setCount(quizPolicy.questionCount);
        }
        if (quizPolicy) {
          setExplanationMode(quizPolicy.explanationMode);
        }

        const effectiveNoticeDifficulty = queryDifficulty ?? recommendedDifficulty;
        const difficultyLabel =
          DIFFICULTIES.find((item) => item.id === effectiveNoticeDifficulty)?.label ??
          effectiveNoticeDifficulty;
        const effectiveNoticeTopic =
          queryTopic ?? (!querySubject ? recommendedTopic : null) ?? '入门摸底';
        const effectiveNoticeCount = queryCount ? Number(queryCount) : quizPolicy?.questionCount;
        setNotice(
          context.learnerDecision
            ? `${queryTopic || querySubject ? '保留你选择的范围。' : context.learnerDecision.summary} ${effectiveNoticeTopic} / ${difficultyLabel}难度 / ${effectiveNoticeCount}题`
            : `已根据天梯工坊为你预设：${recommendedTopic ?? '入门摸底'} / ${difficultyLabel}难度`,
        );
      } catch {
        try {
          const res = await fetch('/api/student/profile');
          if (!res.ok) return;
          const json = await res.json();
          const profile = json?.data?.hasProfile
            ? {
                userId: '',
                masteryBySubject: {} as StudentProfile['masteryBySubject'],
                masteryByKnowledge: json.data.masteryByKnowledge ?? {},
                weakPoints: json.data.weakPoints ?? [],
                strongPoints: [],
                errorPatterns: json.data.errorPatterns ?? [],
                totalQuestions: 0,
                totalCorrect: 0,
                lastUpdated: new Date(),
              }
            : null;
          if (cancelled || !profile) return;
          const params = deriveQuizParamsFromProfile(profile);
          setSubject(params.subject);
          if (!userEditedDifficultyRef.current) setDifficulty(params.difficulty);
          if (!userEditedTopicRef.current) setTopic(params.topic);
          setCount(params.count);
        } catch {
          // Ignore auto-fill errors; keep manual defaults.
        }
      }
    }
    loadAutoParams();
    return () => {
      cancelled = true;
    };
  }, [queryCount, queryDifficulty, querySubject, queryTopic]);

  useEffect(() => {
    const store = useTaskStore.getState();
    const quizTasks = Object.values(store.tasks).filter(
      (t) => t.type === 'quiz' && t.status !== 'failed',
    );
    if (quizTasks.length === 0) return;
    const task = quizTasks[quizTasks.length - 1];
    setActiveTaskId(task.id);
    if (task.status === 'running') setState('generating');
    else if (task.status === 'completed' && task.result) {
      const data = task.result as { questions: QuizQuestion[]; source?: QuestionSource };
      startAnswering(data.questions, data.source ?? 'ai');
      store.removeTask(task.id);
      setActiveTaskId(null);
    }
    if (task.status === 'running' && task.jobId) {
      void pollQuizJob(task.id, task.jobId);
    }
  }, [pollQuizJob, startAnswering]);

  useEffect(() => {
    if (!activeTaskId) return;
    const unsub = useTaskStore.subscribe((s) => {
      const task = s.tasks[activeTaskId];
      if (!task) {
        setActiveTaskId(null);
        return;
      }
      if (task.status === 'completed' && task.result) {
        const data = task.result as { questions: QuizQuestion[]; source?: QuestionSource };
        startAnswering(data.questions, data.source ?? 'ai');
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      } else if (task.status === 'failed') {
        setError(task.error || '????????');
        setState('idle');
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      }
    });
    return unsub;
  }, [activeTaskId, startAnswering]);

  useEffect(() => () => stopPolling(), [stopPolling]);
  useEffect(() => {
    return () => {
      void reportQuizExit('page-unload');
    };
  }, [reportQuizExit]);
  const handleLoadFromBank = useCallback(async () => {
    setState('generating');
    setError(null);
    setNotice(null);
    setBankDialog(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('subject', SUBJECT_LABEL_BY_ID[subject] || subject);
      params.set('difficulty', difficulty);
      params.set('questionType', 'choice');
      if (topic.trim()) params.set('knowledgePoint', topic.trim());

      const res = await fetch(`/api/sky/question-bank?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || '加载题库失败');
      if (!data.success) throw new Error(data.error || '加载题库失败');

      const entries = (data.questions ?? []) as QuestionBankRow[];
      const availableQuestions = entries
        .map((entry, index) => bankRowToQuizQuestion(entry, index))
        .filter((question): question is QuizQuestion => question !== null);

      if (availableQuestions.length < count) {
        const subjectLabel = SUBJECTS.find((item) => item.id === subject)?.label ?? subject;
        const difficultyLabel =
          DIFFICULTIES.find((item) => item.id === difficulty)?.label ?? difficulty;
        const topicLabel = topic.trim() ? ` · ${topic.trim()}` : '';
        setBankDialog({
          title: availableQuestions.length === 0 ? '星域题库暂未点亮' : '题库题量不足',
          message:
            availableQuestions.length === 0
              ? `${subjectLabel} · ${difficultyLabel}${topicLabel} 还没有可用题目。可以先用上方「AI 出题」生成一组题（完成后会自动沉淀进题库），之后就能用「题库练习」抽题了。`
              : `${subjectLabel} · ${difficultyLabel}${topicLabel} 当前仅有 ${availableQuestions.length} 道可用选择题，少于本次需要的 ${count} 道。可以降低题量、切换条件，或用「AI 出题」补充题库后再来。`,
        });
        setState('idle');
        return;
      }

      startAnswering(sampleQuestions(availableQuestions, count), 'bank');
    } catch (err) {
      setBankDialog({
        title: '题库星门暂时失联',
        message: err instanceof Error ? err.message : '加载题库失败，请稍后再试。',
      });
      setState('idle');
    }
  }, [count, difficulty, startAnswering, subject, topic]);

  const handleGenerate = useCallback(async () => {
    setState('generating');
    setError(null);
    setNotice(null);
    stopPolling();
    const taskId = `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const subjectLabel = SUBJECTS.find((s) => s.id === subject)?.label || subject;
    setActiveTaskId(taskId);
    useTaskStore.getState().addTask({
      id: taskId,
      type: 'quiz',
      label: `智能出题: ${topic || subjectLabel}`,
      status: 'running',
      progress: 30,
      phase: 'AI 出题中…',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    try {
      const res = await fetch('/api/sky/cloud-mind/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          difficulty,
          topic: topic || undefined,
          count,
          questionType,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '生成失败');
      const jobId = typeof json.jobId === 'string' ? json.jobId : null;
      if (!jobId) throw new Error('缺少 jobId');
      useTaskStore.getState().updateTask(taskId, {
        jobId,
        progress: typeof json.progress === 'number' ? json.progress : 0,
        phase: typeof json.phase === 'string' ? json.phase : '等待执行',
      });
      void pollQuizJob(taskId, jobId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败';
      useTaskStore.getState().updateTask(taskId, {
        status: 'failed',
        progress: 0,
        phase: '出题失败',
        error: msg,
      });
      setError(msg);
      setState('idle');
    }
  }, [count, difficulty, pollQuizJob, stopPolling, subject, topic, questionType]);
  const saveQuizAttempt = useCallback(
    (finalAnswers: (number | null)[]) => {
      if (savePromiseRef.current) return savePromiseRef.current;

      setSaveStatus('saving');
      const request = (async () => {
        try {
          const knowledgePoints = topic.trim() ? [topic.trim()] : [];
          const res = await fetch('/api/sky/cloud-mind/quiz-attempts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject,
              difficulty,
              topic,
              source: quizMode,
              questions: questions.map((question, index) => ({
                question: question.question,
                options: question.options,
                answer: question.answer,
                userAnswer: finalAnswers[index],
                isCorrect: finalAnswers[index] === question.answer,
                explanation: question.explanation,
                knowledgePoints,
              })),
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || '成绩保存失败');
          setNextDecision(data.decision ?? null);
          setQuizEvidence(data.evidence ?? null);
          setProfileImpact(Array.isArray(data.profileImpact) ? data.profileImpact : []);
          setAttemptSaved(true);
          setSaveStatus('saved');
          void completeLearningPlanTaskFromEvidence(
            [
              topic,
              ...((data.profileImpact ?? []) as Array<{ nodeId?: string }>).map(
                (impact) => impact.nodeId ?? '',
              ),
            ].filter(Boolean),
            ['practice', 'diagnostic'],
          );
        } catch {
          setSaveStatus('failed');
          savePromiseRef.current = null;
        }
      })();
      savePromiseRef.current = request;
      return request;
    },
    [attemptSaved, difficulty, questions, quizMode, subject, topic],
  );

  const handleAnswer = useCallback(
    (idx: number) => {
      if (selectedAnswer !== null) return;
      setSelectedAnswer(idx);
      setShowExplanation(explanationMode === 'immediate');
      const na = [...answers];
      na[currentIdx] = idx;
      setAnswers(na);
      answersRef.current = na;
      if (currentIdx === questions.length - 1) {
        void saveQuizAttempt(na);
      }
    },
    [selectedAnswer, explanationMode, answers, currentIdx, questions.length, saveQuizAttempt],
  );

  const correctCount = answers.filter((a, i) => a === questions[i]?.answer).length;

  const handleNext = useCallback(async () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setFillInput('');
      setFillRevealed(false);
      setFillSkipped(false);
    } else {
      await saveQuizAttempt(answers);
      const context = learningDecisionRef.current ?? (await decisionPromiseRef.current);
      const startedAt = sessionStartedAtRef.current;
      if (context && startedAt && !outcomeReportedRef.current) {
        outcomeReportedRef.current = true;
        void reportLearningOutcome({
          decisionId: context.decisionId,
          windowStart: new Date(startedAt).toISOString(),
          windowEnd: new Date().toISOString(),
          correctCount,
          questionCount: questions.length,
          durationSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
          completed: true,
          exited: false,
          hintsRequested: hintsRequestedRef.current,
          errorTypes: correctCount < questions.length ? ['incorrect-answer'] : [],
        });
      }
      setState('done');
    }
  }, [answers, correctCount, currentIdx, questions.length, saveQuizAttempt]);

  const wrongQuestions = useMemo(
    () => questions.filter((question, index) => answers[index] !== question.answer),
    [answers, questions],
  );
  const hasWrongQuestions = wrongQuestions.length > 0;

  const handleAddWrongToMistakeBook = useCallback(async () => {
    if (mistakeBookIds.size === 0) {
      setMistakeBookStatus('skipped');
      return;
    }
    setMistakeBookStatus('saving');
    let added = 0;
    for (const questionId of mistakeBookIds) {
      const index = questions.findIndex((q) => q.id === questionId);
      if (index === -1) continue;
      const q = questions[index];
      const userAnswerIdx = answers[index];
      useSkyClassroomStore.getState().addMistake({
        id: `mistake-quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        problem: q.question,
        userAnswer: userAnswerIdx !== null ? q.options[userAnswerIdx] : '未作答',
        correctAnswer: q.options[q.answer],
        cause: 'concept-unclear',
        solvedAt: new Date(),
        reviewed: false,
        reviewCount: 0,
        knowledgePoints: topic.trim() ? [topic.trim()] : [],
        source: 'classroom-quiz',
        sourceSessionId: activeTaskId ?? undefined,
        errorExplanation: q.explanation,
      });
      added++;
    }
    setMistakeBookResult({ added });
    setMistakeBookStatus('saved');
  }, [mistakeBookIds, questions, answers, topic, activeTaskId]);

  // Initialize mistakeBookIds with all wrong questions when entering 'done' state
  useEffect(() => {
    if (state === 'done' && hasWrongQuestions && mistakeBookStatus === 'idle') {
      setMistakeBookIds(new Set(wrongQuestions.map((q) => q.id)));
    }
  }, [state, hasWrongQuestions, wrongQuestions, mistakeBookStatus]);

  const toggleMistakeBookId = useCallback((id: number) => {
    setMistakeBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    reportQuizExit('reset');
    stopPolling();
    if (activeTaskId) {
      useTaskStore.getState().removeTask(activeTaskId);
      setActiveTaskId(null);
    }
    const quizPolicy = personalizationContext?.toolPolicies?.quiz;
    setTopic(quizPolicy?.targetTopic ?? '');
    setDifficulty(quizPolicy?.difficulty ?? 'medium');
    setCount(quizPolicy?.questionCount ?? 5);
    setExplanationMode(quizPolicy?.explanationMode ?? 'immediate');
    setState('idle');
    setQuestions([]);
    setAnswers([]);
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setError(null);
    setNotice(null);
    setSaveStatus('idle');
    setAttemptSaved(false);
    setNextDecision(null);
    setQuizEvidence(null);
    setProfileImpact([]);
    setQuestionSource('ai');
    setBackfillStats(null);
    setMistakeBookIds(new Set());
    setMistakeBookStatus('idle');
    setMistakeBookResult(null);
    savePromiseRef.current = null;
    learningDecisionRef.current = null;
    decisionPromiseRef.current = null;
    sessionStartedAtRef.current = null;
    outcomeReportedRef.current = false;
  }, [activeTaskId, personalizationContext, reportQuizExit, stopPolling]);

  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const currentQ = questions[currentIdx];
  const nextActionTopic = topic.trim() || SUBJECT_LABEL_BY_ID[subject] || subject;
  const wrongQuestionContent = wrongQuestions
    .map(
      (question, index) =>
        `错题 ${index + 1}：${question.question}\n正确答案：${question.options[question.answer]}\n解析：${question.explanation}`,
    )
    .join('\n\n');
  const algorithmNextAction = nextDecision?.topic
    ? {
        label:
          nextDecision.action === 'teach'
            ? '算法推荐 · 先补概念'
            : nextDecision.action === 'review'
              ? '算法推荐 · 先复习'
              : nextDecision.action === 'diagnostic'
                ? '系统推荐 · 继续练习'
                : '算法推荐 · 进阶练习',
        desc: nextDecision.summary,
        href:
          nextDecision.action === 'teach'
            ? `/sky/cloud-mind/teaching?topic=${encodeURIComponent(nextDecision.topic)}`
            : nextDecision.action === 'review'
              ? `/sky/cloud-mind/memory?topic=${encodeURIComponent(nextDecision.topic)}`
              : `/sky/cloud-mind/quiz?topic=${encodeURIComponent(nextDecision.topic)}&difficulty=${nextDecision.difficulty}&count=5`,
        icon:
          nextDecision.action === 'teach'
            ? Lightbulb
            : nextDecision.action === 'review'
              ? Brain
              : Target,
        tone: 'text-amber-800 border-amber-300 bg-amber-50 dark:text-amber-200 dark:border-amber-400/35 dark:bg-amber-400/10',
        disabled: false,
      }
    : null;
  const nextActionLinks = [
    ...(algorithmNextAction ? [algorithmNextAction] : []),
    {
      label: '复习错题',
      desc: `${wrongQuestions.length} 道错题需要回看`,
      href: '/sky/learning',
      icon: BookOpen,
      tone: 'text-rose-700 border-rose-200 bg-rose-50 dark:text-rose-300 dark:border-rose-500/25 dark:bg-rose-500/8',
      disabled: wrongQuestions.length === 0,
    },
    {
      label: '生成同类题',
      desc: `${nextActionTopic} 专项练习`,
      href: `/sky/cloud-mind/quiz?topic=${encodeURIComponent(nextActionTopic)}&difficulty=${accuracy < 70 ? 'easy' : difficulty}&count=5`,
      icon: Target,
      tone: 'text-[var(--quiz-primary-bright)] border-[var(--quiz-border)] bg-[var(--quiz-primary)]/8',
      disabled: false,
    },
    {
      label: '生成记忆卡',
      desc: wrongQuestions.length > 0 ? '把错因转成复习卡' : '提炼本次练习要点',
      href: `/sky/cloud-mind/memory?topic=${encodeURIComponent(nextActionTopic)}&content=${encodeURIComponent(wrongQuestionContent || `知识点：${nextActionTopic}`)}`,
      icon: Brain,
      tone: 'text-violet-700 border-violet-200 bg-violet-50 dark:text-violet-300 dark:border-violet-500/25 dark:bg-violet-500/8',
      disabled: false,
    },
    {
      label: '进入微讲解',
      desc: '生成一段针对性讲解',
      href: `/sky/cloud-mind/teaching?topic=${encodeURIComponent(nextActionTopic)}&from=quiz`,
      icon: Lightbulb,
      tone: 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-500/25 dark:bg-emerald-500/8',
      disabled: false,
    },
  ];

  const panelStyle: React.CSSProperties = {
    background: 'var(--quiz-surface)',
    border: '1px solid var(--quiz-border)',
    boxShadow: '0 0 20px -6px var(--quiz-glow)',
  };

  const btnPrimary: React.CSSProperties = {
    background: 'var(--quiz-primary-bg)',
    border: '1px solid var(--quiz-border-strong)',
    color: 'var(--quiz-primary-text)',
    boxShadow: '0 0 12px var(--quiz-glow)',
  };

  const btnIdle: React.CSSProperties = {
    border: '1px solid var(--quiz-border)',
    color: 'var(--quiz-muted)',
  };

  const configControls = (
    <div className="space-y-5">
      <QuizPanel title="学科星域">
        <div className="grid grid-cols-3 gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSubject(s.id);
              }}
              disabled={state === 'generating'}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all disabled:opacity-50"
              style={subject === s.id ? btnPrimary : btnIdle}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              <span className="text-[var(--quiz-text)]">{s.label}</span>
            </button>
          ))}
        </div>
      </QuizPanel>

      <QuizPanel
        title={
          <>
            知识点 <span className="text-xs font-normal text-[var(--quiz-muted)]">(可选)</span>
          </>
        }
      >
        <input
          type="text"
          value={topic}
          onChange={(e) => {
            userEditedTopicRef.current = true;
            setTopic(e.target.value);
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state !== 'generating') {
              e.preventDefault();
              if (quizMode === 'ai') handleGenerate();
              else handleLoadFromBank();
            }
          }}
          placeholder="如：导数、牛顿第二定律、线性代数……"
          disabled={state === 'generating'}
          className="w-full bg-transparent border-b border-[var(--quiz-border)] px-1 py-3 text-sm text-[var(--quiz-text)] placeholder:text-[var(--quiz-muted)] focus:border-[var(--quiz-primary)] focus:outline-none transition-colors disabled:opacity-50"
        />
      </QuizPanel>

      <QuizPanel title="难度等级">
        <div className="grid grid-cols-3 gap-3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                userEditedDifficultyRef.current = true;
                setDifficulty(d.id);
              }}
              disabled={state === 'generating'}
              className="flex flex-col items-center gap-1.5 rounded-xl border p-4 transition-all disabled:opacity-50"
              style={difficulty === d.id ? btnPrimary : btnIdle}
            >
              <span className="text-base text-[var(--quiz-primary)]">{d.star}</span>
              <span className="text-sm font-semibold text-[var(--quiz-text)]">{d.label}</span>
              <span className="text-[10px] text-[var(--quiz-muted)]">{d.desc}</span>
            </button>
          ))}
        </div>
      </QuizPanel>

      <QuizPanel title="题目数量">
        <div className="flex gap-2">
          {QUIZ_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => {
                userEditedCountRef.current = true;
                setCount(n);
              }}
              disabled={state === 'generating'}
              className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
              style={count === n ? btnPrimary : btnIdle}
            >
              {n} 题
            </button>
          ))}
        </div>
      </QuizPanel>

      {quizMode === 'ai' && (
        <QuizPanel title="题型选择">
          <div className="grid grid-cols-3 gap-2">
            {QUESTION_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setQuestionType(t.id)}
                disabled={state === 'generating'}
                className="flex flex-col items-center gap-1 rounded-xl border p-3 transition-all disabled:opacity-50"
                style={questionType === t.id ? btnPrimary : btnIdle}
              >
                <span className="text-sm font-semibold text-[var(--quiz-text)]">{t.label}</span>
                <span className="text-[10px] text-[var(--quiz-muted)]">{t.desc}</span>
              </button>
            ))}
          </div>
        </QuizPanel>
      )}
    </div>
  );

  return (
    <div
      className="relative min-h-[calc(100dvh-4rem)] overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(circle at 10% 0%, var(--quiz-glow), transparent 24rem), radial-gradient(circle at 100% 20%, var(--quiz-accent-glow), transparent 28rem), linear-gradient(180deg, var(--quiz-horizon), var(--quiz-void) 38rem)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[32rem] opacity-50 dark:opacity-30 [background-size:28px_28px]"
        style={{
          backgroundImage:
            'linear-gradient(color-mix(in srgb, var(--quiz-border) 45%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--quiz-border) 45%, transparent) 1px, transparent 1px)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent dark:via-amber-300/35" />

      <BankInsufficientDialog dialog={bankDialog} onClose={() => setBankDialog(null)} />

      <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 pt-6 pb-12 space-y-6 text-[var(--quiz-text)]">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
          style={panelStyle}
        >
          <div className="absolute right-0 top-0 h-48 w-48 -translate-y-1/2 translate-x-1/3 rounded-full bg-amber-200/35 blur-3xl dark:bg-amber-300/10" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--quiz-border-strong)] bg-[var(--quiz-primary)]/15 shadow-[0_0_16px_var(--quiz-glow)]">
              <FileQuestion className="h-7 w-7 text-[var(--quiz-primary)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--quiz-text)]">
                星际试炼场
              </h1>
              <p className="text-sm text-[var(--quiz-muted)] mt-1">
                学习情况会先帮你判断练什么，再安排题量、难度、反馈和下一步
              </p>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {(state === 'idle' || state === 'generating') && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid gap-6 lg:grid-cols-[1fr_340px]"
            >
              <div className="space-y-5">
                {/* Mode */}
                <QuizPanel title="出题模式">
                  <div className="grid grid-cols-2 gap-2">
                    {(['ai', 'bank'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setQuizMode(mode)}
                        className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all"
                        style={quizMode === mode ? btnPrimary : btnIdle}
                      >
                        {mode === 'ai' ? (
                          <Wand2 className="h-4 w-4" />
                        ) : (
                          <BookOpen className="h-4 w-4" />
                        )}
                        {mode === 'ai' ? 'AI 出题' : '题库练习'}
                      </button>
                    ))}
                  </div>
                </QuizPanel>

                {configControls}

                {quizMode === 'ai' ? (
                  <button
                    onClick={handleGenerate}
                    disabled={state === 'generating'}
                    className="quiz-button-sweep w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={btnPrimary}
                  >
                    {state === 'generating' ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> AI 出题中…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" /> 启动试炼引擎
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleLoadFromBank}
                    disabled={state === 'generating'}
                    className="quiz-button-sweep w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-all disabled:opacity-50"
                    style={btnPrimary}
                  >
                    {state === 'generating' ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> 题库抽取中…
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-5 w-5" /> 从题库抽题
                      </>
                    )}
                  </button>
                )}
                {!personalizationContext && notice && <QuizNotice message={notice} />}
                {error && <QuizError message={error} />}
              </div>

              {/* Right: Preview */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                {state === 'generating' ? (
                  <QuizPanel>
                    <div className="flex items-center gap-2 mb-5">
                      <Loader2 className="h-4 w-4 text-[var(--quiz-primary)] animate-spin" />
                      <span className="text-sm font-medium text-[var(--quiz-primary-bright)]">
                        {quizMode === 'ai' ? 'AI 正在出题…' : '题库正在抽题…'}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {Array.from({ length: count }).map((_, i) => (
                        <div key={i} className="space-y-2">
                          <div className="h-4 rounded-lg animate-pulse w-full bg-[var(--quiz-primary)]/5" />
                          <div className="h-4 rounded-lg animate-pulse w-3/4 bg-[var(--quiz-primary)]/4" />
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="h-8 rounded-lg animate-pulse bg-[var(--quiz-primary)]/4" />
                            <div className="h-8 rounded-lg animate-pulse bg-[var(--quiz-primary)]/4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </QuizPanel>
                ) : (
                  <QuizPanel>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-4 w-4 text-[var(--quiz-primary)]" />
                      <h3 className="text-sm font-bold text-[var(--quiz-text)]">
                        {quizMode === 'ai' ? '出题配置' : '题库抽题配置'}
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: '学科', value: SUBJECTS.find((s) => s.id === subject)?.label },
                        {
                          label: '难度',
                          value: DIFFICULTIES.find((d) => d.id === difficulty)?.label,
                        },
                        { label: '数量', value: `${count} 题` },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between text-sm">
                          <span className="text-[var(--quiz-muted)]">{row.label}</span>
                          <span className="font-medium text-[var(--quiz-text)]">{row.value}</span>
                        </div>
                      ))}
                      {topic && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--quiz-muted)]">主题</span>
                          <span className="font-medium text-[var(--quiz-text)] truncate ml-2 max-w-[180px]">
                            {topic}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-5 pt-4 border-t border-[var(--quiz-border)]">
                      <p className="text-xs text-[var(--quiz-muted)] text-center">
                        {quizMode === 'ai'
                          ? '支持 Ctrl+Enter 快捷生成'
                          : '按条件从题库随机抽取选择题'}
                      </p>
                    </div>
                  </QuizPanel>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Answering */}
          {state === 'answering' && currentQ && (
            <motion.div
              key="answering"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-2xl space-y-6"
            >
              {!personalizationContext && notice && <QuizNotice message={notice} />}
              {/* Constellation Progress */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--quiz-muted)] shrink-0">
                  {currentIdx + 1} / {questions.length}
                </span>
                <div className="flex-1 flex items-center gap-1">
                  {questions.map((_, i) => {
                    const isDone = answers[i] !== null;
                    const isCurrent = i === currentIdx;
                    const isCorrect = answers[i] === questions[i]?.answer;
                    return (
                      <div key={i} className="flex items-center flex-1">
                        <div
                          className={`h-2.5 flex-1 rounded-full transition-all duration-500 ${isCurrent ? 'quiz-star-pulse' : ''}`}
                          style={{
                            background: isDone
                              ? isCorrect
                                ? 'var(--quiz-success)'
                                : 'var(--quiz-error)'
                              : isCurrent
                                ? 'color-mix(in srgb, var(--quiz-primary) 50%, transparent)'
                                : 'color-mix(in srgb, var(--quiz-primary) 10%, transparent)',
                            boxShadow: isDone
                              ? isCorrect
                                ? '0 0 6px color-mix(in srgb, var(--quiz-success) 40%, transparent)'
                                : '0 0 6px color-mix(in srgb, var(--quiz-error) 40%, transparent)'
                              : isCurrent
                                ? '0 0 8px color-mix(in srgb, var(--quiz-primary) 40%, transparent)'
                                : 'none',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Question Card */}
              <div className="rounded-2xl border p-6" style={panelStyle}>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-4 w-4 text-[var(--quiz-primary)]" />
                  <span className="text-xs text-[var(--quiz-muted)]">第 {currentIdx + 1} 题</span>
                </div>
                <div className="text-base font-semibold text-[var(--quiz-text)] mb-5 leading-relaxed">
                  <MathRenderer content={currentQ.question} />
                </div>

                {currentQ.questionType === 'fill' ? (
                  <div className="space-y-3">
                    {!fillRevealed ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {MATH_INSERT_SYMBOLS.map((s) => (
                            <button
                              key={s.label}
                              type="button"
                              onClick={() => insertFillSymbol(s.value)}
                              disabled={selectedAnswer !== null}
                              title={`插入 ${s.label}`}
                              className="min-w-9 rounded-lg border border-[var(--quiz-border)] px-2 py-1.5 text-sm text-[var(--quiz-muted)] transition-colors hover:border-[var(--quiz-primary)] hover:text-[var(--quiz-primary-bright)] disabled:opacity-40"
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                        <input
                          ref={fillInputRef}
                          type="text"
                          value={fillInput}
                          onChange={(e) => setFillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && fillInput.trim()) {
                              e.preventDefault();
                              setFillInputs((prev) => ({
                                ...prev,
                                [currentQ.id]: fillInput.trim(),
                              }));
                              setFillRevealed(true);
                            }
                          }}
                          disabled={selectedAnswer !== null}
                          placeholder="输入你的答案…"
                          className="w-full rounded-xl border border-[var(--quiz-border)] bg-transparent px-4 py-3 text-sm text-[var(--quiz-text)] placeholder:text-[var(--quiz-muted)] focus:border-[var(--quiz-primary)] focus:outline-none transition-colors disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFillInputs((prev) => ({ ...prev, [currentQ.id]: fillInput.trim() }));
                            setFillRevealed(true);
                          }}
                          disabled={!fillInput.trim() || selectedAnswer !== null}
                          className="quiz-button-sweep w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all disabled:opacity-50"
                          style={btnPrimary}
                        >
                          <CheckCircle2 className="h-4 w-4" /> 提交答案
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="rounded-xl border border-[var(--quiz-border)] bg-[var(--quiz-primary)]/5 p-4"
                          style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--quiz-primary)' }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="h-4 w-4 text-[var(--quiz-primary)]" />
                            <span className="text-xs font-semibold text-[var(--quiz-primary-bright)]">
                              标准答案
                            </span>
                          </div>
                          <p className="text-sm text-[var(--quiz-text)] leading-relaxed">
                            <MathRenderer
                              content={currentQ.answerText}
                              className="text-sm text-[var(--quiz-text)] leading-relaxed"
                            />
                          </p>
                        </div>
                        {selectedAnswer === null && !fillSkipped && (
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => handleAnswer(0)}
                              className="rounded-xl border border-emerald-400/50 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
                            >
                              我答对了
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAnswer(1)}
                              className="rounded-xl border border-red-400/50 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-300"
                            >
                              我答错了
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFillSkipped(true);
                                setShowExplanation(true);
                              }}
                              className="rounded-xl border border-[var(--quiz-border)] px-3 py-2.5 text-sm font-medium text-[var(--quiz-muted)] transition-colors hover:border-[var(--quiz-border-strong)] hover:text-[var(--quiz-primary-bright)]"
                            >
                              跳过自评
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentQ.options.map((option, i) => {
                      const isSelected = selectedAnswer === i;
                      const isCorrectAnswer = i === currentQ.answer;
                      const showResult = selectedAnswer !== null;
                      let border =
                        'border-[var(--quiz-border)] hover:border-[var(--quiz-border-strong)]';
                      if (showResult && isCorrectAnswer)
                        border = 'border-emerald-400/60 bg-emerald-500/10';
                      else if (showResult && isSelected && !isCorrectAnswer)
                        border = 'border-red-400/60 bg-red-500/10';
                      else if (isSelected)
                        border = 'border-[var(--quiz-border-strong)] bg-[var(--quiz-primary)]/10';
                      return (
                        <motion.button
                          key={i}
                          onClick={() => handleAnswer(i)}
                          disabled={selectedAnswer !== null}
                          whileTap={selectedAnswer === null ? { scale: 0.98 } : undefined}
                          className={`w-full text-left rounded-xl border p-4 transition-all disabled:cursor-default ${border}`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors"
                              style={{
                                background:
                                  showResult && isCorrectAnswer
                                    ? 'var(--quiz-success)'
                                    : showResult && isSelected && !isCorrectAnswer
                                      ? 'var(--quiz-error)'
                                      : 'color-mix(in srgb, var(--quiz-primary) 15%, transparent)',
                                color:
                                  showResult &&
                                  (isCorrectAnswer || (isSelected && !isCorrectAnswer))
                                    ? '#fff'
                                    : 'var(--quiz-primary-bright)',
                              }}
                            >
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className="text-sm text-[var(--quiz-text)]">
                              <MathRenderer
                                content={option}
                                className="text-sm text-[var(--quiz-text)]"
                              />
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {selectedAnswer !== null &&
                  explanationMode === 'on-request' &&
                  !showExplanation && (
                    <button
                      type="button"
                      onClick={() => {
                        hintsRequestedRef.current += 1;
                        setShowExplanation(true);
                      }}
                      className="mt-4 w-full rounded-xl border border-[var(--quiz-border)] px-4 py-2.5 text-sm text-[var(--quiz-muted)] transition-colors hover:border-[var(--quiz-border-strong)] hover:text-[var(--quiz-primary-bright)]"
                    >
                      按需查看解析
                    </button>
                  )}

                <AnimatePresence>
                  {showExplanation && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mt-5 rounded-xl border border-[var(--quiz-border)] bg-[var(--quiz-primary)]/5 p-4"
                        style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--quiz-primary)' }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-4 w-4 text-[var(--quiz-primary)]" />
                          <span className="text-xs font-semibold text-[var(--quiz-primary-bright)]">
                            解析星云
                          </span>
                        </div>
                        <p className="text-sm text-[var(--quiz-text)] leading-relaxed">
                          <MathRenderer
                            content={currentQ.explanation}
                            className="text-sm text-[var(--quiz-text)] leading-relaxed"
                          />
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {selectedAnswer !== null && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <button
                    onClick={handleNext}
                    disabled={currentIdx === questions.length - 1 && saveStatus === 'saving'}
                    className="quiz-button-sweep w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={btnPrimary}
                  >
                    {currentIdx < questions.length - 1 ? (
                      <>
                        <>下一题</>
                        <ChevronRight className="h-4 w-4" />
                      </>
                    ) : saveStatus === 'saving' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> 正在写入学情…
                      </>
                    ) : (
                      <>
                        <>查看成绩</>
                        <Trophy className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Done */}
          {state === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-[1440px] space-y-6"
            >
              <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
                <div className="min-w-0 space-y-6">
                  <div
                    className="rounded-2xl border p-6 text-center quiz-score-appear"
                    style={panelStyle}
                  >
                    <div className="relative inline-flex items-center justify-center mb-4">
                      <div className="absolute h-28 w-28 rounded-full border-2 border-[var(--quiz-border)]" />
                      <div
                        className="h-24 w-24 rounded-full flex items-center justify-center"
                        style={{
                          background: 'color-mix(in srgb, var(--quiz-primary) 10%, transparent)',
                          border:
                            '2px solid color-mix(in srgb, var(--quiz-primary) 40%, transparent)',
                          boxShadow: '0 0 20px var(--quiz-glow)',
                        }}
                      >
                        <div>
                          <div className="text-3xl font-bold text-[var(--quiz-primary-bright)]">
                            {accuracy}
                          </div>
                          <div className="text-[10px] text-[var(--quiz-muted)]">分</div>
                        </div>
                      </div>
                      <div
                        className="absolute h-28 w-28 animate-spin"
                        style={{ animationDuration: '8s' }}
                      >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 h-2 w-2 rounded-full bg-[var(--quiz-primary)]" />
                      </div>
                    </div>
                    <h2 className="text-xl font-bold text-[var(--quiz-text)] mb-1">
                      {questions.length} 题中答对 {correctCount} 题
                    </h2>
                    <div className="mt-3 flex items-center justify-center gap-6 text-sm">
                      <div className="flex items-center gap-1.5 text-[var(--quiz-success)]">
                        <CheckCircle2 className="h-4 w-4" /> 正确 {correctCount}
                      </div>
                      <div className="flex items-center gap-1.5 text-[var(--quiz-error)]">
                        <XCircle className="h-4 w-4" /> 错误 {questions.length - correctCount}
                      </div>
                    </div>
                    <div className="mt-4 text-xs text-[var(--quiz-muted)]">
                      {saveStatus === 'saving' && '正在保存答题记录…'}
                      {saveStatus === 'saved' &&
                        '答题记录已保存，返回学习情况页可查看各学科掌握情况'}
                      {saveStatus === 'failed' && '保存答题记录失败，可稍后重试'}
                    </div>
                  </div>

                  {hasWrongQuestions && mistakeBookStatus === 'idle' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border p-5"
                      style={{
                        borderColor: 'rgba(251,191,36,0.3)',
                        background: 'rgba(251,191,36,0.04)',
                      }}
                    >
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--quiz-text)]">
                        <BookOpen className="h-4 w-4 text-amber-500" />
                        错题加入复习计划
                      </div>
                      <p className="mb-3 text-xs leading-5 text-[var(--quiz-muted)]">
                        将错题加入错题本后，系统会按艾宾浩斯遗忘曲线安排复习，下方可取消不需要的题。
                      </p>
                      <div className="space-y-1.5">
                        {wrongQuestions.map((q) => {
                          const index = questions.findIndex((x) => x.id === q.id);
                          return (
                            <label
                              key={q.id}
                              className="flex items-center gap-2 rounded-lg border border-[var(--quiz-border)] px-3 py-2 text-xs text-[var(--quiz-text)] transition-colors hover:border-amber-300/40 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={mistakeBookIds.has(q.id)}
                                onChange={() => toggleMistakeBookId(q.id)}
                                className="h-3.5 w-3.5 accent-amber-500"
                              />
                              <span className="truncate">
                                <span className="font-medium text-rose-500/70">
                                  错题 {index + 1}：
                                </span>
                                <MathRenderer
                                  content={q.question}
                                  className="text-xs text-[var(--quiz-text)]"
                                />
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => {
                            setMistakeBookStatus('skipped');
                            setMistakeBookResult(null);
                          }}
                          className="rounded-lg border border-[var(--quiz-border)] px-3 py-2 text-xs text-[var(--quiz-muted)] transition-colors hover:border-[var(--quiz-border-strong)] hover:text-[var(--quiz-primary-bright)]"
                        >
                          全部跳过
                        </button>
                        <button
                          onClick={handleAddWrongToMistakeBook}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 transition-all hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          确认加入 {mistakeBookIds.size} 道错题
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {mistakeBookStatus === 'saving' && (
                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--quiz-border)] bg-[var(--quiz-primary)]/5 p-4 text-sm text-[var(--quiz-muted)]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在加入错题本…
                    </div>
                  )}

                  {mistakeBookStatus === 'saved' && mistakeBookResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-300/20 dark:bg-emerald-300/[0.07]"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />
                        已加入 {mistakeBookResult.added} 道错题到错题本
                      </div>
                      <p className="mt-1 text-xs text-[var(--quiz-muted)]">
                        系统将按遗忘曲线安排复习，可在"学习情况"页查看。
                      </p>
                    </motion.div>
                  )}

                  {mistakeBookStatus === 'skipped' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-[var(--quiz-border)] bg-[var(--quiz-primary)]/5 p-4"
                    >
                      <div className="flex items-center gap-2 text-sm text-[var(--quiz-muted)]">
                        已跳过，后续可在"学习情况"页手动添加错题。
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="min-w-0 space-y-6">
                  <QuizProfileUpdatePanel
                    status={saveStatus}
                    topic={nextActionTopic}
                    evidence={quizEvidence}
                    impacts={profileImpact}
                    decision={nextDecision ?? null}
                  />

                  <div className="rounded-2xl border p-5" style={panelStyle}>
                    <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--quiz-text)]">
                      <Zap className="h-4 w-4 text-[var(--quiz-primary)]" />
                      下一步学习动作
                    </div>
                    <p className="mb-4 text-xs text-[var(--quiz-muted)]">
                      基于本次答题结果推荐，点卡片即可直达对应学习工具
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {nextActionLinks.map((action) => {
                        const Icon = action.icon;
                        const contentNode = (
                          <>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span className="text-sm font-semibold">{action.label}</span>
                            </div>
                            <p className="mt-1 text-xs text-[var(--quiz-text)]/55">{action.desc}</p>
                          </>
                        );
                        if (action.disabled) {
                          return (
                            <div
                              key={action.label}
                              className="rounded-xl border border-[var(--quiz-border)] bg-[var(--quiz-primary)]/5 px-4 py-3 text-[var(--quiz-text)]/35"
                            >
                              {contentNode}
                            </div>
                          );
                        }
                        return (
                          <Link
                            key={action.label}
                            href={action.href}
                            className={`rounded-xl border px-4 py-3 transition-all hover:translate-y-[-1px] ${action.tone}`}
                          >
                            {contentNode}
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {questionSource === 'ai' && (
                    <div className="rounded-2xl border p-5" style={panelStyle}>
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--quiz-text)]">
                        <BookOpen className="h-4 w-4 text-[var(--quiz-primary)]" />
                        题库自动沉淀
                      </div>
                      <p className="mt-1 text-xs text-[var(--quiz-muted)]">
                        {backfillStats
                          ? `本次生成题目已自动去重沉淀至题库：新增 ${backfillStats.backfilled} 题，跳过重复 ${backfillStats.duplicates} 题${backfillStats.errors > 0 ? `，失败 ${backfillStats.errors} 题` : ''}。可在星域题库中按「AI生成」标签检索查看。`
                          : '本次生成的题目将自动去重沉淀至题库，并标记为「AI生成」。'}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {questions.map((q, i) => {
                      const userAnswer = answers[i];
                      const isCorrect = userAnswer === q.answer;
                      return (
                        <motion.div
                          key={q.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="rounded-xl border p-4"
                          style={{
                            borderColor: isCorrect
                              ? 'rgba(52,211,153,0.3)'
                              : 'rgba(248,113,113,0.3)',
                            background: isCorrect
                              ? 'rgba(52,211,153,0.05)'
                              : 'rgba(248,113,113,0.05)',
                          }}
                        >
                          <div className="flex items-start gap-3">
                            {isCorrect ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium text-[var(--quiz-text)] mb-1">
                                  {i + 1}.{' '}
                                  <MathRenderer
                                    content={q.question}
                                    className="text-sm font-medium text-[var(--quiz-text)]"
                                  />
                                </p>
                              </div>
                              <p className="text-xs text-[var(--quiz-muted)]">
                                你的答案：
                                <MathRenderer
                                  content={
                                    q.questionType === 'fill'
                                      ? (fillInputs[q.id] ?? '未作答')
                                      : userAnswer !== null
                                        ? q.options[userAnswer]
                                        : '未作答'
                                  }
                                  className="text-xs text-[var(--quiz-muted)]"
                                />{' '}
                                · 正确答案：
                                <MathRenderer
                                  content={
                                    q.questionType === 'fill' ? q.answerText : q.options[q.answer]
                                  }
                                  className="text-xs text-[var(--quiz-muted)]"
                                />
                              </p>
                              {!isCorrect && (
                                <div className="text-xs text-[var(--quiz-muted)] mt-1.5">
                                  <MathRenderer
                                    content={q.explanation}
                                    className="text-xs text-[var(--quiz-muted)]"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleReset}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[var(--quiz-border)] px-4 py-3 text-sm font-medium text-[var(--quiz-muted)] hover:text-[var(--quiz-primary-bright)] hover:border-[var(--quiz-border-strong)] transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" /> 重新出题
                    </button>
                    <button
                      onClick={() => {
                        setState('answering');
                        setCurrentIdx(0);
                        setSelectedAnswer(null);
                        setShowExplanation(false);
                        setAnswers(new Array(questions.length).fill(null));
                        setSaveStatus('idle');
                        setAttemptSaved(false);
                        savePromiseRef.current = null;
                      }}
                      className="quiz-button-sweep flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all"
                      style={btnPrimary}
                    >
                      <Target className="h-4 w-4" /> 再做一次
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function _QuizPersonalizationPanel({
  context,
  topic,
  difficulty,
  count,
  explanationMode,
  hasManualOverride,
}: {
  context: PersonalizationContext;
  topic: string;
  difficulty: string;
  count: number;
  explanationMode: 'immediate' | 'on-request';
  hasManualOverride: boolean;
}) {
  const policy = context.toolPolicies?.quiz;
  const decision = context.learnerDecision;
  const targetTopic =
    topic.trim() ||
    policy?.targetTopic ||
    context.weakPoints[0]?.knowledgePoint ||
    context.learningPath?.next ||
    '入门摸底';
  const weakPoint = context.weakPoints.find(
    (point) => point.knowledgePoint.trim().toLocaleLowerCase() === targetTopic.toLocaleLowerCase(),
  );
  const mastery = weakPoint?.mastery ?? context.masteryByKnowledge[targetTopic];
  const reasonCodes = policy?.reasonCodes ?? decision?.reasonCodes ?? [];
  const reasons = reasonCodes.map((code) => REASON_LABELS[code] ?? code);
  const action = decision?.action ?? policy?.action ?? 'quiz';
  const difficultyLabel = DIFFICULTIES.find((item) => item.id === difficulty)?.label ?? difficulty;
  const pacingLabel = context.tutoringPolicy?.pacing
    ? PACING_LABELS[context.tutoringPolicy.pacing]
    : '自适应节奏';
  const duration = policy?.durationMinutes ?? decision?.durationMinutes ?? 15;
  const currentJudgement =
    decision?.summary ??
    context.recommendation?.reason ??
    (context.hasLearningData
      ? '依据近期学习记录生成本次测验。'
      : '先做几道基础题，了解你的学习情况。');

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-[var(--quiz-surface)] to-amber-50 p-5 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.45)] sm:p-6 dark:border-cyan-300/25 dark:from-cyan-400/12 dark:to-violet-500/10 dark:shadow-[0_0_32px_-12px_var(--quiz-glow)]"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-sky-200/30 blur-3xl dark:bg-cyan-300/10" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-100 text-sky-700 shadow-sm dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-200 dark:shadow-[0_0_18px_rgba(34,211,238,0.16)]">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[var(--quiz-text)]">按你的情况出题</h2>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-200">
                  已根据你的情况安排
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--quiz-muted)]">
                当前判断：{currentJudgement}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--quiz-border)] bg-white/75 px-3 py-2 text-right shadow-sm dark:bg-black/10 dark:shadow-none">
            <div className="text-[10px] text-[var(--quiz-muted)]">本次学习动作</div>
            <div className="mt-0.5 text-sm font-semibold text-sky-700 dark:text-cyan-200">
              {ACTION_LABELS[action]}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 dark:border-cyan-300/20 dark:bg-cyan-300/[0.06]">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 dark:text-cyan-200">
              <Target className="h-4 w-4" /> 当前优先知识点
            </div>
            <div className="mt-2 text-xl font-bold text-[var(--quiz-text)]">{targetTopic}</div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[var(--quiz-muted)]">
                <span>当前掌握情况</span>
                <span>{typeof mastery === 'number' ? `${Math.round(mastery)}%` : '待了解'}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all dark:from-cyan-400 dark:to-violet-400"
                  style={{ width: `${Math.max(4, Math.min(100, mastery ?? 4))}%` }}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(reasons.length > 0 ? reasons : ['依据学习路径与近期表现']).map((reason) => (
                <span
                  key={reason}
                  className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] text-[var(--quiz-muted)] dark:border-white/10 dark:bg-white/[0.04]"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: Gauge,
                label: '难度',
                value: difficultyLabel,
                detail: pacingLabel,
              },
              {
                icon: ListChecks,
                label: '题量',
                value: `${count} 题`,
                detail: `预计 ${duration} 分钟`,
              },
              {
                icon: ShieldCheck,
                label: '反馈方式',
                value: explanationMode === 'immediate' ? '答后立即解析' : '需要时看解析',
                detail: explanationMode === 'immediate' ? '及时纠正错误' : '减少答题干扰',
              },
              {
                icon: Clock3,
                label: '结果用途',
                value: '更新学习情况',
                detail: '安排下一步学习',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-[var(--quiz-border)] bg-white/75 p-3 dark:bg-black/10"
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--quiz-muted)]">
                    <Icon className="h-3.5 w-3.5 text-[var(--quiz-primary)]" /> {item.label}
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-[var(--quiz-text)]">
                    {item.value}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--quiz-muted)]">{item.detail}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-xs leading-5 text-[var(--quiz-muted)]">
            <Route className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
            <span>完成后：每道答案都会成为答题记录 → 更新掌握情况 → 重新安排下一步学习。</span>
          </div>
          {hasManualOverride && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-200">
              <SlidersHorizontal className="h-3.5 w-3.5" /> 已保留你的手动调整
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function QuizProfileUpdatePanel({
  status,
  topic,
  evidence,
  impacts,
  decision,
}: {
  status: SaveStatus;
  topic: string;
  evidence: QuizEvidenceSummary | null;
  impacts: QuizProfileImpact[];
  decision: PersonalizationContext['learnerDecision'] | null;
}) {
  const isSaved = status === 'saved';
  const title =
    status === 'saving'
      ? '正在记录本次答题'
      : isSaved
        ? '学习情况已更新'
        : status === 'failed'
          ? '学习情况更新失败'
          : '等待更新学习情况';

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-[var(--quiz-surface)] to-sky-50 p-5 dark:border-violet-300/25 dark:from-violet-500/12 dark:to-cyan-400/10"
      style={{ boxShadow: '0 14px 34px -28px rgba(15, 23, 42, 0.42)' }}
    >
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-violet-200/35 blur-3xl dark:bg-violet-400/10" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-300/25 dark:bg-violet-300/10 dark:text-violet-200">
              {status === 'saving' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : status === 'failed' ? (
                <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-300" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--quiz-text)]">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--quiz-muted)]">
                {status === 'failed'
                  ? '本次分数仍然保留，但答题记录没有成功保存。'
                  : `本次 ${topic} 测验的记录已保存，后续学习工具会参考这次结果。`}
              </p>
            </div>
          </div>
          {isSaved && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-200">
              学习完成
            </span>
          )}
        </div>

        {isSaved && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { label: '新增答题记录', value: `${evidence?.recordedEvents ?? 0} 条` },
                { label: '学习情况更新', value: `${evidence?.updatedStates ?? 0} 次` },
                {
                  label: '新的学习动作',
                  value: decision ? ACTION_LABELS[decision.action] : '继续积累答题记录',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200 bg-white/75 px-3 py-3 text-center dark:border-white/10 dark:bg-black/10"
                >
                  <div className="text-[10px] text-[var(--quiz-muted)]">{item.label}</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--quiz-text)]">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {impacts.length > 0 ? (
              <div className="mt-4 space-y-2">
                {impacts.slice(0, 3).map((impact) => {
                  const masteryBefore =
                    impact.masteryBefore === null
                      ? '首次建立'
                      : `${Math.round(impact.masteryBefore * 100)}%`;
                  const confidenceBefore =
                    impact.confidenceBefore === null
                      ? '首次建立'
                      : `${Math.round(impact.confidenceBefore * 100)}%`;
                  return (
                    <div
                      key={impact.nodeId}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-white/75 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[var(--quiz-text)]">
                          {impact.displayName}
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--quiz-muted)]">
                          新增 {impact.evidenceAdded} 条答题记录
                          {impact.repeatedErrorCount > 0
                            ? ` · 重复错误 ${impact.repeatedErrorCount} 次`
                            : ''}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--quiz-muted)]">
                        掌握情况：{masteryBefore}
                        <span className="mx-1 text-sky-500 dark:text-cyan-300">→</span>
                        <strong className="text-sky-700 dark:text-cyan-200">
                          {Math.round(impact.masteryAfter * 100)}%
                        </strong>
                      </div>
                      <div className="text-xs text-[var(--quiz-muted)]">
                        判断把握：{confidenceBefore}
                        <span className="mx-1 text-violet-500 dark:text-violet-300">→</span>
                        <strong className="text-violet-700 dark:text-violet-200">
                          {Math.round(impact.confidenceAfter * 100)}%
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white/75 px-4 py-3 text-xs leading-5 text-[var(--quiz-muted)] dark:border-white/10 dark:bg-white/[0.03]">
                答题记录已保存；当前主题还没有关联到具体知识点，因此暂不显示掌握情况的变化。
              </div>
            )}

            {decision && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-300/20 dark:bg-amber-300/[0.07]">
                <Route className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200" />
                <div>
                  <div className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                    根据本次答题更新
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--quiz-muted)]">
                    {decision.summary} 下一步将按“{ACTION_LABELS[decision.action]} ·
                    {decision.difficulty === 'easy'
                      ? '基础'
                      : decision.difficulty === 'hard'
                        ? '挑战'
                        : '标准'}
                    难度”执行。
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function QuizPanel({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        background: 'var(--quiz-surface)',
        border: '1px solid var(--quiz-border)',
        boxShadow: '0 0 16px -4px var(--quiz-glow)',
      }}
    >
      {title && (
        <label className="text-sm font-semibold text-[var(--quiz-text)] mb-3 block">{title}</label>
      )}
      {children}
    </div>
  );
}

function QuizNotice({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-300"
    >
      {message}
    </motion.div>
  );
}

function BankInsufficientDialog({
  dialog,
  onClose,
}: {
  dialog: { title: string; message: string } | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {dialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-400/70 px-4 backdrop-blur-sm dark:bg-slate-950/70"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--quiz-border)] bg-[var(--quiz-surface-elevated)] p-6 text-[var(--quiz-text)] shadow-2xl shadow-[var(--quiz-glow-strong)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[var(--quiz-primary)]/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="relative z-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--quiz-border-strong)] bg-[var(--quiz-primary)]/10 shadow-[0_0_18px_var(--quiz-glow)]">
                <BookOpen className="h-6 w-6 text-[var(--quiz-primary-bright)]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--quiz-text)] drop-shadow-[0_0_10px_var(--quiz-glow-strong)]">
                {dialog.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--quiz-text)]/65">{dialog.message}</p>
              <button
                onClick={onClose}
                className="quiz-button-sweep mt-6 w-full rounded-xl border border-[var(--quiz-border-strong)] bg-[var(--quiz-primary)]/15 px-4 py-3 text-sm font-medium text-[var(--quiz-text)] transition-all hover:bg-[var(--quiz-primary)]/20"
              >
                我知道了
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function QuizError({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-400"
    >
      {message}
    </motion.div>
  );
}
