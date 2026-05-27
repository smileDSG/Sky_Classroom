'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTaskStore } from '@/lib/store/use-task-store';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import {
  PenTool,
  ArrowLeft,
  Sparkles,
  Wand2,
  Copy,
  RotateCcw,
  ChevronDown,
  FileText,
  Lightbulb,
  BookOpen,
  Check,
  Loader2,
} from 'lucide-react';

const GENRES = [
  { id: 'essay', label: '作文', desc: '记叙文、议论文、说明文', icon: FileText },
  { id: 'paper', label: '论文', desc: '学术论文、研究报告', icon: BookOpen },
  { id: 'creative', label: '创意写作', desc: '小说、散文、诗歌', icon: Lightbulb },
  { id: 'summary', label: '摘要总结', desc: '读书笔记、文献综述', icon: PenTool },
];

const TEMPLATES = [
  { topic: '难忘的一件事', genre: 'essay', prompt: '写一篇 800 字左右的记叙文，情感真挚，细节生动' },
  { topic: '人工智能对教育的影响', genre: 'paper', prompt: '从正反两面论述 AI 对教育的深远影响，引用具体案例' },
  { topic: '二十年后的家乡', genre: 'creative', prompt: '以科幻笔触描绘未来家乡的面貌，融入人文关怀' },
  { topic: '《红楼梦》读后感', genre: 'summary', prompt: '从人物塑造与社会批判角度总结核心感悟' },
];

type WritingState = 'idle' | 'generating' | 'done';

export default function CloudMindWritePage() {
  const [topic, setTopic] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('essay');
  const [requirements, setRequirements] = useState('');
  const [wordCount, setWordCount] = useState('800');
  const [state, setState] = useState<WritingState>('idle');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Restore state from background task on mount
  useEffect(() => {
    const store = useTaskStore.getState();
    const tasks = Object.values(store.tasks).filter(
      (t) => t.type === 'write' && t.status !== 'failed'
    );
    if (tasks.length === 0) return;
    const task = tasks[tasks.length - 1];
    setActiveTaskId(task.id);

    if (task.status === 'running') {
      setState('generating');
    } else if (task.status === 'completed' && task.result) {
      const data = task.result as { text: string; topic: string; genre: string; wordCount: string };
      setResult(data.text);
      setTopic(data.topic || '');
      setSelectedGenre(data.genre || 'essay');
      setWordCount(data.wordCount || '800');
      setState('done');
      store.removeTask(task.id);
      setActiveTaskId(null);
    }
  }, []);

  // Watch task for completion
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
        const data = task.result as { text: string };
        setResult(data.text);
        setState('done');
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      } else if (task.status === 'failed') {
        setError(task.error || '写作生成失败，请重试');
        setState('idle');
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      }
    });
    return unsub;
  }, [activeTaskId]);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setState('generating');
    setResult('');
    setError(null);
    startTimeRef.current = Date.now();

    const taskId = `write_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveTaskId(taskId);

    useTaskStore.getState().addTask({
      id: taskId,
      type: 'write',
      label: `智能写作: ${topic.trim().slice(0, 20)}`,
      status: 'running',
      progress: 30,
      phase: 'AI 创作中…',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      const res = await fetch('/api/sky/cloud-mind/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          genre: selectedGenre,
          requirements: requirements.trim() || undefined,
          wordCount,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || '写作生成失败');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse Vercel AI SDK streaming format: lines like 0:"text"
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const text = JSON.parse(line.slice(2));
              fullText += text;
              setResult(fullText);
            } catch {
              // skip malformed lines
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith('0:')) {
        try {
          const text = JSON.parse(buffer.slice(2));
          fullText += text;
          setResult(fullText);
        } catch { /* ignore */ }
      }

      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));

      useTaskStore.getState().updateTask(taskId, {
        status: 'completed',
        progress: 100,
        phase: '写作完成',
        result: { text: fullText, topic: topic.trim(), genre: selectedGenre, wordCount },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '写作生成失败，请重试';
      useTaskStore.getState().updateTask(taskId, {
        status: 'failed',
        progress: 0,
        phase: '写作失败',
        error: msg,
      });
    }
  }, [topic, selectedGenre, requirements, wordCount]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleReset = useCallback(() => {
    if (activeTaskId) {
      useTaskStore.getState().removeTask(activeTaskId);
      setActiveTaskId(null);
    }
    setTopic('');
    setRequirements('');
    setState('idle');
    setResult('');
    setError(null);
    setElapsed(0);
  }, [activeTaskId]);

  const wordCountActual = result.replace(/\s/g, '').length;

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
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            云端智囊
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">智能写作</span>
          </div>
        </motion.div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <PenTool className="h-5 w-5 text-emerald-200" />
              </div>
              <span className="text-xs font-medium text-emerald-200 tracking-wider uppercase">AI 写作</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">智能写作</h1>
            <p className="text-emerald-100 text-base max-w-lg">
              输入主题、选择类型，AI 为你生成高质量的文章，支持作文、论文、创意写作等多种题材
            </p>
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* LEFT: Input Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5"
          >
            {/* Topic Input */}
            <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 block">
                写作主题
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && topic.trim() && state !== 'generating') {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="输入写作主题，如「难忘的一件事」"
                disabled={state === 'generating'}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all disabled:opacity-50"
              />

              <button
                onClick={() => setShowTemplates((v) => !v)}
                className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <Lightbulb className="h-3 w-3" />
                热门主题推荐
                <ChevronDown className={`h-3 w-3 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showTemplates && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1.5">
                      {TEMPLATES.map((t) => (
                        <button
                          key={t.topic}
                          onClick={() => {
                            setTopic(t.topic);
                            setSelectedGenre(t.genre);
                            setRequirements(t.prompt);
                            setShowTemplates(false);
                          }}
                          className="w-full text-left rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          <span className="font-medium">{t.topic}</span>
                          <span className="ml-2 text-slate-400">— {t.prompt.slice(0, 20)}…</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Genre Selection */}
            <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 block">
                写作类型
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GENRES.map((genre) => {
                  const Icon = genre.icon;
                  const isActive = selectedGenre === genre.id;
                  return (
                    <button
                      key={genre.id}
                      onClick={() => setSelectedGenre(genre.id)}
                      disabled={state === 'generating'}
                      className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all disabled:opacity-50 ${
                        isActive
                          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-600'
                          : 'border-slate-200 dark:border-slate-600 hover:border-emerald-200 dark:hover:border-emerald-700'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                      <div>
                        <p className={`text-xs font-semibold ${isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>
                          {genre.label}
                        </p>
                        <p className="text-[10px] text-slate-400">{genre.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Word Count */}
            <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 block">
                目标字数
              </label>
              <div className="flex gap-2">
                {['400', '600', '800', '1000', '1500'].map((count) => (
                  <button
                    key={count}
                    onClick={() => setWordCount(count)}
                    disabled={state === 'generating'}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all disabled:opacity-50 ${
                      wordCount === count
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 block">
                补充要求 <span className="text-slate-400 font-normal">(可选)</span>
              </label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="如：需要引用名人名言、使用比喻修辞、突出对比手法……"
                rows={3}
                disabled={state === 'generating'}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all resize-none disabled:opacity-50"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || state === 'generating'}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-3.5 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {state === 'generating' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  AI 创作中…
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  开始写作
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

          {/* RIGHT: Result Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="min-h-[500px]"
          >
            {state === 'idle' ? (
              <div className="flex flex-col items-center justify-center h-full rounded-3xl border-2 border-dashed border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-950/10 py-20">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                  <PenTool className="h-8 w-8 text-white" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-800 dark:text-slate-100">AI 智能写作</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center max-w-md">
                  输入主题、选择类型，AI 将为你生成高质量的文章框架和完整内容
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="w-3 h-3" />
                    多题材覆盖
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-100 dark:bg-teal-900/30 px-3 py-1.5 text-xs text-teal-700 dark:text-teal-300">
                    <Wand2 className="w-3 h-3" />
                    流式生成
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 px-3 py-1.5 text-xs text-cyan-700 dark:text-cyan-300">
                    <Copy className="w-3 h-3" />
                    快速复制
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                      <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{topic}</p>
                      <p className="text-[11px] text-slate-400">
                        {GENRES.find((g) => g.id === selectedGenre)?.label} · 目标 {wordCount} 字
                        {state === 'done' && ` · 实际 ${wordCountActual} 字`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {state === 'done' && (
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? '已复制' : '复制全文'}
                      </button>
                    )}
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      重新写作
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {state === 'generating' && !result && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="relative">
                        <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                        <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-emerald-500" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">AI 正在创作中…</p>
                      <p className="text-xs text-slate-400 mt-1">根据你的要求精心撰写</p>
                    </div>
                  )}
                  {(result || state === 'generating') && (
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-200 leading-relaxed">
                      {result}
                      {state === 'generating' && (
                        <span className="inline-block w-0.5 h-4 bg-emerald-500 animate-pulse ml-0.5" />
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Stats */}
                {state === 'done' && (
                  <div className="flex items-center gap-4 px-6 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
                    <span className="text-[11px] text-slate-400">字数：{wordCountActual}</span>
                    <span className="text-[11px] text-slate-400">类型：{GENRES.find((g) => g.id === selectedGenre)?.label}</span>
                    <span className="text-[11px] text-slate-400">耗时：{elapsed}s</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </SkyAppShell>
  );
}
