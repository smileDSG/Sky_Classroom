'use client';

import { useEffect } from 'react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { StatCards, QuickActions, ActivityTimeline } from '@/components/sky/dashboard/stat-cards';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '早上好，同学！☀️';
  if (hour >= 12 && hour < 18) return '下午好，同学！🌤️';
  if (hour >= 18 && hour < 22) return '晚上好，同学！🌙';
  return '夜深了，注意休息！⭐';
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

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">{greeting}</h2>
        <StatCards mistakes={mistakes} />
        <QuickActions />
        <ActivityTimeline mistakes={mistakes} />
      </div>
    </SkyAppShell>
  );
}
