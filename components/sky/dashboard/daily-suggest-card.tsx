'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw } from 'lucide-react';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { generateSuggestions } from '@/lib/mistakes/suggestions';
import { useAuth } from '@/components/auth/auth-provider';

interface DailySuggestCardProps {
  mistakes: MistakeRecord[];
}

export function DailySuggestCard({ mistakes }: DailySuggestCardProps) {
  const { user } = useAuth();
  const [streakDays, setStreakDays] = useState(0);
  const [masteryPercent, setMasteryPercent] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetch('/api/sky/learning-stats', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setStreakDays(j.streakDays ?? 0);
          setMasteryPercent(j.masteryPercent ?? 0);
        }
      })
      .catch(() => {});
  }, [user]);

  const allSuggestions = useMemo(
    () => generateSuggestions(mistakes, { streakDays, masteryPercent }),
    [mistakes, streakDays, masteryPercent],
  );

  const [startIndex, setStartIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const visible = useMemo(() => {
    if (allSuggestions.length <= 3) return allSuggestions;
    const end = startIndex + 3;
    if (end <= allSuggestions.length) return allSuggestions.slice(startIndex, end);
    return [
      ...allSuggestions.slice(startIndex),
      ...allSuggestions.slice(0, end - allSuggestions.length),
    ];
  }, [allSuggestions, startIndex]);

  const handleRefresh = useCallback(() => {
    setDirection(1);
    setStartIndex((prev) => (prev + 3) % allSuggestions.length);
  }, [allSuggestions.length]);

  if (allSuggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="relative overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-gradient-to-br from-amber-50/60 via-white/60 to-orange-50/50 dark:from-slate-800/60 dark:via-slate-900/60 dark:to-slate-800/50 px-4 py-3 backdrop-blur-sm"
    >
      <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-amber-400/8 blur-xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10">
              <Sparkles className="h-3 w-3 text-amber-500" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              今日学习建议
            </span>
          </div>
          {allSuggestions.length > 3 && (
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-colors"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              换一批
            </button>
          )}
        </div>

        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={startIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction * 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 15 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {visible.map((s, i) => (
              <div
                key={`${startIndex}-${i}`}
                className="flex items-center gap-2.5 rounded-lg bg-white/50 dark:bg-slate-800/30 border border-slate-200/30 dark:border-slate-700/25 px-3 py-2.5"
              >
                <span className="text-sm shrink-0">{s.icon}</span>
                <span className="flex-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {s.text}
                </span>
                <Link
                  href={s.action.href}
                  className="shrink-0 rounded-md bg-amber-500/8 hover:bg-amber-500/15 px-2.5 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 transition-colors"
                >
                  {s.action.label}
                </Link>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
