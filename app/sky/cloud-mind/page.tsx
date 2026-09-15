'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Camera,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Gauge,
  Layers,
  ListChecks,
  Loader2,
  Presentation,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { SkySectionNav } from '@/components/sky/layout/sky-section-nav';
import { PageTour } from '@/components/sky/tour/page-tour';
import type {
  CloudMindDashboardData,
  LearningRecommendation,
  PersonalizationContext,
  ToolPersonalizationPolicy,
  ToolPersonalizationPolicies,
} from '@/lib/cloud-mind/types';

const TOOLS: Array<{
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  gradient: string;
  stats: string;
  badge?: string;
  policyKey: keyof ToolPersonalizationPolicies;
  group: 'learning' | 'resources';
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
    policyKey: 'solve',
    group: 'learning',
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
    policyKey: 'slides',
    group: 'resources',
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
    policyKey: 'quiz',
    group: 'learning',
  },
  {
    id: 'memory',
    label: '记忆卡片',
    description: 'AI 生成记忆卡片，艾宾浩斯高效复习',
    href: '/sky/cloud-mind/memory',
    icon: Brain,
    gradient: 'from-rose-500 to-pink-600',
    stats: '科学记忆法',
    policyKey: 'memory',
    group: 'learning',
  },
  {
    id: 'teaching',
    label: '智能授课',
    description: '针对薄弱点生成微课，边学边练并即时检查',
    href: '/sky/cloud-mind/teaching',
    icon: BookOpen,
    gradient: 'from-amber-500 to-orange-600',
    stats: '学生微课讲解',
    badge: '新',
    policyKey: 'teaching',
    group: 'learning',
  },
  {
    id: 'course-studio',
    label: '课程资源工坊',
    description: '结合课程资料和你的学习情况，生成讲义、题库、导图、实操案例和视频脚本',
    href: '/sky/cloud-mind/course-studio',
    icon: Layers,
    gradient: 'from-emerald-500 to-teal-600',
    stats: 'AI 导论知识库',
    badge: '个性化',
    policyKey: 'learningPath',
    group: 'resources',
  },
];

const PACE_LABELS: Record<ToolPersonalizationPolicy['pacing'], string> = {
  remedial: '补基础节奏',
  steady: '稳步推进',
  sprint: '冲刺节奏',
};

const DIFFICULTY_LABELS: Record<ToolPersonalizationPolicy['difficulty'], string> = {
  easy: '基础难度',
  medium: '标准难度',
  hard: '挑战难度',
};

const EXPLANATION_LABELS: Record<ToolPersonalizationPolicy['explanationStyle'], string> = {
  step_first: '步骤优先',
  principle_first: '原理优先',
  example_first: '例题优先',
  practice_first: '练习优先',
};

type ToolCardView = {
  kicker: string;
  title: string;
  detail: string;
  meta: string;
  action: string;
};

function displayTopic(value: string | undefined): string | undefined {
  const topic = value?.trim();
  return topic && !/^kp-[a-z0-9-]+$/i.test(topic) ? topic : undefined;
}

function toolTopic(policy: ToolPersonalizationPolicy | undefined): string {
  const topic = displayTopic(policy?.targetTopic);
  return topic ? `「${topic}」` : '当前学习重点';
}

function buildToolCardView(
  toolId: string,
  policy: ToolPersonalizationPolicy | undefined,
  dueReviewCount: number,
): ToolCardView {
  const topic = toolTopic(policy);
  const duration = policy?.durationMinutes ?? 10;
  const difficulty = policy ? DIFFICULTY_LABELS[policy.difficulty] : '完成画像后匹配';
  const pace = policy ? PACE_LABELS[policy.pacing] : '完成练习后匹配';
  const count = policy?.questionCount ?? 0;

  switch (toolId) {
    case 'solve':
      return {
        kicker: policy?.action === 'diagnostic' ? '先建立基线' : '针对最近错题',
        title: `把 ${topic} 的解题步骤讲明白`,
        detail: `拍一道题直接进入即时讲解，${policy ? EXPLANATION_LABELS[policy.explanationStyle] : '按步骤拆解'}，不用先选学科或难度。`,
        meta: `${duration} 分钟 · 1 道题`,
        action: '拍题解析',
      };
    case 'quiz':
      return {
        kicker: policy?.action === 'diagnostic' ? '先做小诊断' : '验证掌握度',
        title: `用 ${count || 3} 题检验 ${topic}`,
        detail: `${difficulty} · ${pace}，答题结果会继续调整后续练习，不需要你手动拼配置。`,
        meta: `${count || 3} 题 · ${duration} 分钟`,
        action: '开始小测',
      };
    case 'memory':
      return {
        kicker: dueReviewCount > 0 ? '到期内容优先' : '巩固容易遗忘的内容',
        title:
          dueReviewCount > 0 ? `先复习 ${dueReviewCount} 项到期内容` : `把 ${topic} 做成记忆卡`,
        detail: `按间隔复习安排卡片，${topic} 会作为首个复习范围，减少你再次整理资料的成本。`,
        meta: `${count || 5} 张卡 · ${duration} 分钟`,
        action: dueReviewCount > 0 ? '开始复习' : '生成卡片',
      };
    case 'teaching':
      return {
        kicker: '学生微课讲解',
        title: `用一节微课补上 ${topic}`,
        detail: `先${policy ? EXPLANATION_LABELS[policy.explanationStyle] : '讲清核心'}，再用检查点确认是否真的掌握；教师备课请进入备课工作区。`,
        meta: `微课 · ${duration} 分钟`,
        action: '开始授课',
      };
    case 'slides':
      return {
        kicker: '组织成可讲的课件',
        title: `把 ${topic} 讲成一套 PPT`,
        detail: `课件优先覆盖需要加强的内容，并按${policy ? EXPLANATION_LABELS[policy.explanationStyle] : '结构化讲解'}组织页面。`,
        meta: `课件 · ${duration} 分钟`,
        action: '生成课件',
      };
    case 'course-studio':
      return {
        kicker: '一站生成学习资源',
        title: `围绕 ${topic} 生成一套资料`,
        detail: '把讲义、导图、题库和实操案例放进同一条学习路径，适合需要完整补齐一个章节时使用。',
        meta: `资源包 · ${duration} 分钟`,
        action: '进入资源工坊',
      };
    default:
      return {
        kicker: '按你的学习情况准备',
        title: `继续处理 ${topic}`,
        detail: '系统会在进入工具后继续读取你的学习记录。',
        meta: '按需安排',
        action: '开始使用',
      };
  }
}

function buildToolHref(
  toolId: string,
  fallbackHref: string,
  policy: ToolPersonalizationPolicy | undefined,
): string {
  const topic = displayTopic(policy?.targetTopic);
  if (!topic || !policy) return fallbackHref;

  const params = new URLSearchParams({
    topic,
    difficulty: policy.difficulty,
  });

  switch (toolId) {
    case 'solve':
      return `/sky/cloud-mind/solve?${params.toString()}`;
    case 'slides':
      return `/sky/cloud-mind/slides?${params.toString()}`;
    case 'quiz':
      if (policy.questionCount > 0) params.set('count', String(policy.questionCount));
      if (policy.action === 'diagnostic') params.set('mode', 'diagnostic');
      return `/sky/cloud-mind/quiz?${params.toString()}`;
    case 'memory':
      params.set('content', `知识点：${topic}`);
      return `/sky/cloud-mind/memory?${params.toString()}`;
    case 'teaching':
      params.set('from', 'cloud-mind');
      return `/sky/cloud-mind/teaching?${params.toString()}`;
    case 'course-studio':
      return `/sky/cloud-mind/course-studio?${params.toString()}`;
    default:
      return fallbackHref;
  }
}

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
      label: '开始入门练习',
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
  const [profileContext, setProfileContext] = useState<PersonalizationContext | null>(null);
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

  // Personalization is useful after the dashboard is visible, but expensive to build.
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      fetch('/api/sky/cloud-mind/personalization-context', { credentials: 'include' })
        .then((res) => res.json())
        .then((payload: { data?: PersonalizationContext }) => {
          if (!active) return;
          setProfileContext(payload.data ?? null);
        })
        .catch(() => {
          if (!active) return;
          setProfileContext(null);
        });
    }, 900);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const primaryRecommendation = dashboard?.recommendations[0] ?? null;
  const recommendationAction = getRecommendationAction(primaryRecommendation);
  const suggestedTopic = dashboard?.weakPoints[0]?.knowledgePoint;
  const policies = profileContext?.toolPolicies;
  const primaryWeakPoint = dashboard?.weakPoints[0];
  const mastery = primaryWeakPoint?.mastery ?? dashboard?.summary.masteryAverage ?? 0;
  const accuracy = dashboard?.summary.recentAccuracy;
  const profileStatus = !dashboard?.hasLearningData
    ? '正在了解你的学习情况'
    : mastery < 50
      ? '需要补基础'
      : mastery < 75
        ? '正在稳定提升'
        : '状态良好';
  const statusTone = !dashboard?.hasLearningData
    ? 'text-sky-700 dark:text-sky-300'
    : mastery < 50
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-emerald-700 dark:text-emerald-300';
  const profileReason = !dashboard?.hasLearningData
    ? '完成一次短练习，系统才知道从哪里开始最合适。'
    : primaryWeakPoint
      ? `根据最近的答题和错题，${primaryWeakPoint.knowledgePoint} 是当前最值得先处理的薄弱点。`
      : '系统会继续观察你的答题表现，动态调整后续工具。';
  const secondaryAction = recommendationAction.href.startsWith('/sky/cloud-mind/memory')
    ? {
        href: buildTeachingHref(suggestedTopic),
        label: '进入微讲解',
      }
    : {
        href: buildMemoryHref(suggestedTopic),
        label: '生成记忆卡片',
      };

  const profileAction = !dashboard?.hasLearningData
    ? { href: '/sky/cloud-mind/quiz?mode=diagnostic', label: '开始 5 分钟入门练习' }
    : recommendationAction;
  const recommendedToolId = primaryRecommendation?.target.href
    .split('/sky/cloud-mind/')[1]
    ?.split('?')[0];

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-5 pt-1">
        <SkySectionNav section="resources" />

        <motion.section
          data-tour-step="page-header"
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
          transition={{ duration: 0.55, delay: 0.08 }}
          className="overflow-hidden rounded-3xl border border-sky-200/80 bg-white shadow-xl shadow-sky-100/70 dark:border-sky-900/60 dark:bg-slate-900/80 dark:shadow-slate-950/20"
        >
          <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40 md:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  <Gauge className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">
                    学习情况中心
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold text-slate-950 dark:text-white">
                    你的学习状态，正在驱动下面的每个工具
                  </h2>
                </div>
              </div>
              <span className={`text-sm font-semibold ${statusTone}`}>
                {dashboardState === 'loading' ? '正在读取数据…' : profileStatus}
              </span>
            </div>
          </div>

          <div className="grid gap-6 px-5 py-6 md:grid-cols-[1.15fr_0.85fr] md:px-7">
            <div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    当前优先主题
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                    {dashboardState === 'loading'
                      ? '正在分析…'
                      : (primaryWeakPoint?.knowledgePoint ?? '先完成一次入门练习')}
                  </p>
                </div>
                <p className="text-3xl font-bold tabular-nums text-sky-700 dark:text-sky-300">
                  {mastery}%
                </p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(4, Math.min(100, mastery))}%` }}
                  transition={{ duration: 0.8, delay: 0.25 }}
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                />
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {profileReason}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">近 14 天正确率</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                    {accuracy === null || accuracy === undefined ? '暂无' : `${accuracy}%`}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">待复习</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-amber-600 dark:text-amber-300">
                    {dashboard?.dueReviews.length ?? 0} 项
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">累计练习</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                    {dashboard?.summary.totalQuestions ?? 0} 题
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">学习记录</p>
                  <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-300">
                    {profileContext?.hasPersonalizationSignals ? '已启用' : '待收集'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-sky-200 bg-sky-50/80 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-800 dark:text-sky-200">
                  <Target className="h-4 w-4" />
                  系统下一步怎么安排
                </div>
                <p className="mt-3 text-xl font-bold text-slate-950 dark:text-white">
                  {primaryRecommendation?.title ?? '先做一次入门练习'}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {primaryRecommendation?.reason ?? '用 5 道题建立基线，后续难度和内容会自动调整。'}
                </p>
              </div>
              <Link
                href={profileAction.href}
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition-colors hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
              >
                {profileAction.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
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
                  : (primaryRecommendation?.title ?? '先完成一次入门练习')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {dashboardState === 'error'
                  ? '可以直接从下面的 AI 工具开始。'
                  : (primaryRecommendation?.reason ??
                    '完成一些练习后，系统会优先推荐更适合你当前状态的学习工具。')}
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">按任务选择工具</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              学习时先用核心工具，准备课程时进入资源生成区
            </p>
          </div>
          <span className="rounded-full border border-slate-200/80 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700/40 dark:bg-slate-900/55 dark:text-slate-400">
            {TOOLS.length} 个工具
          </span>
        </div>

        <motion.section
          data-tour-step="page-primary"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {(['learning', 'resources'] as const).map((group) => (
            <div key={group} className="contents">
              <div className="col-span-full flex items-end justify-between gap-3 border-b border-slate-200/70 pb-2 dark:border-slate-700/40">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {group === 'learning' ? '学习工具' : '资源与生成'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {group === 'learning'
                      ? '直接解决一道题、补一个知识点，或开始复习。'
                      : '把知识点整理成课件、讲义和可复用的课程材料。'}
                  </p>
                </div>
              </div>
              {TOOLS.filter((tool) => tool.group === group).map((tool) => {
                const Icon = tool.icon;
                const policy = policies?.[tool.policyKey];
                const isRecommended = recommendedToolId === tool.id;
                const cardView = buildToolCardView(
                  tool.id,
                  policy,
                  profileContext?.dueReviews.length ?? dashboard?.dueReviews.length ?? 0,
                );
                const toolHref = buildToolHref(tool.id, tool.href, policy);
                return (
                  <motion.div key={tool.id} variants={itemVariants}>
                    <Link
                      href={toolHref}
                      aria-label={`${tool.label}：${cardView.action}`}
                      className={`group relative flex min-h-56 flex-col overflow-hidden rounded-2xl border bg-white/90 p-6 shadow-lg shadow-slate-200/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300/50 hover:bg-white hover:shadow-xl hover:shadow-indigo-200/50 dark:bg-slate-900/55 dark:shadow-none dark:hover:border-indigo-400/30 dark:hover:bg-slate-900/75 dark:hover:shadow-indigo-500/10 ${
                        isRecommended
                          ? 'border-sky-400 ring-2 ring-sky-400/20 dark:border-sky-400/70 dark:ring-sky-400/20'
                          : 'border-slate-200/80 dark:border-slate-700/30'
                      }`}
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
                        <div className="mt-3 flex flex-1 flex-col border-t border-slate-200/80 pt-3 dark:border-slate-700/50">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
                            {isRecommended ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Target className="h-3.5 w-3.5" />
                            )}
                            {isRecommended ? '当前优先' : cardView.kicker}
                          </div>
                          <p className="mt-1.5 text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100">
                            {cardView.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {cardView.detail}
                          </p>
                          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              {cardView.meta}
                            </span>
                            <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300">
                              <ListChecks className="h-3.5 w-3.5" />
                              {cardView.action}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </motion.section>
      </div>

      <PageTour id="resources-overview" />
    </SkyAppShell>
  );
}
