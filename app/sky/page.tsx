'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { isDocumentVisible } from '@/lib/hooks/use-document-visibility';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Camera,
  Route,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { MistakeReviewStrip } from '@/components/sky/learning/mistake-review-strip';
import { LearningProfilePrompt } from '@/components/sky/dashboard/learning-profile-prompt';
import { SkySectionNav } from '@/components/sky/layout/sky-section-nav';
import {
  LearningPlanPanel,
  type LearningPlanPanelData,
} from '@/components/sky/learning/learning-plan-panel';
import { useAuth } from '@/components/auth/auth-provider';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { fetchLearningStats } from '@/lib/client/learning-stats';

interface LearningStats {
  todayStudyMinutes: number;
  streakDays: number;
  masteryPercent: number;
}

type RouteTopic = {
  name: string;
  mastery: number;
  mistakeCount: number;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好，同学';
  if (hour < 18) return '下午好，同学';
  return '晚上好，同学';
}

function TodayFocusPanel({
  recommendation,
}: {
  recommendation: PersonalizationContext['recommendation'] | null;
}) {
  const action = recommendation ?? {
    title: '先完成一次入门练习',
    reason: '先留下第一批学习记录，系统才能为你生成更准确的计划。',
    href: '/sky/cloud-mind/solve',
  };

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5 dark:border-sky-200/20 dark:bg-sky-300/[0.08] sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-100">
            <Target className="h-4 w-4" />
            今天优先完成
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {action.title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {action.reason}
          </p>
        </div>
        <Link
          href={action.href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200"
        >
          开始行动
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function LearningSnapshot({
  stats,
  mistakeCount,
  weakPointText,
}: {
  stats: LearningStats;
  mistakeCount: number;
  weakPointText: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">学习快照</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            今天只看影响下一步的三项数据
          </p>
        </div>
        <BarChart3 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.05]">
          <dt className="text-[11px] text-slate-500 dark:text-slate-400">掌握情况</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {stats.masteryPercent}%
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.05]">
          <dt className="text-[11px] text-slate-500 dark:text-slate-400">错题待处理</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {mistakeCount}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.05]">
          <dt className="text-[11px] text-slate-500 dark:text-slate-400">连续学习</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {stats.streakDays}天
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl border border-slate-200 px-3 py-3 text-xs leading-5 text-slate-600 dark:border-white/10 dark:text-slate-300">
        {weakPointText
          ? `当前优先补强：${weakPointText}`
          : '完成更多练习后，系统会标出优先补强的知识点。'}
        {stats.streakDays > 0 && (
          <span className="block mt-1 text-amber-700 dark:text-amber-100">
            已连续学习 {stats.streakDays} 天，保持这个节奏。
          </span>
        )}
      </div>
    </section>
  );
}

function ContinueLearningLinks({
  topics,
  mistakeCount,
}: {
  topics: RouteTopic[];
  mistakeCount: number;
}) {
  const nextTopic = topics[0];
  const entries = [
    {
      icon: Route,
      label: '学习路径',
      description: nextTopic ? `下一步：${nextTopic.name}` : '查看下一步学习顺序',
      href: '/sky/learning/path',
    },
    {
      icon: BookOpenCheck,
      label: '复习计划',
      description: mistakeCount > 0 ? `有 ${mistakeCount} 道错题待处理` : '安排下一次巩固复习',
      href: '/sky/learning/review',
    },
    {
      icon: ShieldCheck,
      label: '学习分析',
      description: '查看完整画像与学习建议',
      href: '/sky/learning/profile',
    },
  ];

  return (
    <section
      aria-labelledby="continue-learning-title"
      className="border-t border-slate-200 pt-5 dark:border-white/10"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="continue-learning-title"
            className="text-base font-semibold text-slate-950 dark:text-white"
          >
            完成后，再深入处理
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            需要时再进入一个独立页面，不把所有工具都堆在这里。
          </p>
        </div>
        <Link
          href="/sky/learning/stats"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-sky-700 transition-colors hover:text-sky-800 dark:text-sky-200 dark:hover:text-sky-100"
        >
          查看学习统计
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link
              key={entry.label}
              href={entry.href}
              className="group flex min-h-20 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-sky-200 hover:bg-sky-50/60 dark:border-white/10 dark:bg-slate-900/70 dark:hover:border-sky-200/30 dark:hover:bg-white/[0.06]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:bg-sky-300/15 dark:text-sky-100">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-950 dark:text-white">
                  {entry.label}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {entry.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function DashboardEmptyState() {
  const starterSteps = [
    {
      icon: Camera,
      label: '完成一道题',
      description: '拍照搜题或直接输入题目，建立第一条学习记录。',
    },
    {
      icon: ShieldCheck,
      label: '补全学习情况',
      description: '告诉系统你的目标和薄弱点，建议才会更贴近你。',
    },
    {
      icon: TrendingUp,
      label: '拿到下一步',
      description: '系统会根据记录生成路径、复习和讲解建议。',
    },
  ];

  return (
    <section className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/55 p-5 dark:border-sky-200/20 dark:bg-sky-300/[0.06]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white dark:bg-sky-300 dark:text-slate-950">
            <Star className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              从第一条记录开始
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              不需要一次填完所有信息，先做一个小任务就够了。
            </p>
          </div>
        </div>
        <Link
          href="/sky/cloud-mind/solve"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200"
        >
          <Camera className="h-4 w-4" />
          开始做题
        </Link>
      </div>

      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {starterSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li
              key={step.label}
              className="flex gap-3 rounded-xl bg-white/75 p-3 dark:bg-slate-950/20"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-xs font-semibold text-sky-700 dark:text-sky-100">
                {index + 1}
              </span>
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Icon className="h-3.5 w-3.5 text-sky-600 dark:text-sky-200" />
                  {step.label}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function SkyDashboardPage() {
  const { user } = useAuth();
  const mistakes = useSkyClassroomStore((state) => state.mistakes);
  const [stats, setStats] = useState<LearningStats>({
    todayStudyMinutes: 0,
    streakDays: 0,
    masteryPercent: 0,
  });
  const [personalization, setPersonalization] = useState<PersonalizationContext | null>(null);
  const [learningPlanData, setLearningPlanData] = useState<LearningPlanPanelData | null>(null);
  const [learningPlanError, setLearningPlanError] = useState<string | null>(null);
  const greeting = useMemo(() => getGreeting(), []);

  useEffect(() => {
    syncMistakesFromQuizzes();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchStats = () => {
      if (!isDocumentVisible()) return;
      fetchLearningStats()
        .then((data) => {
          setStats(data);
        })
        .catch(() => {});
    };
    fetchStats();
    const interval = window.setInterval(fetchStats, 60_000);
    return () => window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/sky/cloud-mind/personalization-context', { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.data) setPersonalization(data.data);
      })
      .catch(() => {});
  }, [user]);

  const loadLearningPlan = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/sky/learning-plan?view=today', {
        credentials: 'include',
        signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? '个人学习计划加载失败');
      }
      setLearningPlanData((payload.data ?? null) as LearningPlanPanelData | null);
      setLearningPlanError(null);
    } catch (error) {
      if (signal?.aborted) return;
      setLearningPlanError(error instanceof Error ? error.message : '个人学习计划加载失败');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void loadLearningPlan(controller.signal);
    return () => controller.abort();
  }, [loadLearningPlan, user]);

  const routeTopics = useMemo<RouteTopic[]>(() => {
    const graph = buildKnowledgeGraph(mistakes);
    const topics = graph.nodes
      .slice()
      .sort((left, right) => left.mastery - right.mastery || right.mistakeCount - left.mistakeCount)
      .slice(0, 3)
      .map((node) => ({
        name: node.name,
        mastery: node.mastery,
        mistakeCount: node.mistakeCount,
      }));

    if (topics.length > 0) return topics;

    return (personalization?.weakPoints ?? []).slice(0, 3).map((point) => ({
      name: point.knowledgePoint,
      mastery: point.mastery,
      mistakeCount: point.recentMistakeCount,
    }));
  }, [mistakes, personalization]);

  const weakPointText =
    personalization?.weakPoints
      .slice(0, 2)
      .map((point) => point.knowledgePoint)
      .join('、') ||
    routeTopics
      .slice(0, 2)
      .map((topic) => topic.name)
      .join('、');
  const hasData = mistakes.length > 0;

  return (
    <SkyAppShell section="learning">
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        <SkySectionNav section="learning" />

        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-white/10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-200">
              <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" />
              学习总览
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-3xl">
              {greeting}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {hasData
                ? '先完成今天最重要的一件事，其余信息在需要时再展开。'
                : '从一个小任务开始，系统会逐步建立你的学习节奏。'}
            </p>
          </div>
          <Link
            href="/sky/learning/profile-dashboard"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-sky-200 hover:text-sky-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-sky-200/30 dark:hover:text-sky-100"
          >
            查看完整学习记录
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <LearningProfilePrompt status={user?.onboardingStatus} />

        <TodayFocusPanel recommendation={personalization?.recommendation ?? null} />

        <MistakeReviewStrip />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section id="learning-plan" className="scroll-mt-5">
            <LearningPlanPanel
              initialData={learningPlanData}
              error={learningPlanError ?? undefined}
              onPlanChanged={() => loadLearningPlan()}
              compact
            />
          </section>

          <aside className="lg:sticky lg:top-24">
            <LearningSnapshot
              stats={stats}
              mistakeCount={mistakes.length}
              weakPointText={weakPointText}
            />
          </aside>
        </div>

        {hasData ? (
          <ContinueLearningLinks topics={routeTopics} mistakeCount={mistakes.length} />
        ) : (
          <DashboardEmptyState />
        )}
      </div>
    </SkyAppShell>
  );
}
