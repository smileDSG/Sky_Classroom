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
  FileQuestion,
  Layers,
  ListChecks,
  Loader2,
  Presentation,
  Sparkles,
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
    gradient: 'from-violet-500 to-indigo-600',
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
    gradient: 'from-violet-500 to-indigo-600',
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
    gradient: 'from-violet-500 to-indigo-500',
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
    gradient: 'from-rose-500 to-violet-600',
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
    gradient: 'from-violet-500 to-indigo-600',
    stats: '学生微课讲解',
    badge: '新',
    policyKey: 'teaching',
    group: 'learning',
  },
  {
    id: 'course-studio',
    label: '学习包工坊',
    description: '结合课程资料和你的学习情况，生成讲义、导图、自查清单和学习路径',
    href: '/sky/cloud-mind/course-studio',
    icon: Layers,
    gradient: 'from-violet-500 to-indigo-600',
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
  const secondaryAction = recommendationAction.href.startsWith('/sky/cloud-mind/memory')
    ? {
        href: buildTeachingHref(suggestedTopic),
        label: '进入微讲解',
      }
    : {
        href: buildMemoryHref(suggestedTopic),
        label: '生成记忆卡片',
      };

  const recommendedToolId = primaryRecommendation?.target.href
    .split('/sky/cloud-mind/')[1]
    ?.split('?')[0];

  return (
    <SkyAppShell>
      <div className=" space-y-5 pt-1">
        <SkySectionNav section="resources" />

        <motion.section
          data-tour-step="page-header"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl border border-violet-200/70 bg-gradient-to-br from-white to-violet-50 px-7 py-6 shadow-lg shadow-violet-200/40 md:px-10 md:py-8"
        >
          <div className="absolute right-8 top-0 h-48 w-48 rounded-full bg-violet-200/30 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs font-semibold tracking-wider text-violet-600 uppercase">
                  AI 工具集
                </span>
              </div>
              <h1 className="text-2xl font-bold text-violet-900 md:text-3xl">云端智囊</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600 md:text-base">
                拍照搜题、PPT课件、智能出题、记忆卡片与微课讲解，一站直达。
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-700">
                <Zap className="h-4 w-4" />
                <span>{TOOLS.length} 大智能工具</span>
              </div>
              <div className="h-4 w-px bg-violet-200" />
              <div className="flex items-center gap-2 text-sm font-medium text-violet-700">
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
                      className={`group relative flex min-h-48 flex-col overflow-hidden rounded-2xl border bg-white/90 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-200/40 dark:bg-slate-900/55 dark:shadow-none dark:hover:bg-slate-900/75 dark:hover:shadow-indigo-500/10 ${
                        isRecommended
                          ? 'border-violet-400 ring-2 ring-violet-400/20 dark:border-violet-400/70 dark:ring-violet-400/20'
                          : 'border-slate-200/80 dark:border-slate-700/30'
                      }`}
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-[0.06] dark:group-hover:opacity-[0.08]`}
                      />

                      <div className="relative z-10 flex h-full flex-col">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} shadow-md`}
                            >
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            {isRecommended ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-300/15 dark:text-violet-200">
                                <CheckCircle2 className="h-3 w-3" />
                                当前优先
                              </span>
                            ) : (
                              tool.badge && (
                                <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                                  {tool.badge}
                                </span>
                              )
                            )}
                          </div>
                          <ArrowRight className="h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-indigo-500 dark:text-slate-600 dark:group-hover:text-indigo-300" />
                        </div>

                        <h3 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-100">
                          {tool.label}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500 dark:text-slate-400">
                          {cardView.title}
                        </p>
                        <p className="mt-auto flex items-center gap-1.5 pt-3 text-xs font-medium text-violet-700 dark:text-violet-300">
                          <ListChecks className="h-3.5 w-3.5" />
                          {cardView.action}
                        </p>
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
