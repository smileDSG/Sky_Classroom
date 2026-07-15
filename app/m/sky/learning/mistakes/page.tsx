'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import type { MistakeRecord } from '@/lib/mistakes/types';
import type { MistakeCause } from '@/lib/solve/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { cn } from '@/lib/utils';

interface WorkshopMistakeSnapshot extends Omit<MistakeRecord, 'solvedAt' | 'source'> {
  solvedAt: string | number;
  source?: MistakeRecord['source'] | 'classroom-diagnostic';
}

type ReviewFilter = 'all' | 'unreviewed' | 'reviewed';

const MOBILE_MISTAKES_PAGE_SIZE = 5;

const causeOptions: Array<{ value: MistakeCause | 'all'; label: string }> = [
  { value: 'all', label: '全部错因' },
  { value: 'concept-unclear', label: '概念不清' },
  { value: 'calculation-error', label: '计算失误' },
  { value: 'misreading', label: '审题错误' },
  { value: 'method-wrong', label: '方法错误' },
  { value: 'careless', label: '粗心' },
  { value: 'format-error', label: '格式错误' },
];

const causeLabels: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  misreading: '审题错误',
  'method-wrong': '方法错误',
  careless: '粗心',
  'format-error': '格式错误',
};

const causeTone: Record<MistakeCause, string> = {
  'concept-unclear': 'border-violet-300/18 bg-violet-300/10 text-violet-100',
  'calculation-error': 'border-amber-300/18 bg-amber-300/10 text-amber-100',
  misreading: 'border-cyan-300/18 bg-cyan-300/10 text-cyan-100',
  'method-wrong': 'border-rose-300/18 bg-rose-300/10 text-rose-100',
  careless: 'border-yellow-300/18 bg-yellow-300/10 text-yellow-100',
  'format-error': 'border-slate-300/18 bg-slate-300/10 text-slate-100',
};

function normalizeSnapshotMistake(mistake: WorkshopMistakeSnapshot): MistakeRecord {
  return {
    ...mistake,
    solvedAt: new Date(mistake.solvedAt),
    source:
      mistake.source === 'classroom-diagnostic'
        ? 'classroom-quiz'
        : (mistake.source as MistakeRecord['source']),
  };
}

function isDue(mistake: MistakeRecord, now: number) {
  if (mistake.reviewed) return false;
  if (!mistake.nextReview) return true;
  return mistake.nextReview <= now;
}

function formatDate(value: Date | string | number) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '刚刚';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getPrimaryTopic(mistake: MistakeRecord) {
  return mistake.knowledgePoints[0] ?? '综合诊断';
}

function buildTopicQuery(topic: string) {
  return encodeURIComponent(topic);
}

export default function MobileMistakeBookPage() {
  const mistakes = useSkyClassroomStore((state) => state.mistakes);
  const mergeMistakes = useSkyClassroomStore((state) => state.mergeMistakes);
  const markReviewed = useSkyClassroomStore((state) => state.markReviewed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [causeFilter, setCauseFilter] = useState<MistakeCause | 'all'>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const loadMistakes = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/sky/workshop', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error ?? '错题本数据加载失败');
        }
        if (cancelled) return;
        const snapshotMistakes = Array.isArray(data.mistakes)
          ? data.mistakes.map(normalizeSnapshotMistake)
          : [];
        mergeMistakes(snapshotMistakes);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '错题本数据加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadMistakes();
    return () => {
      cancelled = true;
    };
  }, [mergeMistakes]);

  const now = Date.now();
  const stats = useMemo(() => {
    const dueCount = mistakes.filter((mistake) => isDue(mistake, now)).length;
    const reviewedCount = mistakes.filter((mistake) => mistake.reviewed).length;
    const topCause = causeOptions
      .filter((option): option is { value: MistakeCause; label: string } => option.value !== 'all')
      .map((option) => ({
        ...option,
        count: mistakes.filter((mistake) => mistake.cause === option.value).length,
      }))
      .sort((a, b) => b.count - a.count)[0];

    return {
      total: mistakes.length,
      dueCount,
      reviewedCount,
      topCause: topCause?.count ? topCause.label : '待积累',
    };
  }, [mistakes, now]);

  const filteredMistakes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return mistakes.filter((mistake) => {
      if (causeFilter !== 'all' && mistake.cause !== causeFilter) return false;
      if (reviewFilter === 'reviewed' && !mistake.reviewed) return false;
      if (reviewFilter === 'unreviewed' && mistake.reviewed) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        mistake.problem,
        mistake.userAnswer,
        mistake.correctAnswer,
        ...mistake.knowledgePoints,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [causeFilter, mistakes, query, reviewFilter]);

  useEffect(() => {
    setPage(1);
  }, [causeFilter, query, reviewFilter]);

  const dueMistakes = useMemo(
    () => filteredMistakes.filter((mistake) => isDue(mistake, now)),
    [filteredMistakes, now],
  );
  const totalPages = Math.max(1, Math.ceil(filteredMistakes.length / MOBILE_MISTAKES_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * MOBILE_MISTAKES_PAGE_SIZE;
  const visibleMistakes = filteredMistakes.slice(pageStart, pageStart + MOBILE_MISTAKES_PAGE_SIZE);
  const visibleStart = filteredMistakes.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(pageStart + MOBILE_MISTAKES_PAGE_SIZE, filteredMistakes.length);
  const primaryMistake = dueMistakes[0] ?? filteredMistakes[0] ?? mistakes[0];
  const primaryActionTopic = primaryMistake ? getPrimaryTopic(primaryMistake) : '综合诊断';

  return (
    <MobileSkyShell fullBleed>
      <div className="space-y-3 px-4 pb-24">
        <header className="flex items-center gap-2.5">
          <Link
            href="/m/sky/study-lab"
            aria-label="返回天梯工坊"
            className="flex size-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.06] text-slate-100 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/45"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-emerald-200/80">天梯工坊</div>
            <h1 className="truncate text-[22px] font-extrabold leading-tight text-white">错题本</h1>
          </div>
          <span className="flex h-11 items-center gap-1.5 rounded-[16px] border border-emerald-300/15 bg-emerald-300/10 px-3 text-[12px] font-bold text-emerald-100">
            <BookOpenCheck className="size-4" />
            {loading ? '同步中' : `${stats.total}题`}
          </span>
        </header>

        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#101a2b] shadow-xl shadow-slate-950/24">
          <div className="relative p-4">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(52,211,153,0.20),rgba(14,165,233,0.10)_48%,rgba(15,23,42,0)_100%)]" />
            <div className="absolute -right-14 -top-14 size-40 rounded-full bg-emerald-300/12 blur-3xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/18 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-extrabold text-emerald-100">
                    <Sparkles className="size-3" />
                    闭环复盘
                  </span>
                  <h2 className="mt-3 text-[26px] font-black leading-tight text-white">
                    先处理最该回看的题
                  </h2>
                  <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-5 text-slate-400">
                    按错因、知识点和复习状态整理，保持和移动端首页一致的轻量学习节奏。
                  </p>
                </div>
                <div className="grid size-[72px] shrink-0 place-items-center rounded-[23px] border border-white/10 bg-white/[0.055] shadow-inner shadow-white/5">
                  <div className="text-center">
                    <div className="text-[24px] font-black leading-none text-white">
                      {stats.dueCount}
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-slate-400">待复习</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <HeroMetric icon={FileText} label="总错题" value={stats.total} />
                <HeroMetric icon={CheckCircle2} label="已闭环" value={stats.reviewedCount} />
                <HeroMetric icon={Brain} label="高频错因" value={stats.topCause} compact />
              </div>
            </div>
          </div>

          <div className="border-t border-white/8 bg-white/[0.035] p-3">
            <Link
              href={
                stats.total > 0
                  ? `/m/sky/cloud-mind/quiz?topic=${buildTopicQuery(primaryActionTopic)}`
                  : '/m/sky/cloud-mind/solve'
              }
              className="flex min-h-11 items-center justify-center gap-2 rounded-[15px] bg-emerald-300 px-3 text-[13px] font-extrabold text-slate-950 shadow-lg shadow-emerald-950/25 active:scale-[0.99]"
            >
              <Target className="size-4" />
              {stats.total > 0 ? '按薄弱点再练一组' : '先去练一题'}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <section
          aria-label="错题筛选"
          className="rounded-[20px] border border-white/10 bg-[#0d1728] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]"
        >
          <div className="flex items-center gap-2 rounded-[15px] border border-white/10 bg-white/[0.055] px-3 py-2">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索题干或知识点"
              className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mt-3 flex items-center gap-2 text-[12px] font-bold text-slate-400">
            <Filter className="size-3.5" />
            错因
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {causeOptions.map((option) => {
              const active = causeFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCauseFilter(option.value)}
                  className={cn(
                    'h-8 shrink-0 rounded-full border px-3 text-[11px] font-extrabold transition active:scale-[0.98]',
                    active
                      ? 'border-emerald-200/30 bg-emerald-300 text-slate-950'
                      : 'border-white/10 bg-white/[0.055] text-slate-300',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {(
              [
                ['all', '全部'],
                ['unreviewed', '未复习'],
                ['reviewed', '已复习'],
              ] as const
            ).map(([value, label]) => {
              const active = reviewFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReviewFilter(value)}
                  className={cn(
                    'h-9 rounded-[13px] text-[12px] font-extrabold transition active:scale-[0.98]',
                    active ? 'bg-cyan-300 text-slate-950' : 'bg-white/[0.055] text-slate-300',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <section className="rounded-[18px] border border-rose-300/20 bg-rose-400/10 px-3.5 py-3 text-[12px] font-semibold leading-5 text-rose-50">
            {error}
          </section>
        )}

        {loading && <LoadingState />}

        {!loading && stats.total === 0 && (
          <EmptyState
            title="还没有错题记录"
            desc="完成拍照搜题、课堂测验或专项练习后，错题会自动进入这里。"
            actionHref="/m/sky/cloud-mind/solve"
            actionLabel="去练一题"
          />
        )}

        {!loading && stats.total > 0 && filteredMistakes.length === 0 && (
          <EmptyState
            title="当前筛选下没有错题"
            desc="换一个错因或清空搜索条件，再看看你的复盘队列。"
            actionHref="/m/sky/learning/mistakes"
            actionLabel="查看全部"
            onAction={() => {
              setCauseFilter('all');
              setReviewFilter('all');
              setQuery('');
            }}
          />
        )}

        {!loading && filteredMistakes.length > 0 && (
          <section className="space-y-2.5" aria-label="错题列表">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-[16px] font-extrabold text-white">复盘队列</h2>
              <span className="text-[12px] font-semibold text-slate-400">
                {visibleStart}-{visibleEnd} / {filteredMistakes.length} 题
              </span>
            </div>

            {visibleMistakes.map((mistake) => (
              <MistakeCard key={mistake.id} mistake={mistake} onMarkReviewed={markReviewed} />
            ))}

            {totalPages > 1 && (
              <MobileMistakePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}
          </section>
        )}
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}

function getPaginationItems(currentPage: number, totalPages: number) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => {
    if (totalPages <= 5) return true;
    if (item === 1 || item === totalPages) return true;
    return Math.abs(item - currentPage) <= 1;
  });

  return pages.reduce<Array<number | 'ellipsis'>>((items, pageNumber, index) => {
    const previous = pages[index - 1];
    if (previous && pageNumber - previous > 1) items.push('ellipsis');
    items.push(pageNumber);
    return items;
  }, []);
}

function MobileMistakePagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const paginationItems = getPaginationItems(currentPage, totalPages);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <nav
      aria-label="错题分页"
      className="rounded-[18px] border border-white/10 bg-[#0d1728] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <button
          type="button"
          aria-label="上一页"
          disabled={!canGoPrevious}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[15px] border border-white/10 bg-white/[0.055] px-3 text-[12px] font-extrabold text-slate-100 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ArrowLeft className="size-4" />
          上一页
        </button>

        <div
          className="flex h-11 min-w-[64px] items-center justify-center rounded-[15px] border border-emerald-300/20 bg-emerald-300/10 px-3 text-[12px] font-black text-emerald-100"
          aria-live="polite"
        >
          {currentPage} / {totalPages}
        </div>

        <button
          type="button"
          aria-label="下一页"
          disabled={!canGoNext}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[15px] bg-emerald-300 px-3 text-[12px] font-extrabold text-slate-950 shadow-lg shadow-emerald-950/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.055] disabled:text-slate-500 disabled:shadow-none"
        >
          下一页
          <ArrowRight className="size-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-1">
        {paginationItems.map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className="flex size-9 items-center justify-center text-[12px] font-black text-slate-500"
            >
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={`第 ${item} 页`}
              aria-current={item === currentPage ? 'page' : undefined}
              onClick={() => onPageChange(item)}
              className={cn(
                'size-9 rounded-[13px] text-[12px] font-black transition active:scale-[0.98]',
                item === currentPage
                  ? 'bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-950/20'
                  : 'border border-white/10 bg-white/[0.055] text-slate-300',
              )}
            >
              {item}
            </button>
          ),
        )}
      </div>
    </nav>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value,
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className="min-h-[70px] rounded-[17px] border border-white/10 bg-white/[0.055] px-2 py-2.5 text-center shadow-inner shadow-white/5">
      <Icon className="mx-auto size-4 text-emerald-100" />
      <div
        className={cn(
          'mt-1.5 truncate font-black leading-none text-white',
          compact ? 'text-[12px]' : 'text-[18px]',
        )}
      >
        {value}
      </div>
      <div className="mt-1 truncate text-[11px] font-bold text-slate-400">{label}</div>
    </div>
  );
}

function MistakeCard({
  mistake,
  onMarkReviewed,
}: {
  mistake: MistakeRecord;
  onMarkReviewed: (id: string, correct?: boolean) => void;
}) {
  const topic = getPrimaryTopic(mistake);
  const mastered = mistake.reviewed;

  return (
    <article
      className={cn(
        'rounded-[20px] border border-white/10 bg-[#101a2b] p-3.5 shadow-lg shadow-slate-950/18',
        mastered && 'opacity-72',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'rounded-full border px-2 py-1 text-[11px] font-bold',
                causeTone[mistake.cause],
              )}
            >
              {causeLabels[mistake.cause]}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-1 text-[12px] font-semibold text-slate-300">
              {mastered ? `已复习 x${mistake.reviewCount}` : `第 ${mistake.reviewCount + 1} 轮`}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-2 text-[15px] font-extrabold leading-6 text-white">
            {mistake.problem}
          </h3>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[15px] bg-emerald-300/10 text-emerald-100">
          {mastered ? <CheckCircle2 className="size-5" /> : <Clock3 className="size-5" />}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <AnswerBlock label="我的答案" value={mistake.userAnswer || '未记录'} />
        <AnswerBlock label="正确答案" value={mistake.correctAnswer || '待补全'} strong />
      </div>

      {mistake.knowledgePoints.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {mistake.knowledgePoints.slice(0, 4).map((point, index) => (
            <span
              key={`${mistake.id}-${point}`}
              className={cn(
                'rounded-full border px-2 py-1 text-[11px] font-semibold',
                index % 2 === 0
                  ? 'border-cyan-300/18 bg-cyan-300/10 text-cyan-100'
                  : 'border-emerald-300/18 bg-emerald-300/10 text-emerald-100',
              )}
            >
              {point}
            </span>
          ))}
          <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[11px] font-semibold text-slate-400">
            {formatDate(mistake.solvedAt)}
          </span>
        </div>
      )}

      {mistake.errorExplanation && (
        <p className="mt-3 line-clamp-2 rounded-[15px] border border-white/10 bg-white/[0.045] px-3 py-2 text-[12px] font-medium leading-5 text-slate-400">
          {mistake.errorExplanation}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href={`/m/sky/cloud-mind/quiz?topic=${buildTopicQuery(topic)}`}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-[15px] bg-cyan-300/12 px-3 text-[13px] font-extrabold text-cyan-50 ring-1 ring-cyan-200/15 active:scale-[0.99]"
        >
          同类练习
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href={`/m/sky/cloud-mind/teaching?topic=${buildTopicQuery(topic)}`}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-[15px] bg-violet-300/12 px-3 text-[13px] font-extrabold text-violet-50 ring-1 ring-violet-200/15 active:scale-[0.99]"
        >
          生成讲解
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onMarkReviewed(mistake.id, true)}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-[15px] bg-emerald-400/18 px-3 text-[13px] font-extrabold text-emerald-50 ring-1 ring-emerald-300/20 active:scale-[0.99]"
        >
          <CheckCircle2 className="size-4" />
          {mastered ? '再记一轮' : '标为掌握'}
        </button>
        <button
          type="button"
          onClick={() => onMarkReviewed(mistake.id, false)}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-[15px] bg-white/[0.07] px-3 text-[13px] font-extrabold text-slate-100 ring-1 ring-white/10 active:scale-[0.99]"
        >
          <RotateCcw className="size-4" />
          还需巩固
        </button>
      </div>
    </article>
  );
}

function AnswerBlock({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
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

function EmptyState({
  title,
  desc,
  actionHref,
  actionLabel,
  onAction,
}: {
  title: string;
  desc: string;
  actionHref: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#101a2b] p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[18px] bg-emerald-300/12 text-emerald-100">
          <BookOpenCheck className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-extrabold text-white">{title}</h2>
          <p className="mt-1 text-[12px] leading-5 text-slate-400">{desc}</p>
        </div>
      </div>
      <Link
        href={actionHref}
        onClick={onAction}
        className="mt-4 flex h-11 items-center justify-center gap-2 rounded-[15px] bg-[#4f7cff] text-[13px] font-extrabold text-white shadow-lg shadow-blue-950/30 active:scale-[0.99]"
      >
        {actionLabel}
        <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}

function LoadingState() {
  return (
    <section className="space-y-2.5" aria-label="正在加载错题本">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-[172px] animate-pulse rounded-[20px] border border-white/8 bg-white/[0.05]"
        />
      ))}
    </section>
  );
}
