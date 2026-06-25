'use client';

import { BookOpen, Brain, Database, History, RotateCcw } from 'lucide-react';
import type { EvidenceItem, EvidenceType } from '@/lib/cloud-mind/types';

const ICONS: Record<EvidenceType, typeof History> = {
  mistake: History,
  profile: Brain,
  memory: RotateCcw,
  knowledge: Database,
  behavior: BookOpen,
};

const TONES: Record<EvidenceType, string> = {
  mistake: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200',
  profile: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200',
  memory: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
  knowledge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
  behavior: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200',
};

export function EvidenceList({ items, compact = false }: { items: EvidenceItem[]; compact?: boolean }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
        暂无证据记录
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'grid gap-2 sm:grid-cols-2'}>
      {items.map((item, index) => {
        const Icon = ICONS[item.type];
        return (
          <div
            key={`${item.type}-${item.sourceId ?? index}`}
            className={`rounded-md border px-3 py-2 ${TONES[item.type]}`}
          >
            <div className="flex items-start gap-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold">{item.title}</div>
                <div className="mt-0.5 text-xs leading-5 opacity-85">{item.summary}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
