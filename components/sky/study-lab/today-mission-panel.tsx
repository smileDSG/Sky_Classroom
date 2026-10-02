import Link from 'next/link';
import { ArrowRight, CalendarClock, RefreshCw, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MistakeReviewStrip } from '@/components/sky/learning/mistake-review-strip';
import { getStudyLabTodayMission, type StudyLabViewModel } from '@/lib/sky/study-lab-data';
import { RecallNudge } from './recall-nudge';
import { PanelShell } from './panel-shell';

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
  const mission = getStudyLabTodayMission(viewModel);
  const actionLabel = mission.state === 'ready' ? '开始今日任务' : '查看完整安排';

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
          className="min-h-10 hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-300/10 dark:hover:text-sky-100"
        >
          <RefreshCw className={refreshing ? 'animate-spin' : ''} />
          刷新
        </Button>
      }
    >
      <MistakeReviewStrip className="mb-5 shadow-none" />

      {/* 召回提示（FR-12）：进站问一次服务端，仅在「该提醒」时显示一条轻提示。
          刻意做轻——不做弹窗/红点/全屏，可关闭，12秒后自动消失。 */}
      <RecallNudge weakPoints={viewModel.profile.weakPoints ?? []} />

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 dark:border-sky-200/20 dark:bg-sky-300/10">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-200/20 dark:bg-white/[0.08] dark:text-sky-50">
            {mission.sourceLabel}
          </span>
          {mission.durationLabel && (
            <span className="text-xs text-sky-700/80 dark:text-sky-50/80">
              {mission.durationLabel}
            </span>
          )}
        </div>
        <h3 className="mt-4 text-lg font-semibold leading-7 text-slate-950 dark:text-white">
          {mission.title}
        </h3>
        {/* 未掌握点悬念（FR-11）：只来自真实薄弱点，没有真实数据时不会出现。
            放在标题与详情之间，作为"为什么今天做这件事"的具体理由。 */}
        {mission.suspense && (
          <p className="mt-3 border-l-2 border-sky-300 pl-3 text-sm leading-6 text-sky-800 dark:border-sky-300/40 dark:text-sky-100">
            {mission.suspense}
          </p>
        )}
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-200">
          {mission.detail}
        </p>
        <details className="mt-4 border-t border-sky-200/70 pt-3 dark:border-sky-100/10">
          <summary className="cursor-pointer text-xs font-semibold text-sky-700 dark:text-sky-200">
            查看安排依据
          </summary>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-200">
            <p>{mission.reason}</p>
            <ul className="list-disc space-y-1 pl-5">
              {mission.successCriteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </div>
        </details>
        <Link
          href={mission.href}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200 sm:w-auto"
        >
          <CalendarClock className="h-4 w-4" />
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </PanelShell>
  );
}
