'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { StatCards, ActivityTimeline } from '@/components/sky/dashboard/stat-cards';
import { LearningTrendChart } from '@/components/sky/dashboard/learning-trend-chart';
import { AbilityRadar } from '@/components/sky/dashboard/ability-radar';
import { DailySuggestCard } from '@/components/sky/dashboard/daily-suggest-card';
import { LearningPathCard } from '@/components/sky/dashboard/learning-path-card';
import { PersonalizedActionBridge } from '@/components/sky/dashboard/personalized-action-bridge';
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
  BarChart3,
} from 'lucide-react';

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getGreeting(isDark: boolean): string {
  const hour = new Date().getHours();
  if (isDark) {
    if (hour >= 5 && hour < 12) return '早安，同学！';
    if (hour >= 12 && hour < 18) return '下午好，同学！';
    if (hour >= 18 && hour < 22) return '晚上好，同学！';
    return '夜深了，注意休息！';
  }
  if (hour >= 5 && hour < 12) return '早上好，同学！';
  if (hour >= 12 && hour < 18) return '下午好，同学！';
  if (hour >= 18 && hour < 22) return '晚上好，同学！';
  return '夜深了，注意休息！';
}

// ── Cloud Mind Mini Card (redesigned) ────────────────────────────

function CloudMindMiniCard() {
  const tools = [
    {
      icon: Camera,
      label: '拍照搜题',
      desc: '智能识别题目',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      hoverBg: 'hover:bg-violet-500/15',
      href: '/sky/cloud-mind/solve',
    },
    {
      icon: Presentation,
      label: '幻灯片',
      desc: '一键生成课件',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      hoverBg: 'hover:bg-cyan-500/15',
      href: '/sky/cloud-mind/slides',
    },
    {
      icon: Brain,
      label: '记忆卡片',
      desc: 'AI 智能复习',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      hoverBg: 'hover:bg-rose-500/15',
      href: '/sky/cloud-mind/memory',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700"
    >
      {/* Subtle decorative elements */}
      <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/8 rounded-full blur-xl" />
      <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-purple-400/8 rounded-full blur-2xl" />

      <div className="relative z-10 px-3.5 py-3.5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/15">
            <Brain className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <span className="text-[9px] font-medium text-indigo-200/70 tracking-wider uppercase">
              AI 工具
            </span>
            <h3 className="text-sm font-bold text-white leading-tight">云端智囊</h3>
          </div>
        </div>

        {/* Tool buttons */}
        <div className="space-y-1.5">
          {tools.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.label}
                href={tool.href}
                className="group/tool flex items-center gap-2.5 rounded-lg bg-white/8 px-2.5 py-2 ring-1 ring-white/8 transition-all hover:bg-white/12"
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-md ${tool.bg} ${tool.hoverBg} transition-colors`}
                >
                  <Icon className={`h-3.5 w-3.5 ${tool.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{tool.label}</p>
                </div>
                <ArrowRight className="h-3 w-3 text-indigo-200/30 group-hover/tool:text-white group-hover/tool:translate-x-0.5 transition-all" />
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ── Quick Actions Compact ────────────────────────────────────────

function QuickActionsCompact() {
  const actions = [
    {
      icon: BookOpen,
      label: '学习路径',
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      hoverBg: 'hover:bg-indigo-500/15',
      href: '/sky/learning?tab=graph',
    },
    {
      icon: BarChart3,
      label: '数据分析',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      hoverBg: 'hover:bg-emerald-500/15',
      href: '/sky/learning?tab=stats',
    },
    {
      icon: TrendingUp,
      label: '复习计划',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      hoverBg: 'hover:bg-amber-500/15',
      href: '/sky/learning?tab=review',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm"
    >
      <div className="px-3.5 py-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">快捷操作</h3>
        </div>

        {/* Action buttons */}
        <div className="space-y-1.5">
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="group/action flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-md ${action.bg} ${action.hoverBg} transition-colors`}
                >
                  <Icon className={`h-3.5 w-3.5 ${action.color}`} />
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {action.label}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-300 dark:text-slate-600 ml-auto group-hover/action:text-slate-500 group-hover/action:translate-x-0.5 transition-all" />
              </Link>
            );
          })}
        </div>
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

// ── Empty state for the dashboard ────────────────────────────────

function DashboardEmptyState() {
  const quickActions = [
    {
      icon: Camera,
      label: '拍照搜题',
      desc: '拍题自动识别并解析',
      href: '/sky/cloud-mind/solve',
      gradient: 'from-violet-500 to-indigo-500',
      bg: 'bg-violet-500/10 hover:bg-violet-500/15',
      iconColor: 'text-violet-400',
    },
    {
      icon: Presentation,
      label: '生成课件',
      desc: 'AI 自动生成精美 PPT',
      href: '/sky/cloud-mind/slides',
      gradient: 'from-cyan-500 to-blue-500',
      bg: 'bg-cyan-500/10 hover:bg-cyan-500/15',
      iconColor: 'text-cyan-400',
    },
    {
      icon: Brain,
      label: 'AI 助手',
      desc: '智能答疑与知识讲解',
      href: '/sky/assistant',
      gradient: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-500/10 hover:bg-amber-500/15',
      iconColor: 'text-amber-400',
    },
    {
      icon: TrendingUp,
      label: '复习计划',
      desc: '基于艾宾浩斯记忆曲线',
      href: '/sky/learning',
      gradient: 'from-emerald-500 to-green-500',
      bg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
      iconColor: 'text-emerald-400',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Welcome hero */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-gradient-to-br from-violet-50/50 via-white/60 to-indigo-50/50 dark:from-slate-900/40 dark:via-slate-900/40 dark:to-slate-800/40 px-5 py-6 backdrop-blur-sm"
      >
        {/* Subtle decorative elements */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-violet-400/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/5 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Animated icon */}
          <motion.div
            className="mb-4 relative"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
          >
            <div className="absolute inset-0 rounded-2xl bg-violet-500/15 blur-lg scale-110" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/15">
              <Star className="h-8 w-8 text-white" />
            </div>
          </motion.div>

          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1.5">
            欢迎来到摘星锦囊
          </h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed mb-6">
            你的个人学习驾驶舱。完成练习后，这里会展示学习数据和知识趋势。
          </p>

          {/* Quick start CTA */}
          <Link
            href="/sky/cloud-mind/solve"
            className="group/cta inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/15 transition-all hover:shadow-lg hover:shadow-violet-500/20 hover:scale-[1.02]"
          >
            <Camera className="h-4 w-4" />
            拍照搜题开始学习
            <ArrowRight className="h-3.5 w-3.5 group-hover/cta:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </motion.div>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action, i) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.06 }}
            >
              <Link
                href={action.href}
                className={`group/action relative overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm p-3.5 transition-all hover:scale-[1.02] hover:shadow-md`}
              >
                {/* Hover gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover/action:opacity-[0.05] transition-opacity`}
                />

                <div className="relative z-10">
                  <div
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${action.bg} mb-2.5`}
                  >
                    <Icon className={`h-4.5 w-4.5 ${action.iconColor}`} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {action.label}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {action.desc}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function SkyDashboardPage() {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const mistakes = useSkyClassroomStore((s) => s.mistakes);
  const greeting = useMemo(() => getGreeting(resolvedTheme === 'dark'), [resolvedTheme]);
  const greetingEmoji = useMemo(() => {
    const hour = new Date().getHours();
    if (resolvedTheme === 'dark') return '🌙';
    if (hour >= 5 && hour < 12) return '☀️';
    if (hour >= 12 && hour < 18) return '🌤️';
    return '🌙';
  }, [resolvedTheme]);

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

  const hasData = mistakes.length > 0;

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-4">
        {/* ── Greeting ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-gradient-to-r from-violet-50/60 via-white/50 to-indigo-50/60 dark:from-slate-900/40 dark:via-slate-900/40 dark:to-slate-800/40 px-4 py-4 md:px-5 md:py-4 backdrop-blur-sm"
        >
          {/* Subtle decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-300/5 dark:bg-violet-600/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-1/4 w-24 h-24 bg-indigo-300/5 dark:bg-indigo-600/5 rounded-full blur-2xl translate-y-1/2" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="text-xl md:text-2xl">{greetingEmoji}</span>
                {greeting}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {hasData ? `已有 ${mistakes.length} 道错题，继续加油！` : '开始你的第一道练习吧！'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setFavoriteDialogOpen(true)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 ring-1 ring-rose-500/15 hover:bg-rose-500/20 transition-colors"
              >
                <Star className="h-3 w-3 fill-current" />
                收藏
              </button>
              <div className="flex items-center gap-1.5 rounded-md bg-white/60 dark:bg-slate-800/50 ring-1 ring-slate-200/40 dark:ring-slate-700/40 px-2.5 py-1 text-slate-500 dark:text-slate-400">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                学习中
              </div>
              {stats.streakDays > 0 && (
                <div className="flex items-center gap-1 rounded-md bg-amber-500/10 ring-1 ring-amber-500/15 px-2.5 py-1 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  <Zap className="h-3 w-3" />
                  {stats.streakDays}天
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Daily Suggestions ────────────────────────────────── */}
        {hasData && <DailySuggestCard mistakes={mistakes} />}
        {hasData && <PersonalizedActionBridge mistakes={mistakes} />}

        <AnimatePresence mode="wait">
          {!hasData ? (
            <DashboardEmptyState key="empty" />
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* ── Zone 1: Stats + Learning Path (compact bento) ─────── */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Left: 3 stat cards (span 3 cols) */}
                <div className="lg:col-span-3">
                  <StatCards mistakes={mistakes} />
                </div>

                {/* Right: Learning Path (span 1 col) */}
                <div className="lg:col-span-1">
                  <LearningPathCard
                    onStartTopic={(topic) => {
                      window.location.href = `/sky/teaching?topic=${encodeURIComponent(topic)}`;
                    }}
                  />
                </div>
              </div>

              {/* ─ Zone 2: Streak + AI Tools (balanced row) ────── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Streak card */}
                <div className="lg:col-span-1">
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-white/50 dark:bg-slate-900/40 px-4 py-3.5 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-500/10">
                        <Sparkles className="h-3 w-3 text-orange-500" />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        连续打卡
                      </span>
                      {nextMilestone && (
                        <span className="ml-auto text-[9px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/8 px-1.5 py-0.5 rounded-full">
                          目标: {nextMilestone}天
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mb-1.5">
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {stats.streakDays}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">天</span>
                    </div>
                    <div className="relative h-1 rounded-full bg-slate-100 dark:bg-slate-800 mb-1.5">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-400 to-amber-500"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(stats.streakDays / maxMilestone, 1) * 100}%`,
                        }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex justify-between">
                      {MILESTONES.slice(0, 4).map((d) => {
                        const achieved = stats.streakDays >= d;
                        return (
                          <span
                            key={d}
                            className={`text-[9px] ${
                              achieved
                                ? 'text-amber-600 dark:text-amber-400 font-medium'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {MILESTONE_NAMES[d]}
                          </span>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>

                {/* Cloud Mind tools */}
                <div className="lg:col-span-1">
                  <CloudMindMiniCard />
                </div>

                {/* Quick actions */}
                <div className="lg:col-span-1">
                  <QuickActionsCompact />
                </div>
              </div>

              {/* ── Zone 3: Charts ─────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LearningTrendChart data={trendData} />
                <AbilityRadar data={radarData} />
              </div>

              {/* ── Zone 4: Activity ───────────────────────────── */}
              <ActivityTimeline mistakes={mistakes} />
            </motion.div>
          )}
        </AnimatePresence>

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
