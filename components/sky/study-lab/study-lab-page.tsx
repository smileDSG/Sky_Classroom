'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BrainCircuit, Sparkles } from 'lucide-react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { Button } from '@/components/ui/button';
import {
  buildStudyLabViewModel,
  type SnapshotResult,
  type StudyLabApiSnapshots,
  type StudyLabLearningPathResponse,
  type StudyLabLearningPlanResponse,
  type StudyLabViewModel,
  type StudyLabWorkshopSnapshot,
} from '@/lib/sky/study-lab-data';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import { cn } from '@/lib/utils';
import { PageTour } from '@/components/sky/tour/page-tour';
import { LearningPathTimeline } from './learning-path-timeline';
import { ProfileSummaryPanel } from './profile-summary-panel';
import { TodayMissionPanel } from './today-mission-panel';

type LoadState = 'loading' | 'ready';

function asPayload(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

async function fetchApiData<T>(
  href: string,
  select: (payload: Record<string, unknown>) => T,
): Promise<T> {
  const response = await fetch(href, { credentials: 'include' });
  const payload = asPayload(await response.json().catch(() => null));
  if (!response.ok || !payload?.success) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : '数据加载失败');
  }
  return select(payload);
}

async function settle<T>(promise: Promise<T>): Promise<SnapshotResult<T>> {
  try {
    return {
      status: 'fulfilled',
      data: await promise,
    };
  } catch (error) {
    return {
      status: 'rejected',
      error: error instanceof Error ? error.message : '数据加载失败',
    };
  }
}

async function loadStudyLabSnapshots(): Promise<StudyLabApiSnapshots> {
  const [personalization, workshop, learningPath, learningPlan] = await Promise.all([
    settle(
      fetchApiData<PersonalizationContext>(
        '/api/sky/cloud-mind/personalization-context',
        (payload) => payload.data as PersonalizationContext,
      ),
    ),
    settle(fetchApiData<StudyLabWorkshopSnapshot>('/api/sky/workshop', (payload) => payload)),
    settle(
      fetchApiData<StudyLabLearningPathResponse>(
        '/api/sky/learning-path',
        (payload) => payload.data as StudyLabLearningPathResponse,
      ),
    ),
    settle(
      fetchApiData<StudyLabLearningPlanResponse>(
        '/api/sky/learning-plan?view=today',
        (payload) => payload.data as StudyLabLearningPlanResponse,
      ),
    ),
  ]);

  return {
    personalization,
    workshop,
    learningPath,
    learningPlan,
  };
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="min-h-[220px] animate-pulse rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-cyan-100/10 dark:bg-[#081423]/90"
        >
          <div className="h-9 w-40 rounded-xl bg-slate-200 dark:bg-white/10" />
          <div className="mt-5 h-24 rounded-xl bg-slate-100 dark:bg-white/[0.06]" />
          <div className="mt-3 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

function MetricStrip({ viewModel }: { viewModel: StudyLabViewModel }) {
  const metrics = [
    { label: '到期复习', value: viewModel.workshop.dueReviewCount, unit: '条' },
    { label: '错题沉淀', value: viewModel.workshop.mistakeTotal, unit: '题' },
    { label: '今日学习', value: viewModel.workshop.todayStudyMinutes, unit: '分钟' },
    { label: '连续学习', value: viewModel.workshop.streakDays, unit: '天' },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="min-h-[76px] rounded-xl border border-slate-200 bg-white/90 px-3 py-3 shadow-sm dark:border-cyan-100/10 dark:bg-[#081423]/90 dark:shadow-none"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-slate-950 dark:text-white">
              {metric.value}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{metric.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudyLabPage() {
  const [snapshots, setSnapshots] = useState<StudyLabApiSnapshots | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const nextSnapshots = await loadStudyLabSnapshots();
      setSnapshots(nextSnapshots);
    } finally {
      setLoadState('ready');
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const viewModel = useMemo(
    () => (snapshots ? buildStudyLabViewModel(snapshots) : null),
    [snapshots],
  );

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-4 pb-24 sm:pb-10">
        <section data-tour-step="page-header" className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#f0f9ff_58%,#ffffff_100%)] p-4 shadow-sm dark:border-emerald-200/15 dark:bg-[linear-gradient(135deg,#0e2f36_0%,#0b2035_58%,#07111f_100%)] dark:shadow-none sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white dark:bg-emerald-300 dark:text-slate-950">
                  <BrainCircuit className="h-4 w-4" />
                </span>
                <span className="rounded-full border border-emerald-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-200/20 dark:bg-white/[0.08] dark:text-emerald-50">
                  学习数据详情
                </span>
                <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
                  隐藏详情页
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-3xl">
                学习情况、路线和资料来源
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-200">
                这里保留个性化学习的详细数据，主流程请从摘星锦囊和天梯工坊进入。
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="min-h-11 justify-center">
                <Link href="/sky/cloud-mind">
                  <Sparkles className="h-4 w-4" />
                  打开云端智囊
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {viewModel && <MetricStrip viewModel={viewModel} />}

        <div
          data-tour-step="page-primary"
          className={cn(
            'transition-opacity',
            loadState === 'loading' && !viewModel ? 'opacity-100' : 'opacity-100',
          )}
        >
          {!viewModel ? (
            <LoadingState />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <TodayMissionPanel
                viewModel={viewModel}
                onRefresh={() => void load(true)}
                refreshing={refreshing}
                error={viewModel.errors.learningPlan ?? viewModel.errors.workshop}
              />
              <ProfileSummaryPanel
                profile={viewModel.profile}
                error={viewModel.errors.personalization}
              />
              <LearningPathTimeline
                learningPath={viewModel.learningPath}
                error={viewModel.errors.learningPath ?? viewModel.errors.learningPlan}
              />
            </div>
          )}
        </div>
      </div>

      <PageTour id="learning-today" />
    </SkyAppShell>
  );
}
