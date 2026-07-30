import Link from 'next/link';
import { ArrowRight, CalendarClock, RefreshCw, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StudyLabViewModel } from '@/lib/sky/study-lab-data';
import { PanelShell } from './panel-shell';

function buildMission(viewModel: StudyLabViewModel) {
  if (viewModel.profile.recommendation) {
    return {
      title: viewModel.profile.recommendation.title,
      detail: viewModel.profile.recommendation.reason,
      href: viewModel.profile.recommendation.href,
      badge: '画像推荐',
    };
  }

  if (viewModel.workshop.dueReviewCount > 0) {
    return {
      title: `处理 ${viewModel.workshop.dueReviewCount} 条到期复习`,
      detail: '先把到期内容转为短周期复习，避免遗忘继续累积。',
      href: '/sky/learning/review?dailyTask=1',
      badge: '到期复习',
    };
  }

  return {
    title: '完成一次入门诊断',
    detail: '通过智能出题或拍照解题建立第一批学习信号。',
    href: '/sky/cloud-mind/quiz',
    badge: '诊断采样',
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
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-200/20 dark:bg-emerald-300/10">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-200/20 dark:bg-white/[0.08] dark:text-emerald-50">
            {mission.badge}
          </span>
          <span className="text-xs text-emerald-700/80 dark:text-emerald-50/80">约 10-20 分钟</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-7 text-slate-950 dark:text-white">
          {mission.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-200">
          {mission.detail}
        </p>
        <Link
          href={mission.href}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200 sm:w-auto"
        >
          <CalendarClock className="h-4 w-4" />
          开始今日任务
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </PanelShell>
  );
}
