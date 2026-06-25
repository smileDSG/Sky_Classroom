'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTaskStore } from '@/lib/store/use-task-store';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import {
  FileQuestion,
  ArrowLeft,
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
} from 'lucide-react';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';
import { deriveQuizParamsFromProfile } from '@/lib/student/quiz-param-deriver';
import {
  SUBJECT_CONFIG,
  DIFFICULTY_CONFIG,
  QUIZ_COUNT_OPTIONS,
} from '@/lib/student/profile-config';
import { MathRenderer } from '@/components/sky/solve/math-renderer';
import type { QuestionBankRow } from '@/lib/question-bank/types';

const SUBJECTS = SUBJECT_CONFIG.map((s) => ({ id: s.id, label: s.label, dot: s.dot }));

const DIFFICULTIES = DIFFICULTY_CONFIG.map((d, i) => ({
  id: d.id,
  label: d.label,
  desc: d.desc,
  star: '★'.repeat(i + 1),
}));

const SUBJECT_LABEL_BY_ID = Object.fromEntries(SUBJECTS.map((subject) => [subject.id, subject.label]));

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

type QuizState = 'idle' | 'generating' | 'answering' | 'done';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';
type QuestionSource = 'ai' | 'bank';
type BankSaveStatus = 'idle' | 'saving' | 'saved' | 'duplicate' | 'failed';

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

  const optionIndex = options.findIndex((option) => stripOptionPrefix(option) === stripOptionPrefix(normalized));
  return optionIndex >= 0 ? optionIndex : null;
}

function normalizeQuizQuestions(rawQuestions: unknown): QuizQuestion[] {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions
    .map((raw, index) => {
      const item = raw as Partial<QuizQuestion>;
      const options = Array.isArray(item.options)
        ? item.options.map((option) => stripOptionPrefix(String(option))).filter(Boolean)
        : [];
      const answer = typeof item.answer === 'number'
        ? item.answer
        : answerToIndex(String(item.answer ?? ''), options);

      if (!item.question || options.length !== 4 || answer === null || answer < 0 || answer > 3) return null;

      return {
        id: index + 1,
        question: String(item.question),
        options,
        answer,
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
    question: row.content,
    options,
    answer,
    explanation: row.explanation || row.answer,
  };
}

function sampleQuestions(questions: QuizQuestion[], count: number): QuizQuestion[] {
  return [...questions]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((question, index) => ({ ...question, id: index + 1 }));
}

export default function CloudMindQuizPage() {
  const searchParams = useSearchParams();
  const [quizMode, setQuizMode] = useState<'ai' | 'bank'>('ai');
  const [subject, setSubject] = useState('math');
  const [difficulty, setDifficulty] = useState('medium');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [state, setState] = useState<QuizState>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [attemptSaved, setAttemptSaved] = useState(false);
  const [questionSource, setQuestionSource] = useState<QuestionSource>('ai');
  const [selectedForBank, setSelectedForBank] = useState<Set<number>>(new Set());
  const [bankSaveStatusById, setBankSaveStatusById] = useState<Record<number, BankSaveStatus>>({});
  const [bankSaveMessageById, setBankSaveMessageById] = useState<Record<number, string>>({});
  const [bankDialog, setBankDialog] = useState<{ title: string; message: string } | null>(null);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const startAnswering = useCallback((nextQuestions: QuizQuestion[], source: QuestionSource) => {
    setQuestions(nextQuestions);
    setAnswers(new Array(nextQuestions.length).fill(null));
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setSaveStatus('idle');
    setAttemptSaved(false);
    setQuestionSource(source);
    setSelectedForBank(source === 'ai' ? new Set(nextQuestions.map((question) => question.id)) : new Set());
    setBankSaveStatusById({});
    setBankSaveMessageById({});
    savePromiseRef.current = null;
    setState('answering');
  }, []);

  // Load parameters from URL query (classroom review-quiz redirect)
  useEffect(() => {
    const qSubject = searchParams.get('subject');
    const qDifficulty = searchParams.get('difficulty');
    const qTopic = searchParams.get('topic');
    const qCount = searchParams.get('count');
    if (qSubject) setSubject(qSubject);
    if (qDifficulty) setDifficulty(qDifficulty);
    if (qTopic) setTopic(qTopic);
    if (qCount) setCount(Number(qCount));
  }, [searchParams]);

  // Auto-fill from student profile when no URL params are present
  useEffect(() => {
    const hasUrlParams =
      searchParams.get('subject') ||
      searchParams.get('difficulty') ||
      searchParams.get('topic');
    if (hasUrlParams) return;

    async function loadAutoParams() {
      try {
        const res = await fetch('/api/student/profile');
        if (!res.ok) return;
        const profile = await res.json();
        if (!profile) return;
        const params = deriveQuizParamsFromProfile(profile);
        setSubject(params.subject);
        setDifficulty(params.difficulty);
        setTopic(params.topic);
        setCount(params.count);
      } catch {
        // Ignore auto-fill errors; keep manual defaults
      }
    }
    loadAutoParams();
  }, [searchParams]);

  useEffect(() => {
    const store = useTaskStore.getState();
    const quizTasks = Object.values(store.tasks).filter(
      (t) => t.type === 'quiz' && t.status !== 'failed'
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
  }, [startAnswering]);

  useEffect(() => {
    if (!activeTaskId) return;
    const unsub = useTaskStore.subscribe((s) => {
      const task = s.tasks[activeTaskId];
      if (!task) { setActiveTaskId(null); return; }
      if (task.status === 'completed' && task.result) {
        const data = task.result as { questions: QuizQuestion[]; source?: QuestionSource };
        startAnswering(data.questions, data.source ?? 'ai');
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      } else if (task.status === 'failed') {
        setError(task.error || '生成失败，请重试');
        setState('idle');
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      }
    });
    return unsub;
  }, [activeTaskId, startAnswering]);

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
        const difficultyLabel = DIFFICULTIES.find((item) => item.id === difficulty)?.label ?? difficulty;
        const topicLabel = topic.trim() ? ` · ${topic.trim()}` : '';
        setBankDialog({
          title: availableQuestions.length === 0 ? '星域题库暂未点亮' : '题库题量不足',
          message: `${subjectLabel} · ${difficultyLabel}${topicLabel} 当前仅有 ${availableQuestions.length} 道可用选择题，少于本次需要的 ${count} 道。请降低题量、切换条件，或先用 AI 出题补充题库。`,
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
    const taskId = `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveTaskId(taskId);
    useTaskStore.getState().addTask({
      id: taskId, type: 'quiz',
      label: `智能出题: ${topic || SUBJECTS.find(s => s.id === subject)?.label || ''}`,
      status: 'running', progress: 30, phase: 'AI 出题中…',
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    try {
      const res = await fetch('/api/sky/cloud-mind/quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, difficulty, topic: topic || undefined, count }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '生成失败');
      const generatedQuestions = normalizeQuizQuestions(json.data?.questions);
      if (generatedQuestions.length === 0) throw new Error('AI 返回格式异常，请重新生成');
      startAnswering(generatedQuestions, 'ai');
      useTaskStore.getState().updateTask(taskId, {
        status: 'completed', progress: 100, phase: '出题完成',
        result: { questions: generatedQuestions, source: 'ai' },
      });
      useTaskStore.getState().removeTask(taskId);
      setActiveTaskId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败';
      useTaskStore.getState().updateTask(taskId, {
        status: 'failed', progress: 0, phase: '出题失败', error: msg,
      });
    }
  }, [count, subject, difficulty, startAnswering, topic]);

  const saveQuizAttempt = useCallback((finalAnswers: (number | null)[]) => {
    if (attemptSaved || questions.length === 0) return Promise.resolve();
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
        setAttemptSaved(true);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('failed');
        savePromiseRef.current = null;
      }
    })();
    savePromiseRef.current = request;
    return request;
  }, [attemptSaved, difficulty, questions, quizMode, subject, topic]);

  const handleAnswer = useCallback((idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx); setShowExplanation(true);
    const na = [...answers]; na[currentIdx] = idx; setAnswers(na);
    if (currentIdx === questions.length - 1) {
      void saveQuizAttempt(na);
    }
  }, [selectedAnswer, answers, currentIdx, questions.length, saveQuizAttempt]);

  const handleNext = useCallback(async () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1); setSelectedAnswer(null); setShowExplanation(false);
    } else {
      await saveQuizAttempt(answers);
      setState('done');
    }
  }, [answers, currentIdx, questions.length, saveQuizAttempt]);

  const toggleQuestionForBank = useCallback((questionId: number) => {
    const status = bankSaveStatusById[questionId] ?? 'idle';
    if (status === 'saving' || status === 'saved' || status === 'duplicate') return;

    setSelectedForBank((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, [bankSaveStatusById]);

  const buildQuestionBankPayload = useCallback((question: QuizQuestion) => ({
    subject: SUBJECT_LABEL_BY_ID[subject] || subject,
    grade: '',
    difficulty,
    questionType: 'choice',
    content: question.question,
    answer: answerIndexToLetter(question.answer),
    explanation: question.explanation,
    knowledgePoints: topic.trim() ? [topic.trim()] : [],
    options: question.options.map(stripOptionPrefix),
    source: 'AI智能出题',
    tags: ['AI生成', '智能出题'],
    verified: true,
  }), [difficulty, subject, topic]);

  const handleSaveQuestionToBank = useCallback(async (question: QuizQuestion) => {
    if (questionSource !== 'ai') return;
    const currentStatus = bankSaveStatusById[question.id] ?? 'idle';
    if (currentStatus === 'saving' || currentStatus === 'saved' || currentStatus === 'duplicate') return;

    setBankSaveStatusById((prev) => ({ ...prev, [question.id]: 'saving' }));
    setBankSaveMessageById((prev) => ({ ...prev, [question.id]: '' }));

    try {
      const res = await fetch('/api/sky/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildQuestionBankPayload(question)),
      });
      const data = await res.json();

      if (data.success && data.saved === true) {
        setBankSaveStatusById((prev) => ({ ...prev, [question.id]: 'saved' }));
        setSelectedForBank((prev) => {
          const next = new Set(prev);
          next.delete(question.id);
          return next;
        });
        return;
      }

      if (data.success && data.duplicated === true) {
        setBankSaveStatusById((prev) => ({ ...prev, [question.id]: 'duplicate' }));
        setBankSaveMessageById((prev) => ({ ...prev, [question.id]: '题库中已存在' }));
        setSelectedForBank((prev) => {
          const next = new Set(prev);
          next.delete(question.id);
          return next;
        });
        return;
      }

      throw new Error(data.error || data.details || '加入题库失败');
    } catch (err) {
      setBankSaveStatusById((prev) => ({ ...prev, [question.id]: 'failed' }));
      setBankSaveMessageById((prev) => ({
        ...prev,
        [question.id]: err instanceof Error ? err.message : '加入题库失败',
      }));
    }
  }, [bankSaveStatusById, buildQuestionBankPayload, questionSource]);

  const selectAllUnsavedForBank = useCallback(() => {
    setSelectedForBank(new Set(questions
      .filter((question) => {
        const status = bankSaveStatusById[question.id] ?? 'idle';
        return status !== 'saving' && status !== 'saved' && status !== 'duplicate';
      })
      .map((question) => question.id)));
  }, [bankSaveStatusById, questions]);

  const handleSaveSelectedToBank = useCallback(async () => {
    if (questionSource !== 'ai') return;
    const targets = questions.filter((question) => {
      const status = bankSaveStatusById[question.id] ?? 'idle';
      return selectedForBank.has(question.id) && status !== 'saving' && status !== 'saved' && status !== 'duplicate';
    });

    for (const question of targets) {
      await handleSaveQuestionToBank(question);
    }
  }, [bankSaveStatusById, handleSaveQuestionToBank, questionSource, questions, selectedForBank]);

  const handleReset = useCallback(() => {
    if (activeTaskId) { useTaskStore.getState().removeTask(activeTaskId); setActiveTaskId(null); }
    setTopic(''); setState('idle'); setQuestions([]); setAnswers([]);
    setCurrentIdx(0); setSelectedAnswer(null); setError(null); setNotice(null);
    setSaveStatus('idle'); setAttemptSaved(false); setQuestionSource('ai');
    setSelectedForBank(new Set()); setBankSaveStatusById({}); setBankSaveMessageById({});
    savePromiseRef.current = null;
  }, [activeTaskId]);

  const correctCount = answers.filter((a, i) => a === questions[i]?.answer).length;
  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const currentQ = questions[currentIdx];
  const wrongQuestions = questions.filter((question, index) => answers[index] !== question.answer);
  const nextActionTopic = topic.trim() || SUBJECT_LABEL_BY_ID[subject] || subject;
  const wrongQuestionContent = wrongQuestions
    .map(
      (question, index) =>
        `错题 ${index + 1}：${question.question}\n正确答案：${question.options[question.answer]}\n解析：${question.explanation}`,
    )
    .join('\n\n');
  const nextActionLinks = [
    {
      label: '复习错题',
      desc: `${wrongQuestions.length} 道错题需要回看`,
      href: '/sky/learning',
      icon: BookOpen,
      tone: 'text-rose-300 border-rose-500/25 bg-rose-500/8',
      disabled: wrongQuestions.length === 0,
    },
    {
      label: '生成同类题',
      desc: `${nextActionTopic} 专项练习`,
      href: `/sky/cloud-mind/quiz?topic=${encodeURIComponent(nextActionTopic)}&difficulty=${accuracy < 70 ? 'easy' : difficulty}&count=5`,
      icon: Target,
      tone: 'text-amber-300 border-amber-500/25 bg-amber-500/8',
      disabled: false,
    },
    {
      label: '生成记忆卡',
      desc: wrongQuestions.length > 0 ? '把错因转成复习卡' : '提炼本次练习要点',
      href: `/sky/cloud-mind/memory?topic=${encodeURIComponent(nextActionTopic)}&content=${encodeURIComponent(wrongQuestionContent || `知识点：${nextActionTopic}`)}`,
      icon: Brain,
      tone: 'text-violet-300 border-violet-500/25 bg-violet-500/8',
      disabled: false,
    },
    {
      label: '进入微讲解',
      desc: '生成一段针对性讲解',
      href: `/sky/cloud-mind/teaching?topic=${encodeURIComponent(nextActionTopic)}&from=quiz`,
      icon: Lightbulb,
      tone: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/8',
      disabled: false,
    },
  ];
  const selectedBankCount = questions.filter((question) => {
    const status = bankSaveStatusById[question.id] ?? 'idle';
    return selectedForBank.has(question.id) && status !== 'saving' && status !== 'saved' && status !== 'duplicate';
  }).length;
  const bankSaving = Object.values(bankSaveStatusById).some((status) => status === 'saving');
  const bankHandledCount = Object.values(bankSaveStatusById).filter((status) => status === 'saved' || status === 'duplicate').length;

  const panelStyle: React.CSSProperties = {
    background: 'rgba(15, 18, 35, 0.85)',
    border: '1px solid rgba(251, 191, 36, 0.2)',
    boxShadow: '0 0 20px -6px rgba(251, 191, 36, 0.08)',
  };

  const btnPrimary: React.CSSProperties = {
    background: 'rgba(251, 191, 36, 0.15)',
    border: '1px solid rgba(251, 191, 36, 0.45)',
    color: '#FDE68A',
    boxShadow: '0 0 12px rgba(251, 191, 36, 0.15)',
  };

  const btnIdle: React.CSSProperties = {
    border: '1px solid rgba(251, 191, 36, 0.2)',
    color: 'rgba(253, 230, 138, 0.6)',
  };

  const configControls = (
    <div className="space-y-5">
      <QuizPanel title="学科星域">
        <div className="grid grid-cols-3 gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSubject(s.id)}
              disabled={state === 'generating'}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all disabled:opacity-50"
              style={subject === s.id ? btnPrimary : btnIdle}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              <span className="text-amber-100">{s.label}</span>
            </button>
          ))}
        </div>
      </QuizPanel>

      <QuizPanel title={<>知识点 <span className="text-xs font-normal text-amber-200/40">(可选)</span></>}>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state !== 'generating') {
              e.preventDefault();
              if (quizMode === 'ai') handleGenerate();
              else handleLoadFromBank();
            }
          }}
          placeholder="如：二次函数、牛顿第二定律……"
          disabled={state === 'generating'}
          className="w-full bg-transparent border-b border-amber-500/20 px-1 py-3 text-sm text-amber-100 placeholder:text-amber-200/30 focus:border-amber-400 focus:outline-none transition-colors disabled:opacity-50"
        />
      </QuizPanel>

      <QuizPanel title="难度等级">
        <div className="grid grid-cols-3 gap-3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              disabled={state === 'generating'}
              className="flex flex-col items-center gap-1.5 rounded-xl border p-4 transition-all disabled:opacity-50"
              style={difficulty === d.id ? btnPrimary : btnIdle}
            >
              <span className="text-base text-amber-400">{d.star}</span>
              <span className="text-sm font-semibold text-amber-100">{d.label}</span>
              <span className="text-[10px] text-amber-200/40">{d.desc}</span>
            </button>
          ))}
        </div>
      </QuizPanel>

      <QuizPanel title="题目数量">
        <div className="flex gap-2">
          {QUIZ_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              disabled={state === 'generating'}
              className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
              style={count === n ? btnPrimary : btnIdle}
            >
              {n} 题
            </button>
          ))}
        </div>
      </QuizPanel>
    </div>
  );

  return (
    <div className="relative min-h-screen" style={{ background: 'linear-gradient(180deg, #0B0D1A 0%, #121008 50%, #0B0D1A 100%)' }}>
      <div className="pointer-events-none fixed inset-0 z-0">
        <CelestialCanvas starCount={120} parallax={false} nebula grid={false} horizonGlow />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/3 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-sky-500/4 blur-[120px]" />
      </div>

      <BankInsufficientDialog dialog={bankDialog} onClose={() => setBankDialog(null)} />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-12 space-y-6 text-amber-50">
        {/* Top actions */}
        {state !== 'done' && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <Link href="/sky/cloud-mind" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-amber-200/60 transition-all hover:text-amber-300 hover:bg-amber-500/10">
              <ArrowLeft className="h-4 w-4" /> 返回
            </Link>
            <Link href="/sky/question-bank" className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-200/70 transition-all hover:text-amber-300 hover:border-amber-400/40 hover:bg-amber-500/15">
              <BookOpen className="h-4 w-4" /> 题库中心
            </Link>
          </motion.div>
        )}

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-8 relative overflow-hidden" style={panelStyle}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/15 shadow-[0_0_16px_rgba(251,191,36,0.2)]">
              <FileQuestion className="h-7 w-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-amber-100 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]">
                星际试炼场
              </h1>
              <p className="text-sm text-amber-200/50 mt-1">选择你的星域与难度，AI 为你定制试炼挑战</p>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {(state === 'idle' || state === 'generating') && (
            <motion.div key="config" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="space-y-5">
                {/* Mode */}
                <QuizPanel title="出题模式">
                  <div className="grid grid-cols-2 gap-2">
                    {(['ai', 'bank'] as const).map((mode) => (
                      <button key={mode} onClick={() => setQuizMode(mode)}
                        className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all"
                        style={quizMode === mode ? btnPrimary : btnIdle}>
                        {mode === 'ai' ? <Wand2 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                        {mode === 'ai' ? 'AI 出题' : '题库练习'}
                      </button>
                    ))}
                  </div>
                </QuizPanel>

                {configControls}

                {quizMode === 'ai' ? (
                  <button onClick={handleGenerate} disabled={state === 'generating'}
                    className="quiz-button-sweep w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={btnPrimary}>
                    {state === 'generating' ? <><Loader2 className="h-5 w-5 animate-spin" /> AI 出题中…</> : <><Sparkles className="h-5 w-5" /> 启动试炼引擎</>}
                  </button>
                ) : (
                  <button onClick={handleLoadFromBank} disabled={state === 'generating'}
                    className="quiz-button-sweep w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-all disabled:opacity-50"
                    style={btnPrimary}>
                    {state === 'generating' ? <><Loader2 className="h-5 w-5 animate-spin" /> 题库抽取中…</> : <><BookOpen className="h-5 w-5" /> 从题库抽题</>}
                  </button>
                )}
                {notice && <QuizNotice message={notice} />}
                {error && <QuizError message={error} />}
              </div>

              {/* Right: Preview */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                {state === 'generating' ? (
                  <QuizPanel>
                    <div className="flex items-center gap-2 mb-5">
                      <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                      <span className="text-sm font-medium text-amber-300">{quizMode === 'ai' ? 'AI 正在出题…' : '题库正在抽题…'}</span>
                    </div>
                    <div className="space-y-4">
                      {Array.from({ length: count }).map((_, i) => (
                        <div key={i} className="space-y-2">
                          <div className="h-4 rounded-lg animate-pulse w-full bg-amber-500/5" />
                          <div className="h-4 rounded-lg animate-pulse w-3/4 bg-amber-500/4" />
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="h-8 rounded-lg animate-pulse bg-amber-500/4" />
                            <div className="h-8 rounded-lg animate-pulse bg-amber-500/4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </QuizPanel>
                ) : (
                  <QuizPanel>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-4 w-4 text-amber-400" />
                      <h3 className="text-sm font-bold text-amber-100">{quizMode === 'ai' ? '出题配置' : '题库抽题配置'}</h3>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: '学科', value: SUBJECTS.find(s => s.id === subject)?.label },
                        { label: '难度', value: DIFFICULTIES.find(d => d.id === difficulty)?.label },
                        { label: '数量', value: `${count} 题` },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between text-sm">
                          <span className="text-amber-200/50">{row.label}</span>
                          <span className="font-medium text-amber-100">{row.value}</span>
                        </div>
                      ))}
                      {topic && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-amber-200/50">主题</span>
                          <span className="font-medium text-amber-100 truncate ml-2 max-w-[180px]">{topic}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-5 pt-4 border-t border-amber-500/15">
                      <p className="text-xs text-amber-200/40 text-center">
                        {quizMode === 'ai' ? '支持 Ctrl+Enter 快捷生成' : '按条件从题库随机抽取选择题'}
                      </p>
                    </div>
                  </QuizPanel>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Answering */}
          {state === 'answering' && currentQ && (
            <motion.div key="answering" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl space-y-6">
              {notice && <QuizNotice message={notice} />}
              {/* Constellation Progress */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-200/50 shrink-0">{currentIdx + 1} / {questions.length}</span>
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
                            background: isDone ? (isCorrect ? '#34D399' : '#F87171') : isCurrent ? 'rgba(251,191,36,0.5)' : 'rgba(251,191,36,0.1)',
                            boxShadow: isDone ? (isCorrect ? '0 0 6px rgba(52,211,153,0.4)' : '0 0 6px rgba(248,113,113,0.4)') : isCurrent ? '0 0 8px rgba(251,191,36,0.4)' : 'none',
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
                  <Star className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-amber-200/50">第 {currentIdx + 1} 题</span>
                </div>
                <div className="text-base font-semibold text-amber-50 mb-5 leading-relaxed">
                  <MathRenderer content={currentQ.question} />
                </div>

                <div className="space-y-3">
                  {currentQ.options.map((option, i) => {
                    const isSelected = selectedAnswer === i;
                    const isCorrectAnswer = i === currentQ.answer;
                    const showResult = selectedAnswer !== null;
                    let border = 'border-amber-500/20 hover:border-amber-400/50';
                    if (showResult && isCorrectAnswer) border = 'border-emerald-400/60 bg-emerald-500/10';
                    else if (showResult && isSelected && !isCorrectAnswer) border = 'border-red-400/60 bg-red-500/10';
                    else if (isSelected) border = 'border-amber-400/60 bg-amber-500/10';
                    return (
                      <motion.button key={i} onClick={() => handleAnswer(i)} disabled={selectedAnswer !== null}
                        whileTap={selectedAnswer === null ? { scale: 0.98 } : undefined}
                        className={`w-full text-left rounded-xl border p-4 transition-all disabled:cursor-default ${border}`}>
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors"
                            style={{
                              background: showResult && isCorrectAnswer ? '#34D399' : showResult && isSelected && !isCorrectAnswer ? '#F87171' : 'rgba(251,191,36,0.15)',
                              color: showResult && (isCorrectAnswer || (isSelected && !isCorrectAnswer)) ? '#fff' : '#FDE68A',
                            }}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="text-sm text-amber-50"><MathRenderer content={option} className="text-sm text-amber-50" /></span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {showExplanation && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4" style={{ borderLeftWidth: '3px', borderLeftColor: '#FBBF24' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-4 w-4 text-amber-400" />
                          <span className="text-xs font-semibold text-amber-300">解析星云</span>
                        </div>
                        <p className="text-sm text-amber-100 leading-relaxed"><MathRenderer content={currentQ.explanation} className="text-sm text-amber-100 leading-relaxed" /></p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {selectedAnswer !== null && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <button onClick={handleNext}
                    disabled={currentIdx === questions.length - 1 && saveStatus === 'saving'}
                    className="quiz-button-sweep w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={btnPrimary}>
                    {currentIdx < questions.length - 1 ? <><>下一题</><ChevronRight className="h-4 w-4" /></> : saveStatus === 'saving' ? <><Loader2 className="h-4 w-4 animate-spin" /> 正在写入学情…</> : <><>查看成绩</><Trophy className="h-4 w-4" /></>}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Done */}
          {state === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl space-y-6">
              <div className="rounded-2xl border p-8 text-center quiz-score-appear" style={panelStyle}>
                <div className="relative inline-flex items-center justify-center mb-4">
                  <div className="absolute h-28 w-28 rounded-full border-2 border-amber-500/20" />
                  <div className="h-24 w-24 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(251,191,36,0.1)', border: '2px solid rgba(251,191,36,0.4)', boxShadow: '0 0 20px rgba(251,191,36,0.2)' }}>
                    <div>
                      <div className="text-3xl font-bold text-amber-300">{accuracy}</div>
                      <div className="text-[10px] text-amber-200/50">分</div>
                    </div>
                  </div>
                  <div className="absolute h-28 w-28 animate-spin" style={{ animationDuration: '8s' }}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 h-2 w-2 rounded-full bg-amber-400" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-amber-50 mb-1">{questions.length} 题中答对 {correctCount} 题</h2>
                <div className="mt-3 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-4 w-4" /> 正确 {correctCount}</div>
                  <div className="flex items-center gap-1.5 text-red-400"><XCircle className="h-4 w-4" /> 错误 {questions.length - correctCount}</div>
                </div>
                <div className="mt-4 text-xs text-amber-200/50">
                  {saveStatus === 'saving' && '正在写入学情分析…'}
                  {saveStatus === 'saved' && '已写入学情分析，返回学情页可查看各学科掌握度'}
                  {saveStatus === 'failed' && '成绩写入学情分析失败，可稍后重试'}
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={panelStyle}>
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-amber-100">
                  <Zap className="h-4 w-4 text-amber-400" />
                  下一步学习动作
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {nextActionLinks.map((action) => {
                    const Icon = action.icon;
                    const contentNode = (
                      <>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-semibold">{action.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-amber-100/55">{action.desc}</p>
                      </>
                    );
                    if (action.disabled) {
                      return (
                        <div
                          key={action.label}
                          className="rounded-xl border border-amber-500/10 bg-amber-500/5 px-4 py-3 text-amber-100/35"
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                        <BookOpen className="h-4 w-4 text-amber-400" />
                        将 AI 题目加入题库
                      </div>
                      <p className="mt-1 text-xs text-amber-200/50">本次 AI 生成的题目不会自动入库，可选择需要沉淀的题目。</p>
                    </div>
                    <Link href="/sky/question-bank" className="inline-flex items-center justify-center rounded-lg border border-amber-500/20 px-3 py-2 text-xs font-medium text-amber-200/70 transition-colors hover:border-amber-400/40 hover:text-amber-300">
                      进入题库中心
                    </Link>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button onClick={selectAllUnsavedForBank} disabled={bankSaving} className="rounded-lg border border-amber-500/20 px-3 py-2 text-xs text-amber-200/70 transition-colors hover:border-amber-400/40 hover:text-amber-300 disabled:opacity-50">
                      全选未入库
                    </button>
                    <button onClick={() => setSelectedForBank(new Set())} disabled={bankSaving} className="rounded-lg border border-amber-500/20 px-3 py-2 text-xs text-amber-200/70 transition-colors hover:border-amber-400/40 hover:text-amber-300 disabled:opacity-50">
                      清空选择
                    </button>
                    <button onClick={handleSaveSelectedToBank} disabled={selectedBankCount === 0 || bankSaving} className="quiz-button-sweep inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all disabled:opacity-50" style={btnPrimary}>
                      {bankSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      加入选中 {selectedBankCount} 题
                    </button>
                    {bankHandledCount > 0 && <span className="text-xs text-emerald-300/80">已处理 {bankHandledCount} 题</span>}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {questions.map((q, i) => {
                  const userAnswer = answers[i];
                  const isCorrect = userAnswer === q.answer;
                  const bankStatus = bankSaveStatusById[q.id] ?? 'idle';
                  const canSelectForBank = questionSource === 'ai' && bankStatus !== 'saving' && bankStatus !== 'saved' && bankStatus !== 'duplicate';
                  const bankButtonLabel = bankStatus === 'saving'
                    ? '加入中…'
                    : bankStatus === 'saved'
                      ? '已加入'
                      : bankStatus === 'duplicate'
                        ? '已存在'
                        : bankStatus === 'failed'
                          ? '重试'
                          : '加入题库';
                  return (
                    <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-xl border p-4"
                      style={{ borderColor: isCorrect ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)', background: isCorrect ? 'rgba(52,211,153,0.05)' : 'rgba(248,113,113,0.05)' }}>
                      <div className="flex items-start gap-3">
                        {isCorrect ? <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-amber-50 mb-1">{i + 1}. <MathRenderer content={q.question} className="text-sm font-medium text-amber-50" /></p>
                            {questionSource === 'ai' && (
                              <div className="flex shrink-0 items-center gap-2">
                                <label className={`flex items-center gap-1.5 text-xs ${canSelectForBank ? 'text-amber-200/70' : 'text-amber-200/30'}`}>
                                  <input
                                    type="checkbox"
                                    checked={selectedForBank.has(q.id)}
                                    disabled={!canSelectForBank}
                                    onChange={() => toggleQuestionForBank(q.id)}
                                    className="h-3.5 w-3.5 accent-amber-400"
                                  />
                                  入库
                                </label>
                                <button
                                  onClick={() => handleSaveQuestionToBank(q)}
                                  disabled={bankStatus === 'saving' || bankStatus === 'saved' || bankStatus === 'duplicate'}
                                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 px-2.5 py-1.5 text-xs text-amber-200/70 transition-colors hover:border-amber-400/40 hover:text-amber-300 disabled:opacity-60"
                                >
                                  {bankStatus === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
                                  {bankButtonLabel}
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-amber-200/50">你的答案：<MathRenderer content={userAnswer !== null ? q.options[userAnswer] : '未作答'} className="text-xs text-amber-200/50" /> · 正确答案：<MathRenderer content={q.options[q.answer]} className="text-xs text-amber-200/50" /></p>
                          {!isCorrect && <div className="text-xs text-amber-200/40 mt-1.5"><MathRenderer content={q.explanation} className="text-xs text-amber-200/40" /></div>}
                          {questionSource === 'ai' && bankSaveMessageById[q.id] && (
                            <p className={`mt-2 text-xs ${bankStatus === 'failed' ? 'text-red-300/80' : 'text-emerald-300/80'}`}>{bankSaveMessageById[q.id]}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 px-4 py-3 text-sm font-medium text-amber-200/60 hover:text-amber-300 hover:border-amber-400/40 transition-colors">
                  <ArrowLeft className="h-4 w-4" /> 返回星际试炼场
                </button>
                <button onClick={handleReset} className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 px-4 py-3 text-sm font-medium text-amber-200/60 hover:text-amber-300 hover:border-amber-400/40 transition-colors">
                  <RotateCcw className="h-4 w-4" /> 重新出题
                </button>
                <button onClick={() => {
                  setState('answering'); setCurrentIdx(0); setSelectedAnswer(null); setShowExplanation(false);
                  setAnswers(new Array(questions.length).fill(null)); setSaveStatus('idle'); setAttemptSaved(false);
                  setSelectedForBank(new Set(questions.filter((question) => {
                    const status = bankSaveStatusById[question.id] ?? 'idle';
                    return questionSource === 'ai' && status !== 'saving' && status !== 'saved' && status !== 'duplicate';
                  }).map((question) => question.id)));
                  savePromiseRef.current = null;
                }}
                  className="quiz-button-sweep flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all"
                  style={btnPrimary}>
                  <Target className="h-4 w-4" /> 再做一次
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function QuizPanel({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: 'rgba(15, 18, 35, 0.85)', border: '1px solid rgba(251, 191, 36, 0.2)', boxShadow: '0 0 16px -4px rgba(251, 191, 36, 0.06)' }}>
      {title && <label className="text-sm font-semibold text-amber-100 mb-3 block">{title}</label>}
      {children}
    </div>
  );
}

function QuizNotice({ message }: { message: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/25 bg-slate-950/95 p-6 text-amber-50 shadow-2xl shadow-amber-950/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="relative z-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 shadow-[0_0_18px_rgba(251,191,36,0.16)]">
                <BookOpen className="h-6 w-6 text-amber-300" />
              </div>
              <h3 className="text-lg font-bold text-amber-100 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]">{dialog.title}</h3>
              <p className="mt-3 text-sm leading-6 text-amber-100/65">{dialog.message}</p>
              <button
                onClick={onClose}
                className="quiz-button-sweep mt-6 w-full rounded-xl border border-amber-400/45 bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-100 transition-all hover:bg-amber-500/20"
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
    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
      {message}
    </motion.div>
  );
}
