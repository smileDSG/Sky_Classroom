'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpenCheck, CalendarClock, Loader2 } from 'lucide-react';
import type { DailyReviewPath } from '@/lib/sky/daily-review-path';
import { cn } from '@/lib/utils';

/**
 * Compact, self-contained "mistake review" card that pulls today's review path
 * from the workshop API. Safe to drop into any entry surface (overview, today
 * plan, learning path) without wiring extra data flow.
 */

interface ReviewPathPayload {
  success?: boolean;
  dailyReviewPath?: DailyReviewPath;
  error?: string;
}

export function MistakeReviewStrip({ className }: { className?: string }) {
  const [path, setPath] = useState<DailyReviewPath | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sky/workshop', { credentials: 'include' });
      const payload = (await response.json().catch(() => null)) as ReviewPathPayload | null;
      if (response.ok && payload?.success && payload.dailyReviewPath) {
        setPath(payload.dailyReviewPath);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div
        className={cn(
          'flex min-h-[88px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-[#081423] dark:text-slate-400',
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-sky-600 dark:text-sky-300" />
        正在读取今日错题复习…
      </div>
    );
  }

  const summary = path?.summary;
  const totalDue = summary?.totalDue ?? 0;
  const todayCount = path?.today.count ?? 0;
  const overdue = summary?.overdueCount ?? 0;

  return (
    <section
      aria-label="今日错题复习"
      className={cn(
        'overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-[#081423]',
        totalDue > 0
          ? 'border-sky-200 dark:border-sky-200/25'
          : 'border-sky-200 dark:border-sky-200/15',
        className,
      )}
    >
      <div className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                totalDue > 0
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-300/15 dark:text-sky-100'
                  : 'bg-sky-100 text-sky-700 dark:bg-sky-300/15 dark:text-sky-100',
              )}
            >
              <BookOpenCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                错题复习
                {totalDue > 0 && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-200/25 dark:bg-sky-300/10 dark:text-sky-100">
                    今日 {todayCount} 道
                  </span>
                )}
                {overdue > 0 && (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-200/25 dark:bg-rose-300/10 dark:text-rose-100">
                    {overdue} 道逾期
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {totalDue > 0
                  ? `按遗忘曲线，今天需要回看 ${todayCount} 道错题，约 ${summary?.estimatedMinutes ?? todayCount * 3} 分钟。`
                  : path
                    ? '今日无待复习错题，可以去做一组新题巩固薄弱点。'
                    : '完成一次练习后，系统会把错题排进复习节奏。'}
              </p>
              {totalDue > 0 && path && path.today.items.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {path.today.items.slice(0, 3).map((item) => (
                    <span
                      key={item.mistakeId}
                      className="truncate max-w-52 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                      title={item.problem}
                    >
                      {item.problem}
                    </span>
                  ))}
                  {path.today.items.length > 3 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400 dark:bg-white/[0.05] dark:text-slate-500">
                      +{path.today.items.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <Link
            href="/sky/cloud-mind/memory"
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-colors sm:min-w-40',
              totalDue > 0
                ? 'bg-sky-600 hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200'
                : 'bg-sky-600 hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200',
            )}
          >
            <CalendarClock className="h-4 w-4" />
            {totalDue > 0 ? '开始今日复习' : '查看复习计划'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
