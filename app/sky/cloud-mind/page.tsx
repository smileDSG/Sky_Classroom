'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Camera,
  FileQuestion,
  Layers,
  Loader2,
  Presentation,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import type { CloudMindDashboardData, LearningRecommendation } from '@/lib/cloud-mind/types';

const TOOLS: Array<{
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  gradient: string;
  stats: string;
  badge?: string;
}> = [
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
  {
    id: 'course-studio',
    label: '课程资源工坊',
    description: '结合课程知识库和学习画像，生成讲义、题库、导图、实操案例和视频脚本',
    href: '/sky/cloud-mind/course-studio',
    icon: Layers,
    gradient: 'from-emerald-500 to-teal-600',
    stats: 'AI 导论知识库',
    badge: '个性化',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

type DashboardState = 'loading' | 'ready' | 'error';

const suggestionPanelClass =
  'rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/50 backdrop-blur-sm dark:border-slate-700/30 dark:bg-slate-900/55 dark:shadow-slate-950/10';

function getRecommendationAction(recommendation: LearningRecommendation | null) {
  const href = recommendation?.target.href ?? '';
  const isCloudMindTool =
    href.startsWith('/sky/cloud-mind/') &&
    !href.startsWith('/sky/cloud-mind/write') &&
    !href.startsWith('/sky/cloud-mind/translate') &&
    !href.startsWith('/sky/cloud-mind/knowledge');

  if (recommendation && isCloudMindTool) return recommendation.target;

  if (recommendation?.actionType === 'review_cards') {
    return {
      href: '/sky/cloud-mind/memory',
      label: '生成记忆卡片',
    };
  }

  if (recommendation?.actionType === 'micro_lesson') {
    return {
      href: '/sky/cloud-mind/teaching',
      label: '进入微讲解',
    };
  }

  if (!recommendation) {
    return {
      href: '/sky/cloud-mind/quiz',
      label: '开始诊断',
    };
  }

  return {
    href: '/sky/cloud-mind/quiz',
    label: '开始练习',
  };
}

function buildMemoryHref(topic?: string): string {
  if (!topic) return '/sky/cloud-mind/memory';
  return `/sky/cloud-mind/memory?topic=${encodeURIComponent(topic)}&content=${encodeURIComponent(
    `知识点：${topic}`,
  )}`;
}

function buildTeachingHref(topic?: string): string {
  if (!topic) return '/sky/cloud-mind/teaching';
  return `/sky/cloud-mind/teaching?topic=${encodeURIComponent(topic)}&from=cloud-mind`;
}

export default function CloudMindPage() {
  const [dashboard, setDashboard] = useState<CloudMindDashboardData | null>(null);
  const [dashboardState, setDashboardState] = useState<DashboardState>('loading');

  useEffect(() => {
    let active = true;

    fetch('/api/sky/cloud-mind/dashboard', { credentials: 'include' })
      .then((res) => res.json())
      .then((payload: { data?: CloudMindDashboardData }) => {
        if (!active) return;
        setDashboard(payload.data ?? null);
        setDashboardState('ready');
      })
      .catch(() => {
        if (!active) return;
        setDashboardState('error');
      });

    return () => {
      active = false;
    };
  }, []);

  const primaryRecommendation = dashboard?.recommendations[0] ?? null;
  const recommendationAction = getRecommendationAction(primaryRecommendation);
  const suggestedTopic = dashboard?.weakPoints[0]?.knowledgePoint;
  const secondaryAction = recommendationAction.href.startsWith('/sky/cloud-mind/memory')
    ? {
        href: buildTeachingHref(suggestedTopic),
        label: '进入微讲解',
      }
    : {
        href: buildMemoryHref(suggestedTopic),
        label: '生成记忆卡片',
      };

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-5 pt-1">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-7 py-8 shadow-2xl shadow-violet-950/20 md:px-10 md:py-10"
        >
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-400/20 blur-2xl" />

          <div className="relative z-10">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-medium tracking-wider text-indigo-200 uppercase">
                AI 工具集
              </span>
            </div>

            <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">云端智囊</h1>
            <p className="max-w-xl text-base leading-relaxed text-indigo-100 md:text-lg">
              汇聚 AI
              之力，为你的学习保驾护航。拍照搜题、PPT课件生成、智能出题、记忆卡片、智能授课、课程资源，一站直达。
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
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className={`${suggestionPanelClass} p-5`}
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-200">
                <Sparkles className="h-4 w-4" />
                今日推荐工具
                {dashboardState === 'loading' && (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500 dark:text-indigo-200" />
                )}
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {dashboardState === 'error'
                  ? '暂时没有拿到实时建议'
                  : (primaryRecommendation?.title ?? '先完成一次入门诊断')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {dashboardState === 'error'
                  ? '可以直接从下面的 AI 工具开始。'
                  : (primaryRecommendation?.reason ??
                    '建立第一份学情画像后，智囊会优先推荐更适合当前状态的 AI 工具。')}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link
                href={recommendationAction.href}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-400"
              >
                {recommendationAction.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-indigo-400/40 dark:hover:text-indigo-200"
              >
                {secondaryAction.label}
              </Link>
            </div>
          </div>
        </motion.section>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">全部工具</h2>
            <p className="text-sm text-slate-500">围绕学习任务组织核心入口</p>
          </div>
          <span className="rounded-full border border-slate-200/80 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700/40 dark:bg-slate-900/55 dark:text-slate-400">
            {TOOLS.length} 个工具
          </span>
        </div>

        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <motion.div key={tool.id} variants={itemVariants}>
                <Link
                  href={tool.href}
                  className="group relative flex min-h-44 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-lg shadow-slate-200/50 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-indigo-300/50 hover:bg-white hover:shadow-xl hover:shadow-indigo-200/50 dark:border-slate-700/30 dark:bg-slate-900/55 dark:shadow-none dark:hover:border-indigo-400/30 dark:hover:bg-slate-900/75 dark:hover:shadow-indigo-500/10"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-[0.06] dark:group-hover:opacity-[0.08]`}
                  />

                  <div className="relative z-10 flex h-full flex-col">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg`}
                        >
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        {tool.badge && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <ArrowRight className="h-5 w-5 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-indigo-500 dark:text-slate-600 dark:group-hover:text-indigo-300" />
                    </div>

                    <h3 className="mb-1.5 text-lg font-bold text-slate-800 dark:text-slate-100">
                      {tool.label}
                    </h3>
                    <p className="flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      {tool.description}
                    </p>

                    <div className="mt-4">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-400">
                        {tool.stats}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.section>
      </div>
    </SkyAppShell>
  );
}
