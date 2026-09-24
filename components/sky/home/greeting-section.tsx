'use client';

import { useMemo, useState, useEffect } from 'react';
import { CalendarClock, Flame, Target } from 'lucide-react';
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

// 这两个只接受外部传进来的小时数, 自己**不读** new Date():
// 服务端容器跑在 UTC、浏览器在 UTC+8, 渲染时直接算会让两边文本对不上,
// React 报 #418 水合失配。改由调用方在挂载后再算(见下面的 greetingHour)。
function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return '早上好';
  if (hour >= 12 && hour < 18) return '下午好';
  if (hour >= 18 && hour < 22) return '晚上好';
  return '夜深了，注意休息';
}

// 次行：不喊空口号，按学习数据给一句"下一刻该干嘛"。
function getWarmSubtext(stats: LearningStats): string {
  if (stats.todayStudyMinutes > 0) {
    return `今天已学 ${formatStudyTime(stats.todayStudyMinutes)}，接着把你手头那门课学完。`;
  }
  if (stats.streakDays > 0) {
    return `你已连续打卡 ${stats.streakDays} 天，今天别断。`;
  }
  return `写一句想学的，我陪你开出第一堂课。`;
}

export function GreetingSection() {
  const { user } = useAuth();
  // 首帧留空 → 服务端与客户端首屏一致; 挂载后再按访问者本地时间填, 避免 #418。
  const [greetingHour, setGreetingHour] = useState<number | null>(null);
  useEffect(() => setGreetingHour(new Date().getHours()), []);
  const greeting = greetingHour === null ? '' : getGreeting(greetingHour);

  const [stats, setStats] = useState<LearningStats>({
    todayStudyMinutes: 0,
    streakDays: 0,
    masteryPercent: 0,
  });
  const warmSubtext = useMemo(() => getWarmSubtext(stats), [stats]);

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

  const statItems = user
    ? [
        {
          icon: CalendarClock,
          label: '今日学习',
          value: formatStudyTime(stats.todayStudyMinutes),
        },
        {
          icon: Flame,
          label: '连续打卡',
          value: stats.streakDays > 0 ? `${stats.streakDays} 天` : '—',
        },
        {
          icon: Target,
          label: '知识掌握',
          value: stats.masteryPercent > 0 ? `${stats.masteryPercent}%` : '—',
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-[28px] md:leading-tight">
          {greeting}
          {user?.username ? `，${user.username}` : ''}
        </h1>
        <p className="mt-1 text-[15px] leading-6 text-slate-500 dark:text-slate-400">
          {warmSubtext}
        </p>
      </div>

      {statItems.length > 0 && (
        <div className="flex shrink-0 items-center gap-2.5">
          {statItems.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2 sm:px-3.5 dark:border-white/10 dark:bg-slate-900"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:bg-sky-300/15 dark:text-sky-300">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="leading-none">
                  <span className="block text-base font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">
                    {stat.label}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}