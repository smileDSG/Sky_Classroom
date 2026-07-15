'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Layers,
  Network,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import {
  getLearningFeatureHref,
  isLearningFeatureKey,
  LEARNING_FEATURES,
  type LearningFeatureKey,
} from '@/components/sky/learning/learning-feature-config';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import type { MistakeRecord } from '@/lib/mistakes/types';
import type { MistakeCause } from '@/lib/solve/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import {
  buildLearningInsights,
  type LearningInsightTopic,
  type LearningInsights,
} from '@/lib/sky/learning-insights';
import { cn } from '@/lib/utils';

type MissionTone = 'amber' | 'violet' | 'emerald' | 'rose';

interface DurationRange {
  min: number;
  max: number;
}

interface MissionStep {
  id: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  icon: typeof CalendarClock;
  tone: MissionTone;
  feature?: LearningFeatureKey;
  duration: DurationRange;
}

interface DailyTaskAction {
  title: string;
  detail: string;
  href: string;
  icon: typeof CalendarClock;
  feature?: LearningFeatureKey;
  autoStartReview?: boolean;
  duration: DurationRange;
}

interface WorkshopSnapshot {
  generatedAt: number;
  mistakes: WorkshopMistakeSnapshot[];
  review?: {
    dueCount?: number;
    overdue?: number;
    completed?: number;
    total?: number;
  };
  learningStats?: {
    masteryPercent?: number;
    todayStudyMinutes?: number;
    streakDays?: number;
    problemsAttempted?: number;
    problemsCorrect?: number;
    scenesCompleted?: number;
  } | null;
  memoryProgress?: {
    totalFlipped: number;
    topicCount: number;
    lastStudied: number | null;
  } | null;
  profile?: {
    masteryByKnowledge?: Record<string, number>;
    weakPoints?: string[];
    strongPoints?: string[];
    errorPatterns?: Array<{
      knowledgePoint: string;
      errorType: MistakeCause | string;
      frequency: number;
    }>;
    totalQuestions?: number;
    totalCorrect?: number;
  } | null;
}

interface WorkshopMistakeSnapshot extends Omit<MistakeRecord, 'solvedAt' | 'source'> {
  solvedAt: string | number;
  source?: MistakeRecord['source'] | 'classroom-diagnostic';
}

const toneClasses: Record<MissionTone, { chip: string; text: string; line: string }> = {
  amber: {
    chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-200/25 dark:bg-amber-300/10 dark:text-amber-100',
    text: 'text-amber-700 dark:text-amber-100',
    line: 'from-amber-300/60 dark:from-amber-300/50',
  },
  violet: {
    chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-200/25 dark:bg-violet-300/10 dark:text-violet-100',
    text: 'text-violet-700 dark:text-violet-100',
    line: 'from-violet-300/60 dark:from-violet-300/50',
  },
  emerald: {
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-200/25 dark:bg-emerald-300/10 dark:text-emerald-100',
    text: 'text-emerald-700 dark:text-emerald-100',
    line: 'from-emerald-300/60 dark:from-emerald-300/50',
  },
  rose: {
    chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-200/25 dark:bg-rose-300/10 dark:text-rose-100',
    text: 'text-rose-700 dark:text-rose-100',
    line: 'from-rose-300/60 dark:from-rose-300/50',
  },
};

function buildMemoryHref(topic: string, topics: string[]): string {
  const content = topics.length
    ? topics.map((item) => `知识点：${item}`).join('\n')
    : `围绕「${topic}」整理核心概念、易错点和复习问题。`;
  return `/sky/cloud-mind/memory?topic=${encodeURIComponent(topic)}&content=${encodeURIComponent(content)}`;
}

function clampDuration(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDuration(duration: DurationRange): string {
  return duration.min === duration.max
    ? `约 ${duration.min} 分钟`
    : `约 ${duration.min}-${duration.max} 分钟`;
}

function sumDurations(durations: DurationRange[]): DurationRange {
  return durations.reduce(
    (total, item) => ({
      min: total.min + item.min,
      max: total.max + item.max,
    }),
    { min: 0, max: 0 },
  );
}

function estimateReviewDuration(insights: LearningInsights): DurationRange {
  if (insights.metrics.dueReviewCount > 0) {
    return {
      min: clampDuration(insights.metrics.dueReviewCount * 3, 8, 35),
      max: clampDuration(insights.metrics.dueReviewCount * 5, 12, 50),
    };
  }

  if (insights.metrics.reviewBacklogCount > 0) {
    return {
      min: clampDuration(insights.metrics.reviewBacklogCount * 2, 8, 25),
      max: clampDuration(insights.metrics.reviewBacklogCount * 4, 12, 40),
    };
  }

  return { min: 3, max: 5 };
}

function withQueryParam(href: string, key: string, value: string): string {
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  params.set(key, value);
  const nextQuery = params.toString();

  return `${path}${nextQuery ? `?${nextQuery}` : ''}`;
}

function appendQueryString(href: string, query: string): string {
  if (!query) return href;
  return `${href}${href.includes('?') ? '&' : '?'}${query}`;
}

function getWorkshopFeatureHref(key: LearningFeatureKey): string {
  const href = getLearningFeatureHref(key);
  return key === 'profile' ? withQueryParam(href, 'from', 'learning') : href;
}

function buildMissionSteps(insights: LearningInsights): MissionStep[] {
  const topic = insights.focusTopic;
  const relatedTopics = insights.topTopics.map((item) => item.name);
  const reviewDuration = estimateReviewDuration(insights);
  const hasSignals = insights.hasSignals;

  if (!hasSignals) {
    return [
      {
        id: 'diagnose',
        label: '第一步',
        title: '完成一次诊断采样',
        detail: '拍照搜题或手动输入题目，让系统获得第一批学习信号',
        href: '/sky/cloud-mind/solve?source=workshop-chain',
        icon: Sparkles,
        tone: 'emerald',
        duration: { min: 5, max: 10 },
      },
      {
        id: 'profile',
        label: '第二步',
        title: '生成学情画像',
        detail: '查看题目、正确率和薄弱点是否已经被系统识别',
        href: getWorkshopFeatureHref('profile'),
        icon: ShieldCheck,
        tone: 'violet',
        feature: 'profile',
        duration: { min: 3, max: 6 },
      },
      {
        id: 'graph',
        label: '第三步',
        title: '查看天梯路线',
        detail: '确认薄弱点和先修关系，决定下一轮练习方向',
        href: getWorkshopFeatureHref('graph'),
        icon: Network,
        tone: 'amber',
        feature: 'graph',
        duration: { min: 5, max: 8 },
      },
      {
        id: 'quiz',
        label: '收束',
        title: '做一组针对练习',
        detail: '用 5 道同类题验证画像是否准确',
        href: `/sky/cloud-mind/quiz?topic=${encodeURIComponent(topic)}&count=5`,
        icon: Target,
        tone: 'rose',
        duration: { min: 15, max: 25 },
      },
    ];
  }

  return [
    {
      id: 'review',
      label: '第一步',
      title: insights.metrics.dueReviewCount > 0 ? '清理到期复习' : '检查复习节奏',
      detail:
        insights.metrics.dueReviewCount > 0
          ? `${insights.metrics.dueReviewCount} 道错题处于复习窗口`
          : '先确认今天是否有需要回看内容',
      href: getWorkshopFeatureHref('review'),
      icon: CalendarClock,
      tone: 'amber',
      feature: 'review',
      duration: reviewDuration,
    },
    {
      id: 'quiz',
      label: '第二步',
      title: `围绕「${topic}」做针对练习`,
      detail: '用同类题验证薄弱点是否真正补上',
      href: `/sky/cloud-mind/quiz?topic=${encodeURIComponent(topic)}`,
      icon: Target,
      tone: 'violet',
      duration: { min: 15, max: 25 },
    },
    {
      id: 'teaching',
      label: '第三步',
      title: `讲透「${topic}」`,
      detail: '把错因回溯到概念、方法和先修关系',
      href: `/sky/cloud-mind/teaching?topic=${encodeURIComponent(topic)}`,
      icon: GraduationCap,
      tone: 'emerald',
      duration: { min: 20, max: 30 },
    },
    {
      id: 'memory',
      label: '收束',
      title: '沉淀为记忆卡片',
      detail: '把薄弱点转成可反复复习的材料',
      href: buildMemoryHref(topic, relatedTopics),
      icon: Layers,
      tone: 'rose',
      duration: { min: 8, max: 15 },
    },
  ];
}

function fallbackTopics(insights: LearningInsights): LearningInsightTopic[] {
  if (insights.topTopics.length > 0) return insights.topTopics;
  return [
    {
      name: insights.focusTopic,
      score: 60,
      mastery: insights.metrics.averageMastery || 50,
      mistakeCount: insights.metrics.totalMistakes,
      dueCount: insights.metrics.dueReviewCount,
      unreviewedCount: insights.metrics.reviewBacklogCount,
      dominantCause: null,
      reason: '等待更多数据完善路线',
    },
  ];
}

function buildDailyTaskAction(
  insights: LearningInsights,
  missionSteps: MissionStep[],
): DailyTaskAction {
  if (insights.metrics.dueReviewCount > 0) {
    return {
      title: `处理 ${insights.metrics.dueReviewCount} 道到期复习`,
      detail:
        insights.metrics.overdueReviewCount > 0
          ? `其中 ${insights.metrics.overdueReviewCount} 道已逾期，点击后直接进入沉浸复习`
          : '点击后直接进入今日沉浸复习',
      href: withQueryParam(getWorkshopFeatureHref('review'), 'dailyTask', '1'),
      icon: CalendarClock,
      feature: 'review',
      autoStartReview: true,
      duration:
        missionSteps.find((step) => step.id === 'review')?.duration ??
        estimateReviewDuration(insights),
    };
  }

  if (insights.metrics.reviewBacklogCount > 0) {
    return {
      title: `补齐 ${insights.metrics.reviewBacklogCount} 道错题闭环`,
      detail: '先进入复习计划，确认下一轮复习节奏',
      href: getWorkshopFeatureHref('review'),
      icon: BookOpenCheck,
      feature: 'review',
      duration:
        missionSteps.find((step) => step.id === 'review')?.duration ??
        estimateReviewDuration(insights),
    };
  }

  if (insights.topTopics.length > 0) {
    const quizStep = missionSteps.find((step) => step.id === 'quiz') ?? missionSteps[1];
    return {
      title: `围绕「${insights.focusTopic}」做针对练习`,
      detail: '用一组同类题验证薄弱点是否真正补上',
      href: quizStep.href,
      icon: Target,
      duration: quizStep.duration,
    };
  }

  const diagnoseStep = missionSteps.find((step) => step.id === 'diagnose') ?? missionSteps[0];
  return {
    title: '先完成一次诊断采样',
    detail: '通过拍照搜题或手动输入题目，让系统生成你的学习画像',
    href: diagnoseStep.href,
    icon: Sparkles,
    duration: diagnoseStep.duration,
  };
}

function normalizeSnapshotMistake(mistake: WorkshopSnapshot['mistakes'][number]): MistakeRecord {
  return {
    ...mistake,
    solvedAt: new Date(mistake.solvedAt),
    source:
      mistake.source === 'classroom-diagnostic'
        ? 'classroom-quiz'
        : (mistake.source as MistakeRecord['source']),
  };
}

export function WorkshopPage() {
  return (
    <Suspense
      fallback={
        <SkyAppShell>
          <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center text-sm text-muted-foreground">
            加载天梯工坊...
          </div>
        </SkyAppShell>
      }
    >
      <WorkshopPageContent />
    </Suspense>
  );
}

function WorkshopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<WorkshopSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const mistakes = useSkyClassroomStore((state) => state.mistakes);
  const memoryProgress = useSkyClassroomStore((state) => state.memoryProgress);
  const prioritizeReview = useSkyClassroomStore((state) => state.prioritizeReview);
  const tabParam = searchParams.get('tab');
  const snapshotMistakes = useMemo(
    () => snapshot?.mistakes.map(normalizeSnapshotMistake) ?? null,
    [snapshot],
  );
  const effectiveMistakes = snapshotMistakes ?? mistakes;
  const effectiveMemoryProgress = useMemo(() => {
    const serverProgress = snapshot?.memoryProgress;
    if (!serverProgress) return memoryProgress;

    const latestLocal = memoryProgress.lastStudied ?? 0;
    const latestServer = serverProgress.lastStudied ?? 0;
    return {
      totalFlipped: Math.max(memoryProgress.totalFlipped, serverProgress.totalFlipped),
      topicCount: Math.max(memoryProgress.topicCount, serverProgress.topicCount),
      lastStudied: Math.max(latestLocal, latestServer) || null,
    };
  }, [memoryProgress, snapshot?.memoryProgress]);
  const insights = useMemo(
    () =>
      buildLearningInsights(effectiveMistakes, effectiveMemoryProgress, Date.now(), {
        profile: snapshot?.profile,
        learningStats: snapshot?.learningStats,
        review: snapshot?.review,
      }),
    [effectiveMistakes, effectiveMemoryProgress, snapshot],
  );
  const missionSteps = useMemo(() => buildMissionSteps(insights), [insights]);
  const missionDuration = useMemo(
    () => sumDurations(missionSteps.map((step) => step.duration)),
    [missionSteps],
  );
  const dailyTaskAction = useMemo(
    () => buildDailyTaskAction(insights, missionSteps),
    [insights, missionSteps],
  );
  const allRouteTopics = useMemo(() => fallbackTopics(insights), [insights]);
  const routeTopics = allRouteTopics.slice(0, 3);
  const routeOverflowCount = Math.max(allRouteTopics.length - routeTopics.length, 0);
  const visibleSignals = insights.dataHealth.signals.slice(0, 3);
  const priorityTopics = insights.topTopics.map((topic) => topic.name);

  const loadWorkshopSnapshot = useCallback(async (forceRefresh = false) => {
    setLoadingSnapshot(true);
    setSnapshotError(null);
    try {
      syncMistakesFromQuizzes();
      const response = await fetch(`/api/sky/workshop${forceRefresh ? '?force=true' : ''}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? '天梯工坊数据加载失败');
      }

      const nextSnapshot: WorkshopSnapshot = {
        generatedAt: data.generatedAt ?? Date.now(),
        mistakes: Array.isArray(data.mistakes) ? data.mistakes : [],
        review: data.review ?? null,
        learningStats: data.learningStats ?? null,
        memoryProgress: data.memoryProgress ?? null,
        profile: data.profile ?? null,
      };
      setSnapshot(nextSnapshot);
      const store = useSkyClassroomStore.getState();
      store.mergeMistakes(nextSnapshot.mistakes.map(normalizeSnapshotMistake));
      if (nextSnapshot.memoryProgress) {
        const latestLocal = store.memoryProgress.lastStudied ?? 0;
        const latestServer = nextSnapshot.memoryProgress.lastStudied ?? 0;
        store.updateMemoryProgress({
          totalFlipped: Math.max(
            store.memoryProgress.totalFlipped,
            nextSnapshot.memoryProgress.totalFlipped,
          ),
          topicCount: Math.max(
            store.memoryProgress.topicCount,
            nextSnapshot.memoryProgress.topicCount,
          ),
          lastStudied: Math.max(latestLocal, latestServer) || null,
        });
      }
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : '天梯工坊数据加载失败');
    } finally {
      setLoadingSnapshot(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkshopSnapshot();
  }, [loadWorkshopSnapshot]);

  useEffect(() => {
    if (!isLearningFeatureKey(tabParam)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('tab');
    const query = params.toString();
    router.replace(appendQueryString(getWorkshopFeatureHref(tabParam), query), {
      scroll: false,
    });
  }, [router, searchParams, tabParam]);

  const MainIcon = dailyTaskAction.icon;

  const handleStartDailyTask = () => {
    try {
      localStorage.setItem('sky-workshop-daily-task-started', new Date().toISOString());
    } catch {
      /* non-critical */
    }

    if (dailyTaskAction.feature) {
      const featureHref = getWorkshopFeatureHref(dailyTaskAction.feature);
      const href = dailyTaskAction.autoStartReview
        ? withQueryParam(featureHref, 'dailyTask', '1')
        : featureHref;
      router.push(href);
      return;
    }
    router.push(dailyTaskAction.href);
  };

  const handleOpenFullProfile = () => {
    router.push(getWorkshopFeatureHref('profile'));
  };

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-5 pb-8">
        <section className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/85 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-cyan-100/10 dark:bg-[#07111f]/95 dark:shadow-[0_24px_72px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="grid border-b border-slate-200/70 dark:border-cyan-100/10 lg:grid-cols-[minmax(0,1fr)_520px]">
            <div className="bg-[linear-gradient(135deg,#f0fdf4_0%,#f0f9ff_52%,#f8fafc_100%)] px-5 py-5 dark:bg-[linear-gradient(135deg,#123346_0%,#0d2438_52%,#0b1729_100%)] md:px-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-200/30 dark:bg-emerald-300/10 dark:text-emerald-100">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-200/25 dark:bg-emerald-300/10 dark:text-emerald-100">
                  天梯工坊
                </span>
                <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:shadow-none">
                  {insights.strategyLabel}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 dark:text-white md:text-3xl">
                {insights.headline}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-200 md:line-clamp-2">
                {insights.focusReason}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-300">
                <span>
                  数据来源：
                  {snapshot ? '云端实时快照' : '本地学习缓存'}
                  {snapshot?.generatedAt
                    ? ` · ${new Date(snapshot.generatedAt).toLocaleTimeString()} 更新`
                    : ''}
                </span>
                {snapshotError && (
                  <span className="text-amber-600 dark:text-amber-100">· {snapshotError}</span>
                )}
                <button
                  type="button"
                  onClick={() => loadWorkshopSnapshot(true)}
                  disabled={loadingSnapshot}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100 dark:shadow-none dark:hover:bg-white/[0.08]"
                >
                  <RefreshCw className={cn('h-3 w-3', loadingSnapshot && 'animate-spin')} />
                  刷新数据
                </button>
              </div>
            </div>

            <aside className="border-t border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#eef9ff_52%,#f8fafc_100%)] p-5 shadow-[inset_1px_0_0_rgba(16,185,129,0.12)] dark:border-emerald-200/15 dark:bg-[linear-gradient(135deg,#0f3035_0%,#0b2530_48%,#081827_100%)] dark:shadow-[inset_1px_0_0_rgba(167,243,208,0.08)] lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-100">
                  今日任务
                </span>
                <span className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-emerald-700 shadow-sm dark:border-emerald-200/20 dark:bg-emerald-300/10 dark:text-emerald-50 dark:shadow-none">
                  {formatDuration(dailyTaskAction.duration)}
                </span>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_10px_26px_rgba(16,185,129,0.22)] dark:bg-emerald-300 dark:text-slate-950 dark:shadow-[0_10px_26px_rgba(52,211,153,0.18)]">
                  <MainIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-base font-semibold leading-6 text-slate-950 dark:text-white">
                    {dailyTaskAction.title}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {dailyTaskAction.detail}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={handleStartDailyTask}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,185,129,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-emerald-700 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200"
                >
                  <MainIcon className="h-4 w-4" />
                  开始今日任务
                </button>
                <button
                  type="button"
                  onClick={handleOpenFullProfile}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-slate-100 dark:shadow-none dark:hover:border-indigo-200/40 dark:hover:bg-white/[0.09]"
                >
                  <ShieldCheck className="h-4 w-4 text-indigo-500 dark:text-indigo-100" />
                  画像
                </button>
              </div>
            </aside>
          </div>

          <div className="flex flex-col gap-5 p-5">
            <details className="order-2 rounded-2xl border border-slate-200 bg-white/70 shadow-sm dark:border-cyan-100/10 dark:bg-[#0b1729]/80 dark:shadow-none">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/[0.05]">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-100" />
                  学习状态
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  展开实时概览
                </span>
              </summary>
              <div className="grid gap-3 border-t border-slate-200/70 p-4 dark:border-cyan-100/10 sm:grid-cols-2 lg:grid-cols-4">
                <MetricTile
                  icon={CalendarClock}
                  label="到期复习"
                  value={insights.metrics.dueReviewCount}
                  unit="题"
                />
                <MetricTile
                  icon={BookOpenCheck}
                  label="错题闭环"
                  value={insights.metrics.reviewBacklogCount}
                  unit="题"
                />
                <MetricTile
                  icon={BarChart3}
                  label="平均掌握"
                  value={insights.metrics.averageMastery}
                  unit="%"
                />
                <MetricTile
                  icon={Layers}
                  label="记忆主题"
                  value={insights.metrics.memoryTopicCount}
                  unit="个"
                />
              </div>
            </details>

            <section className="order-1 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-cyan-100/10 dark:bg-[#0b1729]/80 dark:shadow-none">
              <SectionTitle icon={Route} title="学习路线" aside={formatDuration(missionDuration)} />
              <div className="mt-4 grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-4">
                {missionSteps.map((step, index) => (
                  <MissionStepCard
                    key={step.id}
                    step={step}
                    index={index}
                    isLast={index === missionSteps.length - 1}
                  />
                ))}
              </div>
            </section>

            <details className="order-3 rounded-2xl border border-slate-200 bg-white/70 shadow-sm dark:border-cyan-100/10 dark:bg-[#0b1729]/80 dark:shadow-none">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/[0.05]">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-100" />
                  路线依据和完整路线
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">展开</span>
              </summary>
              <div className="grid gap-4 border-t border-slate-200/70 p-4 dark:border-cyan-100/10 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-cyan-100/10 dark:bg-[#0b1729]/80 dark:shadow-none">
                  <SectionTitle
                    icon={Activity}
                    title="推荐依据"
                    aside={insights.dataHealth.label}
                  />
                  <div className="mt-3 grid gap-2 md:grid-cols-3 lg:grid-cols-1">
                    {visibleSignals.map((signal) => (
                      <EvidenceSignal key={signal.label} signal={signal} />
                    ))}
                  </div>
                  {insights.causeSummary.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {insights.causeSummary.slice(0, 3).map((cause) => (
                        <Link
                          key={cause.cause}
                          href={getWorkshopFeatureHref('stats')}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 dark:border-cyan-100/10 dark:bg-white/[0.045] dark:text-slate-200 dark:hover:border-indigo-200/35"
                        >
                          {cause.label} {cause.count}
                        </Link>
                      ))}
                      {insights.causeSummary.length > 3 && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-cyan-100/10 dark:bg-white/[0.035] dark:text-slate-400">
                          +{insights.causeSummary.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-cyan-100/10 dark:bg-[#0b1729]/80 dark:shadow-none">
                  <SectionTitle
                    icon={Network}
                    title="天梯路线"
                    aside={routeOverflowCount > 0 ? `另有 ${routeOverflowCount} 个` : '薄弱点优先'}
                  />
                  <div className="mt-3 space-y-2">
                    {routeTopics.map((topic, index) => (
                      <RoutePreviewCard
                        key={`${topic.name}-${index}`}
                        topic={topic}
                        index={index}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(getWorkshopFeatureHref('graph'))}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/60 dark:border-cyan-100/10 dark:bg-white/[0.045] dark:text-slate-100 dark:shadow-none dark:hover:border-indigo-200/35 dark:hover:bg-white/[0.07]"
                    >
                      <Network className="h-4 w-4 text-cyan-600 dark:text-cyan-100" />
                      查看完整路线
                    </button>
                    {priorityTopics.length > 0 && (
                      <button
                        type="button"
                        onClick={() => prioritizeReview(priorityTopics)}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-200/25 dark:bg-emerald-300/10 dark:text-emerald-100 dark:hover:bg-emerald-300/15"
                      >
                        <CalendarClock className="h-4 w-4" />
                        加入复习
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[24px] border border-emerald-200 bg-white/85 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-emerald-200/20 dark:bg-[#07111f]/95 dark:shadow-[0_18px_55px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.04)]">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent dark:via-emerald-300/70" />
          <button
            type="button"
            onClick={() => setToolsExpanded((value) => !value)}
            aria-expanded={toolsExpanded}
            className="flex min-h-16 w-full items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-50/70 p-5 text-left transition-colors hover:bg-slate-100/70 dark:border-cyan-100/10 dark:bg-[#0b1729]/80 dark:hover:bg-[#10223a] md:p-6"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-3 text-base font-semibold text-slate-950 dark:text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-200/25 dark:bg-emerald-300/10 dark:text-emerald-100">
                  <BookOpenCheck className="h-4 w-4" />
                </span>
                更多工具
              </span>
              <span className="mt-2 block max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-300">
                有明确目标时再打开工具，今日任务会优先带你进入最合适的一项。
              </span>
            </span>
            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
              {toolsExpanded ? '收起' : '展开'}
            </span>
          </button>

          {toolsExpanded && (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
              {LEARNING_FEATURES.map((feature) => (
                <FeatureEntryCard key={feature.key} feature={feature} />
              ))}
            </div>
          )}
        </section>
      </div>
    </SkyAppShell>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  aside,
}: {
  icon: typeof Activity;
  title: string;
  aside: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-100" />
        {title}
      </div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{aside}</span>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="flex min-h-[76px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-cyan-100/10 dark:bg-[#0c182b] dark:shadow-none">
      <div className="flex min-w-0 items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-300">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-600 dark:border-cyan-100/12 dark:bg-cyan-200/10 dark:text-cyan-100">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="flex shrink-0 items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
          {value}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-300">{unit}</span>
      </div>
    </div>
  );
}

function MissionStepCard({
  step,
  index,
  isLast,
}: {
  step: MissionStep;
  index: number;
  isLast: boolean;
}) {
  const Icon = step.icon;
  const tone = toneClasses[step.tone];
  return (
    <div className="relative h-full">
      {!isLast && (
        <span className="absolute left-[calc(100%-2px)] top-9 z-0 hidden h-px w-4 bg-slate-200 dark:bg-cyan-100/15 xl:block" />
      )}
      <Link
        href={step.href}
        className="group relative z-10 flex h-full min-h-[132px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-cyan-100/10 dark:bg-[#081423] dark:shadow-none dark:hover:border-emerald-200/35 dark:hover:bg-[#0f2238]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-200">
              {formatDuration(step.duration)}
            </span>
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border',
                tone.chip,
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className={cn('mt-4 text-[11px] font-semibold', tone.text)}>{step.label}</div>
        <div className="mt-1 line-clamp-1 text-sm font-semibold text-slate-950 dark:text-slate-100">
          {step.title}
        </div>
        <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {step.detail}
        </div>
        <div className="mt-auto flex items-center gap-1 pt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-100">
          去完成
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Link>
    </div>
  );
}

function RoutePreviewCard({ topic, index }: { topic: LearningInsightTopic; index: number }) {
  return (
    <Link
      href={getWorkshopFeatureHref('graph')}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-cyan-100/10 dark:bg-[#081423] dark:shadow-none dark:hover:border-emerald-200/35 dark:hover:bg-[#0f2238]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-xs font-semibold text-cyan-700 dark:border-cyan-100/12 dark:bg-cyan-200/10 dark:text-cyan-100">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {topic.name}
        </div>
        <div className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
          {topic.reason} · {topic.mistakeCount} 题样本
        </div>
      </div>
      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 dark:border-cyan-100/10 dark:bg-white/[0.04] dark:text-slate-200">
        {topic.mastery}%
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-slate-500 dark:group-hover:text-emerald-100" />
    </Link>
  );
}

function FeatureEntryCard({ feature }: { feature: (typeof LEARNING_FEATURES)[number] }) {
  const Icon = feature.icon;
  const href = getWorkshopFeatureHref(feature.key);

  return (
    <Link
      href={href}
      className="group relative flex min-h-[168px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/40 hover:shadow-[0_16px_38px_rgba(15,23,42,0.08)] dark:border-cyan-100/10 dark:bg-[#081423] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] dark:hover:border-emerald-200/40 dark:hover:bg-[#10223a] dark:hover:shadow-[0_16px_38px_rgba(0,0,0,0.22)]"
    >
      <span className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent dark:via-emerald-200/55" />
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-[0_10px_28px_rgba(16,185,129,0.08)] transition-colors group-hover:bg-emerald-100 dark:border-emerald-200/20 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[0_10px_28px_rgba(52,211,153,0.08)] dark:group-hover:bg-emerald-300/15">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-5 text-base font-semibold text-slate-950 dark:text-white">
        {feature.label}
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {feature.desc}
      </p>
      <span className="mt-auto pt-4 text-xs font-semibold text-emerald-700 opacity-80 transition-opacity group-hover:opacity-100 dark:text-emerald-100">
        进入工具
      </span>
    </Link>
  );
}

function EvidenceSignal({ signal }: { signal: LearningInsights['dataHealth']['signals'][number] }) {
  return (
    <div className="flex min-h-[62px] items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-cyan-100/10 dark:bg-[#081423] dark:shadow-none">
      <CheckCircle2
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          signal.ready
            ? 'text-emerald-500 dark:text-emerald-200'
            : 'text-slate-300 dark:text-slate-500',
        )}
      />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {signal.label}
        </div>
        <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {signal.detail}
        </div>
      </div>
    </div>
  );
}
