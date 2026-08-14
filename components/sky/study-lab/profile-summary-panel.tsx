import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { StudyLabViewModel } from '@/lib/sky/study-lab-data';
import { PanelShell } from './panel-shell';

function formatAccuracy(value: number | null): string {
  return value === null ? '待了解' : `${Math.round(value)}%`;
}

export function ProfileSummaryPanel({
  profile,
  error,
}: {
  profile: StudyLabViewModel['profile'];
  error?: string;
}) {
  const primaryWeakPoint = profile.weakPoints[0];

  return (
    <PanelShell icon={ShieldCheck} title="学习情况" eyebrow="Profile" error={error}>
      {profile.hasLearningData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-h-[76px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-cyan-100/10 dark:bg-white/[0.04]">
              <div className="text-xs text-slate-500 dark:text-slate-400">近期正确率</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                {formatAccuracy(profile.recentAccuracy)}
              </div>
            </div>
            <div className="min-h-[76px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-cyan-100/10 dark:bg-white/[0.04]">
              <div className="text-xs text-slate-500 dark:text-slate-400">推荐难度</div>
              <div className="mt-1 text-2xl font-semibold capitalize text-slate-950 dark:text-white">
                {profile.preferredDifficulty}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {profile.weakPoints.slice(0, 3).map((point) => (
              <Link
                key={point.knowledgePoint}
                href={point.actionHref}
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 dark:border-cyan-100/10 dark:bg-[#0b1729] dark:hover:border-emerald-200/30 dark:hover:bg-white/[0.07]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900 dark:text-white">
                    {point.knowledgePoint}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    掌握情况 {Math.round(point.mastery)}% · 近错 {point.recentMistakeCount} 次
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-cyan-100/15 dark:bg-white/[0.04] dark:text-slate-300">
          还没有足够的学习记录。先完成一次练习、整理错题或参加测验，系统才能更准确地了解你。
          <Link
            href="/sky/cloud-mind/quiz"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-300 dark:text-slate-950"
          >
            开始入门练习
          </Link>
        </div>
      )}

      {profile.recommendation && (
        <Link
          href={profile.recommendation.href}
          className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-200/20 dark:bg-emerald-300/10 dark:text-emerald-50"
        >
          <span className="min-w-0">
            <span className="block font-semibold">{profile.recommendation.title}</span>
            <span className="line-clamp-2 text-xs leading-5 opacity-80">
              {profile.recommendation.reason}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      {primaryWeakPoint && (
        <div className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
          当前优先补强：{primaryWeakPoint.knowledgePoint}
        </div>
      )}
    </PanelShell>
  );
}
