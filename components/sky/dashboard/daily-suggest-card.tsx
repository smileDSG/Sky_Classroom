'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, Lightbulb } from 'lucide-react';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { generateSuggestions } from '@/lib/mistakes/suggestions';

interface DailySuggestCardProps {
  mistakes: MistakeRecord[];
  stats: {
    streakDays: number;
    masteryPercent: number;
  };
}

export function DailySuggestCard({ mistakes, stats }: DailySuggestCardProps) {
  const allSuggestions = useMemo(
    () => generateSuggestions(mistakes, stats).slice(0, 3),
    [mistakes, stats],
  );

  if (allSuggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-xl border border-slate-200/60 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-slate-700/40 dark:bg-slate-900/45"
    >
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              今日学习建议
            </span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-2"
        >
          {allSuggestions.map((s, i) => (
            <div
              key={`${s.action.href}-${i}`}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200/50 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700/35 dark:bg-slate-800/35"
            >
              <span className="flex-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {s.text}
              </span>
              <Link
                href={s.action.href}
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
              >
                {s.action.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
