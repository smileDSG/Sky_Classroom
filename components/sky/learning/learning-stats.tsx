'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Flame,
  LineChart,
  Target,
} from 'lucide-react';
import type { MistakeCause } from '@/lib/solve/types';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { buildKnowledgeGraph, getMasterySummary } from '@/lib/knowledge-graph';
import { inferSubject, getSubjectLabel } from '@/lib/mistakes/subject-inference';
import type { Subject } from '@/lib/mistakes/subject-inference';
import { MathRenderer } from '@/components/sky/solve/math-renderer';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { cn } from '@/lib/utils';

const causeLabels: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  misreading: '审题错误',
  'method-wrong': '方法错误',
  careless: '粗心',
  'format-error': '格式错误',
};

const causeBarColors: Record<MistakeCause, string> = {
  'concept-unclear': 'from-violet-500 to-fuchsia-500',
  'calculation-error': 'from-amber-500 to-orange-500',
  misreading: 'from-sky-500 to-cyan-500',
  'method-wrong': 'from-rose-500 to-red-500',
  careless: 'from-yellow-400 to-amber-500',
  'format-error': 'from-slate-500 to-slate-400',
};

const allCauses: MistakeCause[] = [
  'concept-unclear',
  'calculation-error',
  'misreading',
  'method-wrong',
  'careless',
  'format-error',
];

interface CauseStat {
  cause: MistakeCause;
  label: string;
  count: number;
  pct: number;
}

interface SubjectStat {
  subject: Subject;
  label: string;
  total: number;
  reviewed: number;
  rate: number;
}

interface TrendPoint {
  date: string;
  total: number;
  reviewed: number;
}

function isToday(date: Date): boolean {
  const d = new Date(date);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isWithinDays(date: Date, days: number): boolean {
  const diff = Date.now() - new Date(date).getTime();
  return diff >= 0 && diff <= days * 86400000;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date);
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffHour < 1) return '刚刚';
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  return `${Math.floor(diffDay / 30)}个月前`;
}

function MetricCard({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: 'rose' | 'emerald' | 'amber' | 'sky';
  icon: typeof BarChart3;
}) {
  const toneClass = {
    rose: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-300/10 dark:text-rose-100 dark:ring-rose-200/15',
    emerald:
      'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-300/10 dark:text-emerald-100 dark:ring-emerald-200/15',
    amber:
      'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-300/10 dark:text-amber-100 dark:ring-amber-200/15',
    sky: 'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-300/10 dark:text-sky-100 dark:ring-sky-200/15',
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm shadow-slate-200/40 dark:border-cyan-100/10 dark:bg-slate-950/35 dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-950 dark:text-white">
            {value}
          </div>
        </div>
        <span className={cn('rounded-xl p-2 ring-1', toneClass)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function InsightBanner({
  reviewRate,
  topCause,
  topSubject,
  weakPointsCount,
}: {
  reviewRate: number;
  topCause: CauseStat | null;
  topSubject: SubjectStat | null;
  weakPointsCount: number;
}) {
  const title =
    reviewRate < 40
      ? '先把待复习错题清掉'
      : weakPointsCount > 0
        ? '今天适合补薄弱知识点'
        : '复习节奏不错，继续保持';
  const detail = topCause
    ? `最高频错因是「${topCause.label}」，${
        topSubject ? `集中在「${topSubject.label}」相关题目。` : '建议先做一组同类题。'
      }`
    : '完成更多练习后，这里会给出更具体的学习建议。';

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-[linear-gradient(135deg,#ecfdf5_0%,#eff6ff_58%,#ffffff_100%)] p-5 shadow-sm shadow-emerald-100/60 dark:border-emerald-200/15 dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.14)_0%,rgba(14,165,233,0.1)_58%,rgba(15,23,42,0.2)_100%)] dark:shadow-none">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-100">
            <Target className="h-4 w-4" aria-hidden="true" />
            今日学习建议
          </div>
          <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {detail}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/sky/cloud-mind/memory"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200"
          >
            开始复习
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/sky/cloud-mind/quiz"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/75 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]"
          >
            去练一组
          </Link>
        </div>
      </div>
    </section>
  );
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const maxTotal = Math.max(...data.map((item) => item.total), 1);
  const totalRecent = data.reduce((sum, item) => sum + item.total, 0);
  const reviewedRecent = data.reduce((sum, item) => sum + item.reviewed, 0);

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm shadow-slate-200/40 dark:border-cyan-100/10 dark:bg-slate-950/35 dark:shadow-none">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <LineChart className="h-4 w-4 text-sky-500" aria-hidden="true" />
            最近 14 天练习热度
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            共新增 {totalRecent} 道错题，已复习 {reviewedRecent} 道
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            错题
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            已复习
          </span>
        </div>
      </div>

      <div
        className="mt-5 grid h-40 items-end gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
        aria-label="最近 14 天错题与复习数量柱状图"
      >
        {data.map((item, index) => {
          const totalHeight = Math.max((item.total / maxTotal) * 100, item.total > 0 ? 8 : 0);
          const reviewedHeight = Math.max(
            (item.reviewed / maxTotal) * 100,
            item.reviewed > 0 ? 8 : 0,
          );
          const showLabel = index === 0 || index === data.length - 1 || index % 4 === 0;

          return (
            <div key={`${item.date}-${index}`} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex h-28 w-full items-end justify-center gap-1 rounded-lg bg-slate-50 px-1 py-2 dark:bg-white/[0.04]">
                <span
                  className="w-2 rounded-full bg-rose-400 transition-all duration-500"
                  style={{ height: `${totalHeight}%` }}
                  title={`${item.date} 错题 ${item.total} 道`}
                />
                <span
                  className="w-2 rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ height: `${reviewedHeight}%` }}
                  title={`${item.date} 复习 ${item.reviewed} 道`}
                />
              </div>
              <span className="h-4 text-[10px] text-slate-400">{showLabel ? item.date : ''}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RankedBarList({
  title,
  icon: Icon,
  items,
  emptyText,
}: {
  title: string;
  icon: typeof BarChart3;
  items: { key: string; label: string; value: number; meta: string; pct: number; color: string }[];
  emptyText: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm shadow-slate-200/40 dark:border-cyan-100/10 dark:bg-slate-950/35 dark:shadow-none">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <Icon className="h-4 w-4 text-amber-500" aria-hidden="true" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.key}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                <span className="shrink-0 text-slate-500 dark:text-slate-400">{item.meta}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                <div
                  className={cn('h-full rounded-full bg-gradient-to-r', item.color)}
                  style={{ width: `${item.pct}%`, minWidth: item.value > 0 ? '8px' : '0' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentMistakes({ mistakes }: { mistakes: MistakeRecord[] }) {
  const recent = mistakes
    .slice()
    .sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime())
    .slice(0, 4);

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm shadow-slate-200/40 dark:border-cyan-100/10 dark:bg-slate-950/35 dark:shadow-none">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <CalendarDays className="h-4 w-4 text-sky-500" aria-hidden="true" />
          最近错题动态
        </h3>
        <Link
          href="/sky/learning/mistakes"
          className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-300"
        >
          查看全部
        </Link>
      </div>
      <div className="mt-4 space-y-2">
        {recent.map((mistake) => (
          <Link
            key={mistake.id}
            href={`/sky/learning/mistakes?highlight=${mistake.id}`}
            className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 transition-colors hover:border-sky-200 hover:bg-sky-50/70 dark:border-white/[0.05] dark:bg-white/[0.04] dark:hover:border-sky-200/20 dark:hover:bg-sky-300/10"
          >
            <span
              className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                mistake.reviewed
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-300/10 dark:text-emerald-100'
                  : 'bg-amber-100 text-amber-600 dark:bg-amber-300/10 dark:text-amber-100',
              )}
            >
              {mistake.reviewed ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <CircleDot className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <MathRenderer
                content={mistake.problem}
                className="line-clamp-2 text-sm font-medium leading-6 text-slate-700 group-hover:text-sky-700 dark:text-slate-200 dark:group-hover:text-sky-100"
              />
              <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span>{formatRelativeTime(mistake.solvedAt)}</span>
                <span>{causeLabels[mistake.cause]}</span>
                <span>{mistake.reviewed ? '已复习' : '待复习'}</span>
              </span>
            </span>
            <ArrowRight
              className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-sky-500"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function LearningStats() {
  const { mistakes } = useSkyClassroomStore();
  const memoryProgress = useSkyClassroomStore((s) => s.memoryProgress);

  const stats = useMemo(() => {
    const totalCount = mistakes.length;
    const reviewedCount = mistakes.filter((m) => m.reviewed).length;
    const pendingCount = totalCount - reviewedCount;
    const reviewRate = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;
    const todayCount = mistakes.filter((m) => isToday(m.solvedAt)).length;
    const recentCount = mistakes.filter((m) => isWithinDays(m.solvedAt, 7)).length;

    const causeDist: Record<MistakeCause, number> = Object.fromEntries(
      allCauses.map((cause) => [cause, 0]),
    ) as Record<MistakeCause, number>;
    for (const mistake of mistakes) {
      causeDist[mistake.cause] = (causeDist[mistake.cause] ?? 0) + 1;
    }
    const maxCause = Math.max(...Object.values(causeDist), 1);
    const causeStats = allCauses
      .map((cause) => ({
        cause,
        label: causeLabels[cause],
        count: causeDist[cause] ?? 0,
        pct: ((causeDist[cause] ?? 0) / maxCause) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    const graph = mistakes.length > 0 ? buildKnowledgeGraph(mistakes) : null;
    const mastery = graph
      ? getMasterySummary(graph)
      : { overallMastery: 0, weakCount: 0, masteredCount: 0, totalCount: 0 };

    return {
      totalCount,
      reviewedCount,
      pendingCount,
      reviewRate,
      todayCount,
      recentCount,
      causeStats,
      topCause: causeStats.find((item) => item.count > 0) ?? null,
      mastery,
    };
  }, [mistakes]);

  const trendData = useMemo(() => {
    const now = new Date();
    const days: TrendPoint[] = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const dayMistakes = mistakes.filter((m) => {
        const t = new Date(m.solvedAt).getTime();
        return t >= dayStart && t < dayEnd;
      });

      days.push({
        date: formatDate(d),
        total: dayMistakes.length,
        reviewed: dayMistakes.filter((m) => m.reviewed).length,
      });
    }

    return days;
  }, [mistakes]);

  const subjectStats = useMemo(() => {
    const map = new Map<Subject, { total: number; reviewed: number }>();
    for (const mistake of mistakes) {
      for (const kp of mistake.knowledgePoints) {
        const subject = inferSubject(kp);
        const entry = map.get(subject) ?? { total: 0, reviewed: 0 };
        entry.total++;
        if (mistake.reviewed) entry.reviewed++;
        map.set(subject, entry);
      }
    }

    return [...map.entries()]
      .filter(([subject]) => subject !== 'unknown')
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([subject, data]) => ({
        subject,
        label: getSubjectLabel(subject),
        ...data,
        rate: data.total > 0 ? Math.round((data.reviewed / data.total) * 100) : 0,
      }));
  }, [mistakes]);

  const subjectMaxTotal = Math.max(...subjectStats.map((item) => item.total), 1);
  const topSubject = subjectStats[0] ?? null;

  if (mistakes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center shadow-sm dark:border-cyan-100/15 dark:bg-slate-950/35">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-300/10 dark:text-emerald-100 dark:ring-emerald-200/15">
          <BarChart3 className="h-7 w-7" aria-hidden="true" />
        </div>
        <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">
          还没有学习数据
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          完成搜题、练习或复习后，这里会整理错因趋势、薄弱学科和下一步建议。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/sky/cloud-mind/solve"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200"
          >
            去搜题练习
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/sky/cloud-mind/quiz"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]"
          >
            AI 出题
          </Link>
        </div>
      </div>
    );
  }

  const causeItems = stats.causeStats.map((item) => ({
    key: item.cause,
    label: item.label,
    value: item.count,
    meta: `${item.count} 道`,
    pct: item.pct,
    color: causeBarColors[item.cause],
  }));

  const subjectItems = subjectStats.map((item) => ({
    key: item.subject,
    label: item.label,
    value: item.total,
    meta: `${item.total} 题 · 复习 ${item.rate}%`,
    pct: (item.total / subjectMaxTotal) * 100,
    color: 'from-sky-500 to-cyan-500',
  }));

  return (
    <div className="space-y-5">
      <InsightBanner
        reviewRate={stats.reviewRate}
        topCause={stats.topCause}
        topSubject={topSubject}
        weakPointsCount={stats.mastery.weakCount}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="总错题"
          value={stats.totalCount}
          detail={`近 7 天新增 ${stats.recentCount} 道，今日 ${stats.todayCount} 道`}
          tone="rose"
          icon={AlertTriangle}
        />
        <MetricCard
          label="待复习"
          value={stats.pendingCount}
          detail={`已复习 ${stats.reviewedCount} 道，复习率 ${stats.reviewRate}%`}
          tone="amber"
          icon={BookOpenCheck}
        />
        <MetricCard
          label="掌握情况"
          value={`${stats.mastery.overallMastery}%`}
          detail={`${stats.mastery.masteredCount} 个知识点已掌握，${stats.mastery.weakCount} 个仍薄弱`}
          tone="emerald"
          icon={Target}
        />
        <MetricCard
          label="记忆卡片"
          value={memoryProgress.totalFlipped}
          detail={
            memoryProgress.totalFlipped > 0
              ? `${memoryProgress.topicCount} 个主题，最近 ${memoryProgress.lastStudied ? new Date(memoryProgress.lastStudied).toLocaleDateString('zh-CN') : '未记录'}`
              : '还没有记忆卡片学习记录'
          }
          tone="sky"
          icon={Brain}
        />
      </div>

      <TrendChart data={trendData} />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <RankedBarList
          title="错因优先级"
          icon={Flame}
          items={causeItems}
          emptyText="暂无错因数据"
        />
        <RankedBarList
          title="学科薄弱分布"
          icon={BarChart3}
          items={subjectItems}
          emptyText="暂无可识别的学科数据"
        />
      </div>

      <RecentMistakes mistakes={mistakes} />
    </div>
  );
}
