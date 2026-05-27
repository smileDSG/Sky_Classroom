'use client';

import { useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { StatCards, QuickActions, ActivityTimeline } from '@/components/sky/dashboard/stat-cards';
import { LearningTrendChart } from '@/components/sky/dashboard/learning-trend-chart';
import { AbilityRadar } from '@/components/sky/dashboard/ability-radar';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildKnowledgeGraph, getMasterySummary } from '@/lib/mistakes/knowledge-graph';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import { useTheme } from '@/lib/hooks/use-theme';
import type { MistakeRecord } from '@/lib/mistakes/types';
import {
  Brain,
  Camera,
  Presentation,
  Sparkles,
  ArrowRight,
  Zap,
} from 'lucide-react';

const DEMO_MISTAKES: MistakeRecord[] = [
  {
    id: 'demo-1',
    problem: '解方程：2x + 5 = 13，求 x 的值。',
    userAnswer: 'x = 3',
    correctAnswer: 'x = 4',
    cause: 'calculation-error',
    solvedAt: new Date(Date.now() - 3600000),
    reviewed: false,
    reviewCount: 0,
    knowledgePoints: ['代数', '一元一次方程'],
  },
  {
    id: 'demo-2',
    problem: '若 sin A = 3/5，且 A 为锐角，求 cos A。',
    userAnswer: 'cos A = 3/5',
    correctAnswer: 'cos A = 4/5',
    cause: 'concept-unclear',
    solvedAt: new Date(Date.now() - 7200000),
    reviewed: false,
    reviewCount: 0,
    knowledgePoints: ['几何', '三角函数'],
  },
  {
    id: 'demo-3',
    problem: '下列选项中，哪一个是二次函数 y = x² - 4x + 3 的对称轴？',
    userAnswer: 'x = 1',
    correctAnswer: 'x = 2',
    cause: 'method-wrong',
    solvedAt: new Date(Date.now() - 86400000),
    reviewed: true,
    reviewCount: 1,
    knowledgePoints: ['代数', '二次函数'],
  },
  {
    id: 'demo-4',
    problem: '一个物体从 20 米高处自由落下，求落地时的速度。（g=10m/s²）',
    userAnswer: '10 m/s',
    correctAnswer: '20 m/s',
    cause: 'misreading',
    solvedAt: new Date(Date.now() - 172800000),
    reviewed: false,
    reviewCount: 0,
    knowledgePoints: ['物理', '自由落体'],
  },
  {
    id: 'demo-5',
    problem: '计算：(a + b)² 的展开式。',
    userAnswer: 'a² + b²',
    correctAnswer: 'a² + 2ab + b²',
    cause: 'careless',
    solvedAt: new Date(Date.now() - 259200000),
    reviewed: true,
    reviewCount: 3,
    knowledgePoints: ['代数', '乘法公式'],
  },
];

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
    { icon: Camera, label: '拍照搜题', color: 'text-violet-500', bg: 'bg-violet-500/10', href: '/sky/cloud-mind/solve' },
    { icon: Presentation, label: '幻灯片', color: 'text-cyan-500', bg: 'bg-cyan-500/10', href: '/sky/cloud-mind/slides' },
    { icon: Brain, label: '记忆卡片', color: 'text-rose-500', bg: 'bg-rose-500/10', href: '/sky/cloud-mind/memory' },
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
          <span className="text-xs font-medium text-indigo-200 tracking-wider uppercase">AI 工具集</span>
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

// ── Quick Stats Row ───────────────────────────────────────────────

function QuickStatsRow() {
  const stats = [
    { label: '今日学习', value: '2.5h', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: '连续打卡', value: '7 天', icon: Sparkles, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: '知识掌握', value: '68%', icon: Brain, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-3 rounded-xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-4"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
              <Icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{stat.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function SkyDashboardPage() {
  const { resolvedTheme } = useTheme();
  const mistakes = useSkyClassroomStore((s) => s.mistakes);
  const greeting = useMemo(() => getGreeting(resolvedTheme === 'dark'), [resolvedTheme]);
  const greetingEmoji = useMemo(() => getGreetingEmoji(resolvedTheme === 'dark'), [resolvedTheme]);

  useEffect(() => {
    const store = useSkyClassroomStore.getState();
    if (store.mistakes.length === 0) {
      DEMO_MISTAKES.forEach((m) => store.addMistake(m));
    }
    syncMistakesFromQuizzes();
  }, []);

  const now = new Date();

  const trendData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return { date: d, day: DAY_NAMES[d.getDay()], count: 0 };
    });
    for (const m of mistakes) {
      const mDate = new Date(m.solvedAt);
      const diffDays = Math.floor((now.getTime() - mDate.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        days[6 - diffDays].count++;
      }
    }
    return days;
  }, [mistakes]);

  const radarData = useMemo(() => {
    if (mistakes.length === 0) {
      return [
        { name: '代数', value: 0 },
        { name: '几何', value: 0 },
        { name: '函数', value: 0 },
        { name: '概率', value: 0 },
        { name: '统计', value: 0 },
      ];
    }
    const graph = buildKnowledgeGraph(mistakes);
    const categoryMastery = new Map<string, { total: number; count: number }>();
    for (const node of graph.nodes) {
      const existing = categoryMastery.get(node.category) ?? { total: 0, count: 0 };
      existing.total += node.mastery;
      existing.count++;
      categoryMastery.set(node.category, existing);
    }
    const dimensions = ['代数', '几何', '函数', '概率', '统计'];
    return dimensions.map((name) => {
      const cat = categoryMastery.get(name);
      return { name, value: cat ? Math.round(cat.total / cat.count) : 0 };
    });
  }, [mistakes]);

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Greeting */}
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
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            学习进行中
          </div>
        </motion.div>

        {/* Quick Stats */}
        <QuickStatsRow />

        {/* Cloud Mind Card + Stat Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <CloudMindMiniCard />
          </div>
          <div className="lg:col-span-2">
            <StatCards mistakes={mistakes} />
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <LearningTrendChart data={trendData} />
          <AbilityRadar data={radarData} />
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Activity Timeline */}
        <ActivityTimeline mistakes={mistakes} />
      </div>
    </SkyAppShell>
  );
}
