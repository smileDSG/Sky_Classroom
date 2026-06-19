'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { StatCards, ActivityTimeline } from '@/components/sky/dashboard/stat-cards';
import { LearningTrendChart } from '@/components/sky/dashboard/learning-trend-chart';
import { AbilityRadar } from '@/components/sky/dashboard/ability-radar';
import { DailySuggestCard } from '@/components/sky/dashboard/daily-suggest-card';
import { LearningPathCard } from '@/components/sky/dashboard/learning-path-card';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import { useTheme } from '@/lib/hooks/use-theme';
import { useAuth } from '@/components/auth/auth-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { fetchTeachingHistory, type TeachingHistoryItem } from '@/lib/teaching/teaching-job-client';
import {
  Brain,
  Camera,
  Presentation,
  Sparkles,
  ArrowRight,
  Zap,
  TrendingUp,
  Star,
  BookOpen,
  ChevronRight,
} from 'lucide-react';

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

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

// ── Cloud Mind Mini Card ──────────────────────────────────────────

function CloudMindMiniCard() {
  const tools = [
    {
      icon: Camera,
      label: '拍照搜题',
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      href: '/sky/cloud-mind/solve',
    },
    {
      icon: Presentation,
      label: '幻灯片',
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10',
      href: '/sky/cloud-mind/slides',
    },
    {
      icon: Brain,
      label: '记忆卡片',
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      href: '/sky/cloud-mind/memory',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <span className="text-xs font-medium text-indigo-200 tracking-wider uppercase">
            AI 工具集
          </span>
        </div>

        <h3 className="text-xl font-bold text-white mb-1">云端智囊</h3>
        <p className="text-sm text-indigo-100 mb-4">AI 驱动的智能学习工具，助你高效学习</p>

        <div className="flex gap-2 mb-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.label}
                href={tool.href}
                className={`flex items-center gap-1.5 rounded-lg ${tool.bg} px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all hover:scale-105`}
              >
                <Icon className={`h-4 w-4 ${tool.color}`} />
                {tool.label}
              </Link>
            );
          })}
        </div>

        <Link
          href="/sky/cloud-mind"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-200 hover:text-white transition-colors"
        >
          查看全部工具
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

interface LearningStats {
  todayStudyMinutes: number;
  streakDays: number;
  masteryPercent: number;
}

function formatStudyTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

export default function SkyDashboardPage() {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const mistakes = useSkyClassroomStore((s) => s.mistakes);
  const greeting = useMemo(() => getGreeting(resolvedTheme === 'dark'), [resolvedTheme]);
  const greetingEmoji = useMemo(() => getGreetingEmoji(resolvedTheme === 'dark'), [resolvedTheme]);

  // ── Fetch learning stats ──────────────────────────────────────
  const [stats, setStats] = useState<LearningStats>({
    todayStudyMinutes: 0,
    streakDays: 0,
    masteryPercent: 0,
  });
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);
  const [favorites, setFavorites] = useState<TeachingHistoryItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  useEffect(() => {
    syncMistakesFromQuizzes();
  }, []);

  const loadFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      const data = await fetchTeachingHistory({ favorited: true, limit: 50 });
      setFavorites(data);
    } catch {
      setFavorites([]);
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (favoriteDialogOpen) {
      loadFavorites();
    }
  }, [favoriteDialogOpen, loadFavorites]);

  useEffect(() => {
    if (!user) return;
    const fetchStats = () => {
      fetch('/api/sky/learning-stats', { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setStats(j);
        })
        .catch(() => {});
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  // ── Computed data ─────────────────────────────────────────────
  const trendData = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (13 - i));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      return { day: DAY_NAMES[d.getDay()], dayStart, total: 0, reviewed: 0 };
    });
    for (const m of mistakes) {
      const mTime = new Date(m.solvedAt).getTime();
      for (const slot of days) {
        if (mTime >= slot.dayStart && mTime < slot.dayStart + 86400000) {
          slot.total++;
          if (m.reviewed) slot.reviewed++;
          break;
        }
      }
    }
    return days.map(({ day, total, reviewed }) => ({ day, total, reviewed }));
  }, [mistakes]);

  const DEFAULT_DIMENSIONS = ['代数', '函数', '几何', '概率', '统计'];

  const radarData = useMemo(() => {
    const graph = buildKnowledgeGraph(mistakes);
    if (graph.nodes.length === 0) {
      return DEFAULT_DIMENSIONS.map((name) => ({ name, value: 0 }));
    }
    const categoryMastery = new Map<string, { total: number; count: number }>();
    for (const node of graph.nodes) {
      const existing = categoryMastery.get(node.category) ?? { total: 0, count: 0 };
      existing.total += node.mastery;
      existing.count++;
      categoryMastery.set(node.category, existing);
    }
    const sorted = [...categoryMastery.entries()]
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, value: Math.round(data.total / data.count) }));
    if (sorted.length < 5) {
      const used = new Set(sorted.map((d) => d.name));
      for (const name of DEFAULT_DIMENSIONS) {
        if (sorted.length >= 5) break;
        if (!used.has(name)) sorted.push({ name, value: 0 });
      }
    }
    return sorted;
  }, [mistakes]);

  // ── Milestone helpers ─────────────────────────────────────────
  const MILESTONES = [3, 7, 14, 30, 60, 100];
  const MILESTONE_NAMES: Record<number, string> = {
    3: '铜星',
    7: '银星',
    14: '金星',
    30: '白金',
    60: '钻石',
    100: '传奇',
  };
  const nextMilestone = MILESTONES.find((m) => m > stats.streakDays);
  const maxMilestone = MILESTONES[MILESTONES.length - 1];

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* ── Greeting ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="text-3xl">{greetingEmoji}</span>
              {greeting}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              今天是学习的好日子，继续加油！
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFavoriteDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
            >
              <Star className="h-4 w-4 fill-current" />
              收藏
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <motion.div
                className="w-2 h-2 rounded-full bg-emerald-400"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              学习进行中
            </div>
          </div>
        </motion.div>

        {/* ── Daily Suggestions ────────────────────────────────── */}
        <DailySuggestCard mistakes={mistakes} />

        {mistakes.length === 0 ? (
          /* ── Empty state onboarding ─────────────────────────── */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 p-12 text-center"
          >
            <div className="text-5xl mb-4">⭐</div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              欢迎来到摘星锦囊
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
              这里是你的学习驾驶舱。开始使用后，会展示学习数据统计、知识掌握趋势、能力雷达图和最近学习活动。
            </p>
            <div className="flex gap-3">
              <Link
                href="/sky/solve"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.03]"
              >
                <Camera className="h-4 w-4" />
                拍照搜题开始学习
              </Link>
              <Link
                href="/sky/cloud-mind"
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all"
              >
                <Brain className="h-4 w-4" />
                探索 AI 工具集
              </Link>
            </div>
          </motion.div>
        ) : (
          <>
            {/* ── Zone 1: Overview Stats + Streak (merged) ─────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left: 3 stat cards stacked */}
              <div className="lg:col-span-2">
                <StatCards mistakes={mistakes} />
              </div>

              {/* Right: Learning Path + Streak + Quick Actions combined */}
              <div className="lg:col-span-1 space-y-4">
                <LearningPathCard
                  onStartTopic={(topic) => {
                    window.location.href = `/sky/teaching?topic=${encodeURIComponent(topic)}`;
                  }}
                />

                {/* Inline streak card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl border border-slate-200/60 dark:border-slate-700/40 bg-white/70 dark:bg-slate-900/50 p-5 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15">
                      <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      连续打卡
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                      {stats.streakDays}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">天</span>
                    {nextMilestone && (
                      <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        距{MILESTONE_NAMES[nextMilestone]}还差 {nextMilestone - stats.streakDays} 天
                      </span>
                    )}
                  </div>
                  <div className="relative h-2 rounded-full bg-slate-100 dark:bg-slate-800 mb-2">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-400 to-amber-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(stats.streakDays / maxMilestone, 1) * 100}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between">
                    {MILESTONES.map((d) => {
                      const achieved = stats.streakDays >= d;
                      const isNext = nextMilestone === d;
                      return (
                        <span
                          key={d}
                          className={`text-[10px] ${
                            achieved
                              ? 'text-amber-600 dark:text-amber-400 font-medium'
                              : isNext
                                ? 'text-slate-500 dark:text-slate-400 font-medium'
                                : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {MILESTONE_NAMES[d]}
                        </span>
                      );
                    })}
                  </div>
                  {stats.streakDays === 0 && (
                    <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
                      今天开始你的第一天打卡吧！
                    </p>
                  )}
                </motion.div>

                {/* Quick actions compact */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-2 gap-2"
                >
                  {[
                    {
                      icon: Camera,
                      label: '拍照搜题',
                      href: '/sky/solve',
                      color: 'text-violet-500',
                      bg: 'bg-violet-500/10 hover:bg-violet-500/20',
                    },
                    {
                      icon: Presentation,
                      label: '幻灯片',
                      href: '/sky/slides',
                      color: 'text-cyan-500',
                      bg: 'bg-cyan-500/10 hover:bg-cyan-500/20',
                    },
                    {
                      icon: TrendingUp,
                      label: '学习数据',
                      href: '/sky/learning',
                      color: 'text-emerald-500',
                      bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
                    },
                    {
                      icon: Brain,
                      label: 'AI 助手',
                      href: '/sky/assistant',
                      color: 'text-amber-500',
                      bg: 'bg-amber-500/10 hover:bg-amber-500/20',
                    },
                  ].map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.label}
                        href={action.href}
                        className={`flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 ${action.bg} backdrop-blur-sm transition-all hover:scale-[1.03]`}
                      >
                        <Icon className={`w-4 h-4 ${action.color}`} />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {action.label}
                        </span>
                      </Link>
                    );
                  })}
                </motion.div>
              </div>
            </div>

            {/* ── Zone 2: AI Tools + Charts ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left: Cloud Mind Card */}
              <div className="lg:col-span-1">
                <CloudMindMiniCard />
              </div>
              {/* Right: Charts side by side */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                <LearningTrendChart data={trendData} />
                <AbilityRadar data={radarData} />
              </div>
            </div>

            {/* ── Zone 3: Activity ─────────────────────────────── */}
            <ActivityTimeline mistakes={mistakes} />
          </>
        )}

        {/* ── Favorites Dialog ─────────────────────────────── */}
        <Dialog open={favoriteDialogOpen} onOpenChange={setFavoriteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-rose-500 fill-current" />
                收藏的教案
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              {favoritesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Zap className="h-5 w-5 animate-spin text-rose-500" />
                </div>
              ) : favorites.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
                  暂无收藏的教案
                </div>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <div className="space-y-2">
                    {favorites.map((item) => (
                      <Link
                        key={item.id}
                        href={`/sky/teaching?history=${item.id}`}
                        onClick={() => setFavoriteDialogOpen(false)}
                        className="group flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 p-3 transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
                          <BookOpen className="h-4 w-4 text-rose-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {item.plan?.title || item.topic}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {item.totalSections || item.sections?.length || 0} 章节
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-rose-500 transition-colors" />
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SkyAppShell>
  );
}
