'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTaskStore } from '@/lib/store/use-task-store';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { motion, AnimatePresence } from 'motion/react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import {
  Brain,
  ArrowLeft,
  Sparkles,
  Loader2,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  BookOpen,
  Layers,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { MemoryCardDeck } from '@/lib/agents/cloud-mind/memory-cards-agent';

export default function CloudMindMemoryPage() {
  const searchParams = useSearchParams();
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [cardCount, setCardCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<MemoryCardDeck | null>(null);
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Pre-fill from URL query params (e.g., from slides/write/translate)
  useEffect(() => {
    const qContent = searchParams.get('content');
    const qTopic = searchParams.get('topic');
    if (qContent) setContent(qContent);
    if (qTopic) setTopic(qTopic);
  }, [searchParams]);

  // Import from mistakes (错题 → 记忆卡片)
  const handleImportFromMistakes = () => {
    const mistakes = useSkyClassroomStore.getState().mistakes;
    if (mistakes.length === 0) {
      setError('暂无错题记录，先去做些练习吧');
      return;
    }
    const kpCounts = new Map<string, number>();
    for (const m of mistakes) {
      for (const kp of m.knowledgePoints) {
        kpCounts.set(kp, (kpCounts.get(kp) ?? 0) + 1);
      }
    }
    const sortedKps = [...kpCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topKps = sortedKps.slice(0, 8);
    const topicStr = topKps.map(([kp]) => kp).join('、');
    const contentStr = topKps
      .map(([kp, count]) => `知识点"${kp}"错误${count}次，典型题目：${mistakes.find(m => m.knowledgePoints.includes(kp))?.problem ?? ''}`)
      .join('\n\n');
    setTopic(`错题薄弱点：${topicStr}`);
    setContent(contentStr);
  };

  // Restore state from background task on mount
  useEffect(() => {
    const store = useTaskStore.getState();
    const tasks = Object.values(store.tasks).filter(
      (t) => t.type === 'memory' && t.status !== 'failed'
    );
    if (tasks.length === 0) return;
    const task = tasks[tasks.length - 1];
    setActiveTaskId(task.id);

    if (task.status === 'running') {
      setLoading(true);
    } else if (task.status === 'completed' && task.result) {
      setDeck(task.result as MemoryCardDeck);
      setCurrentCard(0);
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
        setDeck(task.result as MemoryCardDeck);
        setCurrentCard(0);
        setLoading(false);
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      } else if (task.status === 'failed') {
        setError(task.error || '生成失败，请重试');
        setLoading(false);
        useTaskStore.getState().removeTask(task.id);
        setActiveTaskId(null);
      }
    });
    return unsub;
  }, [activeTaskId]);

  const handleGenerate = async () => {
    if (!content.trim()) {
      setError('请输入学习内容或知识点');
      return;
    }

    setLoading(true);
    setError(null);
    setDeck(null);
    setFlipped(false);

    const taskId = `memory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveTaskId(taskId);

    useTaskStore.getState().addTask({
      id: taskId,
      type: 'memory',
      label: `记忆卡片: ${topic || '未命名主题'}`,
      status: 'running',
      progress: 30,
      phase: 'AI 生成中…',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      const res = await fetch('/api/sky/cloud-mind/memory-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), topic: topic || undefined, cardCount }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || '生成失败');
      }

      useTaskStore.getState().updateTask(taskId, {
        status: 'completed',
        progress: 100,
        phase: '生成完成',
        result: json.data,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败，请重试';
      useTaskStore.getState().updateTask(taskId, {
        status: 'failed',
        progress: 0,
        phase: '生成失败',
        error: msg,
      });
    }
  };

  const nextCard = () => {
    if (!deck) return;
    setFlipped(false);
    setCurrentCard((prev) => (prev + 1) % deck.cards.length);
  };

  // Track memory progress to localStorage
  const trackFlip = () => {
    setFlipped(!flipped);
    if (!flipped && deck) {
      try {
        const key = 'memory-progress';
        const raw = localStorage.getItem(key);
        const progress = raw ? JSON.parse(raw) : { totalFlipped: 0, topics: {} };
        progress.totalFlipped = (progress.totalFlipped || 0) + 1;
        const topicKey = deck.topic || 'unknown';
        progress.topics[topicKey] = (progress.topics[topicKey] || 0) + 1;
        progress.lastStudied = Date.now();
        localStorage.setItem(key, JSON.stringify(progress));
      } catch { /* ignore */ }
    }
  };
  const prevCard = () => {
    if (!deck) return;
    setFlipped(false);
    setCurrentCard((prev) => (prev - 1 + deck.cards.length) % deck.cards.length);
  };

  const difficultyColors = {
    easy: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/30',
    medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/30',
    hard: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/30',
  };

  const difficultyLabels = { easy: '简单', medium: '中等', hard: '困难' };

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
            <Brain className="h-4 w-4 text-rose-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">记忆卡片</span>
          </div>
        </motion.div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-pink-700 to-fuchsia-800 p-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Brain className="h-5 w-5 text-rose-200" />
              </div>
              <span className="text-xs font-medium text-rose-200 tracking-wider uppercase">记忆工具</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">记忆卡片</h1>
            <p className="text-rose-100 text-base max-w-lg">输入知识点，AI 自动生成问答记忆卡片，配合艾宾浩斯遗忘曲线高效复习</p>
          </div>
        </motion.div>

        {/* Input Section */}
        {!deck && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-6"
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">学习主题</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例如：三角函数公式、化学元素周期表..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">卡片数量</label>
                <select
                  value={cardCount}
                  onChange={(e) => setCardCount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-colors"
                >
                  <option value={6}>6 张（精要）</option>
                  <option value={12}>12 张（标准）</option>
                  <option value={20}>20 张（详细）</option>
                  <option value={30}>30 张（全面）</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">学习内容 / 知识点</label>
                <button
                  type="button"
                  onClick={handleImportFromMistakes}
                  className="flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-600 transition-colors"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  从错题生成
                </button>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="粘贴需要记忆的知识点、课文内容、公式定理等…AI 会自动提炼出关键卡片"
                rows={6}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-colors resize-y"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !content.trim()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-2.5 text-white font-medium shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'AI 生成中...' : '生成记忆卡片'}
            </button>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
            )}
          </motion.div>
        )}

        {/* Study Mode */}
        <AnimatePresence>
          {deck && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Deck Info */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Brain className="h-5 w-5 text-rose-500" />{deck.topic}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{deck.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setDeck(null); setContent(''); }}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    重新生成
                  </button>
                  <button
                    onClick={() => setStudyMode(!studyMode)}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      studyMode
                        ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <BookOpen className="h-4 w-4" />
                    {studyMode ? '学习中' : '开始学习'}
                  </button>
                </div>
              </div>

              {studyMode ? (
                /* Flashcard Study Mode */
                <div className="flex flex-col items-center gap-4">
                  {/* Progress */}
                  <div className="w-full flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500"
                        style={{ width: `${((currentCard + 1) / deck.cards.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {currentCard + 1} / {deck.cards.length}
                    </span>
                  </div>

                  {/* Card */}
                  <div
                    onClick={trackFlip}
                    className="w-full max-w-2xl cursor-pointer perspective-1000"
                  >
                    <motion.div
                      animate={{ rotateY: flipped ? 180 : 0 }}
                      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                      className="relative w-full"
                      style={{ transformStyle: 'preserve-3d', minHeight: 280 }}
                    >
                      {/* Front */}
                      <div
                        className="absolute inset-0 rounded-2xl bg-white dark:bg-slate-800 border-2 border-rose-200 dark:border-rose-700/30 p-8 flex flex-col items-center justify-center"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <div className="text-center">
                          <div className={`inline-flex rounded-lg border px-3 py-1 text-xs font-medium mb-4 ${
                            difficultyColors[deck.cards[currentCard].difficulty]
                          }`}>
                            {difficultyLabels[deck.cards[currentCard].difficulty]}
                          </div>
                          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                            {deck.cards[currentCard].front}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-6">
                            点击翻看答案
                          </p>
                        </div>
                      </div>

                      {/* Back */}
                      <div
                        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/10 border-2 border-rose-300 dark:border-rose-600/30 p-8 flex flex-col items-center justify-center"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        <div className="text-center">
                          <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed mb-4">
                            {deck.cards[currentCard].back}
                          </p>
                          {deck.cards[currentCard].mnemonic && (
                            <div className="mt-3 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-rose-200/30 dark:border-rose-700/20 p-3">
                              <div className="flex items-center gap-1.5 text-xs text-rose-500 mb-1">
                                <Lightbulb className="h-3 w-3" />助记技巧
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-300">{deck.cards[currentCard].mnemonic}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                            {deck.cards[currentCard].tags.map((tag, i) => (
                              <span key={i} className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 rounded px-2 py-0.5">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center gap-4">
                    <button onClick={prevCard} className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                    </button>
                    <button onClick={nextCard} className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Card List View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deck.cards.map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                      onClick={() => { setCurrentCard(i); setStudyMode(true); setFlipped(false); }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`rounded-lg border px-2 py-0.5 text-[10px] font-medium ${
                          difficultyColors[card.difficulty]
                        }`}>
                          {difficultyLabels[card.difficulty]}
                        </div>
                        <span className="text-xs text-slate-400">{i + 1}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 line-clamp-2">
                        {card.front}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {card.back}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {card.tags.slice(0, 3).map((tag, j) => (
                          <span key={j} className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/50 rounded px-1.5 py-0.5">
                            {tag}
                          </span>
                        ))}
                        {card.tags.length > 3 && (
                          <span className="text-[10px] text-slate-400">+{card.tags.length - 3}</span>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/30 flex items-center gap-1 text-[10px] text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <BookOpen className="h-3 w-3" />
                        点击开始学习
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Study Tips */}
              {deck.studyTips && (
                <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200/50 dark:border-amber-700/30 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">学习建议</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{deck.studyTips}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      推荐复习间隔：{deck.reviewIntervals?.join('、')} 天后
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SkyAppShell>
  );
}