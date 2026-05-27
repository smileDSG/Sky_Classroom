'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTaskStore } from '@/lib/store/use-task-store';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import {
  Languages,
  ArrowLeft,
  ArrowRightLeft,
  Copy,
  Check,
  Loader2,
  Sparkles,
  BookOpen,
} from 'lucide-react';

const LANGUAGES = [
  { id: 'zh', label: '中文', flag: '🇨🇳' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'ja', label: '日本語', flag: '🇯🇵' },
  { id: 'ko', label: '한국어', flag: '🇰🇷' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const EXAMPLES = [
  { text: '学而不思则罔，思而不学则殆。', from: 'zh', to: 'en' },
  { text: 'The only way to do great work is to love what you do.', from: 'en', to: 'zh' },
  { text: '桜の花が咲く頃、新しい出会いが始まる。', from: 'ja', to: 'zh' },
  { text: '지식은 힘이다.', from: 'ko', to: 'zh' },
];

type TranslateState = 'idle' | 'translating' | 'done';

export default function CloudMindTranslatePage() {
  const [sourceLang, setSourceLang] = useState('zh');
  const [targetLang, setTargetLang] = useState('en');
  const [sourceText, setSourceText] = useState('');
  const [result, setResult] = useState('');
  const [state, setState] = useState<TranslateState>('idle');
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Restore state from background task on mount
  useEffect(() => {
    const store = useTaskStore.getState();
    const tasks = Object.values(store.tasks).filter(
      (t) => t.type === 'translate' && t.status !== 'failed'
    );
    if (tasks.length === 0) return;
    const task = tasks[tasks.length - 1];
    setActiveTaskId(task.id);

    if (task.status === 'running') {
      setState('translating');
    } else if (task.status === 'completed' && task.result) {
      const data = task.result as { translation: string; alternatives?: string[]; notes?: string; sourceText?: string; sourceLang?: string; targetLang?: string };
      setResult(data.translation);
      setAlternatives(data.alternatives || []);
      setNotes(data.notes || '');
      if (data.sourceText) setSourceText(data.sourceText);
      if (data.sourceLang) setSourceLang(data.sourceLang);
      if (data.targetLang) setTargetLang(data.targetLang);
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
        const data = task.result as { translation: string; alternatives?: string[]; notes?: string };
        setResult(data.translation);
        setAlternatives(data.alternatives || []);
        setNotes(data.notes || '');
        setState('done');
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      } else if (task.status === 'failed') {
        setError(task.error || '翻译失败，请重试');
        setState('idle');
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      }
    });
    return unsub;
  }, [activeTaskId]);

  const handleSwap = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(result);
    setResult(sourceText);
    setAlternatives([]);
    setNotes('');
  }, [sourceLang, targetLang, sourceText, result]);

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;
    setState('translating');
    setResult('');
    setError(null);
    setAlternatives([]);
    setNotes('');

    const taskId = `translate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveTaskId(taskId);

    const srcLabel = LANGUAGES.find(l => l.id === sourceLang)?.label || sourceLang;
    const tgtLabel = LANGUAGES.find(l => l.id === targetLang)?.label || targetLang;

    useTaskStore.getState().addTask({
      id: taskId,
      type: 'translate',
      label: `翻译: ${srcLabel} → ${tgtLabel}`,
      status: 'running',
      progress: 30,
      phase: '翻译中…',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      const res = await fetch('/api/sky/cloud-mind/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText.trim(),
          sourceLang,
          targetLang,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || '翻译失败');
      }

      useTaskStore.getState().updateTask(taskId, {
        status: 'completed',
        progress: 100,
        phase: '翻译完成',
        result: {
          translation: json.data.translation,
          alternatives: json.data.alternatives || [],
          notes: json.data.notes || '',
          sourceText: sourceText.trim(),
          sourceLang,
          targetLang,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '翻译失败，请重试';
      useTaskStore.getState().updateTask(taskId, {
        status: 'failed',
        progress: 0,
        phase: '翻译失败',
        error: msg,
      });
    }
  }, [sourceText, sourceLang, targetLang]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleExample = useCallback((ex: typeof EXAMPLES[0]) => {
    setSourceText(ex.text);
    setSourceLang(ex.from);
    setTargetLang(ex.to);
    setResult('');
    setState('idle');
    setError(null);
    setAlternatives([]);
    setNotes('');
  }, []);

  const getLangLabel = (id: string) => LANGUAGES.find((l) => l.id === id)?.label || id;
  const getLangFlag = (id: string) => LANGUAGES.find((l) => l.id === id)?.flag || '';

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
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            云端智囊
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">智能翻译</span>
          </div>
        </motion.div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Languages className="h-5 w-5 text-indigo-200" />
              </div>
              <span className="text-xs font-medium text-indigo-200 tracking-wider uppercase">AI 翻译</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">智能翻译</h1>
            <p className="text-indigo-100 text-base max-w-lg">
              支持中英日韩法德 6 种语言互译，AI 理解语境，精准传达含义
            </p>
          </div>
        </motion.div>

        {/* Language Selector Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-4"
        >
          <div className="flex items-end gap-3">
            {/* Source Language */}
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 mb-1.5 block">源语言</label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:rotate-180 transition-all duration-300 shrink-0 mb-0.5"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>

            {/* Target Language */}
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 mb-1.5 block">目标语言</label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Translation Area */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Source */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="text-base">{getLangFlag(sourceLang)}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{getLangLabel(sourceLang)}</span>
              </div>
              <button
                onClick={() => { setSourceText(''); setResult(''); setState('idle'); setError(null); }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                清空
              </button>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && sourceText.trim() && state !== 'translating') {
                  e.preventDefault();
                  handleTranslate();
                }
              }}
              placeholder="输入要翻译的文本…（支持 Ctrl+Enter 快捷翻译）"
              rows={8}
              className="w-full px-5 py-4 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 bg-transparent focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700/50">
              <span className="text-[11px] text-slate-400">{sourceText.length} 字符</span>
              <button
                onClick={handleTranslate}
                disabled={!sourceText.trim() || state === 'translating'}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state === 'translating' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                翻译
              </button>
            </div>
          </motion.div>

          {/* Result */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="text-base">{getLangFlag(targetLang)}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{getLangLabel(targetLang)}</span>
              </div>
              {result && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
              )}
            </div>
            <div className="px-5 py-4 min-h-[224px]">
              {state === 'idle' && !result ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Languages className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400">翻译结果将在此显示</p>
                  <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">支持 Ctrl+Enter 快捷翻译</p>
                </div>
              ) : state === 'translating' && !result ? (
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <div className="relative">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-indigo-500" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400">翻译中…</p>
                  <div className="mt-3 space-y-2 w-full max-w-xs">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-full" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-4/5" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/5" />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {result}
                  {state === 'translating' && (
                    <span className="inline-block w-0.5 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                  )}
                </div>
              )}
            </div>
            {result && state === 'done' && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700/50">
                <span className="text-[11px] text-slate-400">{result.length} 字符</span>
                <button
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-[11px] text-indigo-500 hover:text-indigo-600 transition-colors"
                >
                  {showDetails ? '收起' : '翻译详情'}
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 px-4 py-3 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Translation Details */}
        <AnimatePresence>
          {showDetails && state === 'done' && result && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">翻译分析</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">源语言</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{getLangLabel(sourceLang)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">目标语言</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{getLangLabel(targetLang)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">源文本长度</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{sourceText.length} 字符</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">译文长度</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{result.length} 字符</p>
                  </div>
                </div>

                {alternatives.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-indigo-200/30 dark:border-indigo-700/20">
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2">备选翻译</p>
                    <div className="space-y-1.5">
                      {alternatives.map((alt, i) => (
                        <p key={i} className="text-sm text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/30 rounded-lg px-3 py-2">{alt}</p>
                      ))}
                    </div>
                  </div>
                )}

                {notes && (
                  <div className="mt-4 pt-3 border-t border-indigo-200/30 dark:border-indigo-700/20">
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">翻译说明</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Example Sentences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">试试这些例句</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => handleExample(ex)}
                className="text-left rounded-xl border border-slate-200 dark:border-slate-600 p-3 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all group"
              >
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">{ex.text}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {getLangFlag(ex.from)} {getLangLabel(ex.from)} → {getLangFlag(ex.to)} {getLangLabel(ex.to)}
                </p>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </SkyAppShell>
  );
}
