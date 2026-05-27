'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { MistakeBook } from '@/components/sky/learning/mistake-book';
import { KnowledgeGraphView } from '@/components/sky/learning/knowledge-graph-view';
import { LearningStats } from '@/components/sky/learning/learning-stats';
import { ReviewPlan } from '@/components/sky/learning/review-plan';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import type { MistakeRecord } from '@/lib/mistakes/types';
import {
  BookOpen,
  CalendarCheck,
  Network,
  BarChart3,
  TreePine,
  TrendingUp,
  Leaf,
} from 'lucide-react';

const DEMO_MISTAKES: MistakeRecord[] = [
  {
    id: 'demo-1',
    problem: '解方程：2x + 5 = 13，求 x 的值。',
    userAnswer: 'x = 3',
    correctAnswer: 'x = 4',
    cause: 'calculation-error',
    solvedAt: new Date(Date.now() - 3600000),
    reviewed: false, reviewCount: 0,
    knowledgePoints: ['代数', '一元一次方程'],
  },
  {
    id: 'demo-2',
    problem: '若 sin A = 3/5，且 A 为锐角，求 cos A。',
    userAnswer: 'cos A = 3/5',
    correctAnswer: 'cos A = 4/5',
    cause: 'concept-unclear',
    solvedAt: new Date(Date.now() - 7200000),
    reviewed: false, reviewCount: 0,
    knowledgePoints: ['几何', '三角函数'],
  },
  {
    id: 'demo-3',
    problem: '下列选项中，哪一个是二次函数 y = x² - 4x + 3 的对称轴？',
    userAnswer: 'x = 1',
    correctAnswer: 'x = 2',
    cause: 'method-wrong',
    solvedAt: new Date(Date.now() - 86400000),
    reviewed: true, reviewCount: 1,
    knowledgePoints: ['代数', '二次函数'],
  },
  {
    id: 'demo-4',
    problem: '一个物体从 20 米高处自由落下，求落地时的速度。（g=10m/s²）',
    userAnswer: '10 m/s',
    correctAnswer: '20 m/s',
    cause: 'misreading',
    solvedAt: new Date(Date.now() - 172800000),
    reviewed: false, reviewCount: 0,
    knowledgePoints: ['物理', '自由落体'],
  },
  {
    id: 'demo-5',
    problem: '计算：(a + b)² 的展开式。',
    userAnswer: 'a² + b²',
    correctAnswer: 'a² + 2ab + b²',
    cause: 'careless',
    solvedAt: new Date(Date.now() - 259200000),
    reviewed: true, reviewCount: 3,
    knowledgePoints: ['代数', '乘法公式'],
  },
];

const TABS = [
  { key: 'mistakes', label: '错题本', icon: BookOpen, desc: '记录与反思' },
  { key: 'review', label: '复习计划', icon: CalendarCheck, desc: '艾宾浩斯曲线' },
  { key: 'graph', label: '知识图谱', icon: Network, desc: '能力可视化' },
  { key: 'stats', label: '学习统计', icon: BarChart3, desc: '数据洞察' },
] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } },
};

export default function LearningPage() {
  const [activeTab, setActiveTab] = useState<string>('mistakes');

  useEffect(() => {
    const store = useSkyClassroomStore.getState();
    if (store.mistakes.length === 0) {
      DEMO_MISTAKES.forEach((m) => store.addMistake(m));
    }
    syncMistakesFromQuizzes();
  }, []);

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Hero — 森林阶梯主题 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 p-8 md:p-10"
        >
          {/* 装饰元素 */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-teal-400/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />
          <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-emerald-300/40 rounded-full" />
          <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-teal-300/30 rounded-full" />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <TreePine className="h-5 w-5 text-emerald-200" />
                </div>
                <span className="text-xs font-medium text-emerald-200 tracking-wider uppercase">
                  成长之路
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                天梯工坊
              </h1>
              <p className="text-emerald-100 text-base max-w-md leading-relaxed">
                每一步都是向上的阶梯，记录错题、规划复习、构建知识图谱，让成长有迹可循。
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm text-emerald-200">
                  <TrendingUp className="h-4 w-4" />
                  <span>持续进步</span>
                </div>
                <div className="h-4 w-px bg-emerald-400/30" />
                <div className="flex items-center gap-1.5 text-sm text-emerald-200">
                  <Leaf className="h-4 w-4" />
                  <span>科学记忆</span>
                </div>
              </div>
            </div>

            {/* 阶梯装饰 */}
            <div className="hidden md:flex flex-col items-end gap-1 opacity-30">
              {[5, 4, 3, 2, 1].map((step) => (
                <motion.div
                  key={step}
                  initial={{ width: 0 }}
                  animate={{ width: step * 32 }}
                  transition={{ delay: 0.3 + step * 0.1, duration: 0.6 }}
                  className="h-2 rounded-full bg-emerald-200/40"
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Tab Bar — 森林风格 */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <motion.button
                key={tab.key}
                variants={itemVariants}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex flex-col items-center rounded-2xl p-4 transition-all duration-300 border ${
                  isActive
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-700/40 shadow-lg shadow-emerald-500/10'
                    : 'bg-white/60 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-700/30 hover:bg-white/80 dark:hover:bg-slate-800/60 hover:-translate-y-0.5'
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl mb-2 transition-colors ${
                    isActive
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md'
                      : 'bg-emerald-50 dark:bg-emerald-900/20'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      isActive ? 'text-white' : 'text-emerald-500 dark:text-emerald-400'
                    }`}
                  />
                </div>
                <span
                  className={`text-sm font-semibold ${
                    isActive
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {tab.desc}
                </span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'mistakes' && <MistakeBook />}
          {activeTab === 'review' && <ReviewPlan />}
          {activeTab === 'graph' && <KnowledgeGraphView />}
          {activeTab === 'stats' && <LearningStats />}
        </motion.div>
      </div>
    </SkyAppShell>
  );
}
