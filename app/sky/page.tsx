'use client';

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { LearningTrendChart } from '@/components/sky/dashboard/learning-trend-chart';
import { AbilityRadar } from '@/components/sky/dashboard/ability-radar';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import { useTheme } from '@/lib/hooks/use-theme';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  BookOpenCheck,
  Camera,
  ArrowRight,
  Zap,
  Star,
  TrendingUp,
  Target,
  ShieldCheck,
  CheckCircle2,
  Route,
  Search,
  Sun,
  Moon,
  MessageCircle,
  LayoutDashboard,
} from 'lucide-react';
import { LearnerProfileDashboard } from '@/components/sky/learning/learner-profile-dashboard';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import { LearningProfilePrompt } from '@/components/sky/dashboard/learning-profile-prompt';

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const ABILITY_DIMENSIONS = [
  { name: '概念理解', causes: ['concept-unclear'] },
  { name: '计算准确', causes: ['calculation-error', 'careless'] },
  { name: '方法选择', causes: ['method-wrong'] },
  { name: '审题能力', causes: ['misreading', 'careless'] },
  { name: '表达规范', causes: ['format-error'] },
] as const;

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

function TodayFocusPanel({
  recommendation,
  stats,
  mistakeCount,
}: {
  recommendation: PersonalizationContext['recommendation'] | null;
  stats: LearningStats;
  mistakeCount: number;
}) {
  const action = recommendation ?? {
    title: mistakeCount > 0 ? '先完成一组错题复盘' : '先完成一次诊断采样',
    reason:
      mistakeCount > 0
        ? '摘星锦囊会优先处理已沉淀的薄弱点，完成后再更新学习路线。'
        : '先让系统获得第一批学习信号，后续会自动生成今日任务和学习路线。',
    href: mistakeCount > 0 ? '/sky/learning/review?dailyTask=1' : '/sky/cloud-mind/solve',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="overflow-hidden rounded-2xl border border-indigo-200/70 bg-[linear-gradient(135deg,#eef2ff_0%,#f8fafc_54%,#ffffff_100%)] shadow-[0_18px_55px_rgba(79,70,229,0.12)] dark:border-indigo-300/15 dark:bg-[linear-gradient(135deg,#111c3c_0%,#0b1729_58%,#070f1d_100%)] dark:shadow-[0_18px_55px_rgba(0,0,0,0.28)]"
    >
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:p-6">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white dark:bg-indigo-300 dark:text-slate-950">
              <Target className="h-4 w-4" />
            </span>
            <span className="rounded-full border border-indigo-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-200/20 dark:bg-white/[0.08] dark:text-indigo-100">
              摘星锦囊
            </span>
            <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
              今日只做一件最重要的事
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-slate-950 dark:text-white md:text-3xl">
              {action.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-200">
              {action.reason}
            </p>
          </div>
          <Link
            href={action.href}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.22)] transition-colors hover:bg-indigo-700 dark:bg-indigo-300 dark:text-slate-950 dark:hover:bg-indigo-200 sm:w-auto"
          >
            开始今日任务
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-white/[0.06]">
            <div className="text-xs text-slate-500 dark:text-slate-300">错题沉淀</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
              {mistakeCount}
            </div>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-white/[0.06]">
            <div className="text-xs text-slate-500 dark:text-slate-300">今日学习</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
              {stats.todayStudyMinutes}
              <span className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-300">
                分钟
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-white/[0.06]">
            <div className="text-xs text-slate-500 dark:text-slate-300">连续学习</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
              {stats.streakDays}
              <span className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-300">
                天
              </span>
            </div>
          </div>
        </div>
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

type TrendPoint = {
  day: string;
  total: number;
  reviewed: number;
};

type RadarPoint = {
  name: string;
  value: number;
};

type RouteTopic = {
  name: string;
  mastery: number;
  mistakeCount: number;
};

function LearningInsightsSection({
  trendData,
  radarData,
  masteryPercent,
  weakPointText,
}: {
  trendData: TrendPoint[];
  radarData: RadarPoint[];
  masteryPercent: number;
  weakPointText: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-sm dark:border-slate-700/40 dark:bg-slate-900/45">
      <div className="flex flex-col gap-3 border-b border-slate-200/60 px-4 py-4 dark:border-slate-700/40 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">学习洞察</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              用五维能力图和 14 天趋势解释今天为什么这样安排。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
            掌握度 {masteryPercent}%
          </span>
          <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
            {weakPointText ? `优先补强 ${weakPointText}` : '暂无明显薄弱点'}
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <LearningTrendChart data={trendData} />
        <AbilityRadar data={radarData} />
      </div>
    </section>
  );
}

function ReviewPlanSection({
  topics,
  weakPointText,
  mistakeCount,
}: {
  topics: RouteTopic[];
  weakPointText: string;
  mistakeCount: number;
}) {
  const focusTopic = topics[0]?.name ?? weakPointText ?? '当前错题';
  const reviewItems = [
    {
      title: `先复盘 ${focusTopic}`,
      desc: '看原题、错因和正确步骤，先把今天最关键的漏洞补上。',
    },
    {
      title: '做一组同类变式',
      desc: '不要急着刷新题，用 3-5 道相近题确认方法能迁移。',
    },
    {
      title: '更新画像和路线',
      desc: '完成复盘后再同步薄弱点，让后续路线更准。',
    },
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700/40 dark:bg-slate-900/45">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <BookOpenCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              今日复盘清单
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              已沉淀 {mistakeCount} 道错题，把今天的学习动作拆成可执行的三步。
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {reviewItems.map((item, index) => (
            <div
              key={item.title}
              className="flex gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700/50 dark:bg-slate-950/35"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/sky/learning/review?dailyTask=1"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200 sm:w-auto"
        >
          开始复盘
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700/40 dark:bg-slate-900/45">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
            <Route className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">路线预览</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              只露出接下来 3 个重点，完整路线放到学习路线页。
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {topics.slice(0, 3).map((topic, index) => (
            <div
              key={`${topic.name}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700/50 dark:bg-slate-950/35"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {topic.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  掌握度 {topic.mastery}% · 错题 {topic.mistakeCount} 道
                </p>
              </div>
            </div>
          ))}
          {topics.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs leading-5 text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              完成更多练习后，这里会根据薄弱点生成路线预览。
            </div>
          )}
        </div>

        <Link
          href="/sky/learning"
          className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-cyan-700 transition-colors hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
        >
          查看完整学习路线
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function CommonToolsSection({ weakPoints }: { weakPoints: PersonalizationContext['weakPoints'] }) {
  const weakPointText = weakPoints
    .slice(0, 2)
    .map((item) => item.knowledgePoint)
    .join('、');
  const tools = [
    {
      icon: Search,
      title: '拍照搜题',
      desc: '遇到新题先识别解析',
      href: '/sky/cloud-mind/solve',
    },
    {
      icon: CheckCircle2,
      title: '错题复盘',
      desc: '围绕今日薄弱点训练',
      href: '/sky/learning/review?dailyTask=1',
    },
    {
      icon: ShieldCheck,
      title: '学习画像',
      desc: weakPointText ? `当前关注 ${weakPointText}` : '补全目标和偏好',
      href: '/sky/learning/profile',
    },
    {
      icon: MessageCircle,
      title: 'AI 助手',
      desc: '随时提问，智能答疑',
      action: () => window.dispatchEvent(new CustomEvent('open-kagami-panel')),
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700/40 dark:bg-slate-900/45">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">常用工具</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            只保留最常用的学习入口，其它工具放回云端智囊。
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        {tools.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {item.desc}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-slate-600" />
            </>
          );
          if (item.action) {
            return (
              <button
                key={item.title}
                onClick={item.action}
                className="group flex min-h-16 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-700/50 dark:bg-slate-950/35 dark:hover:border-indigo-300/30 dark:hover:bg-white/[0.06]"
              >
                {content}
              </button>
            );
          }
          return (
            <Link
              key={item.title}
              href={item.href}
              className="group flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-700/50 dark:bg-slate-950/35 dark:hover:border-indigo-300/30 dark:hover:bg-white/[0.06]"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function DashboardEmptyState() {
  const starterSteps = [
    {
      icon: Camera,
      label: '先完成一道题',
      desc: '拍照搜题或输入题目，建立第一条学习记录。',
      bg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-500',
    },
    {
      icon: ShieldCheck,
      label: '补全学习画像',
      desc: '告诉系统你的课程、目标和薄弱点。',
      bg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
    },
    {
      icon: TrendingUp,
      label: '查看下一步建议',
      desc: '有了记录后，首页会生成今日任务和下一步路线。',
      bg: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
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
                先完成一道练习，系统会在这里生成今日任务和下一步建议。
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
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">起步路径</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            首页先负责引导，不急着展示所有功能。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {starterSteps.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.06 }}
              >
                <div className="flex min-h-28 items-start gap-3 rounded-xl border border-slate-200/60 bg-white/70 p-3.5 dark:border-slate-700/40 dark:bg-slate-900/45">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${action.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      STEP {i + 1}
                    </span>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {action.label}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {action.desc}
                    </p>
                  </div>
                </div>
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
  const [viewTab, setViewTab] = useState<'today' | 'dashboard'>('today');
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

  const trendData = useMemo<TrendPoint[]>(() => {
    const now = new Date();
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (13 - i));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      return { day: DAY_NAMES[d.getDay()], dayStart, total: 0, reviewed: 0 };
    });

    for (const mistake of mistakes) {
      const solvedAt = new Date(mistake.solvedAt).getTime();
      for (const slot of days) {
        if (solvedAt >= slot.dayStart && solvedAt < slot.dayStart + 86_400_000) {
          slot.total++;
          if (mistake.reviewed) slot.reviewed++;
          break;
        }
      }
    }

    return days.map(({ day, total, reviewed }) => ({ day, total, reviewed }));
  }, [mistakes]);

  const radarData = useMemo<RadarPoint[]>(() => {
    const total = Math.max(mistakes.length, 1);
    return ABILITY_DIMENSIONS.map((dimension) => {
      const causeSet = new Set<string>(dimension.causes);
      const related = mistakes.filter((mistake) => causeSet.has(mistake.cause));
      if (mistakes.length === 0) return { name: dimension.name, value: 0 };

      const hitRatio = related.length / total;
      const reviewedRatio =
        related.length > 0
          ? related.filter((mistake) => mistake.reviewed).length / related.length
          : 0;
      const value = Math.round(88 - hitRatio * 60 + reviewedRatio * 16);
      return {
        name: dimension.name,
        value: Math.max(35, Math.min(96, value)),
      };
    });
  }, [mistakes]);

  const routeTopics = useMemo<RouteTopic[]>(() => {
    const graph = buildKnowledgeGraph(mistakes);
    const topics = graph.nodes
      .slice()
      .sort((a, b) => a.mastery - b.mastery || b.mistakeCount - a.mistakeCount)
      .slice(0, 3)
      .map((node) => ({
        name: node.name,
        mastery: node.mastery,
        mistakeCount: node.mistakeCount,
      }));

    if (topics.length > 0) return topics;

    return (personalization?.weakPoints ?? []).slice(0, 3).map((point) => ({
      name: point.knowledgePoint,
      mastery: point.mastery,
      mistakeCount: point.recentMistakeCount,
    }));
  }, [mistakes, personalization]);

  const masteryPercent = useMemo(() => {
    if (stats.masteryPercent > 0) return stats.masteryPercent;
    const activeValues = radarData.filter((item) => item.value > 0);
    if (activeValues.length === 0) return 0;
    return Math.round(
      activeValues.reduce((sum, item) => sum + item.value, 0) / activeValues.length,
    );
  }, [radarData, stats.masteryPercent]);

  const weakPoints = personalization?.weakPoints ?? [];
  const weakPointText =
    weakPoints
      .slice(0, 2)
      .map((item) => item.knowledgePoint)
      .join('、') ||
    routeTopics
      .slice(0, 2)
      .map((item) => item.name)
      .join('、');

  const hasData = mistakes.length > 0;

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-4">
        {/* ── View Tab Switch ──────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewTab('today')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              viewTab === 'today'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white/70 text-slate-600 hover:bg-slate-100 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800/50',
            )}
          >
            <Star className="h-3.5 w-3.5" />
            今日学习
          </button>
          <button
            onClick={() => setViewTab('dashboard')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              viewTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white/70 text-slate-600 hover:bg-slate-100 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800/50',
            )}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            画像大屏
          </button>
        </div>

        {/* ── Dashboard View ───────────────────────────────────── */}
        {viewTab === 'dashboard' ? (
          <LearnerProfileDashboard />
        ) : (
          <>
            <LearningProfilePrompt status={user?.onboardingStatus} />

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
                    {hasData
                      ? `摘星锦囊已记录 ${mistakes.length} 道错题，先完成今天最重要的一步。`
                      : '从第一道题开始，摘星锦囊会逐步生成你的今日任务。'}
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
                  <TodayFocusPanel
                    recommendation={personalization?.recommendation ?? null}
                    stats={stats}
                    mistakeCount={mistakes.length}
                  />

                  <LearningInsightsSection
                    trendData={trendData}
                    radarData={radarData}
                    masteryPercent={masteryPercent}
                    weakPointText={weakPointText}
                  />

                  <ReviewPlanSection
                    topics={routeTopics}
                    weakPointText={weakPointText}
                    mistakeCount={mistakes.length}
                  />

                  <CommonToolsSection weakPoints={weakPoints} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </SkyAppShell>
  );
}
