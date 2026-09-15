'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOUR_STEPS, isTourSeen, markTourSeen } from '@/lib/sky/tour';

const TOOLTIP_GAP = 12;
const TOOLTIP_EST_HEIGHT = 200;

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (isTourSeen()) return;
    setActive(true);
  }, []);

  const measure = useCallback(() => {
    const step = TOUR_STEPS[stepIndex];
    const target = step
      ? document.querySelector<HTMLElement>(`[data-tour-step="${step.id}"]`)
      : null;
    setRect(target ? target.getBoundingClientRect() : null);
  }, [stepIndex]);

  useEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [active, measure]);

  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIndex];
    const target = document.querySelector<HTMLElement>(`[data-tour-step="${step.id}"]`);
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const timer = window.setTimeout(measure, 450);
    return () => window.clearTimeout(timer);
  }, [active, stepIndex, measure]);

  function finish() {
    markTourSeen();
    setActive(false);
  }

  function goTo(index: number) {
    setStepIndex(Math.max(0, Math.min(TOUR_STEPS.length - 1, index)));
  }

  if (!active || !rect) return null;

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const viewportWidth = window.innerWidth;
  const tooltipWidth = Math.min(360, viewportWidth - 24);
  const placeBelow = rect.bottom + TOOLTIP_GAP + TOOLTIP_EST_HEIGHT <= window.innerHeight;
  const tooltipLeft = Math.max(
    12,
    Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, viewportWidth - tooltipWidth - 12),
  );
  const tooltipTop = placeBelow
    ? rect.bottom + TOOLTIP_GAP
    : Math.max(12, rect.top - TOOLTIP_GAP - TOOLTIP_EST_HEIGHT);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[70] rounded-xl transition-all duration-300"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.55)',
        }}
      />
      <div
        role="dialog"
        aria-label={step.title}
        className="fixed z-[71]"
        style={{ top: tooltipTop, left: tooltipLeft, width: tooltipWidth }}
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">{step.title}</h3>
            <button
              type="button"
              onClick={finish}
              aria-label="关闭引导"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`第 ${i + 1} 步`}
                  aria-current={i === stepIndex ? 'step' : undefined}
                  className={cn(
                    'h-2 rounded-full transition-all',
                    i === stepIndex
                      ? 'w-6 bg-sky-600 dark:bg-sky-300'
                      : 'w-2 bg-slate-300 hover:bg-slate-400 dark:bg-white/20',
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={finish}
                className="inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06]"
              >
                跳过
              </button>
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => goTo(stepIndex - 1)}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  上一步
                </button>
              )}
              <button
                type="button"
                onClick={() => (isLast ? finish() : goTo(stepIndex + 1))}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200"
              >
                {isLast ? '完成' : '下一步'}
                {!isLast && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
