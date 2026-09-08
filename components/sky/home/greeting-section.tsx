'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Zap, Sparkles, Brain } from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';
import { useAuth } from '@/components/auth/auth-provider';
import { isDocumentVisible } from '@/lib/hooks/use-document-visibility';

interface LearningStats {
  todayStudyMinutes: number;
  streakDays: number;
  masteryPercent: number;
  checkedInToday?: boolean;
}

function formatStudyTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function getGreeting(isDark: boolean): string {
  const hour = new Date().getHours();
  if (isDark) {
    if (hour >= 5 && hour < 12) return '晚上好，同学！';
    if (hour >= 12 && hour < 18) return '夜晚好，同学！';
    if (hour >= 18 && hour < 22) return '晚上好，同学！';
    return '夜深了，注意休息！';
  }
  if (hour >= 5 && hour < 12) return '早上好，同学！';
  if (hour >= 12 && hour < 18) return '下午好，同学！';
  if (hour >= 18 && hour < 22) return '晚上好，同学！';
  return '夜深了，注意休息！';
}

function getGreetingEmoji(isDark: boolean): string {
  const hour = new Date().getHours();
  if (isDark) return '🌙';
  if (hour >= 5 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 18) return '🌤️';
  return '🌙';
}

export function GreetingSection() {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const greeting = useMemo(() => getGreeting(resolvedTheme === 'dark'), [resolvedTheme]);
  const greetingEmoji = useMemo(() => getGreetingEmoji(resolvedTheme === 'dark'), [resolvedTheme]);

  const [stats, setStats] = useState<LearningStats>({
    todayStudyMinutes: 0,
    streakDays: 0,
    masteryPercent: 0,
  });

  // Fetch learning stats (real data from user_stats table)
  useEffect(() => {
    if (!user) return;

    const fetchStats = () => {
      if (!isDocumentVisible()) return;
      fetch('/api/sky/learning-stats', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (data?.success) {
            setStats({
              todayStudyMinutes: data.todayStudyMinutes || 0,
              streakDays: data.streakDays || 0,
              masteryPercent: data.masteryPercent || 0,
            });
          }
        })
        .catch(() => {});
    };

    fetchStats();
    // Refresh every 60 seconds to pick up study timer updates
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  const dynamicStats = user
    ? [
        {
          label: '今日学习',
          value: formatStudyTime(stats.todayStudyMinutes),
          icon: Zap,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
        },
        {
          label: '连续打卡',
          value: stats.streakDays > 0 ? `${stats.streakDays} 天` : '—',
          icon: Sparkles,
          color: 'text-rose-500',
          bg: 'bg-rose-500/10',
        },
        {
          label: '知识掌握',
          value: stats.masteryPercent > 0 ? `${stats.masteryPercent}%` : '—',
          icon: Brain,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10',
        },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 px-1"
    >
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <motion.span
            className="text-3xl"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 1.5, delay: 0.5, repeat: Infinity, repeatDelay: 5 }}
          >
            {greetingEmoji}
          </motion.span>
          <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 dark:from-sky-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            {greeting}
          </span>
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          今天是学习的好日子，继续加油！
        </p>
      </div>

      {/* Quick Stats - Only show when logged in */}
      {user && dynamicStats.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {dynamicStats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                whileHover={{ scale: 1.05, y: -2 }}
                className="flex items-center gap-3 rounded-xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-3 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/30 transition-shadow cursor-default"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}
                >
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{stat.label}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
