import Link from 'next/link';
import { ArrowRight, CalendarClock, RefreshCw, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MistakeReviewStrip } from '@/components/sky/learning/mistake-review-strip';
import type { StudyLabViewModel } from '@/lib/sky/study-lab-data';
import { PanelShell } from './panel-shell';

function buildMission(viewModel: StudyLabViewModel) {
  const learningPlan = viewModel.learningPlan;
  if (learningPlan) {
    const plannedTask = learningPlan.todayTask;
    if (plannedTask) {
      return {
        title: plannedTask.title,
        detail: plannedTask.objective,
        href: plannedTask.actionHref ?? '/sky/learning/path',
        badge: '今日计划',
        duration: `${plannedTask.plannedMinutes} 分钟`,
        actionLabel: '开始今日任务',
      };
    }

    const todaySummary = learningPlan.todaySummary;
    if (todaySummary && todaySummary.totalTasks > 0 && todaySummary.completionRate === 100) {
      return {
        title: '今日计划已完成',
        detail: '今日任务已全部完成。保持节奏，下一批任务会按个人路径继续推进。',
        href: '/sky/learning/path',
        badge: '计划完成',
        duration: `${todaySummary.plannedMinutes} 分钟`,
        actionLabel: '查看完整安排',
      };
    }

    return {
      title: '今日为计划缓冲日',
      detail: '算法已结合本周时间预算与休息日安排，今天无需追加学习任务。',
      href: '/sky/learning/path',
      badge: '计划缓冲',
      duration: '0 分钟',
      actionLabel: '查看完整安排',
    };
  }

  if (viewModel.profile.recommendation) {
    return {
      title: viewModel.profile.recommendation.title,
      detail: viewModel.profile.recommendation.reason,
      href: viewModel.profile.recommendation.href,
      badge: '为你推荐',
      duration: '约 10-20 分钟',
      actionLabel: '开始今日任务',
    };
  }

  if (viewModel.workshop.dueReviewCount > 0) {
    return {
      title: `处理 ${viewModel.workshop.dueReviewCount} 条到期复习`,
      detail: '先把到期内容转为短周期复习，避免遗忘继续累积。',
      href: '/sky/cloud-mind/memory',
      badge: '到期复习',
      duration: '约 10-20 分钟',
      actionLabel: '开始今日任务',
    };
  }

  return {
    title: '完成一次入门练习',
    detail: '通过智能出题或拍照解题留下第一批学习记录。',
    href: '/sky/cloud-mind/quiz',
    badge: '入门练习',
    duration: '约 10-20 分钟',
    actionLabel: '开始今日任务',
  };
}

export function TodayMissionPanel({
  viewModel,
  onRefresh,
  refreshing,
  error,
}: {
  viewModel: StudyLabViewModel;
  onRefresh: () => void;
  refreshing: boolean;
  error?: string;
}) {
  const mission = buildMission(viewModel);

  return (
    <PanelShell
      icon={Target}
      title="今日任务"
      eyebrow="Mission"
      error={error}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="min-h-10"
        >
          <RefreshCw className={refreshing ? 'animate-spin' : ''} />
          刷新
        </Button>
      }
    >
      <MistakeReviewStrip className="mb-5 shadow-none" />

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-200/20 dark:bg-sky-300/10">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-200/20 dark:bg-white/[0.08] dark:text-sky-50">
            {mission.badge}
          </span>
          <span className="text-xs text-sky-700/80 dark:text-sky-50/80">
            {mission.duration}
          </span>
        </div>
        <h3 className="mt-4 text-lg font-semibold leading-7 text-slate-950 dark:text-white">
          {mission.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-200">
          {mission.detail}
        </p>
        <Link
          href={mission.href}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200 sm:w-auto"
        >
          <CalendarClock className="h-4 w-4" />
          {mission.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </PanelShell>
  );
}
