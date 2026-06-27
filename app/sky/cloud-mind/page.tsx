'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import {
  Camera,
  Presentation,
  Brain,
  ArrowRight,
  Sparkles,
  Zap,
  BookOpen,
  FileQuestion,
  Route,
} from 'lucide-react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildPersonalizedActionPlan } from '@/lib/sky/personalized-actions';

const TOOLS = [
  {
    id: 'solve',
    label: '拍照搜题',
    description: '拍照识别题目，AI 智能解答，步骤清晰',
    href: '/sky/cloud-mind/solve',
    icon: Camera,
    gradient: 'from-violet-500 to-purple-600',
    stats: '已解答 1.2k+ 题',
    badge: '热门',
  },
  {
    id: 'slides',
    label: 'PPT课件生成',
    description: '输入主题，AI 一键生成精美PPT课件',
    href: '/sky/cloud-mind/slides',
    icon: Presentation,
    gradient: 'from-cyan-500 to-blue-600',
    stats: 'AI 智能生成',
    badge: '推荐',
  },
  {
    id: 'quiz',
    label: '智能出题',
    description: '选择学科与难度，AI 量身定制练习题',
    href: '/sky/cloud-mind/quiz',
    icon: FileQuestion,
    gradient: 'from-amber-500 to-yellow-500',
    stats: '9 大学科覆盖',
    badge: '新',
  },
  {
    id: 'memory',
    label: '记忆卡片',
    description: 'AI 生成记忆卡片，艾宾浩斯高效复习',
    href: '/sky/cloud-mind/memory',
    icon: Brain,
    gradient: 'from-rose-500 to-pink-600',
    stats: '科学记忆法',
  },
  {
    id: 'teaching',
    label: '智能授课',
    description: 'AI 辅助课堂讲解，智能生成教学方案',
    href: '/sky/cloud-mind/teaching',
    icon: BookOpen,
    gradient: 'from-amber-500 to-orange-600',
    stats: 'AI 教学助手',
    badge: '新',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

export default function CloudMindPage() {
  const mistakes = useSkyClassroomStore((s) => s.mistakes);
  const actionPlan = useMemo(() => buildPersonalizedActionPlan(mistakes), [mistakes]);
  const pinnedActions = actionPlan.actions
    .filter((action) => ['quiz', 'memory', 'teaching'].includes(action.id))
    .slice(0, 3);

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 md:p-12"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-medium text-indigo-200 tracking-wider uppercase">
                AI 工具集
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">云端智囊</h1>
            <p className="text-indigo-100 text-base md:text-lg max-w-xl leading-relaxed">
              汇聚 AI
              之力，为你的学习保驾护航。拍照搜题、PPT课件生成、智能出题、记忆卡片与智能授课一站直达。
            </p>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-indigo-200">
                <Zap className="h-4 w-4" />
                <span>{TOOLS.length} 大智能工具</span>
              </div>
              <div className="h-4 w-px bg-indigo-400/40" />
              <div className="flex items-center gap-2 text-sm text-indigo-200">
                <Sparkles className="h-4 w-4" />
                <span>持续更新中</span>
              </div>
            </div>
          </div>
        </motion.div>

        {actionPlan.hasSignals && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-slate-200/50 bg-white/70 p-5 backdrop-blur-sm dark:border-slate-700/30 dark:bg-slate-800/60"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    来自天梯工坊
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                  为「{actionPlan.primaryTopic}」安排下一步
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {actionPlan.primaryReason}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {pinnedActions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="group rounded-xl border border-slate-200/60 bg-white/70 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white dark:border-slate-700/40 dark:bg-slate-900/40 dark:hover:border-indigo-800"
                  >
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {action.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {action.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tools Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"
        >
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <motion.div key={tool.id} variants={itemVariants}>
                <Link
                  href={tool.href}
                  className="group relative flex flex-col h-full overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-6 transition-all duration-500 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1"
                >
                  {/* Glow effect on hover */}
                  <div
                    className={`absolute inset-0 opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500 bg-gradient-to-br ${tool.gradient}`}
                  />

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg`}
                        >
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        {tool.badge && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <ArrowRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all duration-300" />
                    </div>

                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1.5">
                      {tool.label}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed flex-1">
                      {tool.description}
                    </p>

                    <div className="mt-4 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {tool.stats}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="rounded-2xl bg-gradient-to-r from-slate-100 to-indigo-50 dark:from-slate-800/50 dark:to-indigo-950/30 border border-slate-200/50 dark:border-slate-700/30 p-6 text-center"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">
            所有工具均支持多学科，持续迭代中 ✨
          </p>
        </motion.div>
      </div>
    </SkyAppShell>
  );
}
