'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { cn } from '@/lib/utils';

type ReviewItem = {
  id: string;
  problemText: string;
  userAnswer?: string;
  correctAnswer?: string;
  errorType?: string;
  knowledgePoints?: string[];
  reviewCount: number;
  nextReview?: number;
  masteryLevel: number;
  reviewed: boolean;
};

type UpcomingDay = {
  date: string;
  dayLabel: string;
  count: number;
};

type ReviewProgress = {
  totalCount?: number;
  masteredCount?: number;
  percentComplete?: number;
  completedRounds?: number;
  totalRounds?: number;
};

type ReviewPlanData = {
  dueToday: ReviewItem[];
  dueCount: number;
  upcoming: UpcomingDay[];
  overdue: number;
  completed: number;
  total: number;
  progress?: ReviewProgress;
};

const emptyPlan: ReviewPlanData = {
  dueToday: [],
  dueCount: 0,
  upcoming: [],
  overdue: 0,
  completed: 0,
  total: 0,
};

function normalizePlan(payload: unknown): ReviewPlanData {
  const root = (payload ?? {}) as { data?: Partial<ReviewPlanData> } & Partial<ReviewPlanData>;
  const raw = root.data ?? root;
  const dueToday = Array.isArray(raw.dueToday) ? raw.dueToday : [];
  const upcoming = Array.isArray(raw.upcoming) ? raw.upcoming : [];

  return {
    dueToday,
    dueCount: Number(raw.dueCount ?? dueToday.length ?? 0),
    upcoming,
    overdue: Number(raw.overdue ?? 0),
    completed: Number(raw.completed ?? 0),
    total: Number(raw.total ?? dueToday.length ?? 0),
    progress: raw.progress,
  };
}

function formatReviewRound(count: number) {
  return `第 ${Math.max(1, count + 1)} 轮`;
}

function knowledgeTone(index: number) {
  return index % 2 === 0
    ? 'border-cyan-300/18 bg-cyan-300/10 text-cyan-100'
    : 'border-emerald-300/18 bg-emerald-300/10 text-emerald-100';
}

export default function MobileReviewPlanPage() {
  const [plan, setPlan] = useState<ReviewPlanData>(emptyPlan);
  const [activeItems, setActiveItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/sky/review/due', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('复习计划加载失败');
      }

      const nextPlan = normalizePlan(await response.json());
      setPlan(nextPlan);
      setActiveItems(nextPlan.dueToday);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '复习计划加载失败');
      setPlan(emptyPlan);
      setActiveItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const summary = useMemo(() => {
    const dueCount = activeItems.length;
    const percentComplete = plan.progress?.percentComplete ?? 0;
    const total = plan.total || plan.progress?.totalCount || dueCount;
    const completed = plan.completed || plan.progress?.masteredCount || 0;

    return { dueCount, percentComplete, total, completed };
  }, [activeItems.length, plan]);

  const markReview = useCallback(async (itemId: string, correct: boolean) => {
    const actionKey = `${itemId}:${correct ? 'correct' : 'retry'}`;
    setPendingAction(actionKey);
    setNotice(null);

    try {
      const response = await fetch('/api/sky/mistakes', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, correct }),
      });

      if (!response.ok) {
        throw new Error('记录失败');
      }

      setActiveItems((items) => items.filter((item) => item.id !== itemId));
      setPlan((current) => ({
        ...current,
        dueCount: Math.max(0, current.dueCount - 1),
        completed: correct ? current.completed + 1 : current.completed,
      }));
      setNotice(correct ? '已记录掌握，下一轮会自动延后' : '已记录需要巩固，系统会重新安排复习');
    } catch {
      setNotice('记录失败，请稍后再试');
    } finally {
      setPendingAction(null);
    }
  }, []);

  return (
    <MobileSkyShell fullBleed>
      <div className="space-y-3 px-4 pb-24">
        <header className="flex items-center gap-2.5">
          <Link
            href="/m/sky/learning/profile"
            aria-label="返回学习画像"
            className="flex size-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.06] text-slate-100 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-cyan-200/80">记忆曲线任务</div>
            <h1 className="truncate text-[22px] font-extrabold leading-tight text-white">
              到期复习
            </h1>
          </div>
          <span className="flex h-11 items-center gap-1.5 rounded-[16px] border border-emerald-300/15 bg-emerald-300/10 px-3 text-[12px] font-bold text-emerald-100">
            <Clock3 className="size-4" />
            今日
          </span>
        </header>

        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#101a2b] p-4 shadow-xl shadow-slate-950/25">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-slate-400">优先把快遗忘的题拉回来</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-[46px] font-black leading-none text-white">
                  {loading ? '-' : summary.dueCount}
                </span>
                <span className="pb-1.5 text-[13px] font-bold text-slate-300">道待处理</span>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-slate-400">
                系统按错题复习轮次和下次复习时间排序，先处理逾期内容，再安排未来计划。
              </p>
            </div>
            <div className="flex size-14 shrink-0 items-center justify-center rounded-[20px] bg-cyan-300/12 text-cyan-100 ring-1 ring-cyan-200/20">
              <BookOpenCheck className="size-7" />
            </div>
          </div>
        </section>

        <section aria-label="复习概览" className="grid grid-cols-3 gap-2">
          <MetricCard label="今日待复习" value={loading ? '-' : summary.dueCount} tone="cyan" />
          <MetricCard label="逾期" value={loading ? '-' : plan.overdue} tone="amber" />
          <MetricCard label="掌握进度" value={loading ? '-' : `${summary.percentComplete}%`} tone="emerald" />
        </section>

        {notice && (
          <div
            role="status"
            className="rounded-[16px] border border-white/10 bg-white/[0.06] px-3.5 py-3 text-[13px] font-semibold text-slate-100"
          >
            {notice}
          </div>
        )}

        {loading && <LoadingState />}

        {!loading && errorMsg && (
          <section className="rounded-[20px] border border-rose-300/20 bg-rose-400/10 p-4">
            <h2 className="text-[16px] font-extrabold text-white">计划加载失败</h2>
            <p className="mt-1 text-[12px] leading-5 text-rose-100/75">{errorMsg}</p>
            <button
              type="button"
              onClick={loadPlan}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-[15px] bg-rose-300/18 text-[13px] font-extrabold text-rose-50 active:scale-[0.99]"
            >
              重新加载
            </button>
          </section>
        )}

        {!loading && !errorMsg && activeItems.length === 0 && (
          <section className="rounded-[22px] border border-white/10 bg-[#101a2b] p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[18px] bg-emerald-300/12 text-emerald-100">
                <CheckCircle2 className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[17px] font-extrabold text-white">今天没有到期复习</h2>
                <p className="mt-1 text-[12px] leading-5 text-slate-400">
                  可以继续拍题练习，新的错题会自动进入下一轮复习计划。
                </p>
              </div>
            </div>
            <Link
              href="/m/sky/cloud-mind/solve"
              className="mt-4 flex h-11 items-center justify-center gap-2 rounded-[15px] bg-[#4f7cff] text-[13px] font-extrabold text-white shadow-lg shadow-blue-950/30 active:scale-[0.99]"
            >
              去练一题
              <ChevronRight className="size-4" />
            </Link>
          </section>
        )}

        {!loading && !errorMsg && activeItems.length > 0 && (
          <section className="space-y-2.5" aria-label="到期题目">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold text-white">复习队列</h2>
              <span className="text-[12px] font-semibold text-slate-400">
                {summary.completed}/{summary.total} 已完成
              </span>
            </div>
            {activeItems.map((item) => (
              <article
                key={item.id}
                className="rounded-[20px] border border-white/10 bg-[#101a2b] p-3.5 shadow-lg shadow-slate-950/18"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-amber-300/18 bg-amber-300/10 px-2 py-1 text-[12px] font-bold text-amber-100">
                        {formatReviewRound(item.reviewCount)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-1 text-[12px] font-semibold text-slate-300">
                        掌握 {item.masteryLevel}/6
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-[15px] font-extrabold leading-6 text-white">
                      {item.problemText}
                    </h3>
                  </div>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[15px] bg-cyan-300/10 text-cyan-100">
                    <Target className="size-5" />
                  </span>
                </div>

                {item.knowledgePoints && item.knowledgePoints.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.knowledgePoints.slice(0, 3).map((point, index) => (
                      <span
                        key={`${item.id}-${point}`}
                        className={cn(
                          'rounded-full border px-2 py-1 text-[12px] font-semibold',
                          knowledgeTone(index),
                        )}
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <AnswerBlock label="我的答案" value={item.userAnswer || '未记录'} />
                  <AnswerBlock label="正确答案" value={item.correctAnswer || '待补全'} strong />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href={`/m/sky/cloud-mind/quiz?topic=${encodeURIComponent(
                      item.knowledgePoints?.[0] ?? item.problemText,
                    )}`}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-[15px] bg-cyan-300/12 px-3 text-[13px] font-extrabold text-cyan-50 ring-1 ring-cyan-200/15 active:scale-[0.99]"
                  >
                    同类练习
                    <ChevronRight className="size-4" />
                  </Link>
                  <Link
                    href={`/m/sky/cloud-mind/memory?topic=${encodeURIComponent(
                      item.knowledgePoints?.[0] ?? item.problemText,
                    )}&content=${encodeURIComponent(item.problemText)}`}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-[15px] bg-violet-300/12 px-3 text-[13px] font-extrabold text-violet-50 ring-1 ring-violet-200/15 active:scale-[0.99]"
                  >
                    生成记忆卡
                    <ChevronRight className="size-4" />
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => markReview(item.id, true)}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-[15px] bg-emerald-400/18 px-3 text-[13px] font-extrabold text-emerald-50 ring-1 ring-emerald-300/20 active:scale-[0.99] disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-4" />
                    {pendingAction === `${item.id}:correct` ? '记录中' : '已掌握'}
                  </button>
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => markReview(item.id, false)}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-[15px] bg-white/[0.07] px-3 text-[13px] font-extrabold text-slate-100 ring-1 ring-white/10 active:scale-[0.99] disabled:opacity-50"
                  >
                    <RotateCcw className="size-4" />
                    {pendingAction === `${item.id}:retry` ? '记录中' : '还需巩固'}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        {!loading && plan.upcoming.length > 0 && (
          <section className="space-y-2.5" aria-label="未来复习安排">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold text-white">未来复习</h2>
              <CalendarClock className="size-5 text-slate-400" />
            </div>
            <div className="space-y-2">
              {plan.upcoming.slice(0, 4).map((day) => (
                <div
                  key={day.date}
                  className="flex min-h-12 items-center justify-between rounded-[17px] border border-white/10 bg-white/[0.055] px-3.5"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-extrabold text-white">{day.dayLabel}</div>
                    <div className="text-[12px] font-semibold text-slate-400">{day.date}</div>
                  </div>
                  <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[12px] font-bold text-cyan-100">
                    {day.count} 题
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[18px] border border-white/10 bg-[#0d1728] p-3.5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[15px] bg-violet-300/12 text-violet-100">
              <Sparkles className="size-5" />
            </span>
            <p className="text-[12px] leading-5 text-slate-400">
              完成一轮复习后，系统会按 1、2、4、7、15、30 天间隔继续安排，直到该错题进入稳定掌握。
            </p>
          </div>
        </section>
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'cyan' | 'amber' | 'emerald';
}) {
  const toneClass = {
    cyan: 'text-cyan-100 bg-cyan-300/10 border-cyan-300/16',
    amber: 'text-amber-100 bg-amber-300/10 border-amber-300/16',
    emerald: 'text-emerald-100 bg-emerald-300/10 border-emerald-300/16',
  }[tone];

  return (
    <div className={cn('rounded-[18px] border p-3', toneClass)}>
      <div className="text-[12px] font-bold text-slate-300">{label}</div>
      <div className="mt-1 text-[22px] font-black leading-none text-white">{value}</div>
    </div>
  );
}

function AnswerBlock({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-h-[58px] rounded-[15px] border border-white/10 bg-white/[0.045] p-2.5">
      <div className="text-[12px] font-bold text-slate-500">{label}</div>
      <div
        className={cn(
          'mt-1 line-clamp-2 text-[12px] font-semibold leading-5',
          strong ? 'text-emerald-100' : 'text-slate-200',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="space-y-2.5" aria-label="正在加载复习计划">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-[148px] animate-pulse rounded-[20px] border border-white/8 bg-white/[0.05]"
        />
      ))}
    </section>
  );
}
