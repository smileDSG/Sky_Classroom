import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { StudyLabViewModel } from '@/lib/sky/study-lab-data';
import { PanelShell } from './panel-shell';

function sourceLabel(value: string): string {
  if (value === 'server') return '云端实时';
  if (value === 'empty') return '暂无记录';
  if (value === 'unavailable') return '暂不可用';
  return value;
}

export function TrustReviewPanel({ viewModel }: { viewModel: StudyLabViewModel }) {
  const sourceEntries = Object.entries(viewModel.workshop.dataSources);
  const hasErrors = Object.keys(viewModel.errors).length > 0;

  return (
    <PanelShell icon={ShieldCheck} title="内容检查" eyebrow="Trust">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-cyan-100/10 dark:bg-white/[0.04]">
          <div className="text-xs text-slate-500 dark:text-slate-400">资料来源</div>
          <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
            {sourceEntries.length > 0 ? '已显示数据源' : '等待学习数据'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-cyan-100/10 dark:bg-white/[0.04]">
          <div className="text-xs text-slate-500 dark:text-slate-400">事实核验</div>
          <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
            生成结果后展示
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-cyan-100/10 dark:bg-white/[0.04]">
          <div className="text-xs text-slate-500 dark:text-slate-400">内容安全</div>
          <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
            {hasErrors ? '部分数据降级' : '页面可用'}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {sourceEntries.length > 0 ? (
          sourceEntries.map(([key, value]) => (
            <div
              key={key}
              className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-cyan-100/10 dark:bg-[#0b1729]"
            >
              <span className="font-semibold text-slate-700 dark:text-slate-200">{key}</span>
              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-500 dark:border-cyan-100/10 dark:text-slate-400">
                {sourceLabel(value)}
              </span>
            </div>
          ))
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500 dark:border-cyan-100/15 dark:bg-white/[0.04] dark:text-slate-400">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            暂无可查看的学习记录。完成练习或复习后，这里会显示资料来源和判断把握。
          </div>
        )}
      </div>
    </PanelShell>
  );
}
