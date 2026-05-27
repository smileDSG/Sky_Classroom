'use client';

import { useMemo, useEffect } from 'react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { StatCards, QuickActions, ActivityTimeline } from '@/components/sky/dashboard/stat-cards';
import { LearningTrendChart } from '@/components/sky/dashboard/learning-trend-chart';
import { AbilityRadar } from '@/components/sky/dashboard/ability-radar';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildKnowledgeGraph, getMasterySummary } from '@/lib/mistakes/knowledge-graph';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import type { MistakeRecord } from '@/lib/mistakes/types';

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '早上好，同学！';
  if (hour >= 12 && hour < 18) return '下午好，同学！';
  if (hour >= 18 && hour < 22) return '晚上好，同学！';
  return '夜深了，注意休息！';
}

export default function SkyDashboardPage() {
  const mistakes = useSkyClassroomStore((s) => s.mistakes);

  // Seed demo data on first visit, then sync real quiz data
  useEffect(() => {
    const store = useSkyClassroomStore.getState();
    if (store.mistakes.length === 0) {
      DEMO_MISTAKES.forEach((m) => store.addMistake(m));
    }
    syncMistakesFromQuizzes();
  }, []);

  const greeting = getGreeting();
  const now = new Date();

  // Build 7-day trend data from mistakes
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

  // Build radar data from knowledge graph
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
    const summary = getMasterySummary(graph);
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
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-100">{greeting}</h2>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            学习进行中
          </div>
        </div>

        {/* Stat Cards */}
        <StatCards mistakes={mistakes} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
