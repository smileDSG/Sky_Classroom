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
  FileDown,
  X,
} from 'lucide-react';
import type { MistakeCause } from '@/lib/solve/types';
import type { MistakeRecord } from '@/lib/mistakes/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const [showMistakePicker, setShowMistakePicker] = useState(false);
  const [studiedCards, setStudiedCards] = useState<Set<number>>(new Set());
  const router = useRouter();

  // Pre-fill from URL query params (e.g., from slides/write/translate)
  useEffect(() => {
    const qContent = searchParams.get('content');
    const qTopic = searchParams.get('topic');
    if (qContent) setContent(qContent);
    if (qTopic) setTopic(qTopic);
  }, [searchParams]);

  // Cause labels for display
  const causeLabels: Record<MistakeCause, string> = {
    'concept-unclear': '概念不清',
    'calculation-error': '计算失误',
    'misreading': '审题错误',
    'method-wrong': '方法错误',
    'careless': '粗心',
    'format-error': '格式错误',
  };

  // Import from mistakes — toggle picker panel
  const handleImportFromMistakes = () => {
    const mistakes = useSkyClassroomStore.getState().mistakes;
    if (mistakes.length === 0) {
      setError('暂无错题记录，先去做些练习吧');
      return;
    }
    setShowMistakePicker(true);
  };

  // Select a specific mistake to fill topic + content
  const handleSelectMistake = (m: MistakeRecord) => {
    setTopic(m.knowledgePoints.join('、'));
    setContent(
      `【题目】${m.problem}\n\n【我的答案】${m.userAnswer}\n\n【正确答案】${m.correctAnswer}\n\n【错因】${causeLabels[m.cause]}\n\n【知识点】${m.knowledgePoints.join('、')}`,
    );
    setShowMistakePicker(false);
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
      setStudiedCards(new Set());
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
        setStudiedCards(new Set());
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
    setStudiedCards(new Set());

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
      setStudiedCards((prev) => {
        const next = new Set(prev);
        next.add(currentCard);
        return next;
      });
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">学习内容 / 知识点</label>

              {/* Quick import from mistakes */}
              <button
                type="button"
                onClick={handleImportFromMistakes}
                className="w-full mb-3 flex items-center gap-3 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-600/50 bg-indigo-50/50 dark:bg-indigo-900/10 px-4 py-3 text-left hover:bg-indigo-100/70 dark:hover:bg-indigo-900/20 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-800/40 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-700/40 transition-colors">
                  <FileDown className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300">从错题本导入</div>
                  <div className="text-xs text-indigo-400 dark:text-indigo-500 mt-0.5">选择错题自动生成记忆卡片</div>
                </div>
              </button>

              {/* Mistake Picker Panel */}
              {showMistakePicker && (
                <MistakePicker
                  onSelect={handleSelectMistake}
                  onClose={() => setShowMistakePicker(false)}
                />
              )}

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
                    onClick={() => { setDeck(null); setContent(''); setStudiedCards(new Set()); }}
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

                  {/* Navigation / Completion */}
                  {studiedCards.size >= deck.cards.length ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-4 py-6"
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">学习完成！</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          你已完成全部 {deck.cards.length} 张卡片的学习
                        </p>
                      </div>
                      <button
                        onClick={() => router.push('/sky/cloud-mind')}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-2.5 text-white font-medium shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30 transition-all hover:-translate-y-0.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        完成学习
                      </button>
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button onClick={prevCard} className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                      </button>
                      <button onClick={nextCard} className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                      </button>
                    </div>
                  )}
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

// ── Mistake Picker Panel ──────────────────────────────────────────────

const causeColors: Record<MistakeCause, string> = {
  'concept-unclear': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'calculation-error': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'misreading': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'method-wrong': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'careless': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'format-error': 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
};

const pickerCauseLabels: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  'misreading': '审题错误',
  'method-wrong': '方法错误',
  'careless': '粗心',
  'format-error': '格式错误',
};

function MistakePicker({
  onSelect,
  onClose,
}: {
  onSelect: (m: MistakeRecord) => void;
  onClose: () => void;
}) {
  const mistakes = useSkyClassroomStore((s) => s.mistakes);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-4 rounded-2xl border border-rose-200 dark:border-rose-700/30 bg-white dark:bg-slate-800 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            选择错题生成卡片
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            共 {mistakes.length} 条
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
        {mistakes.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            暂无错题记录，先去做些练习吧
          </div>
        ) : (
          mistakes.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className="w-full text-left px-4 py-3 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-colors group"
            >
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed">
                {m.problem}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-red-500 dark:text-red-400">
                  我的答案：{m.userAnswer}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  正确答案：{m.correctAnswer}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${causeColors[m.cause]}`}>
                  {pickerCauseLabels[m.cause]}
                </span>
                {m.knowledgePoints.map((kp) => (
                  <span
                    key={kp}
                    className="inline-block rounded bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 text-[10px] text-rose-600 dark:text-rose-400"
                  >
                    {kp}
                  </span>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                点击选择此错题
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
}