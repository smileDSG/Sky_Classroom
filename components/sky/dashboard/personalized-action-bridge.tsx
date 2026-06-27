'use client';

import { useMemo, type ElementType } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Brain, Camera, FileQuestion, GraduationCap, Layers, Route } from 'lucide-react';
import type { MistakeRecord } from '@/lib/mistakes/types';
import {
  buildPersonalizedActionPlan,
  type PersonalizedActionId,
} from '@/lib/sky/personalized-actions';
import { cn } from '@/lib/utils';

interface PersonalizedActionBridgeProps {
  mistakes: MistakeRecord[];
  compact?: boolean;
}

const ACTION_ICONS: Record<PersonalizedActionId, ElementType> = {
  review: Route,
  quiz: FileQuestion,
  memory: Layers,
  teaching: GraduationCap,
  solve: Camera,
};

const ACTION_STYLES: Record<PersonalizedActionId, string> = {
  review: 'text-amber-500 bg-amber-500/10',
  quiz: 'text-violet-500 bg-violet-500/10',
  memory: 'text-rose-500 bg-rose-500/10',
  teaching: 'text-emerald-500 bg-emerald-500/10',
  solve: 'text-sky-500 bg-sky-500/10',
};

export function PersonalizedActionBridge({
  mistakes,
  compact = false,
}: PersonalizedActionBridgeProps) {
  const plan = useMemo(() => buildPersonalizedActionPlan(mistakes), [mistakes]);
  const visibleActions = plan.actions.slice(0, compact ? 3 : 4);

  if (!plan.hasSignals) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-200/50 bg-white/60 p-4 backdrop-blur-sm dark:border-slate-700/30 dark:bg-slate-900/40"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
              <Brain className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              个性化行动链
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            下一步重点：{plan.primaryTopic}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{plan.primaryReason}</p>
        </div>

        <div
          className={cn(
            'grid gap-2',
            compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4',
          )}
        >
          {visibleActions.map((action) => {
            const Icon = ACTION_ICONS[action.id];
            return (
              <Link
                key={action.id}
                href={action.href}
                className="group flex min-w-0 items-center gap-2 rounded-lg border border-slate-200/50 bg-white/60 px-3 py-2 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white dark:border-slate-700/40 dark:bg-slate-800/50 dark:hover:border-indigo-800"
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                    ACTION_STYLES[action.id],
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {action.label}
                  </p>
                  <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">
                    {action.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
