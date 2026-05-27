'use client';

import { useState, useRef, useEffect } from 'react';
import { useTaskStore } from '@/lib/store/use-task-store';
import { motion, AnimatePresence } from 'motion/react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import {
  Presentation,
  ArrowLeft,
  Upload,
  Sparkles,
  FileText,
  Loader2,
  BookOpen,
  Lightbulb,
  MessageCircle,
  PenTool,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import type { SlidesAnalysisOutput } from '@/lib/agents/cloud-mind/slides-agent';

export default function CloudMindSlidesPage() {
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SlidesAnalysisOutput | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore state from background task on mount
  useEffect(() => {
    const store = useTaskStore.getState();
    const tasks = Object.values(store.tasks).filter(
      (t) => t.type === 'slides' && t.status !== 'failed'
    );
    if (tasks.length === 0) return;
    const task = tasks[tasks.length - 1];
    setActiveTaskId(task.id);

    if (task.status === 'running') {
      setLoading(true);
    } else if (task.status === 'completed' && task.result) {
      setResult(task.result as SlidesAnalysisOutput);
      setActiveSlide(0);
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
        setLoading(false);
        return;
      }
      if (task.status === 'completed' && task.result) {
        setResult(task.result as SlidesAnalysisOutput);
        setActiveSlide(0);
        setLoading(false);
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      } else if (task.status === 'failed') {
        setError(task.error || '分析失败，请重试');
        setLoading(false);
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      }
    });
    return unsub;
  }, [activeTaskId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      setContent(text);
      setTopic(file.name.replace(/\.[^/.]+$/, ''));
    } catch {
      setError('文件读取失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!content.trim()) {
      setError('请输入课件内容或上传文件');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const taskId = `slides_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveTaskId(taskId);

    useTaskStore.getState().addTask({
      id: taskId,
      type: 'slides',
      label: `幻灯片讲解: ${topic || '未命名课件'}`,
      status: 'running',
      progress: 30,
      phase: 'AI 分析中…',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      const res = await fetch('/api/sky/cloud-mind/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), topic: topic || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || '分析失败');
      }

      useTaskStore.getState().updateTask(taskId, {
        status: 'completed',
        progress: 100,
        phase: '分析完成',
        result: json.data,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分析失败，请重试';
      useTaskStore.getState().updateTask(taskId, {
        status: 'failed',
        progress: 0,
        phase: '分析失败',
        error: msg,
      });
    }
  };

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Breadcrumb */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/sky/cloud-mind" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />云端智囊
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <Presentation className="h-4 w-4 text-cyan-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">幻灯片讲解</span>
          </div>
        </motion.div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-blue-700 to-indigo-800 p-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Presentation className="h-5 w-5 text-cyan-200" />
              </div>
              <span className="text-xs font-medium text-cyan-200 tracking-wider uppercase">AI 讲解</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">幻灯片讲解</h1>
            <p className="text-cyan-100 text-base max-w-lg">上传课件内容，AI 自动分析并生成逐页教学讲解脚本</p>
          </div>
        </motion.div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-6"
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">课件主题（可选）</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：勾股定理、二次函数、细胞分裂..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-colors"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">课件内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="粘贴课件文本内容，或点击下方按钮上传 .txt 文件…"
              rows={8}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-colors resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={loading || !content.trim()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-white font-medium shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'AI 分析中...' : '开始分析'}
            </button>
            <button
              onClick={() => {
                const topicParam = topic ? `?topic=${encodeURIComponent(topic)}` : '';
                window.location.href = `/sky/slides${topicParam}`;
              }}
              disabled={!topic.trim()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-2.5 text-white font-medium shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Presentation className="h-4 w-4" />
              一键生成PPT
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              上传 TXT 文件
            </button>
            <input ref={fileInputRef} type="file" accept=".txt,.md" onChange={handleFileUpload} className="hidden" />
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Overview Card */}
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 border border-emerald-200/50 dark:border-emerald-700/30 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{result.topic}</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{result.overview}</p>
              </div>

              {/* Outline */}
              <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-6">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
                  <Lightbulb className="h-5 w-5 text-amber-500" />课程大纲
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.outline.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 p-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-sm font-bold">
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-slate-700 dark:text-slate-200">{item.title}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.keyPoints.map((kp, j) => (
                            <span key={j} className="text-[11px] text-slate-400 dark:text-slate-500 bg-slate-200/50 dark:bg-slate-600/30 rounded-md px-1.5 py-0.5">{kp}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slides Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Slide Navigator */}
                <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {result.slides.map((slide, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSlide(i)}
                      className={`w-full text-left rounded-xl p-4 transition-all border ${
                        activeSlide === i
                          ? 'bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/10 border-cyan-200 dark:border-cyan-700/30 shadow-sm'
                          : 'bg-white/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/20 hover:bg-white/70 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                          activeSlide === i ? 'bg-cyan-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                        }`}>
                          {slide.pageIndex}
                        </div>
                        <span className={`text-sm font-medium truncate ${
                          activeSlide === i ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-300'
                        }`}>{slide.title}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {slide.keyConcepts.slice(0, 3).map((c, j) => (
                          <span key={j} className="text-[10px] text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 rounded px-1.5 py-0.5">{c}</span>
                        ))}
                        {slide.keyConcepts.length > 3 && (
                          <span className="text-[10px] text-slate-400">+{slide.keyConcepts.length - 3}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Active Slide Detail */}
                <div className="lg:col-span-2 rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-6">
                  {result.slides[activeSlide] && (
                    <div className="space-y-5">
                      <div className="flex items-center gap-3 pb-4 border-b border-slate-200/50 dark:border-slate-700/30">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 text-white text-sm font-bold">
                          {result.slides[activeSlide].pageIndex}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{result.slides[activeSlide].title}</h3>
                      </div>

                      {/* Script */}
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                          <MessageCircle className="h-4 w-4" />讲解脚本
                        </h4>
                        <div className="rounded-xl bg-cyan-50/50 dark:bg-cyan-900/10 border border-cyan-200/30 dark:border-cyan-700/20 p-4 text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {result.slides[activeSlide].script}
                        </div>
                      </div>

                      {/* Board Notes */}
                      {result.slides[activeSlide].boardNotes.length > 0 && (
                        <div>
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                            <PenTool className="h-4 w-4" />板书要点
                          </h4>
                          <ul className="space-y-1">
                            {result.slides[activeSlide].boardNotes.map((note, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
                                {note}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Interaction Hints */}
                      {result.slides[activeSlide].interactionHints.length > 0 && (
                        <div>
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                            <MessageCircle className="h-4 w-4" />互动建议
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {result.slides[activeSlide].interactionHints.map((hint, i) => (
                              <span key={i} className="text-xs rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/20 px-3 py-1.5 text-amber-700 dark:text-amber-300">{hint}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary + Practice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-6">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />课堂总结
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{result.summary}</p>
                </div>
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-6">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">
                    <PenTool className="h-5 w-5 text-purple-500" />课后练习
                  </h3>
                  <div className="space-y-3">
                    {result.practiceQuestions?.slice(0, 5).map((q, i) => (
                      <div key={i} className="rounded-xl bg-slate-50 dark:bg-slate-700/30 p-3">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{i + 1}. {q.question}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">提示：{q.hint}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SkyAppShell>
  );
}