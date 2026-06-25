'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTaskStore } from '@/lib/store/use-task-store';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useTheme } from '@/lib/hooks/use-theme';
import { InlineMath } from '@/components/ui/inline-math';
import { motion, AnimatePresence } from 'motion/react';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';
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
import { MEMORY_COUNT_OPTIONS } from '@/lib/student/profile-config';
import type { StudentProfile } from '@/lib/student/profile-types';
import {
  buildMemoryCardId,
  buildMemoryDeckId,
  MEMORY_REVIEW_LABELS,
  scheduleMemoryReview,
} from '@/lib/cloud-mind/spaced-repetition';
import type { MemoryReviewRating } from '@/lib/cloud-mind/types';

type CardReviewStatus = MemoryReviewRating;

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
  const [cardReviewStatus, setCardReviewStatus] = useState<Record<number, CardReviewStatus>>({});
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const router = useRouter();
  const { setForceDark } = useTheme();

  useEffect(() => {
    setForceDark(true);
    return () => setForceDark(false);
  }, [setForceDark]);

  // Pre-fill from URL query params
  useEffect(() => {
    const qContent = searchParams.get('content');
    const qTopic = searchParams.get('topic');
    if (qContent) setContent(qContent);
    if (qTopic) setTopic(qTopic);
  }, [searchParams]);

  // Load student profile for weak-point recommendations
  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    fetch('/api/student/profile')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && json.data?.hasProfile) {
          setProfile({
            userId: '',
            masteryBySubject: {} as Record<string, number>,
            masteryByKnowledge: json.data.masteryByKnowledge ?? {},
            weakPoints: json.data.weakPoints ?? [],
            strongPoints: Object.entries(json.data.masteryByKnowledge ?? {})
              .filter(([, m]) => (m as number) > 80)
              .map(([k]) => k),
            errorPatterns: json.data.errorPatterns ?? [],
            totalQuestions: 0,
            totalCorrect: 0,
            lastUpdated: new Date(),
          });
        }
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const causeLabels: Record<MistakeCause, string> = {
    'concept-unclear': '概念不清',
    'calculation-error': '计算失误',
    misreading: '审题错误',
    'method-wrong': '方法错误',
    careless: '粗心',
    'format-error': '格式错误',
  };

  const handleImportFromMistakes = () => {
    const mistakes = useSkyClassroomStore.getState().mistakes;
    if (mistakes.length === 0) {
      setError('暂无错题记录，先去做些练习吧');
      return;
    }
    setShowMistakePicker(true);
  };

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
      (t) => t.type === 'memory' && t.status !== 'failed',
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
      setCardReviewStatus({});
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
        setCardReviewStatus({});
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

  const handleGenerate = async (auto: boolean = false) => {
    const isAuto = auto === true;

    if (!isAuto && !content.trim()) {
      setError('请输入学习内容或知识点');
      return;
    }

    setLoading(true);
    setError(null);
    setDeck(null);
    setFlipped(false);
    setStudiedCards(new Set());
    setCardReviewStatus({});

    const taskId = `memory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveTaskId(taskId);

    useTaskStore.getState().addTask({
      id: taskId,
      type: 'memory',
      label: isAuto ? '记忆卡片: 基于薄弱点生成' : `记忆卡片: ${topic || '未命名主题'}`,
      status: 'running',
      progress: 30,
      phase: '碎片生成中…',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      const body = isAuto
        ? { auto: true }
        : { content: content.trim(), topic: topic || undefined, cardCount };
      const res = await fetch('/api/sky/cloud-mind/memory-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || '生成失败');
      }

      useTaskStore.getState().updateTask(taskId, {
        status: 'completed',
        progress: 100,
        phase: '收集完成',
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

  const trackFlip = () => {
    setFlipped(!flipped);
  };

  const confirmCardMastery = (status: CardReviewStatus) => {
    if (!deck) return;

    const wasConfirmed = studiedCards.has(currentCard);
    const nextStudiedCards = new Set(studiedCards);
    nextStudiedCards.add(currentCard);

    setCardReviewStatus((prev) => ({ ...prev, [currentCard]: status }));
    setStudiedCards(nextStudiedCards);

    const card = deck.cards[currentCard];
    const deckId = buildMemoryDeckId(deck.topic || topic || 'memory', deck.cards.length);
    const cardId = buildMemoryCardId(deckId, currentCard, card.front);
    const store = useSkyClassroomStore.getState();
    const previousReview = store.memoryReviews.find((review) => review.cardId === cardId) ?? null;
    const review = scheduleMemoryReview({
      cardId,
      deckId,
      rating: status,
      previous: previousReview,
      sourceType: content.trim() ? 'manual' : 'memory',
      sourceId: activeTaskId ?? undefined,
      front: card.front,
      back: card.back,
      tags: card.tags,
    });
    store.recordMemoryReview(review);
    fetch('/api/sky/cloud-mind/memory-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    }).catch(() => {
      /* local persisted review is still available */
    });

    if (!wasConfirmed) {
      store.updateMemoryProgress({
        totalFlipped: store.memoryProgress.totalFlipped + 1,
        topicCount: nextStudiedCards.size,
        lastStudied: Date.now(),
      });
    }
  };
  const prevCard = () => {
    if (!deck) return;
    setFlipped(false);
    setCurrentCard((prev) => (prev - 1 + deck.cards.length) % deck.cards.length);
  };

  // Star rarity colors for difficulty
  const difficultyStar: Record<string, string> = {
    easy: 'text-emerald-400',
    medium: 'text-amber-400',
    hard: 'text-rose-400',
  };
  const difficultyLabels = { easy: '简单', medium: '中等', hard: '困难' };
  const currentCardConfirmed = studiedCards.has(currentCard);
  const currentCardStatus = cardReviewStatus[currentCard];
  const currentReview =
    deck && currentCardConfirmed
      ? useSkyClassroomStore
          .getState()
          .memoryReviews.find(
            (review) =>
              review.cardId ===
              buildMemoryCardId(
                buildMemoryDeckId(deck.topic || topic || 'memory', deck.cards.length),
                currentCard,
                deck.cards[currentCard].front,
              ),
          )
      : null;

  return (
    <div
      className="relative min-h-screen dark"
      style={{
        background: 'linear-gradient(180deg, #0B0D1A 0%, #1A0B14 50%, #0B0D1A 100%)',
        // Force dark mode CSS variables regardless of global theme
        ['--background' as string]: '#070914',
        ['--foreground' as string]: '#FFF5F7',
        ['--card' as string]: 'rgba(22, 10, 18, 0.95)',
        ['--card-foreground' as string]: '#FFF5F7',
        ['--muted' as string]: 'oklch(0.269 0 0)',
        ['--muted-foreground' as string]: 'oklch(0.708 0 0)',
        ['--border' as string]: 'rgba(251, 113, 133, 0.3)',
        ['--input' as string]: 'rgba(251, 113, 133, 0.2)',
        ['--ring' as string]: 'oklch(0.556 0 0)',
        // Force dark memory variables
        ['--memory-void' as string]: '#070914',
        ['--memory-surface' as string]: 'rgba(22, 10, 18, 0.95)',
        ['--memory-surface-elevated' as string]: 'rgba(32, 15, 25, 0.97)',
        ['--memory-border' as string]: 'rgba(251, 113, 133, 0.3)',
        ['--memory-border-strong' as string]: 'rgba(251, 113, 133, 0.5)',
        ['--memory-primary' as string]: '#FDA4AF',
        ['--memory-primary-bright' as string]: '#FECDD3',
        ['--memory-glow' as string]: 'rgba(253, 164, 175, 0.45)',
        ['--memory-glow-strong' as string]: 'rgba(253, 164, 175, 0.65)',
        ['--memory-text' as string]: '#FFF5F7',
        ['--memory-muted' as string]: 'rgba(200, 200, 230, 0.55)',
        ['--memory-collected' as string]: '#34D399',
        ['--memory-collected-glow' as string]: 'rgba(52, 211, 153, 0.4)',
        ['--memory-accent' as string]: '#C084FC',
        ['--memory-accent-glow' as string]: 'rgba(192, 132, 252, 0.3)',
        ['--memory-indigo' as string]: '#818CF8',
        ['--memory-indigo-glow' as string]: 'rgba(129, 140, 248, 0.3)',
        ['--memory-warm' as string]: '#FBBF24',
        ['--memory-warm-glow' as string]: 'rgba(251, 191, 36, 0.3)',
      }}
    >
      {/* Starfield */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <CelestialCanvas starCount={100} parallax={false} nebula grid={false} horizonGlow />
      </div>
      {/* Rose ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-[#FB7185]/4 blur-[150px]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[#E11D48]/3 blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-6 pb-12">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3"
        >
          <Link href="/sky/cloud-mind" className="star-breadcrumb flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            云端智囊
          </Link>
          <span className="text-[var(--celestial-starlight)]/20">/</span>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[var(--memory-primary)]" />
            <span className="text-sm font-medium" style={{ color: 'var(--memory-text)' }}>
              星尘收集器
            </span>
          </div>
        </motion.div>

        {/* Hero — transparent + starlight text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-6 overflow-hidden rounded-2xl p-8"
          style={{
            background: 'linear-gradient(135deg, rgba(251, 113, 133, 0.08) 0%, transparent 60%)',
            border: '1px solid var(--memory-border)',
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--memory-primary)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: 'var(--memory-glow)',
                  border: '1px solid var(--memory-border)',
                }}
              >
                <Brain className="h-5 w-5 text-[var(--memory-primary)]" />
              </div>
              <span
                className="text-xs font-medium tracking-wider uppercase"
                style={{ color: 'var(--memory-muted)' }}
              >
                星尘收集器
              </span>
            </div>
            <h1
              className="text-3xl font-bold memory-glow-text"
              style={{ color: 'var(--memory-text)' }}
            >
              记忆卡片
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--memory-muted)' }}>
              收集星座碎片，翻转星图，连成完整星座 — AI 为你提炼关键记忆
            </p>
          </div>
        </motion.div>

        {/* Input Section — 收集任务台 */}
        {!deck && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-6"
            style={{
              background: 'var(--memory-surface)',
              border: '1px solid var(--memory-border)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div className="grid grid-cols-2 gap-6 mb-5">
              {/* Topic input — bottom line style */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--memory-text)' }}
                >
                  学习主题
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例如：三角函数公式、化学元素周期表..."
                  className="w-full bg-transparent border-0 border-b px-0 py-2 text-sm outline-none transition-all"
                  style={{
                    borderColor: 'var(--memory-border)',
                    color: 'var(--memory-text)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--memory-primary)';
                    e.currentTarget.style.boxShadow =
                      '0 1px 0 0 var(--memory-primary), 0 4px 12px -4px var(--memory-glow)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--memory-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              {/* Card count — star selector */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--memory-text)' }}
                >
                  碎片数量
                </label>
                <div className="flex items-center gap-2">
                  {MEMORY_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setCardCount(count)}
                      className="relative flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium transition-all"
                      style={{
                        background:
                          cardCount === count ? 'var(--memory-glow-strong)' : 'transparent',
                        border: `1px solid ${cardCount === count ? 'var(--memory-primary)' : 'var(--memory-border)'}`,
                        color:
                          cardCount === count
                            ? 'var(--memory-primary-bright)'
                            : 'var(--memory-muted)',
                        boxShadow: cardCount === count ? '0 0 12px var(--memory-glow)' : 'none',
                      }}
                    >
                      {count}
                      {cardCount === count && (
                        <span
                          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[var(--memory-primary)]"
                          style={{ boxShadow: '0 0 6px var(--memory-glow)' }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-5">
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--memory-text)' }}
              >
                学习内容 / 知识点
              </label>

              {/* Mistake import — starlight dashed channel */}
              <button
                type="button"
                onClick={handleImportFromMistakes}
                className="w-full mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all group"
                style={{
                  border: '1px dashed var(--memory-indigo)',
                  background: 'rgba(79, 70, 229, 0.05)',
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'var(--memory-indigo-glow)' }}
                >
                  <FileDown className="h-4.5 w-4.5 text-[var(--memory-indigo)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium" style={{ color: 'var(--memory-indigo)' }}>
                    从错题本导入碎片
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--memory-muted)' }}>
                    选择错题自动生成记忆卡片
                  </div>
                </div>
              </button>

              {/* Auto-generate from weak points */}
              {profile && profile.weakPoints.length > 0 && !content.trim() && (
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={loading || profileLoading}
                  className="w-full mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all group"
                  style={{
                    border: '1px dashed var(--memory-primary)',
                    background: 'rgba(251, 113, 133, 0.08)',
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'rgba(251, 113, 133, 0.2)' }}
                  >
                    <Sparkles className="h-4.5 w-4.5 text-[var(--memory-primary)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--memory-primary)' }}>
                      基于薄弱点一键生成
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--memory-muted)' }}>
                      推荐：{profile.weakPoints.slice(0, 3).join('、')}
                    </div>
                  </div>
                </button>
              )}

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
                placeholder="粘贴需要记忆的知识点、课文内容、公式定理等…AI 会自动提炼出关键碎片"
                rows={6}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-y"
                style={{
                  background: 'rgba(11, 16, 33, 0.5)',
                  border: '1px solid var(--memory-border)',
                  color: 'var(--memory-text)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--memory-primary)';
                  e.currentTarget.style.boxShadow =
                    '0 0 0 1px var(--memory-primary), 0 4px 16px -4px var(--memory-glow)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--memory-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Generate button — border style + sweep */}
            <button
              onClick={() => handleGenerate()}
              disabled={loading || !content.trim()}
              className="celestial-button flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                borderColor: 'var(--memory-border-strong)',
                color: 'var(--memory-primary-bright)',
              }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? '碎片生成中…' : '启动收集引擎'}
            </button>

            {error && (
              <div
                className="mt-4 rounded-xl px-4 py-3 text-sm"
                style={{
                  background: 'rgba(248, 113, 113, 0.1)',
                  border: '1px solid rgba(248, 113, 113, 0.2)',
                  color: '#F87171',
                }}
              >
                {error}
              </div>
            )}
          </motion.div>
        )}

        {/* Study Mode */}
        <AnimatePresence>
          {deck && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Deck Info */}
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-xl font-bold flex items-center gap-2 memory-glow-text"
                    style={{ color: 'var(--memory-text)' }}
                  >
                    <Brain className="h-5 w-5 text-[var(--memory-primary)]" />
                    {deck.topic}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--memory-muted)' }}>
                    {deck.description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setDeck(null);
                      setContent('');
                      setStudiedCards(new Set());
                      setCardReviewStatus({});
                    }}
                    className="flex items-center gap-1.5 text-sm transition-colors"
                    style={{ color: 'var(--memory-muted)' }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    重新收集
                  </button>
                  <button
                    onClick={() => setStudyMode(!studyMode)}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                    style={{
                      background: studyMode ? 'var(--memory-glow)' : 'transparent',
                      border: `1px solid ${studyMode ? 'var(--memory-primary)' : 'var(--memory-border)'}`,
                      color: studyMode ? 'var(--memory-primary-bright)' : 'var(--memory-muted)',
                    }}
                  >
                    <BookOpen className="h-4 w-4" />
                    {studyMode ? '收集中' : '开始收集'}
                  </button>
                </div>
              </div>

              {studyMode ? (
                /* Flashcard Study Mode — 星图翻转 */
                <div className="flex flex-col items-center gap-4">
                  {/* Progress — constellation collection line */}
                  <div className="w-full flex items-center gap-3">
                    <div className="flex items-center gap-1 flex-1">
                      {deck.cards.map((_, i) => (
                        <div key={i} className="flex items-center">
                          <div
                            className="h-2 w-2 rounded-full transition-all duration-500"
                            style={{
                              background:
                                cardReviewStatus[i] === 'mastered'
                                  ? 'var(--memory-collected)'
                                  : cardReviewStatus[i] === 'review'
                                    ? 'var(--memory-warm)'
                                    : i === currentCard
                                      ? 'var(--memory-primary)'
                                      : 'rgba(255,255,255,0.15)',
                              boxShadow:
                                i === currentCard
                                  ? '0 0 8px var(--memory-glow)'
                                  : cardReviewStatus[i]
                                    ? '0 0 4px var(--memory-glow)'
                                    : 'none',
                              transform: i === currentCard ? 'scale(1.5)' : 'scale(1)',
                            }}
                          />
                          {i < deck.cards.length - 1 && (
                            <div
                              className="h-px w-4 transition-all duration-500"
                              style={{
                                background:
                                  cardReviewStatus[i]
                                    ? 'var(--memory-primary)'
                                    : 'rgba(255,255,255,0.1)',
                                boxShadow: cardReviewStatus[i]
                                  ? '0 0 4px var(--memory-glow)'
                                  : 'none',
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <span
                      className="text-xs font-medium shrink-0"
                      style={{ color: 'var(--memory-muted)' }}
                    >
                      {studiedCards.size}/{deck.cards.length} 碎片已收集
                    </span>
                  </div>

                  {/* Card — 3D flip */}
                  <div
                    onClick={trackFlip}
                    className="w-full max-w-3xl cursor-pointer"
                    style={{ perspective: '1000px' }}
                  >
                    <motion.div
                      data-testid="memory-card-shell"
                      animate={{ rotateY: flipped ? 180 : 0 }}
                      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                      className="relative h-[420px] w-full sm:h-[460px]"
                      style={{
                        transformStyle: 'preserve-3d',
                      }}
                    >
                      {/* Front */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl p-6 sm:p-8"
                        style={{
                          background: 'var(--memory-surface-elevated)',
                          border: '1px solid var(--memory-border)',
                          backfaceVisibility: 'hidden',
                        }}
                      >
                        <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto text-center">
                          <div className="flex items-center justify-center gap-2 mb-4">
                            <span
                              className={`text-lg ${difficultyStar[deck.cards[currentCard].difficulty]}`}
                            >
                              ★
                            </span>
                            <span
                              className="text-xs font-medium"
                              style={{ color: 'var(--memory-muted)' }}
                            >
                              {difficultyLabels[deck.cards[currentCard].difficulty]}
                            </span>
                          </div>
                          <p
                            className="text-xl font-bold leading-relaxed whitespace-pre-wrap"
                            style={{ color: 'var(--memory-text)' }}
                          >
                            <InlineMath text={deck.cards[currentCard].front} />
                          </p>
                          <p className="text-xs mt-6" style={{ color: 'var(--memory-muted)' }}>
                            点击翻转星图
                          </p>
                        </div>
                      </div>

                      {/* Back */}
                      <div
                        className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl p-6 sm:p-8"
                        style={{
                          background:
                            'linear-gradient(135deg, var(--memory-surface-elevated) 0%, rgba(251, 113, 133, 0.08) 100%)',
                          border: '1px solid var(--memory-border-strong)',
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}
                      >
                        <div className="flex h-full w-full flex-col overflow-hidden text-center">
                          <div
                            data-testid="memory-card-back-scroll"
                            className="min-h-0 flex-1 overflow-y-auto pr-1"
                          >
                            <p
                              className="text-lg leading-relaxed mb-4 whitespace-pre-wrap"
                              style={{ color: 'var(--memory-text)' }}
                            >
                              <InlineMath text={deck.cards[currentCard].back} />
                            </p>
                            {deck.cards[currentCard].mnemonic && (
                              <div
                                className="mt-3 rounded-xl p-3"
                                style={{
                                  background: 'rgba(251, 113, 133, 0.06)',
                                  border: '1px solid var(--memory-border)',
                                }}
                              >
                                <div
                                  className="flex items-center gap-1.5 text-xs mb-1"
                                  style={{ color: 'var(--memory-primary)' }}
                                >
                                  <Lightbulb className="h-3 w-3" />
                                  助记星
                                </div>
                                <p
                                  className="text-sm whitespace-pre-wrap"
                                  style={{ color: 'var(--memory-muted)' }}
                                >
                                  <InlineMath text={deck.cards[currentCard].mnemonic} />
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="mt-4 flex shrink-0 flex-wrap justify-center gap-1.5">
                            {deck.cards[currentCard].tags.map((tag, i) => (
                              <span
                                key={i}
                                className="text-[10px] rounded px-2 py-0.5"
                                style={{
                                  background: 'rgba(251, 113, 133, 0.08)',
                                  border: '1px solid var(--memory-border)',
                                  color: 'var(--memory-primary)',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {flipped && studiedCards.size < deck.cards.length && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        {(['forgotten', 'fuzzy', 'remembered'] as const).map((rating) => {
                          const isActive = currentCardStatus === rating;
                          const isPositive = rating === 'remembered';
                          return (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => confirmCardMastery(rating)}
                              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all"
                              style={{
                                background: isActive
                                  ? isPositive
                                    ? 'var(--memory-collected-glow)'
                                    : 'var(--memory-warm-glow)'
                                  : 'transparent',
                                border: `1px solid ${
                                  isActive
                                    ? isPositive
                                      ? 'var(--memory-collected)'
                                      : 'var(--memory-warm)'
                                    : 'var(--memory-border)'
                                }`,
                                color: isActive
                                  ? isPositive
                                    ? 'var(--memory-collected)'
                                    : 'var(--memory-warm)'
                                  : 'var(--memory-muted)',
                              }}
                            >
                              {isPositive ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <AlertCircle className="h-4 w-4" />
                              )}
                              {MEMORY_REVIEW_LABELS[rating]}
                            </button>
                          );
                        })}
                      </div>
                      {currentReview && (
                        <p className="text-xs" style={{ color: 'var(--memory-muted)' }}>
                          下次复习：
                          {new Date(currentReview.nextReviewAt).toLocaleDateString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Navigation / Completion */}
                  {studiedCards.size >= deck.cards.length ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-4 py-6"
                    >
                      {/* Constellation completion */}
                      <div className="relative flex h-24 w-24 items-center justify-center">
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: 'var(--memory-collected-glow)',
                            filter: 'blur(20px)',
                          }}
                        />
                        <CheckCircle2
                          className="h-12 w-12 relative z-10"
                          style={{ color: 'var(--memory-collected)' }}
                        />
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-bold" style={{ color: 'var(--memory-text)' }}>
                          星座完成！
                        </h3>
                        <p className="text-sm mt-1" style={{ color: 'var(--memory-muted)' }}>
                          {deck.cards.length}/{deck.cards.length} 碎片已收集 — 星座已连成
                        </p>
                      </div>
                      <button
                        onClick={() => router.push('/sky/cloud-mind')}
                        className="celestial-button flex items-center gap-2"
                        style={{
                          borderColor: 'var(--memory-collected)',
                          color: 'var(--memory-collected)',
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        完成收集
                      </button>
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={prevCard}
                        className="flex h-10 w-10 items-center justify-center rounded-full transition-all"
                        style={{
                          background: 'var(--memory-surface)',
                          border: '1px solid var(--memory-border)',
                        }}
                      >
                        <ChevronLeft className="h-5 w-5" style={{ color: 'var(--memory-muted)' }} />
                      </button>
                      <button
                        onClick={nextCard}
                        disabled={!currentCardConfirmed}
                        className="flex h-10 w-10 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          background: 'var(--memory-surface)',
                          border: '1px solid var(--memory-border)',
                        }}
                      >
                        <ChevronRight
                          className="h-5 w-5"
                          style={{ color: 'var(--memory-muted)' }}
                        />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Card List View — 碎片陈列墙 */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deck.cards.map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-2xl p-5 cursor-pointer group transition-all duration-300"
                      style={{
                        background: 'var(--memory-surface)',
                        border: '1px solid var(--memory-border)',
                        animation: `float-card ${3 + (i % 3) * 0.5}s ease-in-out infinite`,
                        animationDelay: `${i * 0.2}s`,
                      }}
                      onClick={() => {
                        setCurrentCard(i);
                        setStudyMode(true);
                        setFlipped(false);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.borderColor = 'var(--memory-border-strong)';
                        e.currentTarget.style.boxShadow = '0 0 20px var(--memory-glow)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'var(--memory-border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm ${difficultyStar[card.difficulty]}`}>★</span>
                          <span
                            className="text-[10px] font-medium"
                            style={{ color: 'var(--memory-muted)' }}
                          >
                            {difficultyLabels[card.difficulty]}
                          </span>
                        </div>
                        <span
                          className="text-xs font-mono"
                          style={{ color: 'var(--memory-muted)' }}
                        >
                          #{String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <p
                        className="text-sm font-semibold mb-2 line-clamp-2"
                        style={{ color: 'var(--memory-text)' }}
                      >
                        <InlineMath text={card.front} />
                      </p>
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--memory-muted)' }}>
                        <InlineMath text={card.back} />
                      </p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {card.tags.slice(0, 3).map((tag, j) => (
                          <span
                            key={j}
                            className="text-[10px] rounded px-1.5 py-0.5"
                            style={{
                              background: 'rgba(251, 113, 133, 0.06)',
                              border: '1px solid var(--memory-border)',
                              color: 'var(--memory-primary)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {card.tags.length > 3 && (
                          <span className="text-[10px]" style={{ color: 'var(--memory-muted)' }}>
                            +{card.tags.length - 3}
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-3 pt-3 flex items-center gap-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          borderTop: '1px solid var(--memory-border)',
                          color: 'var(--memory-primary)',
                        }}
                      >
                        <BookOpen className="h-3 w-3" />
                        点击收集此碎片
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Study Tips — 学习建议星云 */}
              {deck.studyTips && (
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background: 'rgba(251, 191, 36, 0.04)',
                    border: '1px solid rgba(251, 191, 36, 0.15)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-semibold text-amber-300">学习建议星云</span>
                  </div>
                  <p
                    className="text-sm whitespace-pre-wrap"
                    style={{ color: 'var(--memory-muted)' }}
                  >
                    <InlineMath text={deck.studyTips} />
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-amber-400/60" />
                    <span className="text-xs" style={{ color: 'var(--memory-muted)' }}>
                      推荐复习间隔：{deck.reviewIntervals?.join('、')} 天后
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Mistake Picker Panel — 异常信号归档 ──────────────────────────────

const causeColors: Record<MistakeCause, string> = {
  'concept-unclear': 'bg-purple-900/30 text-purple-300 border border-purple-500/20',
  'calculation-error': 'bg-orange-900/30 text-orange-300 border border-orange-500/20',
  misreading: 'bg-sky-900/30 text-sky-300 border border-sky-500/20',
  'method-wrong': 'bg-red-900/30 text-red-300 border border-red-500/20',
  careless: 'bg-yellow-900/30 text-yellow-300 border border-yellow-500/20',
  'format-error': 'bg-slate-700/30 text-slate-300 border border-slate-500/20',
};

const pickerCauseLabels: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  misreading: '审题错误',
  'method-wrong': '方法错误',
  careless: '粗心',
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
      className="mb-4 rounded-2xl overflow-hidden"
      style={{ background: 'var(--memory-surface)', border: '1px solid var(--memory-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--memory-border)' }}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[var(--memory-primary)]" />
          <span className="text-sm font-semibold" style={{ color: 'var(--memory-text)' }}>
            选择错题生成碎片
          </span>
          <span className="text-xs" style={{ color: 'var(--memory-muted)' }}>
            共 {mistakes.length} 条
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg transition-colors"
          style={{ color: 'var(--memory-muted)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto">
        {mistakes.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--memory-muted)' }}>
            暂无错题记录，先去做些练习吧
          </div>
        ) : (
          mistakes.map((m, i) => (
            <button
              key={`${m.id}-${i}`}
              onClick={() => onSelect(m)}
              className="w-full text-left px-4 py-3 transition-colors group"
              style={{ borderBottom: '1px solid var(--memory-border)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(251, 113, 133, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <p
                className="text-sm font-medium line-clamp-2 leading-relaxed"
                style={{ color: 'var(--memory-text)' }}
              >
                {m.problem}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-rose-400">我的答案：{m.userAnswer}</span>
                <span className="text-emerald-400">正确答案：{m.correctAnswer}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${causeColors[m.cause]}`}
                >
                  {pickerCauseLabels[m.cause]}
                </span>
                {m.knowledgePoints.map((kp) => (
                  <span
                    key={kp}
                    className="inline-block rounded px-2 py-0.5 text-[10px]"
                    style={{
                      background: 'rgba(251, 113, 133, 0.08)',
                      color: 'var(--memory-primary)',
                    }}
                  >
                    {kp}
                  </span>
                ))}
              </div>
              <div
                className="mt-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--memory-primary)' }}
              >
                点击选择此错题
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
}
