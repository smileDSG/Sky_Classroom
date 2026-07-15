'use client';

import { useMemo, useRef, useState } from 'react';
import { BookOpen, Lightbulb, RefreshCw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudyQuote {
  text: string;
  author: string;
}

interface MobileStudyCompanionCarouselProps {
  quote: StudyQuote;
  facts: string[];
  initialFactIndex?: number;
  tip?: string;
  className?: string;
}

const defaultTip = '每天回顾昨天的内容，记忆更牢固';

export function MobileStudyCompanionCarousel({
  quote,
  facts,
  initialFactIndex = 0,
  tip = defaultTip,
  className,
}: MobileStudyCompanionCarouselProps) {
  const safeFacts = useMemo(() => (facts.length > 0 ? facts : ['今天适合复盘一小步']), [facts]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [factIndex, setFactIndex] = useState(() => initialFactIndex % safeFacts.length);
  const touchStartX = useRef<number | null>(null);
  const fact = safeFacts[factIndex % safeFacts.length];

  const slides = [
    {
      key: 'quote',
      label: '每日一句',
      controlLabel: '查看每日一句',
      icon: BookOpen,
      iconClassName: 'text-sky-400',
      glowClassName: 'bg-sky-400/10',
      content: (
        <>
          <div className="absolute -left-1 -top-3 select-none font-serif text-6xl leading-none text-sky-400/10">
            &ldquo;
          </div>
          <p className="relative mt-2 line-clamp-2 text-[13px] font-semibold italic leading-relaxed text-slate-100">
            “{quote.text}”
          </p>
          <p className="relative mt-1 text-right text-[12px] text-slate-400">—— {quote.author}</p>
        </>
      ),
    },
    {
      key: 'fact',
      label: '趣味知识',
      controlLabel: '查看趣味知识',
      icon: Lightbulb,
      iconClassName: 'text-amber-400',
      glowClassName: 'bg-amber-400/10',
      action: (
        <button
          type="button"
          aria-label="刷新趣味知识"
          onClick={() => setFactIndex((current) => (current + 1) % safeFacts.length)}
          className="mobile-tactile-button flex size-8 items-center justify-center rounded-full text-slate-500 transition-all active:scale-[0.94] active:bg-white/10 active:text-amber-300"
        >
          <RefreshCw className="size-3.5" />
        </button>
      ),
      content: (
        <p className="relative mt-2 line-clamp-3 text-[13px] leading-relaxed text-slate-100">
          {fact}
        </p>
      ),
    },
    {
      key: 'tip',
      label: '学习提示',
      controlLabel: '查看学习提示',
      icon: Star,
      iconClassName: 'text-rose-400',
      glowClassName: 'bg-rose-400/10',
      content: (
        <p className="relative mt-2 line-clamp-3 text-[13px] leading-relaxed text-slate-100">
          {tip}
        </p>
      ),
    },
  ];

  function showSlide(nextIndex: number) {
    setActiveIndex((nextIndex + slides.length) % slides.length);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX;
    if (typeof endX !== 'number') return;

    const deltaX = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 36) return;
    showSlide(activeIndex + (deltaX < 0 ? 1 : -1));
  }

  return (
    <section className={cn('space-y-1.5', className)}>
      <div
        role="region"
        aria-label="学习补给轮播"
        aria-roledescription="carousel"
        className="overflow-hidden rounded-[16px]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          data-testid="study-companion-track"
          className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {slides.map((slide, index) => {
            const Icon = slide.icon;
            return (
              <article
                key={slide.key}
                aria-hidden={activeIndex !== index}
                aria-label={slide.label}
                aria-live={activeIndex === index ? 'polite' : undefined}
                className="mobile-tactile-card relative min-h-[120px] w-full shrink-0 overflow-hidden rounded-[16px] border border-white/10 bg-white/8 p-3"
              >
                <div
                  className={cn(
                    'pointer-events-none absolute -right-8 -top-8 size-24 rounded-full blur-xl',
                    slide.glowClassName,
                  )}
                />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[12px] font-medium text-slate-400">
                    <span className="flex size-7 items-center justify-center rounded-xl bg-slate-700/70">
                      <Icon className={cn('size-3.5', slide.iconClassName)} />
                    </span>
                    {slide.label}
                  </span>
                  {slide.action}
                </div>
                {slide.content}
              </article>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-1" aria-label="学习补给轮播分页">
        {slides.map((slide, index) => {
          const isActive = activeIndex === index;
          return (
            <button
              key={slide.key}
              type="button"
              aria-label={slide.controlLabel}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => showSlide(index)}
              className="flex size-7 items-center justify-center rounded-full transition-all active:scale-[0.92]"
            >
              <span
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  isActive ? 'w-5 bg-sky-300' : 'w-1.5 bg-slate-600/80',
                )}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
