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
  LayoutDashboard,
  Network,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import {
  LearningPlanPanel,
  type LearningPlanPanelData,
} from '@/components/sky/learning/learning-plan-panel';
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
import type { DailyReviewPath } from '@/lib/sky/daily-review-path';

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
  dailyReviewPath?: DailyReviewPath;
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

async function markLearningPlanTaskInProgress(taskId: string): Promise<void> {
  const response = await fetch(`/api/sky/learning-plan/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in-progress' }),
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
  } | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error ?? '计划任务启动失败');
  }
}

const toneClasses: Record<MissionTone, { chip: string; text: string; line: string }> = {
  amber: {
    chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-200/25 dark:bg-amber-300/10 dark:text-amber-100',
    text: 'text-amber-700 dark:text-amber-100',
    line: 'from-amber-300/60 dark:from-amber-300/50',
  },
  violet: {
    chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-200/25 dark:bg-sky-300/10 dark:text-sky-100',
    text: 'text-sky-700 dark:text-sky-100',
    line: 'from-sky-300/60 dark:from-sky-300/50',
  },
  emerald: {
    chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-200/25 dark:bg-sky-300/10 dark:text-sky-100',
    text: 'text-sky-700 dark:text-sky-100',
    line: 'from-sky-300/60 dark:from-sky-300/50',
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
        title: '完成一次入门练习',
        detail: '拍照搜题或手动输入题目，让系统留下第一批学习记录',
        href: '/sky/cloud-mind/solve?source=workshop-chain',
        icon: Sparkles,
        tone: 'emerald',
        duration: { min: 5, max: 10 },
      },
      {
        id: 'profile',
        label: '第二步',
        title: '了解学习情况',
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
        href: '/sky/learning/path',
        icon: Network,
        tone: 'amber',
        feature: 'graph',
        duration: { min: 5, max: 8 },
      },
      {
        id: 'quiz',
        label: '收束',
        title: '做一组针对练习',
        detail: '用 5 道同类题看看系统是否了解你的情况',
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
      href: '/sky/cloud-mind/memory',
      icon: CalendarClock,
      tone: 'amber',
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
      href: '/sky/cloud-mind/memory',
      icon: CalendarClock,
      duration:
        missionSteps.find((step) => step.id === 'review')?.duration ??
        estimateReviewDuration(insights),
    };
  }

  if (insights.metrics.reviewBacklogCount > 0) {
    return {
      title: `补齐 ${insights.metrics.reviewBacklogCount} 道错题闭环`,
      detail: '先进入复习计划，确认下一轮复习节奏',
      href: '/sky/cloud-mind/memory',
      icon: BookOpenCheck,
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
    title: '先完成一次入门练习',
    detail: '通过拍照搜题或手动输入题目，让系统逐步了解你的学习情况',
    href: diagnoseStep.href,
    icon: Sparkles,
    duration: diagnoseStep.duration,
  };
}

export function buildPlannedDailyTaskAction(
  data: LearningPlanPanelData | null,
  fallback: DailyTaskAction,
): DailyTaskAction {
  if (!data?.plan || !data.view) return fallback;

  const task = data.view.nextTask;
  if (task) {
    return {
      title: task.title,
      detail: task.objective,
      href: task.actionHref ?? '/sky/learning/path',
      icon: CalendarClock,
      duration: { min: task.plannedMinutes, max: task.plannedMinutes },
    };
  }

  if (data.view.summary.totalTasks > 0 && data.view.summary.completionRate === 100) {
    return {
      title: '今日计划已完成',
      detail: '今日学习任务已全部完成。下一批任务会继续按你的学习安排推进。',
      href: '/sky/learning/path',
      icon: CheckCircle2,
      duration: { min: 0, max: 0 },
    };
  }

  return {
    title: '今日为计划缓冲日',
    detail: '算法已结合时间预算和休息日安排，今天无需追加任务。',
    href: '/sky/learning/path',
    icon: Route,
    duration: { min: 0, max: 0 },
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
        <SkyAppShell section="learning" fullBleed>
          <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4 text-sm text-muted-foreground">
            加载学习工作台...
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
  const [learningPlanData, setLearningPlanData] = useState<LearningPlanPanelData | null>(null);
  const [learningPlanError, setLearningPlanError] = useState<string | null>(null);
  const [startingDailyTask, setStartingDailyTask] = useState(false);
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
  const fallbackDailyTaskAction = useMemo(
    () => buildDailyTaskAction(insights, missionSteps),
    [insights, missionSteps],
  );
  const dailyTaskAction = useMemo(
    () => buildPlannedDailyTaskAction(learningPlanData, fallbackDailyTaskAction),
    [fallbackDailyTaskAction, learningPlanData],
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
        throw new Error(data?.error ?? '学习工作台数据加载失败');
      }

      const nextSnapshot: WorkshopSnapshot = {
        generatedAt: data.generatedAt ?? Date.now(),
        mistakes: Array.isArray(data.mistakes) ? data.mistakes : [],
        review: data.review ?? null,
        dailyReviewPath: data.dailyReviewPath ?? undefined,
        learningStats: data.learningStats ?? null,
        memoryProgress: data.memoryProgress ?? null,
        profile: data.profile ?? null,
      };
      setSnapshot(nextSnapshot);
      const store = useSkyClassroomStore.getState();
      const normalized = nextSnapshot.mistakes.map(normalizeSnapshotMistake);
      if (data.dataSources?.replaceMistakes) {
        useSkyClassroomStore.setState({ mistakes: normalized });
      } else {
        store.mergeMistakes(normalized);
      }
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
      setSnapshotError(error instanceof Error ? error.message : '学习工作台数据加载失败');
    } finally {
      setLoadingSnapshot(false);
    }
  }, []);

  const loadLearningPlan = useCallback(async () => {
    setLearningPlanError(null);
    try {
      const response = await fetch('/api/sky/learning-plan?view=today', {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? '个人学习计划加载失败');
      }
      setLearningPlanData(data.data as LearningPlanPanelData);
    } catch (error) {
      setLearningPlanError(error instanceof Error ? error.message : '个人学习计划加载失败');
    }
  }, []);

  useEffect(() => {
    void loadWorkshopSnapshot();
  }, [loadWorkshopSnapshot]);

  useEffect(() => {
    void loadLearningPlan();
  }, [loadLearningPlan]);

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
  const planView = learningPlanData?.view;
  const hasPlannedTask = Boolean(learningPlanData?.plan && planView?.nextTask);
  const planDayCompleted = Boolean(
    learningPlanData?.plan &&
    planView &&
    planView.summary.totalTasks > 0 &&
    planView.summary.completionRate === 100,
  );
  const dailyTaskDurationLabel =
    learningPlanData?.plan && planView && !planView.nextTask
      ? planDayCompleted
        ? '今日完成'
        : '计划缓冲'
      : formatDuration(dailyTaskAction.duration);
  const dailyTaskButtonLabel = hasPlannedTask
    ? planView?.nextTask?.status === 'in-progress'
      ? '继续计划任务'
      : '开始计划任务'
    : learningPlanData?.plan && planView
      ? '查看个人学习安排'
      : '开始今日任务';

  const handlePlanChanged = useCallback(async () => {
    await Promise.all([loadLearningPlan(), loadWorkshopSnapshot(true)]);
  }, [loadLearningPlan, loadWorkshopSnapshot]);

  const handleStartDailyTask = async () => {
    try {
      localStorage.setItem('sky-workshop-daily-task-started', new Date().toISOString());
    } catch {
      /* non-critical */
    }

    if (hasPlannedTask && planView?.nextTask) {
      setStartingDailyTask(true);
      setLearningPlanError(null);
      try {
        await markLearningPlanTaskInProgress(planView.nextTask.id);
        await loadLearningPlan();
      } catch (error) {
        setLearningPlanError(error instanceof Error ? error.message : '计划任务启动失败');
      } finally {
        setStartingDailyTask(false);
      }
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
    <SkyAppShell section="learning" fullBleed>
      <div className=" px-4 pt-6 pb-12 sm:px-6">
        <div data-tour-step="page-header" className="mb-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
                学习工作台
              </h1>
              <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                {insights.headline}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {snapshotError && (
              <span className="text-xs text-amber-600 dark:text-amber-100">{snapshotError}</span>
            )}
            <span className="hidden text-xs text-slate-400 dark:text-slate-500 md:inline">
              {snapshot?.generatedAt
                ? `更新于 ${new Date(snapshot.generatedAt).toLocaleTimeString()}`
                : '本地学习缓存'}
            </span>
            <button
              type="button"
              onClick={() => loadWorkshopSnapshot(true)}
              disabled={loadingSnapshot}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100 dark:shadow-none dark:hover:bg-white/[0.08]"
            >
              <RefreshCw className={cn('h-3 w-3', loadingSnapshot && 'animate-spin')} />
              刷新数据
            </button>
            <Link
              href="/sky/learning/profile-dashboard"
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 shadow-sm transition-colors hover:bg-sky-100 dark:border-sky-200/25 dark:bg-sky-300/10 dark:text-sky-100 dark:shadow-none dark:hover:bg-sky-300/20"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              学习情况总览
            </Link>
          </div>
        </div>

        <div className=" space-y-6">
          <section
            id="daily-task"
            className="scroll-mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-sky-100/10 dark:bg-[#0b1729]/80 dark:shadow-none"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                今日任务
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                {dailyTaskDurationLabel}
              </span>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-[0_10px_26px_rgba(56,189,248,0.22)] dark:bg-sky-300 dark:text-slate-950 dark:shadow-[0_10px_26px_rgba(56,189,248,0.18)]">
                <MainIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-base font-semibold leading-6 text-slate-950 dark:text-white">
                  {dailyTaskAction.title}
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                  {dailyTaskAction.detail}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleStartDailyTask}
                disabled={startingDailyTask}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(56,189,248,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200"
              >
                <MainIcon className="h-4 w-4" />
                {dailyTaskButtonLabel}
              </button>
              <button
                type="button"
                onClick={handleOpenFullProfile}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-slate-100 dark:shadow-none dark:hover:border-blue-200/40 dark:hover:bg-white/[0.09]"
              >
                <ShieldCheck className="h-4 w-4 text-blue-500 dark:text-blue-100" />
                学习情况
              </button>
            </div>
          </section>

          <div id="learning-plan" className="scroll-mt-5">
            <LearningPlanPanel
              initialData={learningPlanData}
              error={learningPlanError ?? undefined}
              onPlanChanged={handlePlanChanged}
            />
          </div>

          {snapshot?.dailyReviewPath && (
            <DailyReviewPathSection path={snapshot.dailyReviewPath} loading={loadingSnapshot} />
          )}

          <section className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/85 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-sky-100/10 dark:bg-[#07111f]/95 dark:shadow-[0_24px_72px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex flex-col gap-5 p-5">
              <LearningLoopRail
                focusTopic={insights.focusTopic}
                routeTopicCount={routeTopics.length}
                hasSignals={insights.hasSignals}
                dailyTaskTitle={dailyTaskAction.title}
                dailyTaskHref={dailyTaskAction.href}
              />

              <details className="order-2 rounded-2xl border border-slate-200 bg-white/70 shadow-sm dark:border-sky-100/10 dark:bg-[#0b1729]/80 dark:shadow-none">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/[0.05]">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-sky-600 dark:text-sky-100" />
                    学习情况
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    展开实时概览
                  </span>
                </summary>
                <div className="grid gap-3 border-t border-slate-200/70 p-4 dark:border-sky-100/10 sm:grid-cols-2 lg:grid-cols-4">
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

              <section className="order-1 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-sky-100/10 dark:bg-[#0b1729]/80 dark:shadow-none">
                <SectionTitle
                  icon={Route}
                  title="学习路线"
                  aside={formatDuration(missionDuration)}
                />
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

              <details className="order-3 rounded-2xl border border-slate-200 bg-white/70 shadow-sm dark:border-sky-100/10 dark:bg-[#0b1729]/80 dark:shadow-none">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/[0.05]">
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-sky-600 dark:text-sky-100" />
                    路线依据和完整路线
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    展开
                  </span>
                </summary>
                <div className="grid gap-4 border-t border-slate-200/70 p-4 dark:border-sky-100/10 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-sky-100/10 dark:bg-[#0b1729]/80 dark:shadow-none">
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
                            href="/sky/learning/profile-dashboard"
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50 dark:border-sky-100/10 dark:bg-white/[0.045] dark:text-slate-200 dark:hover:border-blue-200/35"
                          >
                            {cause.label} {cause.count}
                          </Link>
                        ))}
                        {insights.causeSummary.length > 3 && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-sky-100/10 dark:bg-white/[0.035] dark:text-slate-400">
                            +{insights.causeSummary.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-sky-100/10 dark:bg-[#0b1729]/80 dark:shadow-none">
                    <SectionTitle
                      icon={Network}
                      title="天梯路线"
                      aside={
                        routeOverflowCount > 0 ? `另有 ${routeOverflowCount} 个` : '薄弱点优先'
                      }
                    />
                    <div className=" mt-3 space-y-2">
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
                        onClick={() => router.push('/sky/learning/path')}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/60 dark:border-sky-100/10 dark:bg-white/[0.045] dark:text-slate-100 dark:shadow-none dark:hover:border-blue-200/35 dark:hover:bg-white/[0.07]"
                      >
                        <Network className="h-4 w-4 text-sky-600 dark:text-sky-100" />
                        查看完整路线
                      </button>
                      {priorityTopics.length > 0 && (
                        <button
                          type="button"
                          onClick={() => prioritizeReview(priorityTopics)}
                          className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-200/25 dark:bg-sky-300/10 dark:text-sky-100 dark:hover:bg-sky-300/15"
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

          <section className="relative overflow-hidden rounded-[24px] border border-sky-200 bg-white/85 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-sky-200/20 dark:bg-[#07111f]/95 dark:shadow-[0_18px_55px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-sky-400/50 to-transparent dark:via-sky-300/70" />
            <button
              type="button"
              onClick={() => setToolsExpanded((value) => !value)}
              aria-expanded={toolsExpanded}
              className="flex min-h-16 w-full items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-50/70 p-5 text-left transition-colors hover:bg-slate-100/70 dark:border-sky-100/10 dark:bg-[#0b1729]/80 dark:hover:bg-[#10223a] md:p-6"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-3 text-base font-semibold text-slate-950 dark:text-white">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-200/25 dark:bg-sky-300/10 dark:text-sky-100">
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
        <Icon className="h-4 w-4 text-sky-600 dark:text-sky-100" />
        {title}
      </div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{aside}</span>
    </div>
  );
}

function LearningLoopRail({
  focusTopic,
  routeTopicCount,
  hasSignals,
  dailyTaskTitle,
  dailyTaskHref,
}: {
  focusTopic: string;
  routeTopicCount: number;
  hasSignals: boolean;
  dailyTaskTitle: string;
  dailyTaskHref: string;
}) {
  const steps = [
    {
      label: '知识底座',
      title: '知识地图',
      detail: routeTopicCount > 0 ? `已定位 ${routeTopicCount} 个重点` : '完成练习后建立地图',
      href: '/sky/learning/graph',
      icon: Network,
      tone: 'text-sky-700 dark:text-sky-200',
      bg: 'bg-sky-500/10',
    },
    {
      label: '学习画像',
      title: hasSignals ? '画像已更新' : '建立学习画像',
      detail: hasSignals ? `当前关注 ${focusTopic}` : '先完成一次练习留下证据',
      href: '/sky/learning/profile',
      icon: ShieldCheck,
      tone: 'text-sky-700 dark:text-sky-200',
      bg: 'bg-sky-500/10',
    },
    {
      label: '智能决策',
      title: '今日任务',
      detail: dailyTaskTitle,
      href: '#daily-task',
      icon: Target,
      tone: 'text-sky-700 dark:text-sky-200',
      bg: 'bg-sky-500/10',
    },
    {
      label: '学习反馈',
      title: '更新下一步',
      detail: '完成后重新评估掌握度和复习节奏',
      href: dailyTaskHref,
      icon: RefreshCw,
      tone: 'text-amber-700 dark:text-amber-200',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <section
      id="learning-loop"
      className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-sky-100/10 dark:bg-[#0b1729]/80 dark:shadow-none"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Activity className="h-4 w-4 text-sky-600 dark:text-sky-100" />
            学习闭环
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            系统根据知识状态决定今天学什么，完成后继续更新下一步。
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          知识底座 → 决策 → 反馈
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.label}
              href={step.href}
              className="group relative flex min-h-24 items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition-colors hover:border-sky-300 hover:bg-sky-50/40 dark:border-sky-100/10 dark:bg-[#081423] dark:hover:border-sky-200/35 dark:hover:bg-[#0f2238]"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${step.bg} ${step.tone}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  {index + 1}. {step.label}
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {step.title}
                </span>
                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {step.detail}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
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
    <div className="flex min-h-[76px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-sky-100/10 dark:bg-[#0c182b] dark:shadow-none">
      <div className="flex min-w-0 items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-300">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-100/12 dark:bg-sky-200/10 dark:text-sky-100">
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
        <span className="absolute left-[calc(100%-2px)] top-9 z-0 hidden h-px w-4 bg-slate-200 dark:bg-sky-100/15 xl:block" />
      )}
      <Link
        href={step.href}
        className="group relative z-10 flex h-full min-h-[132px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50/40 dark:border-sky-100/10 dark:bg-[#081423] dark:shadow-none dark:hover:border-sky-200/35 dark:hover:bg-[#0f2238]"
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
        <div className="mt-auto flex items-center gap-1 pt-3 text-xs font-semibold text-sky-700 dark:text-sky-100">
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
      href="/sky/learning/path"
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50/40 dark:border-sky-100/10 dark:bg-[#081423] dark:shadow-none dark:hover:border-sky-200/35 dark:hover:bg-[#0f2238]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-xs font-semibold text-sky-700 dark:border-sky-100/12 dark:bg-sky-200/10 dark:text-sky-100">
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
      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 dark:border-sky-100/10 dark:bg-white/[0.04] dark:text-slate-200">
        {topic.mastery}%
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600 dark:text-slate-500 dark:group-hover:text-sky-100" />
    </Link>
  );
}

function FeatureEntryCard({ feature }: { feature: (typeof LEARNING_FEATURES)[number] }) {
  const Icon = feature.icon;
  const href = getWorkshopFeatureHref(feature.key);

  return (
    <Link
      href={href}
      className="group relative flex min-h-[168px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/40 hover:shadow-[0_16px_38px_rgba(15,23,42,0.08)] dark:border-sky-100/10 dark:bg-[#081423] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] dark:hover:border-sky-200/40 dark:hover:bg-[#10223a] dark:hover:shadow-[0_16px_38px_rgba(0,0,0,0.22)]"
    >
      <span className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent dark:via-sky-200/55" />
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-600 shadow-[0_10px_28px_rgba(56,189,248,0.08)] transition-colors group-hover:bg-sky-100 dark:border-sky-200/20 dark:bg-sky-300/10 dark:text-sky-100 dark:shadow-[0_10px_28px_rgba(56,189,248,0.08)] dark:group-hover:bg-sky-300/15">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-5 text-base font-semibold text-slate-950 dark:text-white">
        {feature.label}
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {feature.desc}
      </p>
      <span className="mt-auto pt-4 text-xs font-semibold text-sky-700 opacity-80 transition-opacity group-hover:opacity-100 dark:text-sky-100">
        进入工具
      </span>
    </Link>
  );
}

function DailyReviewPathSection({ path, loading }: { path: DailyReviewPath; loading: boolean }) {
  const router = useRouter();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  if (loading) {
    return (
      <section className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/85 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-sky-100/10 dark:bg-[#07111f]/95 dark:shadow-[0_24px_72px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="p-5">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
          <div className=" mt-4 space-y-2">
            <div className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-white/5" />
            <div className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-white/5" />
          </div>
        </div>
      </section>
    );
  }

  const { today, upcoming, summary } = path;
  const hasItems = today.items.length > 0;
  const hasDueItems = summary.totalDue > 0;

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/85 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-sky-100/10 dark:bg-[#07111f]/95 dark:shadow-[0_24px_72px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <CalendarClock className="h-4 w-4 text-amber-500" />
            每日复习路径
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {summary.overdueCount > 0 && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-600 dark:border-rose-200/25 dark:bg-rose-300/10 dark:text-rose-100">
                {summary.overdueCount} 道逾期
              </span>
            )}
            {summary.weakPointItems > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:border-amber-200/25 dark:bg-amber-300/10 dark:text-amber-100">
                {summary.weakPointItems} 道薄弱点
              </span>
            )}
            <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
              约 {summary.estimatedMinutes} 分钟
            </span>
          </div>
        </div>

        {hasDueItems ? (
          <>
            <div className=" mt-4 space-y-1.5">
              {today.items.map((item) => (
                <button
                  key={item.mistakeId}
                  type="button"
                  onClick={() => router.push('/sky/learning/mistake-book')}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs transition-colors hover:border-amber-300/40 hover:bg-amber-50/50 dark:border-sky-100/10 dark:hover:border-amber-300/20 dark:hover:bg-amber-300/5"
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      item.dueDays < 0
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-300/15 dark:text-rose-100'
                        : item.dueDays === 0
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-300/15 dark:text-amber-100'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-300/15 dark:text-sky-100',
                    )}
                  >
                    {item.dueDays < 0 ? '逾期' : item.dueDays === 0 ? '今日' : `D${item.dueDays}`}
                  </span>
                  <span className="flex-1 truncate">{item.problem}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {item.weakPoint && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-300/10 dark:text-amber-100">
                        薄弱
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                      第{item.reviewRound}轮
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {upcoming.length > 0 && (
              <details className="mt-4">
                <summary
                  className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  onClick={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    const open = target.closest('details')?.open;
                    setExpandedDay(open ? null : 'upcoming');
                  }}
                >
                  <span className="inline-block h-px flex-1 bg-slate-200 dark:bg-sky-100/10" />
                  未来 {upcoming.length} 天安排
                  <span className="inline-block h-px flex-1 bg-slate-200 dark:bg-sky-100/10" />
                </summary>
                <div className=" mt-3 space-y-2">
                  {upcoming.map((day) => (
                    <div
                      key={day.date}
                      className="rounded-lg border border-slate-200 px-3 py-2 dark:border-sky-100/10"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {day.dayLabel}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {day.count} 道 · 约 {day.estimatedMinutes} 分钟
                        </span>
                      </div>
                      {day.items.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {day.items.slice(0, 3).map((item) => (
                            <span
                              key={item.mistakeId}
                              className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-white/[0.05] dark:text-slate-300"
                              title={item.problem}
                            >
                              {item.problem.slice(0, 20)}...
                            </span>
                          ))}
                          {day.items.length > 3 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400 dark:bg-white/[0.05] dark:text-slate-500">
                              +{day.items.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-300/20 dark:bg-sky-300/[0.07] dark:text-sky-200">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              今日无待复习的错题
            </div>
            <p className="mt-1 text-xs text-sky-600/80 dark:text-sky-200/70">
              所有错题已掌握或在复习计划中，可以去做一组新题巩固薄弱点。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function EvidenceSignal({ signal }: { signal: LearningInsights['dataHealth']['signals'][number] }) {
  return (
    <div className="flex min-h-[62px] items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-sky-100/10 dark:bg-[#081423] dark:shadow-none">
      <CheckCircle2
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          signal.ready ? 'text-sky-500 dark:text-sky-200' : 'text-slate-300 dark:text-slate-500',
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
