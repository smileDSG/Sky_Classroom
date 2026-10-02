'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Brain,
  CalendarClock,
  CheckCircle2,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/shell/mobile-sky-shell';
import { cn } from '@/lib/utils';
import { InlineMath } from '@/components/ui/inline-math';
import type {
  MemoryCardDeck,
  MemoryCardsStreamEvent,
} from '@/lib/agents/cloud-mind/memory-cards-agent';
import {
  buildMemoryCardId,
  buildMemoryDeckId,
  scheduleMemoryReview,
} from '@/lib/cloud-mind/spaced-repetition';
import type { MemoryReviewRating, MemoryReviewRecord } from '@/lib/cloud-mind/types';

interface WeakPoint {
  knowledgePoint: string;
}

interface PersonalizationPayload {
  weakPoints?: WeakPoint[];
}

type MemoryCard = MemoryCardDeck['cards'][number];

const MOBILE_CARD_COUNT = 8;

export default function MobileMemoryPage() {
  return (
    <Suspense
      fallback={
        <MobileSkyShell backHref="/m/sky/cloud-mind" title="记忆卡片">
          <div className="flex min-h-[60dvh] items-center justify-center text-sm font-semibold text-slate-400">
            加载记忆卡片...
          </div>
        </MobileSkyShell>
      }
    >
      <MobileMemoryContent />
    </Suspense>
  );
}

function MobileMemoryContent() {
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState(searchParams.get('topic') ?? '');
  const [content, setContent] = useState(searchParams.get('content') ?? '');
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [deckTopic, setDeckTopic] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const [dueReviews, setDueReviews] = useState<MemoryReviewRecord[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/sky/cloud-mind/personalization-context', { credentials: 'include' })
      .then((response) => response.json())
      .then((json: { success?: boolean; data?: PersonalizationPayload }) => {
        if (cancelled) return;
        const points =
          json.data?.weakPoints?.map((item) => item.knowledgePoint).filter(Boolean) ?? [];
        setWeakPoints(points.slice(0, 5));
        setTopic((current) => current || points[0] || '');
      })
      .catch(() => {
        if (!cancelled) setWeakPoints([]);
      });

    fetch('/api/sky/cloud-mind/memory-due', { credentials: 'include' })
      .then((response) => response.json())
      .then((json: { success?: boolean; data?: MemoryReviewRecord[] }) => {
        if (cancelled || !json.success || !Array.isArray(json.data)) return;
        setDueReviews(json.data);
      })
      .catch(() => {
        /* due reviews are optional */
      });

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  const advancedHref = useMemo(() => {
    const params = new URLSearchParams();
    if (topic.trim()) params.set('topic', topic.trim());
    if (content.trim()) params.set('content', content.trim());
    const query = params.toString();
    return `/sky/cloud-mind/memory${query ? `?${query}` : ''}`;
  }, [content, topic]);

  const currentCard = cards[currentIndex] ?? null;

  const resetDeck = () => {
    abortRef.current?.abort();
    setCards([]);
    setCurrentIndex(0);
    setFlipped(false);
    setRatings({});
    setGenError(null);
    setPartialWarning(null);
  };

  const applyCards = (incoming: MemoryCard[]) => {
    setCards((prev) => {
      const merged = [...prev];
      for (const card of incoming) {
        const existingIndex = merged.findIndex((item) => item.index === card.index);
        if (existingIndex === -1) merged.push(card);
        else merged[existingIndex] = card;
      }
      return merged;
    });
    setDeckTopic((current) => current || topic.trim() || incoming[0]?.front?.slice(0, 12) || '');
  };

  const handleGenerate = async () => {
    if (!topic.trim() && !content.trim()) {
      setGenError('请输入知识点或复习内容');
      return;
    }
    abortRef.current?.abort();
    setGenerating(true);
    setGenError(null);
    setPartialWarning(null);
    setCards([]);
    setDeckTopic('');
    setCurrentIndex(0);
    setFlipped(false);
    setRatings({});

    const safeContent =
      content.trim() || `围绕${topic.trim()}整理概念、例题和易错点。`;

    try {
      const abortController = new AbortController();
      abortRef.current = abortController;
      const res = await fetch('/api/sky/cloud-mind/memory-cards/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: safeContent,
          topic: topic.trim() || undefined,
          cardCount: MOBILE_CARD_COUNT,
        }),
        credentials: 'include',
        signal: abortController.signal,
      });

      const contentType = res.headers.get('content-type') ?? '';
      if (res.ok && contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('浏览器不支持流式响应');
        const decoder = new TextDecoder();
        let buffer = '';
        let accCount = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const event = JSON.parse(line.slice(6)) as MemoryCardsStreamEvent;
            if (event.type === 'cards') {
              accCount += event.cards.length;
              applyCards(event.cards);
            } else if (event.type === 'done') {
              setCards(event.deck.cards);
              setDeckTopic(event.deck.topic || topic.trim() || '');
              return;
            } else if (event.type === 'error') {
              if (accCount > 0) setPartialWarning(event.message || '剩余卡片生成失败');
              else setGenError(event.message || '生成失败，请重试');
              return;
            }
          }
        }
        if (accCount === 0) setGenError('生成未返回卡片，请重试');
      } else {
        const json = await res.json();
        if (!json.success) throw new Error(json.error || '生成失败');
        setCards(json.data.cards);
        setDeckTopic(json.data.topic || topic.trim() || '');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setGenError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const startDueReview = () => {
    if (dueReviews.length === 0) return;
    const dueTopics = Array.from(
      new Set(dueReviews.flatMap((review) => review.tags ?? []).filter(Boolean)),
    );
    const dueCards: MemoryCard[] = dueReviews.map((review, index) => ({
      index: index + 1,
      front: review.front || `回忆这张卡片的核心知识：${review.tags?.[0] ?? '学习内容'}`,
      back: review.back || '请根据上次学习内容主动回忆，再标记本次记忆状态。',
      relatedConcepts: review.tags ?? [],
      difficulty: review.mastery < 45 ? 'hard' : review.mastery < 75 ? 'medium' : 'easy',
      tags: review.tags ?? [],
    }));
    setCards(dueCards);
    setDeckTopic(dueTopics.slice(0, 3).join('、') || '到期记忆复习');
    setCurrentIndex(0);
    setFlipped(false);
    setRatings({});
    setGenError(null);
    setPartialWarning(null);
  };

  const rateCurrent = async (ratingLabel: 'easy' | 'hard' | 'again') => {
    if (!currentCard) return;
    const rating: MemoryReviewRating =
      ratingLabel === 'easy' ? 'remembered' : ratingLabel === 'hard' ? 'fuzzy' : 'forgotten';
    const cardIndexKey = `${currentCard.index}`;
    setRatings((prev) => ({ ...prev, [cardIndexKey]: ratingLabel }));
    setFlipped(false);
    setCurrentIndex((prev) => Math.min(prev + 1, cards.length - 1));

    const deckId = buildMemoryDeckId(deckTopic, cards.length);
    const cardId = buildMemoryCardId(deckId, currentIndex, currentCard.front);
    const review = scheduleMemoryReview({
      cardId,
      deckId,
      rating,
      sourceType: topic.trim() ? 'manual' : 'memory',
      front: currentCard.front,
      back: currentCard.back,
      tags: currentCard.tags,
    });
    try {
      await fetch('/api/sky/cloud-mind/memory-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review),
        credentials: 'include',
      });
    } catch {
      /* 评分保存失败不影响本地学习流 */
    }
  };

  return (
    <MobileSkyShell backHref="/m/sky/cloud-mind" title="记忆卡片">
      <div className="space-y-3 px-4 pb-24 pt-4">
        <section className="rounded-[22px] border border-rose-200/40 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-rose-200/15 dark:bg-[#0d1728] dark:shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-rose-500 text-white">
              <Brain className="size-5" />
            </span>
            <div>
              <h1 className="text-[24px] font-extrabold leading-none text-slate-900 dark:text-white">
                记忆卡片
              </h1>
              <p className="mt-1 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                把薄弱点变成可以反复复习的闪卡。
              </p>
            </div>
          </div>
        </section>

        {dueReviews.length > 0 && cards.length === 0 && !generating && (
          <section className="rounded-[18px] border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-200/20 dark:bg-amber-300/10">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-amber-800 dark:text-amber-100">
                <CalendarClock className="size-4" />
                今天 {dueReviews.length} 张待复习
              </span>
              <button
                type="button"
                onClick={startDueReview}
                className="rounded-full bg-amber-500 px-3 py-1.5 text-[12px] font-extrabold text-white active:bg-amber-400"
              >
                开始复习
              </button>
            </div>
          </section>
        )}

        {cards.length === 0 ? (
          <section className="rounded-[20px] border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0d1728]">
            <label
              className="block text-[12px] font-extrabold text-slate-600 dark:text-slate-300"
              htmlFor="memory-topic"
            >
              知识点
            </label>
            <input
              id="memory-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              className="mt-2 h-11 w-full rounded-[13px] border border-slate-200 bg-slate-50 px-3 text-[14px] font-semibold text-slate-900 outline-none focus:border-rose-300/40 dark:border-white/10 dark:bg-white/[0.055] dark:text-white"
              placeholder="例如：函数单调性"
            />

            {weakPoints.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {weakPoints.map((point) => (
                  <button
                    key={point}
                    type="button"
                    onClick={() => setTopic(point)}
                    className="min-h-9 rounded-full border border-rose-200/50 bg-rose-50 px-3 text-[12px] font-bold text-rose-700 dark:border-rose-200/15 dark:bg-rose-300/10 dark:text-rose-100"
                  >
                    {point}
                  </button>
                ))}
              </div>
            )}

            <label
              className="mt-4 block text-[12px] font-extrabold text-slate-600 dark:text-slate-300"
              htmlFor="memory-content"
            >
              复习内容
            </label>
            <textarea
              id="memory-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-[13px] border border-slate-200 bg-slate-50 px-3 py-3 text-[14px] font-semibold leading-6 text-slate-900 outline-none focus:border-rose-300/40 dark:border-white/10 dark:bg-white/[0.055] dark:text-white"
              placeholder="粘贴错题、课堂笔记或想复习的知识点。"
            />

            {genError && (
              <div className="mt-3 flex items-start gap-1.5 rounded-[13px] border border-red-200/60 bg-red-50 px-3 py-2.5 text-[12px] font-semibold text-red-700 dark:border-red-200/15 dark:bg-red-300/10 dark:text-red-100">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {genError}
              </div>
            )}

            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="flex h-11 items-center justify-center gap-2 rounded-[13px] bg-rose-500 text-[13px] font-extrabold text-white active:bg-rose-400 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    生成中…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    生成复习卡
                  </>
                )}
              </button>
              <Link
                href={advancedHref}
                className="flex h-11 items-center justify-center rounded-[13px] border border-slate-200 px-3 text-[12px] font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
              >
                高级模式
              </Link>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            {generating && (
              <div className="flex items-center gap-1.5 rounded-[13px] border border-rose-200/50 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700 dark:border-rose-200/15 dark:bg-rose-300/10 dark:text-rose-100">
                <Loader2 className="size-3.5 animate-spin" />
                正在生成剩余卡片，已生成的卡片可立即开始复习…
              </div>
            )}
            {partialWarning && (
              <div className="flex items-start gap-1.5 rounded-[13px] border border-amber-300/60 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-800 dark:border-amber-200/20 dark:bg-amber-300/10 dark:text-amber-100">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {partialWarning}
              </div>
            )}

            {/* Card — 3D flip */}
            <div
              role="button"
              aria-label="翻转记忆卡片"
              onClick={() => setFlipped((value) => !value)}
              className="relative h-[min(58dvh,460px)] min-h-[300px] w-full cursor-pointer [perspective:1200px]"
            >
              <div
                className={cn(
                  'relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]',
                  flipped && '[transform:rotateY(180deg)]',
                )}
              >
                {/* Front */}
                <div className="absolute inset-0 flex flex-col rounded-[22px] border border-rose-200/40 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] [backface-visibility:hidden] dark:border-rose-200/18 dark:bg-[#0d1728] dark:shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="mb-3 flex items-center justify-between text-[12px] font-bold text-slate-500 dark:text-slate-400">
                    <span>
                      {currentIndex + 1}/{cards.length}
                    </span>
                    <span>{flipped ? '答案' : '点击卡片查看答案'}</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <p className="whitespace-pre-line text-[22px] font-extrabold leading-8 text-slate-900 dark:text-white">
                      <InlineMath text={currentCard?.front ?? ''} />
                    </p>
                  </div>
                </div>

                {/* Back */}
                <div className="absolute inset-0 flex flex-col rounded-[22px] border border-rose-300/50 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] [backface-visibility:hidden] [transform:rotateY(180deg)] dark:border-rose-200/25 dark:bg-[#0d1728] dark:shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="mb-3 flex items-center justify-between text-[12px] font-bold text-slate-500 dark:text-slate-400">
                    <span>
                      {currentIndex + 1}/{cards.length}
                    </span>
                    <span>答案</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <p className="whitespace-pre-line text-[18px] font-bold leading-7 text-rose-600 dark:text-rose-50">
                      <InlineMath text={currentCard?.back ?? ''} />
                    </p>
                    {currentCard?.mnemonic && (
                      <div className="mt-3 rounded-[13px] border border-rose-200/50 bg-rose-50 p-3 dark:border-rose-200/15 dark:bg-rose-300/10">
                        <div className="flex items-center gap-1 text-[11px] font-extrabold text-rose-600 dark:text-rose-100">
                          <Lightbulb className="size-3" />
                          记忆提示
                        </div>
                        <p className="mt-1 whitespace-pre-line text-[13px] font-semibold leading-6 text-slate-600 dark:text-slate-300">
                          <InlineMath text={currentCard.mnemonic} />
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                ['again', '还不会'],
                ['hard', '模糊'],
                ['easy', '掌握了'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void rateCurrent(value as 'easy' | 'hard' | 'again')}
                  className="flex h-11 items-center justify-center rounded-[13px] border border-slate-200 bg-white text-[12px] font-extrabold text-slate-700 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-100"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-[15px] border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />
                已记录 {Object.keys(ratings).length} 张
              </span>
              <button
                type="button"
                onClick={resetDeck}
                className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-100"
              >
                <RotateCcw className="size-3.5" />
                重新生成
              </button>
            </div>
          </section>
        )}
      </div>
    </MobileSkyShell>
  );
}
