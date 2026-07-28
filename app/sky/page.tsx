'use client';

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
import {
  Brain,
  Camera,
  Presentation,
  ArrowRight,
  Zap,
  Star,
  BarChart3,
  GraduationCap,
  TrendingUp,
  Target,
  Sun,
  Moon,
} from 'lucide-react';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import { LearningProfilePrompt } from '@/components/sky/dashboard/learning-profile-prompt';

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const DEFAULT_DIMENSIONS = ['代数', '函数', '几何', '概率', '统计'];

function getGreeting(isDark: boolean): string {
  const hour = new Date().getHours();
  if (isDark) {
    if (hour >= 5 && hour < 12) return '早上好，同学！';
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
      icon: BarChart3,
      label: '智能出题',
      desc: '按学情练习',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      hoverBg: 'hover:bg-emerald-500/15',
      href: '/sky/cloud-mind/quiz',
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
    {
      icon: GraduationCap,
      label: '智能授课',
      desc: '生成讲解路径',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      hoverBg: 'hover:bg-amber-500/15',
      href: '/sky/cloud-mind/teaching',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl border border-slate-200/60 bg-white/70 backdrop-blur-sm dark:border-slate-700/40 dark:bg-slate-900/45"
    >
      <div className="px-4 py-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
              <Brain className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                关键入口
              </span>
              <h3 className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">
                云端智囊
              </h3>
            </div>
          </div>
          <Link
            href="/sky/cloud-mind"
            className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            全部
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Tool buttons */}
        <div className="space-y-1.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.label}
                href={tool.href}
                className="group/tool flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 ring-1 ring-slate-200/60 transition-all hover:bg-slate-50 dark:ring-slate-700/45 dark:hover:bg-slate-800/60"
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-md ${tool.bg} ${tool.hoverBg} transition-colors`}
                >
                  <Icon className={`h-3.5 w-3.5 ${tool.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                    {tool.label}
                  </p>
                  <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">
                    {tool.desc}
                  </p>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-300 transition-all group-hover/tool:translate-x-0.5 group-hover/tool:text-slate-500 dark:text-slate-600 dark:group-hover/tool:text-slate-300" />
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function TodayActionCard({
  recommendation,
}: {
  recommendation: NonNullable<PersonalizationContext['recommendation']>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-xl border border-indigo-200/60 bg-white/80 px-4 py-4 shadow-sm shadow-indigo-500/5 dark:border-indigo-800/45 dark:bg-slate-900/55"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
              <Target className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
              今日主行动
            </span>
          </div>
          <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-slate-50">
            {recommendation.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {recommendation.reason}
          </p>
        </div>

        <Link
          href={recommendation.href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700"
        >
          开始行动
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

// ── Empty state for the dashboard ────────────────────────────────

function DashboardEmptyState() {
  const quickActions = [
    {
      icon: Camera,
      label: '拍照搜题',
      desc: '拍题自动识别并解析',
      href: '/sky/cloud-mind/solve',
      bg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-500',
    },
    {
      icon: Presentation,
      label: '生成课件',
      desc: 'AI 自动生成精美 PPT',
      href: '/sky/cloud-mind/slides',
      bg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-500',
    },
    {
      icon: Brain,
      label: 'AI 助手',
      desc: '智能答疑与知识讲解',
      href: '/sky/assistant',
      bg: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
    },
    {
      icon: TrendingUp,
      label: '复习计划',
      desc: '基于艾宾浩斯记忆曲线',
      href: '/sky/learning',
      bg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
    },
  ];

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-slate-200/60 bg-white/70 px-5 py-5 backdrop-blur-sm dark:border-slate-700/40 dark:bg-slate-900/45"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
              <Star className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                新手起步
              </span>
              <h2 className="mt-1 text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">
                欢迎来到摘星锦囊
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                先完成一道练习，系统会在这里汇总错题、趋势和下一步建议。
              </p>
            </div>
          </div>
          <Link
            href="/sky/cloud-mind/solve"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Camera className="h-4 w-4" />
            拍照搜题开始学习
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </motion.div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">先从这里开始</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            保留必要入口，避免重复面板抢占注意力。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  className="group/action flex min-h-24 items-start gap-3 rounded-xl border border-slate-200/60 bg-white/70 p-3.5 transition-colors hover:bg-slate-50 dark:border-slate-700/40 dark:bg-slate-900/45 dark:hover:bg-slate-800/60"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${action.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {action.label}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {action.desc}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover/action:text-slate-500 dark:text-slate-600 dark:group-hover/action:text-slate-300" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function SkyDashboardPage() {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const mistakes = useSkyClassroomStore((s) => s.mistakes);
  const greeting = useMemo(() => getGreeting(resolvedTheme === 'dark'), [resolvedTheme]);
  const GreetingIcon = useMemo(() => {
    const hour = new Date().getHours();
    if (resolvedTheme === 'dark') return Moon;
    if (hour >= 5 && hour < 18) return Sun;
    return Moon;
  }, [resolvedTheme]);

  // ── Fetch learning stats ──────────────────────────────────────
  const [stats, setStats] = useState<LearningStats>({
    todayStudyMinutes: 0,
    streakDays: 0,
    masteryPercent: 0,
  });
  const [personalization, setPersonalization] = useState<PersonalizationContext | null>(null);

  useEffect(() => {
    syncMistakesFromQuizzes();
  }, []);

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

  useEffect(() => {
    if (!user) return;
    fetch('/api/sky/cloud-mind/personalization-context', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) setPersonalization(j.data);
      })
      .catch(() => {});
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

  const hasData = mistakes.length > 0;

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-4">
        {/* ── Greeting ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl border border-slate-200/60 bg-white/65 px-4 py-4 backdrop-blur-sm dark:border-slate-700/40 dark:bg-slate-900/45 md:px-5"
        >
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                  <GreetingIcon className="h-4 w-4 text-indigo-500" />
                </span>
                {greeting}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {hasData ? `已有 ${mistakes.length} 道错题，继续加油！` : '开始你的第一道练习吧！'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
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

        <LearningProfilePrompt status={user?.onboardingStatus} />

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
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-4">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          今日调度
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          先处理最重要的一步，再查看辅助建议。
                        </p>
                      </div>
                    </div>
                    {personalization?.recommendation && (
                      <TodayActionCard recommendation={personalization.recommendation} />
                    )}
                    <DailySuggestCard mistakes={mistakes} stats={stats} />
                  </section>

                  <section className="space-y-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        学习概览
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        只保留当下决策需要的核心数字。
                      </p>
                    </div>
                    <StatCards mistakes={mistakes} />
                  </section>
                </div>

                <aside className="space-y-4">
                  <CloudMindMiniCard />
                  <LearningPathCard
                    onStartTopic={(topic) => {
                      window.location.href = `/sky/teaching?topic=${encodeURIComponent(topic)}`;
                    }}
                  />
                </aside>
              </div>

              <section className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    趋势与能力
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    下沉为分析区，避免首屏抢夺主行动。
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <LearningTrendChart data={trendData} />
                  <AbilityRadar data={radarData} />
                </div>
              </section>

              {/* ── Zone 4: Activity ───────────────────────────── */}
              <ActivityTimeline mistakes={mistakes} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SkyAppShell>
  );
}
