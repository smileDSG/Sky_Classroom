'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock3, Route, Sparkles, Target } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import type { LearningTask } from '@/lib/adaptive-learning/contracts';
import type { LearningPlanPanelData } from '@/components/sky/learning/learning-plan-panel';
import { cn } from '@/lib/utils';

const REASON_EXPLANATIONS: Record<string, string> = {
  'no-evidence': '这部分还没有足够记录，先用几道题确认起点。',
  'low-confidence': '近期样本还不够稳定，先多确认几道再继续推进。',
  'low-mastery': '当前掌握度偏低，先把基础概念补清楚。',
  'repeated-errors': '这里最近反复出错，先做针对练习避免重复犯错。',
  'low-retention': '这部分有一段时间没复习，先把记忆找回来。',
  'path-sequence': '这是后续内容的基础，所以安排在当前节点。',
};

function taskReason(task: LearningTask): string {
  return (
    task.reasonCodes.map((code) => REASON_EXPLANATIONS[code]).find(Boolean) ??
    REASON_EXPLANATIONS['path-sequence']
  );
}

function getTaskHref(task: LearningTask): string {
  return task.actionHref ?? '/sky';
}

function PlanLoadingState() {
  return (
    <section
      aria-label="个性化学习安排"
      className="min-h-40 animate-pulse rounded-2xl border border-sky-200/70 bg-white/65 p-5 dark:border-sky-200/10 dark:bg-slate-900/45"
    >
      <div className="h-4 w-32 rounded bg-slate-200/80 dark:bg-white/10" />
      <div className="mt-4 h-6 max-w-md rounded bg-slate-200/80 dark:bg-white/10" />
      <div className="mt-3 h-4 max-w-xl rounded bg-slate-200/60 dark:bg-white/[0.07]" />
    </section>
  );
}

function EmptyPlanPreview({ hasSignals }: { hasSignals: boolean }) {
  return (
    <section className="rounded-2xl border border-sky-200/70 bg-white/75 p-5 shadow-sm backdrop-blur-sm dark:border-sky-200/10 dark:bg-slate-900/50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
            <Route className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-sky-700 dark:text-sky-200">为你安排</p>
            <h2 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
              {hasSignals ? '你的学习画像已经有线索' : '先留下学习记录，再生成具体计划'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {hasSignals
                ? '进入学习工作台，把当前目标和每天可用时间变成可执行任务。'
                : '完成一次讲解或练习后，系统会根据掌握情况安排下一步。'}
            </p>
          </div>
        </div>
        <Link
          href="/sky"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200"
        >
          {hasSignals ? '查看学习安排' : '建立学习计划'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function RecommendationPreview({
  recommendation,
}: {
  recommendation: PersonalizationContext['recommendation'];
}) {
  if (!recommendation) return null;

  return (
    <section className="rounded-2xl border border-sky-200/70 bg-white/75 p-5 shadow-sm backdrop-blur-sm dark:border-sky-200/10 dark:bg-slate-900/50">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">为你安排</p>
              <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
                根据最近学习情况
              </span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              {recommendation.title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {recommendation.reason}
            </p>
          </div>
        </div>
        <Link
          href={recommendation.href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-600 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200"
        >
          {recommendation.targetTool === 'memory' ? '开始复习' : '继续学习'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function PlannedTaskPreview({
  task,
  completionRate,
}: {
  task: LearningTask;
  completionRate: number;
}) {
  return (
    <section className="rounded-2xl border border-emerald-200/70 bg-white/75 p-5 shadow-sm backdrop-blur-sm dark:border-emerald-200/10 dark:bg-slate-900/50">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-200">
              <Target className="h-3.5 w-3.5" /> 今日计划
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:border-emerald-200/15 dark:bg-emerald-300/10 dark:text-emerald-100">
              已完成 {completionRate}%
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
            {task.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {task.objective}
          </p>
          <p className="mt-3 border-l-2 border-amber-300 pl-3 text-sm leading-6 text-slate-600 dark:border-amber-200/60 dark:text-slate-300">
            {taskReason(task)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <span className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
            <Clock3 className="h-3.5 w-3.5" /> 预计 {task.plannedMinutes} 分钟
          </span>
          <Link
            href={getTaskHref(task)}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors',
              task.status === 'in-progress'
                ? 'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200',
            )}
          >
            {task.status === 'in-progress' ? '继续任务' : '开始任务'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LearningPlanPreview() {
  const { user } = useAuth();
  const [data, setData] = useState<LearningPlanPanelData | null>(null);
  const [context, setContext] = useState<PersonalizationContext | null>(null);
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([
      fetch('/api/sky/learning-plan?view=today', { credentials: 'include' }),
      fetch('/api/sky/cloud-mind/personalization-context', { credentials: 'include' }),
    ])
      .then(async ([planResponse, contextResponse]) => {
        const [planJson, contextJson] = await Promise.all([
          planResponse.json().catch(() => null),
          contextResponse.json().catch(() => null),
        ]);
        if (cancelled) return;
        if (planResponse.ok && planJson?.success && planJson.data) {
          setData(planJson.data as LearningPlanPanelData);
        }
        if (contextResponse.ok && contextJson?.success && contextJson.data) {
          setContext(contextJson.data as PersonalizationContext);
        }
      })
      .catch(() => {
        /* The classroom remains usable when personalization is unavailable. */
      })
      .finally(() => {
        if (!cancelled) setLoadedForUserId(user.id);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;
  if (loadedForUserId !== user.id && !data && !context) return <PlanLoadingState />;

  const task = data?.view?.nextTask ?? null;
  if (task) {
    return (
      <PlannedTaskPreview task={task} completionRate={data?.view?.summary.completionRate ?? 0} />
    );
  }
  if (context?.recommendation)
    return <RecommendationPreview recommendation={context.recommendation} />;

  return <EmptyPlanPreview hasSignals={Boolean(context?.hasPersonalizationSignals)} />;
}
