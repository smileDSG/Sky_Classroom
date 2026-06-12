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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/40 bg-gradient-to-br from-amber-50/80 via-white/80 to-orange-50/60 dark:from-slate-800/80 dark:via-slate-900/80 dark:to-slate-800/60 p-5 backdrop-blur-sm"
    >
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              今日学习建议
            </span>
          </div>
          {allSuggestions.length > 3 && (
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              换一批
            </button>
          )}
        </div>

        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={startIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 20 }}
            transition={{ duration: 0.25 }}
            className="space-y-2.5"
          >
            {visible.map((s, i) => (
              <div
                key={`${startIndex}-${i}`}
                className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/30 px-4 py-3"
              >
                <span className="text-base shrink-0">{s.icon}</span>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {s.text}
                </span>
                <Link
                  href={s.action.href}
                  className="shrink-0 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 transition-colors"
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
