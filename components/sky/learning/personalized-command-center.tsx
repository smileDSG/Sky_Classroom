'use client';

import { useMemo, type ElementType } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  CalendarClock,
  CheckCircle2,
  Layers,
  Route,
  Sparkles,
  Target,
} from 'lucide-react';
import type { MistakeRecord } from '@/lib/mistakes/types';
import {
  buildLearningInsights,
  type LearningInsightAction,
  type MemoryProgressSnapshot,
} from '@/lib/sky/learning-insights';
import { cn } from '@/lib/utils';

interface PersonalizedCommandCenterProps {
  mistakes: MistakeRecord[];
  memoryProgress: MemoryProgressSnapshot;
  onOpenTab: (tab: 'mistakes' | 'review' | 'graph' | 'stats' | 'profile') => void;
  onPrioritizeReview: (knowledgePoints: string[]) => void;
}

const ACTION_ICONS: Record<LearningInsightAction['tone'], ElementType> = {
  review: CalendarClock,
  quiz: Target,
  memory: Layers,
  teaching: Brain,
};

const ACTION_STYLES: Record<LearningInsightAction['tone'], string> = {
  review:
    'text-amber-200 bg-amber-300/10 border-amber-200/20 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]',
  quiz: 'text-violet-200 bg-violet-300/10 border-violet-200/20 shadow-[inset_0_1px_0_rgba(167,139,250,0.08)]',
  memory:
    'text-rose-200 bg-rose-300/10 border-rose-200/20 shadow-[inset_0_1px_0_rgba(251,113,133,0.08)]',
  teaching:
    'text-emerald-200 bg-emerald-300/10 border-emerald-200/20 shadow-[inset_0_1px_0_rgba(52,211,153,0.08)]',
};

export function PersonalizedCommandCenter({
  mistakes,
  memoryProgress,
  onOpenTab,
  onPrioritizeReview,
}: PersonalizedCommandCenterProps) {
  const insights = useMemo(
    () => buildLearningInsights(mistakes, memoryProgress),
    [mistakes, memoryProgress],
  );
  const priorityTopics = insights.topTopics.map((topic) => topic.name);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-[24px] border border-emerald-200/20 bg-[#06101d] shadow-[0_24px_70px_rgba(0,0,0,0.36),0_0_0_1px_rgba(45,212,191,0.06),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent" />
      <div className="relative border-b border-emerald-200/15 bg-[linear-gradient(135deg,#123346_0%,#0d223b_48%,#131a36_100%)] px-6 py-5 shadow-[inset_0_-1px_0_rgba(255,255,255,0.035)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200/30 bg-emerald-300/10 shadow-[0_0_24px_rgba(52,211,153,0.12)]">
                <Sparkles className="h-4 w-4 text-emerald-200" />
              </span>
              <span className="rounded-full border border-emerald-200/25 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-emerald-100">
                个性化学习决策
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">{insights.headline}</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-200">
              {insights.focusReason}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200/25 bg-[#07111f]/70 px-4 py-3 text-right shadow-[0_10px_30px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="text-[11px] font-medium text-emerald-100/75">当前策略</div>
            <div className="mt-0.5 text-base font-semibold text-white">
              {insights.strategyLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 bg-[#07111f] p-5">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <MetricCard
              icon={CalendarClock}
              label="到期复习"
              value={insights.metrics.dueReviewCount}
              suffix="题"
              active={insights.metrics.dueReviewCount > 0}
              tone="amber"
            />
            <MetricCard
              icon={BookOpenCheck}
              label="错题闭环"
              value={insights.metrics.reviewBacklogCount}
              suffix="题待处理"
              active={insights.metrics.reviewBacklogCount > 0}
              tone="emerald"
            />
            <MetricCard
              icon={BarChart3}
              label="平均掌握"
              value={insights.metrics.averageMastery}
              suffix="%"
              active={
                insights.metrics.averageMastery < 70 && insights.metrics.knowledgePointCount > 0
              }
              tone="sky"
            />
            <MetricCard
              icon={Layers}
              label="记忆主题"
              value={insights.metrics.memoryTopicCount}
              suffix="个"
              active={insights.metrics.memoryTopicCount > 0}
              tone="violet"
            />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {insights.actions.map((action) => {
              const Icon = ACTION_ICONS[action.tone];
              return (
                <Link
                  key={`${action.tone}-${action.href}`}
                  href={action.href}
                  className="group rounded-xl border border-cyan-100/10 bg-[#0c182b] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-all hover:-translate-y-0.5 hover:border-emerald-200/35 hover:bg-[#10223a]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                          ACTION_STYLES[action.tone],
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-100">
                        {action.label}
                      </span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-200" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">
                    {action.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-cyan-100/10 bg-[#0b1729]/75 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Target className="h-4 w-4 text-rose-200" />
                优先攻坚热区
              </div>
              {priorityTopics.length > 0 && (
                <button
                  type="button"
                  onClick={() => onPrioritizeReview(priorityTopics)}
                  className="rounded-lg border border-emerald-200/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100 transition-colors hover:border-emerald-200/45 hover:bg-emerald-300/15"
                >
                  加入复习
                </button>
              )}
            </div>
            {insights.topTopics.length > 0 ? (
              <div className="space-y-2">
                {insights.topTopics.slice(0, 4).map((topic, index) => (
                  <button
                    key={topic.name}
                    type="button"
                    onClick={() => onOpenTab('graph')}
                    className="group w-full rounded-lg border border-cyan-100/10 bg-[#081423] p-3 text-left transition-colors hover:border-emerald-200/35 hover:bg-[#0e2036]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-cyan-100/10 bg-cyan-200/10 text-[10px] font-semibold text-cyan-100">
                          {index + 1}
                        </span>
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-100">
                          {topic.name}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full border border-cyan-100/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-200">
                        {topic.mastery}%
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-xs text-slate-300">
                      {topic.reason} · {topic.mistakeCount} 题样本
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-cyan-100/15 bg-[#081423] p-4 text-sm text-slate-300">
                还没有足够数据定位薄弱点，先通过拍照搜题或针对练习补充样本。
              </div>
            )}
          </div>

          <div className="rounded-xl border border-cyan-100/10 bg-[#0b1729]/75 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Activity className="h-4 w-4 text-indigo-200" />
                数据画像质量
              </div>
              <span className="text-xs font-semibold text-indigo-100">
                {insights.dataHealth.label} · {insights.dataHealth.score}%
              </span>
            </div>
            <div className="space-y-2">
              {insights.dataHealth.signals.map((signal) => (
                <div key={signal.label} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <CheckCircle2
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        signal.ready ? 'text-emerald-200' : 'text-slate-500',
                      )}
                    />
                    <span className="text-xs font-medium text-slate-200">{signal.label}</span>
                  </div>
                  <span className="truncate text-right text-[11px] text-slate-400">
                    {signal.detail}
                  </span>
                </div>
              ))}
            </div>
            {insights.causeSummary.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {insights.causeSummary.map((item) => (
                  <button
                    key={item.cause}
                    type="button"
                    onClick={() => onOpenTab('stats')}
                    className="rounded-full border border-cyan-100/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-indigo-200/35 hover:text-indigo-100"
                  >
                    {item.label} {item.count}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenTab('profile')}
            className="flex w-full items-center justify-between rounded-xl border border-cyan-100/10 bg-[#0c182b] px-3 py-2.5 text-left transition-colors hover:border-indigo-200/35 hover:bg-[#10223a]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Route className="h-4 w-4 text-indigo-200" />
              查看完整学情画像
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  suffix,
  active,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: number;
  suffix: string;
  active?: boolean;
  tone: 'amber' | 'emerald' | 'sky' | 'violet';
}) {
  const toneClass = {
    amber: 'text-amber-200 bg-amber-300/10 border-amber-200/20',
    emerald: 'text-emerald-200 bg-emerald-300/10 border-emerald-200/20',
    sky: 'text-sky-200 bg-sky-300/10 border-sky-200/20',
    violet: 'text-violet-200 bg-violet-300/10 border-violet-200/20',
  }[tone];

  return (
    <div
      className={cn(
        'rounded-xl border bg-[#0c182b] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]',
        active ? 'border-emerald-200/25 bg-[#10223a]' : 'border-cyan-100/10',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
        <span
          className={cn('flex h-6 w-6 items-center justify-center rounded-md border', toneClass)}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums text-slate-50">{value}</span>
        <span className="text-[11px] font-medium text-slate-300">{suffix}</span>
      </div>
    </div>
  );
}
