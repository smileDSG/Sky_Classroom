'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Brain, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/shell/mobile-sky-shell';
import { cn } from '@/lib/utils';

interface WeakPoint {
  knowledgePoint: string;
}

interface PersonalizationPayload {
  weakPoints?: WeakPoint[];
}

interface MemoryCard {
  id: string;
  front: string;
  back: string;
}

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, string>>({});
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

    return () => {
      cancelled = true;
    };
  }, []);

  const advancedHref = useMemo(() => {
    const params = new URLSearchParams();
    if (topic.trim()) params.set('topic', topic.trim());
    if (content.trim()) params.set('content', content.trim());
    const query = params.toString();
    return `/sky/cloud-mind/memory${query ? `?${query}` : ''}`;
  }, [content, topic]);

  const currentCard = cards[currentIndex] ?? { id: 'empty', front: '', back: '' };

  const generatePreview = () => {
    const safeTopic = topic.trim() || '综合复习';
    const safeContent = content.trim() || `围绕${safeTopic}整理概念、例题和易错点。`;
    setCards([
      {
        id: 'concept',
        front: safeTopic,
        back: `${safeContent}\n\n先说清概念，再用一道错题验证。`,
      },
      {
        id: 'mistake',
        front: `${safeTopic}最容易错在哪里？`,
        back: '先检查题干条件，再写出关键公式，最后回看单位和符号。',
      },
    ]);
    setCurrentIndex(0);
    setFlipped(false);
    setRatings({});
  };

  const rateCurrent = (rating: string) => {
    if (cards.length === 0) return;
    setRatings((prev) => ({ ...prev, [currentCard.id]: rating }));
    setFlipped(false);
    setCurrentIndex((prev) => Math.min(prev + 1, cards.length - 1));
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
              <h1 className="text-[24px] font-extrabold leading-none text-slate-900 dark:text-white">记忆卡片</h1>
              <p className="mt-1 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                把薄弱点变成可以反复复习的闪卡。
              </p>
            </div>
          </div>
        </section>

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

            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onClick={generatePreview}
                className="flex h-11 items-center justify-center gap-2 rounded-[13px] bg-rose-500 text-[13px] font-extrabold text-white active:bg-rose-400"
              >
                <Sparkles className="size-4" />
                生成复习卡
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
            <button
              type="button"
              aria-label="翻转记忆卡片"
              onClick={() => setFlipped((value) => !value)}
              className="min-h-[260px] w-full rounded-[22px] border border-rose-200/40 bg-white p-5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-rose-200/18 dark:bg-[#0d1728] dark:shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <div className="mb-4 flex items-center justify-between text-[12px] font-bold text-slate-500 dark:text-slate-400">
                <span>
                  {currentIndex + 1}/{cards.length}
                </span>
                <span>{flipped ? '答案' : '点击卡片查看答案'}</span>
              </div>
              <div
                className={cn(
                  'whitespace-pre-line text-[22px] font-extrabold leading-8 text-slate-900 dark:text-white',
                  flipped && 'text-rose-600 dark:text-rose-50',
                )}
              >
                {flipped ? currentCard.back : currentCard.front}
              </div>
            </button>

            <div className="grid grid-cols-3 gap-2">
              {[
                ['again', '还不会'],
                ['hard', '模糊'],
                ['easy', '掌握了'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => rateCurrent(value)}
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
                onClick={() => setCards([])}
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
