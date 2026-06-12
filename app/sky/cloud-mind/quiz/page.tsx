'use client';

import { useState, useCallback, useEffect } from 'react';
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
  Loader2,
  Zap,
  Star,
} from 'lucide-react';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';

const SUBJECTS = [
  { id: 'math', label: '数学', dot: 'bg-violet-400' },
  { id: 'physics', label: '物理', dot: 'bg-sky-400' },
  { id: 'chemistry', label: '化学', dot: 'bg-emerald-400' },
  { id: 'biology', label: '生物', dot: 'bg-green-400' },
  { id: 'chinese', label: '语文', dot: 'bg-rose-400' },
  { id: 'english', label: '英语', dot: 'bg-amber-400' },
];

const DIFFICULTIES = [
  { id: 'easy', label: '基础', desc: '巩固基础概念', star: '★' },
  { id: 'medium', label: '进阶', desc: '提升应用能力', star: '★★' },
  { id: 'hard', label: '挑战', desc: '拓展思维深度', star: '★★★' },
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
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  useEffect(() => {
    const qTopic = searchParams.get('topic');
    if (qTopic) setTopic(qTopic);
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

  useEffect(() => {
    if (!activeTaskId) return;
    const unsub = useTaskStore.subscribe((s) => {
      const task = s.tasks[activeTaskId];
      if (!task) { setActiveTaskId(null); setState('idle'); return; }
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

  const handleLoadFromBank = useCallback(async () => {
    setState('generating');
    setError(null);
    try {
      const res = await fetch(`/api/sky/question-bank?limit=${count}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const entries = data.data?.questions ?? [];
      if (entries.length === 0) { setError('题库为空'); setState('idle'); return; }
      const bankQuestions: QuizQuestion[] = entries.slice(0, count).map((e: any, i: number) => ({
        id: i, question: e.problemText,
        options: [e.answer, '（干扰项 A）', '（干扰项 B）', '（干扰项 C）'],
        answer: 0, explanation: e.steps?.join('\n') || e.answer,
      }));
      setQuestions(bankQuestions);
      setAnswers(new Array(bankQuestions.length).fill(null));
      setCurrentIdx(0); setSelectedAnswer(null); setShowExplanation(false);
      setState('answering');
    } catch { setError('加载题库失败'); setState('idle'); }
  }, [count]);

  const handleGenerate = useCallback(async () => {
    setState('generating');
    setError(null);
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
      useTaskStore.getState().updateTask(taskId, {
        status: 'completed', progress: 100, phase: '出题完成',
        result: { questions: json.data.questions },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败';
      useTaskStore.getState().updateTask(taskId, {
        status: 'failed', progress: 0, phase: '出题失败', error: msg,
      });
    }
  }, [count, subject, difficulty, topic]);

  const handleAnswer = useCallback((idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx); setShowExplanation(true);
    const na = [...answers]; na[currentIdx] = idx; setAnswers(na);
  }, [selectedAnswer, answers, currentIdx]);

  const handleNext = useCallback(() => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1); setSelectedAnswer(null); setShowExplanation(false);
    } else setState('done');
  }, [currentIdx, questions.length]);

  const handleReset = useCallback(() => {
    if (activeTaskId) { useTaskStore.getState().removeTask(activeTaskId); setActiveTaskId(null); }
    setTopic(''); setState('idle'); setQuestions([]); setAnswers([]);
    setCurrentIdx(0); setSelectedAnswer(null); setError(null);
  }, [activeTaskId]);

  const correctCount = answers.filter((a, i) => a === questions[i]?.answer).length;
  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const currentQ = questions[currentIdx];

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

  return (
    <div className="relative min-h-screen" style={{ background: 'linear-gradient(180deg, #0B0D1A 0%, #121008 50%, #0B0D1A 100%)' }}>
      <div className="pointer-events-none fixed inset-0 z-0">
        <CelestialCanvas starCount={120} parallax={false} nebula grid={false} horizonGlow />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/3 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-sky-500/4 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-12 space-y-6 text-amber-50">
        {/* Back */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-2">
          <Link href="/sky/cloud-mind" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-amber-200/60 transition-all hover:text-amber-300 hover:bg-amber-500/10">
            <ArrowLeft className="h-4 w-4" /> 返回
          </Link>
        </motion.div>

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

                {quizMode === 'ai' && (<>
                  {/* Subjects */}
                  <QuizPanel title="学科星域">
                    <div className="grid grid-cols-3 gap-2">
                      {SUBJECTS.map((s) => (
                        <button key={s.id} onClick={() => setSubject(s.id)} disabled={state === 'generating'}
                          className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all disabled:opacity-50"
                          style={subject === s.id ? btnPrimary : btnIdle}>
                          <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                          <span className="text-amber-100">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </QuizPanel>

                  {/* Topic */}
                  <QuizPanel title={<>知识点 <span className="text-xs font-normal text-amber-200/40">(可选)</span></>}>
                    <input type="text" value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state !== 'generating') { e.preventDefault(); handleGenerate(); } }}
                      placeholder="如：二次函数、牛顿第二定律……"
                      disabled={state === 'generating'}
                      className="w-full bg-transparent border-b border-amber-500/20 px-1 py-3 text-sm text-amber-100 placeholder:text-amber-200/30 focus:border-amber-400 focus:outline-none transition-colors disabled:opacity-50"
                    />
                  </QuizPanel>

                  {/* Difficulty */}
                  <QuizPanel title="难度等级">
                    <div className="grid grid-cols-3 gap-3">
                      {DIFFICULTIES.map((d) => (
                        <button key={d.id} onClick={() => setDifficulty(d.id)} disabled={state === 'generating'}
                          className="flex flex-col items-center gap-1.5 rounded-xl border p-4 transition-all disabled:opacity-50"
                          style={difficulty === d.id ? btnPrimary : btnIdle}>
                          <span className="text-base text-amber-400">{d.star}</span>
                          <span className="text-sm font-semibold text-amber-100">{d.label}</span>
                          <span className="text-[10px] text-amber-200/40">{d.desc}</span>
                        </button>
                      ))}
                    </div>
                  </QuizPanel>

                  {/* Count */}
                  <QuizPanel title="题目数量">
                    <div className="flex gap-2">
                      {[3, 5, 10, 15].map((n) => (
                        <button key={n} onClick={() => setCount(n)} disabled={state === 'generating'}
                          className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
                          style={count === n ? btnPrimary : btnIdle}>
                          {n} 题
                        </button>
                      ))}
                    </div>
                  </QuizPanel>

                  {/* Generate */}
                  <button onClick={handleGenerate} disabled={state === 'generating'}
                    className="quiz-button-sweep w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={btnPrimary}>
                    {state === 'generating' ? <><Loader2 className="h-5 w-5 animate-spin" /> AI 出题中…</> : <><Sparkles className="h-5 w-5" /> 启动试炼引擎</>}
                  </button>
                  {error && <QuizError message={error} />}
                </>)}

                {quizMode === 'bank' && (
                  <div className="space-y-5">
                    <QuizPanel title="题目数量">
                      <div className="flex gap-2">
                        {[3, 5, 10, 15].map((n) => (
                          <button key={n} onClick={() => setCount(n)} disabled={state === 'generating'}
                            className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
                            style={count === n ? btnPrimary : btnIdle}>
                            {n} 题
                          </button>
                        ))}
                      </div>
                    </QuizPanel>
                    <button onClick={handleLoadFromBank} disabled={state === 'generating'}
                      className="quiz-button-sweep w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-all disabled:opacity-50"
                      style={btnPrimary}>
                      {state === 'generating' ? <><Loader2 className="h-5 w-5 animate-spin" /> 加载中…</> : <><BookOpen className="h-5 w-5" /> 从题库出题</>}
                    </button>
                    {error && <QuizError message={error} />}
                  </div>
                )}
              </div>

              {/* Right: Preview */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                {state === 'generating' ? (
                  <QuizPanel>
                    <div className="flex items-center gap-2 mb-5">
                      <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                      <span className="text-sm font-medium text-amber-300">AI 正在出题…</span>
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
                      <h3 className="text-sm font-bold text-amber-100">出题配置</h3>
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
                      <p className="text-xs text-amber-200/40 text-center">支持 Ctrl+Enter 快捷生成</p>
                    </div>
                  </QuizPanel>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Answering */}
          {state === 'answering' && currentQ && (
            <motion.div key="answering" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl space-y-6">
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
                <p className="text-base font-semibold text-amber-50 mb-5 leading-relaxed">{currentQ.question}</p>

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
                          <span className="text-sm text-amber-50">{option}</span>
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
                        <p className="text-sm text-amber-100 leading-relaxed">{currentQ.explanation}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {selectedAnswer !== null && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <button onClick={handleNext}
                    className="quiz-button-sweep w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-all"
                    style={btnPrimary}>
                    {currentIdx < questions.length - 1 ? <><>下一题</><ChevronRight className="h-4 w-4" /></> : <><>查看成绩</><Trophy className="h-4 w-4" /></>}
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
              </div>

              <div className="space-y-3">
                {questions.map((q, i) => {
                  const userAnswer = answers[i];
                  const isCorrect = userAnswer === q.answer;
                  return (
                    <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-xl border p-4"
                      style={{ borderColor: isCorrect ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)', background: isCorrect ? 'rgba(52,211,153,0.05)' : 'rgba(248,113,113,0.05)' }}>
                      <div className="flex items-start gap-3">
                        {isCorrect ? <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-amber-50 mb-1">{i + 1}. {q.question}</p>
                          <p className="text-xs text-amber-200/50">你的答案：{userAnswer !== null ? q.options[userAnswer] : '未作答'} · 正确答案：{q.options[q.answer]}</p>
                          {!isCorrect && <p className="text-xs text-amber-200/40 mt-1.5">{q.explanation}</p>}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <Link href="/sky/cloud-mind" className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 px-4 py-3 text-sm font-medium text-amber-200/60 hover:text-amber-300 hover:border-amber-400/40 transition-colors">
                  <ArrowLeft className="h-4 w-4" /> 返回
                </Link>
                <button onClick={handleReset} className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 px-4 py-3 text-sm font-medium text-amber-200/60 hover:text-amber-300 hover:border-amber-400/40 transition-colors">
                  <RotateCcw className="h-4 w-4" /> 重新出题
                </button>
                <button onClick={() => { setState('answering'); setCurrentIdx(0); setSelectedAnswer(null); setShowExplanation(false); setAnswers(new Array(questions.length).fill(null)); }}
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

function QuizError({ message }: { message: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
      {message}
    </motion.div>
  );
}
