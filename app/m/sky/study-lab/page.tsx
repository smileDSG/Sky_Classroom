'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  GraduationCap,
  Layers,
  Network,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { buildLearningInsights, type LearningInsights } from '@/lib/sky/learning-insights';
import type { MistakeRecord } from '@/lib/mistakes/types';
import type { MistakeCause } from '@/lib/solve/types';
import { cn } from '@/lib/utils';

type MobileHref = string;

interface WorkshopSnapshot {
  generatedAt: number;
  mistakes: WorkshopMistakeSnapshot[];
  review?: {
    dueCount?: number;
    overdue?: number;
    completed?: number;
    total?: number;
  } | null;
  learningStats?: {
    masteryPercent?: number;
    todayStudyMinutes?: number;
    streakDays?: number;
    problemsAttempted?: number;
    problemsCorrect?: number;
    scenesCompleted?: number;
  } | null;
  memoryProgress?: {
    totalFlipped: number;
    topicCount: number;
    lastStudied: number | null;
  } | null;
  profile?: {
    masteryByKnowledge?: Record<string, number>;
    weakPoints?: string[];
    strongPoints?: string[];
    errorPatterns?: Array<{
      knowledgePoint: string;
      errorType: MistakeCause | string;
      frequency: number;
    }>;
    totalQuestions?: number;
    totalCorrect?: number;
  } | null;
}

interface WorkshopMistakeSnapshot extends Omit<MistakeRecord, 'solvedAt' | 'source'> {
  solvedAt: string | number;
  source?: MistakeRecord['source'] | 'classroom-diagnostic';
}

interface PathStep {
  label: string;
  title: string;
  desc: string;
  href: MobileHref;
  icon: LucideIcon;
  tone: string;
  duration: string;
}

const toolEntries: Array<{
  label: string;
  desc: string;
  href: MobileHref;
  icon: LucideIcon;
}> = [
  {
    label: '错题本',
    desc: '查看错因与学习进度',
    href: '/m/sky/learning/mistakes',
    icon: BookOpenCheck,
  },
  {
    label: '复习计划',
    desc: '处理到期复习',
    href: '/m/sky/learning/review/plan',
    icon: CalendarClock,
  },
  {
    label: '知识地图',
    desc: '定位薄弱点',
    href: '/m/sky/learning/graph',
    icon: Network,
  },
  {
    label: '学习分析',
    desc: '学习情况和建议',
    href: '/m/sky/learning/profile',
    icon: ShieldCheck,
  },
];

function normalizeSnapshotMistake(mistake: WorkshopMistakeSnapshot): MistakeRecord {
  return {
    ...mistake,
    solvedAt: new Date(mistake.solvedAt),
    source:
      mistake.source === 'classroom-diagnostic'
        ? 'classroom-quiz'
        : (mistake.source as MistakeRecord['source']),
  };
}

function toMobileHref(href: string): MobileHref {
  if (href.startsWith('/sky/cloud-mind/solve')) return href.replace('/sky', '/m/sky');
  if (href.startsWith('/sky/cloud-mind/quiz')) return href.replace('/sky', '/m/sky');
  if (href.startsWith('/sky/cloud-mind/teaching')) return href.replace('/sky', '/m/sky');
  if (href.startsWith('/sky/cloud-mind/memory')) return href.replace('/sky', '/m/sky');
  if (href.startsWith('/sky/learning/review')) return '/m/sky/learning/review/plan';
  if (href.startsWith('/sky/learning/')) return href.replace('/sky', '/m/sky');
  if (href === '/sky/learning') return '/m/sky/study-lab';
  return href.startsWith('/m/') ? href : '/m/sky/study-lab';
}

function compactDuration(min: number, max: number): string {
  return min === max ? `约 ${min} 分钟` : `约 ${min}-${max} 分钟`;
}

function buildDailyHref(insights: LearningInsights): MobileHref {
  if (insights.metrics.dueReviewCount > 0 || insights.metrics.reviewBacklogCount > 0) {
    return '/m/sky/learning/review/plan';
  }
  if (insights.topTopics.length > 0) {
    return `/m/sky/cloud-mind/quiz?topic=${encodeURIComponent(insights.focusTopic)}`;
  }
  return '/m/sky/cloud-mind/solve?source=workshop-chain';
}

function buildPathSteps(insights: LearningInsights): PathStep[] {
  if (!insights.hasSignals) {
    return [
      {
        label: '01',
        title: '完成入门练习',
        desc: '拍照搜题或输入题目，让系统留下第一批学习记录',
        href: '/m/sky/cloud-mind/solve?source=workshop-chain',
        icon: Sparkles,
        tone: 'emerald',
        duration: compactDuration(5, 10),
      },
      {
        label: '02',
        title: '了解学习情况',
        desc: '查看题目、正确率和薄弱点是否已被识别',
        href: '/m/sky/learning/profile',
        icon: ShieldCheck,
        tone: 'sky',
        duration: compactDuration(3, 6),
      },
      {
        label: '03',
        title: '查看天梯路线',
        desc: '确认薄弱点和先修关系，决定下一轮方向',
        href: '/m/sky/learning/graph',
        icon: Network,
        tone: 'amber',
        duration: compactDuration(5, 8),
      },
      {
        label: '04',
        title: '做一组针对练习',
        desc: '用 5 道同类题看看系统是否了解你的情况',
        href: '/m/sky/cloud-mind/quiz?count=5',
        icon: Target,
        tone: 'rose',
        duration: compactDuration(15, 25),
      },
    ];
  }

  return [
    {
      label: '01',
      title: insights.metrics.dueReviewCount > 0 ? '清理到期复习' : '检查复习节奏',
      desc:
        insights.metrics.dueReviewCount > 0
          ? `${insights.metrics.dueReviewCount} 道错题处于复习窗口`
          : '确认今天是否有需要回看内容',
      href: '/m/sky/learning/review/plan',
      icon: CalendarClock,
      tone: 'amber',
      duration: compactDuration(8, 18),
    },
    {
      label: '02',
      title: `围绕「${insights.focusTopic}」练习`,
      desc: '用一组同类题验证薄弱点是否真正补上',
      href: `/m/sky/cloud-mind/quiz?topic=${encodeURIComponent(insights.focusTopic)}`,
      icon: Target,
      tone: 'violet',
      duration: compactDuration(12, 20),
    },
    {
      label: '03',
      title: `讲透「${insights.focusTopic}」`,
      desc: '把错因回溯到概念、方法和先修关系',
      href: `/m/sky/cloud-mind/teaching?topic=${encodeURIComponent(insights.focusTopic)}`,
      icon: GraduationCap,
      tone: 'emerald',
      duration: compactDuration(12, 18),
    },
    {
      label: '04',
      title: '沉淀记忆卡片',
      desc: '把薄弱点转成可反复复习的材料',
      href: `/m/sky/cloud-mind/memory?topic=${encodeURIComponent(insights.focusTopic)}`,
      icon: Layers,
      tone: 'rose',
      duration: compactDuration(6, 10),
    },
  ];
}

function buildInsights(snapshot: WorkshopSnapshot | null): LearningInsights {
  const mistakes = snapshot?.mistakes.map(normalizeSnapshotMistake) ?? [];
  return buildLearningInsights(
    mistakes,
    snapshot?.memoryProgress ?? { totalFlipped: 0, topicCount: 0, lastStudied: null },
    Date.now(),
    {
      profile: snapshot?.profile,
      learningStats: snapshot?.learningStats,
      review: snapshot?.review,
    },
  );
}

export default function MobileStudyLabPage() {
  const [snapshot, setSnapshot] = useState<WorkshopSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/sky/workshop', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || !data?.success) throw new Error(data?.error ?? '数据加载失败');
        if (cancelled) return;
        setSnapshot({
          generatedAt: data.generatedAt ?? Date.now(),
          mistakes: Array.isArray(data.mistakes) ? data.mistakes : [],
          review: data.review ?? null,
          learningStats: data.learningStats ?? null,
          memoryProgress: data.memoryProgress ?? null,
          profile: data.profile ?? null,
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '数据加载失败');
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const insights = useMemo(() => buildInsights(snapshot), [snapshot]);
  const pathSteps = useMemo(() => buildPathSteps(insights), [insights]);
  const dailyHref = buildDailyHref(insights);
  const DailyIcon =
    insights.metrics.dueReviewCount > 0 || insights.metrics.reviewBacklogCount > 0
      ? CalendarClock
      : insights.hasSignals
        ? Target
        : Sparkles;
  return (
    <MobileSkyShell fullBleed>
      <div className="relative flex flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-gradient-to-b from-emerald-600/30 via-teal-600/15 to-transparent" />

        <section className="relative px-5 pb-6 pt-9">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Sparkles className="size-4 text-white" />
            </span>
            <span className="text-[12px] font-semibold tracking-[0.2em] text-white/90">
              天梯工坊
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-[28px] font-black leading-tight text-white">
                {insights.hasSignals ? '个人学习安排' : '先完成一次入门练习'}
              </h1>
              <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-white/80">
                {insights.focusReason}
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[12px] text-white backdrop-blur-sm">
                <span>{snapshot ? '云端记录' : '等待学习记录'}</span>
                <span className="h-3 w-px bg-white/25" />
                <span className="max-w-[140px] truncate">
                  {snapshot?.generatedAt
                    ? `${new Date(snapshot.generatedAt).toLocaleTimeString()} 更新`
                    : error || '完成入门练习后生成安排'}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/15 px-2.5 py-1 text-[11px] font-bold text-emerald-100">
                {loading ? '同步中' : insights.strategyLabel}
              </span>
              <Link
                href={dailyHref}
                className="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-[12px] bg-emerald-300 px-3 text-[12px] font-extrabold text-slate-950 shadow-lg shadow-emerald-950/20 active:scale-[0.99]"
              >
                <DailyIcon className="size-3.5" />
                今日任务
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </section>

        <div className="relative space-y-2.5 px-4 pb-24">
          <section aria-label="学习状态" className="grid grid-cols-4 gap-1.5">
            <MetricPill icon={CalendarClock} label="到期" value={insights.metrics.dueReviewCount} />
            <MetricPill
              icon={BookOpenCheck}
              label="错题"
              value={insights.metrics.reviewBacklogCount}
            />
            <MetricPill
              icon={BarChart3}
              label="掌握"
              value={insights.metrics.averageMastery}
              unit="%"
            />
            <MetricPill icon={Layers} label="记忆" value={insights.metrics.memoryTopicCount} />
          </section>

          <section
            aria-label="今日任务路径"
            className="rounded-[20px] border border-white/8 bg-white/[0.035] p-3"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[15px] font-extrabold text-white">
                <Route className="size-4 text-emerald-200" />
                今日学习安排
              </div>
              <span className="rounded-full bg-white/7 px-2 py-0.5 text-[12px] font-bold text-slate-400">
                个性化
              </span>
            </div>
            <div className="space-y-1.5">
              {pathSteps.map((step) => (
                <PathStepCard key={`${step.label}-${step.title}`} step={step} />
              ))}
            </div>
          </section>

          <section aria-label="学习工具入口">
            <div className="grid grid-cols-2 gap-2.5">
              {toolEntries.map((tool, index) => {
                const Icon = tool.icon;
                const wide = index === toolEntries.length - 1;
                return (
                  <Link
                    key={tool.label}
                    href={toMobileHref(tool.href)}
                    className={`group relative overflow-hidden rounded-[17px] border border-white/10 bg-[#0b1525] p-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.06)] active:scale-[0.99] ${
                      wide ? 'col-span-2' : 'min-h-[70px]'
                    }`}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(52,211,153,0.14),rgba(34,211,238,0.055)_48%,rgba(15,23,42,0)_100%)]" />
                    <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/35 to-transparent" />
                    <div className="absolute -right-10 -top-12 size-28 rounded-full bg-emerald-200/8 blur-2xl" />
                    <div
                      className={`relative flex ${wide ? 'items-center gap-2.5' : 'h-full flex-col items-start justify-between gap-2'}`}
                    >
                      <div
                        className={`flex items-start justify-between gap-2 ${wide ? 'shrink-0' : 'w-full'}`}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[13px] border border-emerald-200/16 bg-emerald-200/[0.095] text-emerald-100 shadow-lg shadow-emerald-950/10 backdrop-blur">
                          <Icon className="size-4" />
                        </span>
                        {!wide && (
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.055] text-slate-500 transition-colors group-active:text-white">
                            <ArrowRight className="size-3" />
                          </span>
                        )}
                      </div>
                      <span className={`min-w-0 ${wide ? 'flex-1' : 'w-full'}`}>
                        <span className="block truncate text-[13px] font-extrabold leading-tight text-white">
                          {tool.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] font-semibold text-slate-400">
                          {tool.desc}
                        </span>
                      </span>
                      {wide && (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.055] text-slate-500 transition-colors group-active:text-white">
                          <ArrowRight className="size-3" />
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  unit = '',
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="rounded-[15px] border border-white/8 bg-[#0d1728] px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
      <Icon className="mx-auto size-3.5 text-emerald-200" />
      <div className="mt-1 text-[15px] font-extrabold leading-none text-white">
        {value}
        <span className="text-[11px] text-slate-400">{unit}</span>
      </div>
      <div className="mt-1 truncate text-[11px] font-bold text-slate-500">{label}</div>
    </div>
  );
}

function PathStepCard({ step }: { step: PathStep }) {
  const Icon = step.icon;
  const toneClass =
    step.tone === 'amber'
      ? 'bg-amber-300/12 text-amber-100 ring-amber-200/20'
      : step.tone === 'violet'
        ? 'bg-violet-300/12 text-violet-100 ring-violet-200/20'
        : step.tone === 'sky'
          ? 'bg-sky-300/12 text-sky-100 ring-sky-200/20'
          : 'bg-emerald-300/12 text-emerald-100 ring-emerald-200/20';

  return (
    <Link
      href={step.href}
      className="group flex min-h-[58px] items-center gap-2.5 rounded-[15px] border border-white/9 bg-[#0d1728] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] active:scale-[0.99]"
    >
      <span className="w-5 shrink-0 text-[11px] font-extrabold tabular-nums text-slate-500">
        {step.label}
      </span>
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-[12px] ring-1',
          toneClass,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[12px] font-extrabold text-white">{step.title}</span>
          <span className="shrink-0 rounded-full bg-white/7 px-1.5 py-0.5 text-[11px] font-bold text-slate-400">
            {step.duration}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">
          {step.desc}
        </span>
      </span>
      <ArrowRight className="size-3 shrink-0 text-slate-500 transition-transform group-active:translate-x-0.5" />
    </Link>
  );
}
