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
          className="min-h-[220px] animate-pulse rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-sky-100/10 dark:bg-[#081423]/90"
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
    <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="min-h-[80px] rounded-xl border border-slate-200 bg-white/90 px-3 py-3.5 shadow-sm dark:border-sky-100/10 dark:bg-[#081423]/90 dark:shadow-none"
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
    <SkyAppShell section="learning">
      <div className=" pt-6 pb-12">
        <div data-tour-step="page-header" className="mb-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
                今日计划
              </h1>
              <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                聚焦今天该做什么，从这里直接开始；完整学习路线请到「学习路径」查看。
              </p>
            </div>
          </div>

          <Button asChild className="min-h-11 shrink-0">
            <Link href="/sky/cloud-mind">
              <Sparkles className="h-4 w-4" />
              打开云端智囊
            </Link>
          </Button>
        </div>

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
              <div className=" space-y-4">
                <ProfileSummaryPanel
                  profile={viewModel.profile}
                  error={viewModel.errors.personalization}
                />
                <LearningPathTimeline
                  learningPath={viewModel.learningPath}
                  error={viewModel.errors.learningPath ?? viewModel.errors.learningPlan}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <PageTour id="learning-today" />
    </SkyAppShell>
  );
}
