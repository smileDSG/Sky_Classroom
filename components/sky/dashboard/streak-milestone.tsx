'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Flame } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import Link from 'next/link';

const MILESTONES = [
  { days: 3, name: '铜星', icon: '🥉' },
  { days: 7, name: '银星', icon: '🥈' },
  { days: 14, name: '金星', icon: '🥇' },
  { days: 30, name: '白金', icon: '💎' },
  { days: 60, name: '钻石', icon: '⭐' },
  { days: 100, name: '传奇', icon: '🌟' },
];

export function StreakMilestone() {
  const { user } = useAuth();
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetch('/api/sky/learning-stats', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setStreakDays(j.streakDays ?? 0);
      })
      .catch(() => {});
  }, [user]);

  // Find the current milestone range
  const maxDays = MILESTONES[MILESTONES.length - 1].days;
  const progress = Math.min(streakDays / maxDays, 1);

  // Find next unachieved milestone
  const nextMilestone = MILESTONES.find((m) => m.days > streakDays);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl border border-slate-200/60 dark:border-slate-700/40 bg-white/70 dark:bg-slate-900/50 p-5 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            学习连续性
          </span>
        </div>
        <Link
          href="/sky/learning/stats"
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          查看详情 →
        </Link>
      </div>

      {/* Current streak display */}
      <div className="flex items-baseline gap-1.5 mb-4">
        <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{streakDays}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">天连续打卡</span>
        {nextMilestone && (
          <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            距{nextMilestone.name}还差 {nextMilestone.days - streakDays} 天
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-400 to-amber-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      {/* Milestone markers */}
      <div className="flex justify-between">
        {MILESTONES.map((m) => {
          const achieved = streakDays >= m.days;
          const isCurrent = nextMilestone?.days === m.days;
          return (
            <div key={m.days} className="flex flex-col items-center gap-1">
              <motion.span
                className={`text-lg ${achieved ? '' : 'grayscale opacity-40'}`}
                animate={isCurrent ? { scale: [1, 1.2, 1] } : undefined}
                transition={isCurrent ? { duration: 2, repeat: Infinity } : undefined}
              >
                {m.icon}
              </motion.span>
              <span
                className={`text-[10px] ${
                  achieved
                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {m.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Encouragement text */}
      {streakDays === 0 && (
        <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
          今天开始你的第一天打卡吧！
        </p>
      )}
      {streakDays > 0 && !nextMilestone && (
        <p className="mt-3 text-center text-xs text-amber-600 dark:text-amber-400 font-medium">
          所有里程碑已解锁，你太棒了！
        </p>
      )}
    </motion.div>
  );
}
