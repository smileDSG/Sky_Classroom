import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, Clock3, Route } from 'lucide-react';
import type { StudyLabViewModel } from '@/lib/sky/study-lab-data';
import { cn } from '@/lib/utils';
import { PanelShell } from './panel-shell';

const STATUS_LABELS = {
  completed: '已完成',
  in_progress: '进行中',
  pending: '待学习',
  skipped: '已跳过',
} as const;

function StatusIcon({ status }: { status: keyof typeof STATUS_LABELS }) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === 'in_progress') return <Clock3 className="h-4 w-4 text-amber-600" />;
  return <Circle className="h-4 w-4 text-slate-400" />;
}

export function LearningPathTimeline({
  learningPath,
  error,
}: {
  learningPath: StudyLabViewModel['learningPath'];
  error?: string;
}) {
  return (
    <PanelShell icon={Route} title="个性化学习路径" eyebrow="Path" error={error}>
      {learningPath ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-cyan-100/10 dark:bg-white/[0.04]">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">
              {learningPath.title}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              共 {learningPath.nodes.length} 个阶段，移动端以分段卡片呈现。
            </div>
          </div>

          {learningPath.nodes.slice(0, 6).map((node, index) => (
            <div
              key={node.id}
              className={cn(
                'relative rounded-xl border px-3 py-3',
                node.status === 'in_progress'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-200/20 dark:bg-amber-300/10'
                  : 'border-slate-200 bg-white dark:border-cyan-100/10 dark:bg-[#0b1729]',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600 dark:border-cyan-100/10 dark:bg-white/[0.06] dark:text-slate-200">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={node.status} />
                    <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                      {node.topic}
                    </h3>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {node.knowledgePoints.length > 0
                      ? node.knowledgePoints.join('、')
                      : '等待补充知识点'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-cyan-100/10 dark:text-slate-400">
                  {STATUS_LABELS[node.status]}
                </span>
              </div>
            </div>
          ))}

          <Link
            href="/sky/learning/graph"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 dark:border-cyan-100/10 dark:bg-white/[0.05] dark:text-slate-100 dark:shadow-none"
          >
            查看完整路线
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-cyan-100/15 dark:bg-white/[0.04] dark:text-slate-300">
          暂无学习路径。完成画像诊断或到天梯工坊生成路线后，这里会展示真实路径节点。
          <Link
            href="/sky/learning"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-300 dark:text-slate-950"
          >
            去天梯工坊
          </Link>
        </div>
      )}
    </PanelShell>
  );
}
