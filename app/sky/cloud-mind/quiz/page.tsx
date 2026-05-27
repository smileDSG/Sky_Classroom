'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTaskStore } from '@/lib/store/use-task-store';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
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
  Loader2,
  Zap,
} from 'lucide-react';

const SUBJECTS = [
  { id: 'math', label: '数学', color: 'text-violet-500', bg: 'bg-violet-500' },
  { id: 'physics', label: '物理', color: 'text-sky-500', bg: 'bg-sky-500' },
  { id: 'chemistry', label: '化学', color: 'text-emerald-500', bg: 'bg-emerald-500' },
  { id: 'biology', label: '生物', color: 'text-green-500', bg: 'bg-green-500' },
  { id: 'chinese', label: '语文', color: 'text-rose-500', bg: 'bg-rose-500' },
  { id: 'english', label: '英语', color: 'text-amber-500', bg: 'bg-amber-500' },
];

const DIFFICULTIES = [
  { id: 'easy', label: '基础', desc: '巩固基础概念', color: 'bg-emerald-500' },
  { id: 'medium', label: '进阶', desc: '提升应用能力', color: 'bg-amber-500' },
  { id: 'hard', label: '挑战', desc: '拓展思维深度', color: 'bg-rose-500' },
];

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

type QuizState = 'idle' | 'generating' | 'answering' | 'done';

export default function CloudMindQuizPage() {
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
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Restore state from background task on mount
  useEffect(() => {
    const store = useTaskStore.getState();
    const quizTasks = Object.values(store.tasks).filter(
      (t) => t.type === 'quiz' && t.status !== 'failed'
    );
    if (quizTasks.length === 0) return;
    const task = quizTasks[quizTasks.length - 1]; // latest
    setActiveTaskId(task.id);

    if (task.status === 'running') {
      setState('generating');
    } else if (task.status === 'completed' && task.result) {
      const data = task.result as { questions: QuizQuestion[] };
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(null));
      setCurrentIdx(0);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setState('answering');
      store.removeTask(task.id);
      setActiveTaskId(null);
    }
  }, []);

  // Watch task for completion while on this page
  useEffect(() => {
    if (!activeTaskId) return;
    const unsub = useTaskStore.subscribe((state) => {
      const task = state.tasks[activeTaskId];
      if (!task) {
        setActiveTaskId(null);
        setState('idle');
        return;
      }
      if (task.status === 'completed' && task.result) {
        const data = task.result as { questions: QuizQuestion[] };
        setQuestions(data.questions);
        setAnswers(new Array(data.questions.length).fill(null));
        setCurrentIdx(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setState('answering');
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
  }, [activeTaskId]);

  const handleGenerate = useCallback(async () => {
    setState('generating');
    setError(null);

    const taskId = `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveTaskId(taskId);

    useTaskStore.getState().addTask({
      id: taskId,
      type: 'quiz',
      label: `智能出题: ${topic || SUBJECTS.find(s => s.id === subject)?.label || ''} ${DIFFICULTIES.find(d => d.id === difficulty)?.label || ''}`,
      status: 'running',
      progress: 30,
      phase: 'AI 正在出题中…',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      const res = await fetch('/api/sky/cloud-mind/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, difficulty, topic: topic || undefined, count }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || '生成失败');
      }
      const generatedQuestions = json.data.questions;

      useTaskStore.getState().updateTask(taskId, {
        status: 'completed',
        progress: 100,
        phase: '出题完成',
        result: { questions: generatedQuestions },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败，请重试';
      useTaskStore.getState().updateTask(taskId, {
        status: 'failed',
        progress: 0,
        phase: '出题失败',
        error: msg,
      });
    }
  }, [count, subject, difficulty, topic]);

  const handleAnswer = useCallback((idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    setShowExplanation(true);
    const newAnswers = [...answers];
    newAnswers[currentIdx] = idx;
    setAnswers(newAnswers);
  }, [selectedAnswer, answers, currentIdx]);

  const handleNext = useCallback(() => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setState('done');
    }
  }, [currentIdx, questions.length]);

  const handleReset = useCallback(() => {
    if (activeTaskId) {
      useTaskStore.getState().removeTask(activeTaskId);
      setActiveTaskId(null);
    }
    setTopic('');
    setState('idle');
    setQuestions([]);
    setAnswers([]);
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setError(null);
  }, [activeTaskId]);

  const correctCount = answers.filter((a, i) => a === questions[i]?.answer).length;
  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const currentQ = questions[currentIdx];

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Link
            href="/sky/cloud-mind"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-amber-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            云端智囊
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">智能出题</span>
          </div>
        </motion.div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 p-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <FileQuestion className="h-5 w-5 text-amber-200" />
              </div>
              <span className="text-xs font-medium text-amber-200 tracking-wider uppercase">AI 出题</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">智能出题</h1>
            <p className="text-amber-100 text-base max-w-lg">
              选择学科和难度，AI 为你量身定制高质量练习题，支持 6 大学科
            </p>
          </div>
        </motion.div>

        {state === 'idle' || state === 'generating' ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Left: Config */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-5"
            >
              {/* Subject */}
              <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 block">选择学科</label>
                <div className="grid grid-cols-3 gap-2">
                  {SUBJECTS.map((s) => {
                    const isActive = subject === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSubject(s.id)}
                        disabled={state === 'generating'}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-all disabled:opacity-50 ${
                          isActive
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-600 text-amber-700 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-amber-200'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${s.bg}`} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Topic */}
              <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 block">
                  知识点 / 主题 <span className="text-slate-400 font-normal">(可选)</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state !== 'generating') {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  placeholder="如：二次函数、牛顿第二定律、氧化还原反应……"
                  disabled={state === 'generating'}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all disabled:opacity-50"
                />
              </div>

              {/* Difficulty */}
              <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 block">难度等级</label>
                <div className="grid grid-cols-3 gap-3">
                  {DIFFICULTIES.map((d) => {
                    const isActive = difficulty === d.id;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setDifficulty(d.id)}
                        disabled={state === 'generating'}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-4 transition-all disabled:opacity-50 ${
                          isActive
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-600'
                            : 'border-slate-200 dark:border-slate-600 hover:border-amber-200'
                        }`}
                      >
                        <div className={`h-2.5 w-2.5 rounded-full ${d.color}`} />
                        <span className={`text-sm font-semibold ${isActive ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'}`}>
                          {d.label}
                        </span>
                        <span className="text-[10px] text-slate-400">{d.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Count */}
              <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 block">题目数量</label>
                <div className="flex gap-2">
                  {[3, 5, 10, 15].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      disabled={state === 'generating'}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50 ${
                        count === n
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                      }`}
                    >
                      {n} 题
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate */}
              <button
                onClick={handleGenerate}
                disabled={state === 'generating'}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3.5 text-white font-medium shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {state === 'generating' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    AI 出题中…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-5 w-5" />
                    生成练习题
                  </>
                )}
              </button>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 px-4 py-3 text-sm text-red-600 dark:text-red-400"
                >
                  {error}
                </motion.div>
              )}
            </motion.div>

            {/* Right: Preview / Loading */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {state === 'generating' ? (
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">AI 正在出题…</span>
                  </div>
                  <div className="space-y-4">
                    {Array.from({ length: count }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse w-full" />
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse w-3/4" />
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="h-8 bg-slate-100 dark:bg-slate-700/50 rounded-lg animate-pulse" />
                          <div className="h-8 bg-slate-100 dark:bg-slate-700/50 rounded-lg animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-6">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">
                    <Zap className="h-4 w-4 text-amber-500" />
                    出题配置
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">学科</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{SUBJECTS.find(s => s.id === subject)?.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">难度</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{DIFFICULTIES.find(d => d.id === difficulty)?.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">数量</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{count} 题</span>
                    </div>
                    {topic && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">主题</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate ml-2">{topic}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-200/50 dark:border-slate-700/30">
                    <p className="text-xs text-slate-400 text-center">
                      支持 Ctrl+Enter 快捷生成
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        ) : state === 'done' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl space-y-6"
          >
            {/* Score Card */}
            <div className="rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-8 text-center text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-90" />
                <h2 className="text-3xl font-bold mb-1">{accuracy} 分</h2>
                <p className="text-amber-100 text-sm">
                  {questions.length} 题中答对 {correctCount} 题
                </p>
                <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    正确 {correctCount}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" />
                    错误 {questions.length - correctCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Review Answers */}
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
                    className={`rounded-xl border p-4 ${
                      isCorrect
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">
                          {i + 1}. {q.question}
                        </p>
                        <p className="text-xs text-slate-500">
                          你的答案：{userAnswer !== null ? q.options[userAnswer] : '未作答'} · 正确答案：{q.options[q.answer]}
                        </p>
                        {!isCorrect && (
                          <p className="text-xs text-slate-400 mt-1.5">{q.explanation}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Link
                href="/sky/cloud-mind"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                返回云端智囊
              </Link>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                重新出题
              </button>
              <button
                onClick={() => {
                  setState('answering');
                  setCurrentIdx(0);
                  setSelectedAnswer(null);
                  setShowExplanation(false);
                  setAnswers(new Array(questions.length).fill(null));
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-amber-500/25 hover:shadow-xl transition-all"
              >
                <Target className="h-4 w-4" />
                再做一次
              </button>
            </div>
          </motion.div>
        ) : (
          /* Answering State */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl space-y-6"
          >
            {/* Progress */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                第 {currentIdx + 1} / {questions.length} 题
              </span>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-8 rounded-full transition-colors ${
                      i === currentIdx
                        ? 'bg-amber-500'
                        : answers[i] !== null
                          ? answers[i] === questions[i].answer
                            ? 'bg-emerald-400'
                            : 'bg-rose-400'
                          : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Question Card */}
            <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-6">
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-5 leading-relaxed">
                {currentQ.question}
              </p>

              <div className="space-y-3">
                {currentQ.options.map((option, i) => {
                  const isSelected = selectedAnswer === i;
                  const isCorrectAnswer = i === currentQ.answer;
                  const showResult = selectedAnswer !== null;

                  let optionStyle = 'border-slate-200 dark:border-slate-600 hover:border-amber-300 dark:hover:border-amber-600';
                  if (showResult && isCorrectAnswer) {
                    optionStyle = 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-600';
                  } else if (showResult && isSelected && !isCorrectAnswer) {
                    optionStyle = 'border-rose-400 bg-rose-50 dark:bg-rose-900/30 dark:border-rose-600';
                  } else if (isSelected) {
                    optionStyle = 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-600';
                  }

                  return (
                    <motion.button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={selectedAnswer !== null}
                      whileTap={selectedAnswer === null ? { scale: 0.98 } : undefined}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${optionStyle} disabled:cursor-default`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          showResult && isCorrectAnswer
                            ? 'bg-emerald-500 text-white'
                            : showResult && isSelected && !isCorrectAnswer
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-200">{option}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Explanation */}
              <AnimatePresence>
                {showExplanation && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">解析</span>
                      </div>
                      <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                        {currentQ.explanation}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Next Button */}
            {selectedAnswer !== null && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <button
                  onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3.5 text-white font-medium shadow-lg shadow-amber-500/25 hover:shadow-xl transition-all"
                >
                  {currentIdx < questions.length - 1 ? (
                    <>
                      下一题
                      <ChevronRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      查看成绩
                      <Trophy className="h-4 w-4" />
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </SkyAppShell>
  );
}
