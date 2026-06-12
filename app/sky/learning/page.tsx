'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { MistakeBook } from '@/components/sky/learning/mistake-book';
import { KnowledgeGraphView } from '@/components/sky/learning/knowledge-graph-view';
import { LearningStats } from '@/components/sky/learning/learning-stats';
import { ReviewPlan } from '@/components/sky/learning/review-plan';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import { buildKnowledgeGraph } from '@/lib/mistakes/knowledge-graph';
import type { MistakeCause } from '@/lib/solve/types';
import {
  BookOpen,
  CalendarCheck,
  Network,
  BarChart3,
  TreePine,
  TrendingUp,
  Leaf,
  Globe,
} from 'lucide-react';
import { StudentProfilePage } from '@/app/sky/student/student-profile-page';

/** Map server ErrorType → client MistakeCause */
function errorTypeToCause(errorType: string): MistakeCause {
  const map: Record<string, MistakeCause> = {
    concept: 'concept-unclear',
    calculation: 'calculation-error',
    reading: 'misreading',
    reasoning: 'method-wrong',
    careless: 'careless',
  };
  return map[errorType] ?? 'concept-unclear';
}

const TABS = [
  { key: 'mistakes', label: '错题本', icon: BookOpen, desc: '记录与反思' },
  { key: 'review', label: '复习计划', icon: CalendarCheck, desc: '艾宾浩斯曲线' },
  { key: 'graph', label: '知识图谱', icon: Network, desc: '能力可视化' },
  { key: 'stats', label: '学习统计', icon: BarChart3, desc: '数据洞察' },
  { key: 'profile', label: '学情分析', icon: Globe, desc: '多维度洞察' },
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('mistakes');
  const mistakes = useSkyClassroomStore((s) => s.mistakes);

  const weakPoints = useMemo(() => {
    if (mistakes.length === 0) return [];
    const graph = buildKnowledgeGraph(mistakes);
    return graph.weakPoints;
  }, [mistakes]);

  useEffect(() => {
    // Sync from local quizzes first
    syncMistakesFromQuizzes();

    // Then load from server and merge
    fetch('/api/sky/mistakes?pageSize=9999', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.items)) {
          const serverMistakes = data.items.map((entry: Record<string, unknown>) => ({
            id: entry.id as string,
            problem: entry.problemText as string,
            userAnswer: entry.userAnswer as string,
            correctAnswer: entry.correctAnswer as string,
            cause: errorTypeToCause(entry.errorType as string),
            solvedAt: entry.lastReview ? new Date(entry.lastReview as number) : new Date(),
            reviewed: entry.reviewed as boolean,
            reviewCount: entry.reviewCount as number,
            knowledgePoints: (entry.knowledgePoints as string[]) ?? [],
          }));
          useSkyClassroomStore.getState().mergeMistakes(serverMistakes);
        }
      })
      .catch(() => {
        /* ignore — local data is fallback */
      });
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
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">天梯工坊</h1>
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
          className="grid grid-cols-2 md:grid-cols-5 gap-3"
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
          {activeTab === 'graph' && (
            <div className="space-y-4">
              <KnowledgeGraphView />
              {weakPoints.length > 0 && (
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                    薄弱知识点针对性复习
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {weakPoints.map((kp) => (
                      <span
                        key={kp}
                        className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-900/20 border border-rose-200/50 dark:border-rose-700/30 px-3 py-1 text-xs font-medium text-rose-600 dark:text-rose-400"
                      >
                        {kp}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        router.push(
                          `/sky/cloud-mind/memory?topic=${encodeURIComponent(weakPoints.join('、'))}&content=${encodeURIComponent(weakPoints.map((kp) => `知识点：${kp}`).join('\n'))}`,
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-rose-500/25 hover:shadow-xl transition-all hover:-translate-y-0.5"
                    >
                      生成记忆卡片
                    </button>
                    <button
                      onClick={() =>
                        router.push(
                          `/sky/cloud-mind/quiz?topic=${encodeURIComponent(weakPoints.join('、'))}`,
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-amber-500/25 hover:shadow-xl transition-all hover:-translate-y-0.5"
                    >
                      针对出题
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'stats' && <LearningStats />}
          {activeTab === 'profile' && <StudentProfilePage />}
        </motion.div>
      </div>
    </SkyAppShell>
  );
}
