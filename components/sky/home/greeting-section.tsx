'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Zap, Sparkles, Brain } from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';

const stats = [
  { label: '今日学习', value: '2.5h', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { label: '连续打卡', value: '7 天', icon: Sparkles, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { label: '知识掌握', value: '68%', icon: Brain, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

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
  const greeting = useMemo(() => getGreeting(resolvedTheme === 'dark'), [resolvedTheme]);
  const greetingEmoji = useMemo(() => getGreetingEmoji(resolvedTheme === 'dark'), [resolvedTheme]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"
    >
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="text-3xl">{greetingEmoji}</span>
          {greeting}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          今天是学习的好日子，继续加油！
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-3 rounded-xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-3"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100">{stat.value}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{stat.label}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
