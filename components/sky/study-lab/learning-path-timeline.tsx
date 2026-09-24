import Link from 'next/link';
import { ArrowRight, Route } from 'lucide-react';
import type { StudyLabViewModel } from '@/lib/sky/study-lab-data';
import { PanelShell } from './panel-shell';

export function LearningPathTimeline({
  learningPath,
  error,
}: {
  learningPath: StudyLabViewModel['learningPath'];
  error?: string;
}) {
  const nodes = learningPath?.nodes ?? [];
  const completed = nodes.filter((node) => node.status === 'completed').length;
  const total = nodes.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const nextNode =
    nodes.find((node) => node.status === 'in_progress') ??
    nodes.find((node) => node.status === 'pending');

  return (
    <PanelShell icon={Route} title="学习路径" eyebrow="Route" error={error}>
      {learningPath ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-950 dark:text-white">
              {learningPath.title}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {completed}/{total} 阶段已完成
            </span>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-400 transition-all"
              style={{ width: `${Math.max(3, progressPct)}%` }}
            />
          </div>

          {nextNode && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 dark:border-sky-200/20 dark:bg-sky-300/10">
              <div className="text-[11px] text-sky-700/80 dark:text-sky-200/80">下一站</div>
              <div className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-white">
                {nextNode.topic}
              </div>
            </div>
          )}

          <Link
            href="/sky/learning/path"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200"
          >
            查看完整路线
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-sky-100/15 dark:bg-white/[0.04] dark:text-slate-300">
          还没有学习路线。到学习路径按你的薄弱点与目标生成一条个人路线。
          <Link
            href="/sky/learning/path"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 dark:bg-sky-300 dark:text-slate-950"
          >
            去生成路线
          </Link>
        </div>
      )}
    </PanelShell>
  );
}
