'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Layers,
  Network,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { StudentProfilePage } from '@/app/sky/student/student-profile-page';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { KnowledgeGraphView } from '@/components/sky/learning/knowledge-graph-view';
import { LearningStats } from '@/components/sky/learning/learning-stats';
import { MistakeBook } from '@/components/sky/learning/mistake-book';
import { ReviewPlan } from '@/components/sky/learning/review-plan';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import type { MistakeRecord } from '@/lib/mistakes/types';
import type { MistakeCause } from '@/lib/solve/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import {
  buildLearningInsights,
  type LearningInsightTopic,
  type LearningInsights,
} from '@/lib/sky/learning-insights';
import { cn } from '@/lib/utils';

const DETAIL_TABS = [
  { key: 'mistakes', label: '错题本', desc: '记录与反思', icon: BookOpenCheck },
  { key: 'review', label: '复习计划', desc: '艾宾浩斯曲线', icon: CalendarClock },
  { key: 'graph', label: '知识图谱', desc: '能力可视化', icon: Network },
  { key: 'stats', label: '学习统计', desc: '数据洞察', icon: BarChart3 },
  { key: 'profile', label: '学情分析', desc: '多维画像', icon: ShieldCheck },
] as const;

type DetailTabKey = (typeof DETAIL_TABS)[number]['key'];

type MissionTone = 'amber' | 'violet' | 'emerald' | 'rose';

interface MissionStep {
  id: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  icon: typeof CalendarClock;
  tone: MissionTone;
}

const toneClasses: Record<MissionTone, { chip: string; text: string; line: string }> = {
  amber: {
    chip: 'border-amber-200/25 bg-amber-300/10 text-amber-100',
    text: 'text-amber-100',
    line: 'from-amber-300/50',
  },
  violet: {
    chip: 'border-violet-200/25 bg-violet-300/10 text-violet-100',
    text: 'text-violet-100',
    line: 'from-violet-300/50',
  },
  emerald: {
    chip: 'border-emerald-200/25 bg-emerald-300/10 text-emerald-100',
    text: 'text-emerald-100',
    line: 'from-emerald-300/50',
  },
  rose: {
    chip: 'border-rose-200/25 bg-rose-300/10 text-rose-100',
    text: 'text-rose-100',
    line: 'from-rose-300/50',
  },
};

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

function buildMemoryHref(topic: string, topics: string[]): string {
  const content = topics.length
    ? topics.map((item) => `知识点：${item}`).join('\n')
    : `围绕「${topic}」整理核心概念、易错点和复习问题。`;
  return `/sky/cloud-mind/memory?topic=${encodeURIComponent(topic)}&content=${encodeURIComponent(content)}`;
}

function buildMissionSteps(insights: LearningInsights): MissionStep[] {
  const topic = insights.focusTopic;
  const relatedTopics = insights.topTopics.map((item) => item.name);
  return [
    {
      id: 'review',
      label: '第一步',
      title: insights.metrics.dueReviewCount > 0 ? '清理到期复习' : '检查复习节奏',
      detail:
        insights.metrics.dueReviewCount > 0
          ? `${insights.metrics.dueReviewCount} 道错题处于复习窗口`
          : '先确认今天是否有需要回看内容',
      href: '/sky/learning?tab=review',
      icon: CalendarClock,
      tone: 'amber',
    },
    {
      id: 'quiz',
      label: '第二步',
      title: `围绕「${topic}」做针对练习`,
      detail: '用同类题验证薄弱点是否真正补上',
      href: `/sky/cloud-mind/quiz?topic=${encodeURIComponent(topic)}`,
      icon: Target,
      tone: 'violet',
    },
    {
      id: 'teaching',
      label: '第三步',
      title: `讲透「${topic}」`,
      detail: '把错因回溯到概念、方法和先修关系',
      href: `/sky/cloud-mind/teaching?topic=${encodeURIComponent(topic)}`,
      icon: GraduationCap,
      tone: 'emerald',
    },
    {
      id: 'memory',
      label: '收束',
      title: '沉淀为记忆卡片',
      detail: '把薄弱点转成可反复复习的材料',
      href: buildMemoryHref(topic, relatedTopics),
      icon: Layers,
      tone: 'rose',
    },
  ];
}

function fallbackTopics(insights: LearningInsights): LearningInsightTopic[] {
  if (insights.topTopics.length > 0) return insights.topTopics;
  return [
    {
      name: insights.focusTopic,
      score: 60,
      mastery: insights.metrics.averageMastery || 50,
      mistakeCount: insights.metrics.totalMistakes,
      dueCount: insights.metrics.dueReviewCount,
      unreviewedCount: insights.metrics.reviewBacklogCount,
      dominantCause: null,
      reason: '等待更多数据完善路线',
    },
  ];
}

export function WorkshopTestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailSectionRef = useRef<HTMLElement | null>(null);
  const mistakes = useSkyClassroomStore((state) => state.mistakes);
  const memoryProgress = useSkyClassroomStore((state) => state.memoryProgress);
  const prioritizeReview = useSkyClassroomStore((state) => state.prioritizeReview);
  const tabParam = searchParams.get('tab');
  const activeTab: DetailTabKey = DETAIL_TABS.some((tab) => tab.key === tabParam)
    ? (tabParam as DetailTabKey)
    : 'mistakes';
  const insights = useMemo(
    () => buildLearningInsights(mistakes, memoryProgress),
    [mistakes, memoryProgress],
  );
  const missionSteps = useMemo(() => buildMissionSteps(insights), [insights]);
  const routeTopics = useMemo(() => fallbackTopics(insights).slice(0, 5), [insights]);
  const priorityTopics = insights.topTopics.map((topic) => topic.name);
  const weakPoints = useMemo(() => {
    if (mistakes.length === 0) return [];
    return buildKnowledgeGraph(mistakes).weakPoints;
  }, [mistakes]);

  useEffect(() => {
    syncMistakesFromQuizzes();

    fetch('/api/sky/mistakes?pageSize=9999', { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => {
        if (!data?.success || !Array.isArray(data.items)) return;
        const serverMistakes: MistakeRecord[] = data.items.map(
          (entry: Record<string, unknown>) => ({
            id: entry.id as string,
            problem: entry.problemText as string,
            userAnswer: entry.userAnswer as string,
            correctAnswer: entry.correctAnswer as string,
            cause: errorTypeToCause(entry.errorType as string),
            solvedAt: entry.lastReview ? new Date(entry.lastReview as number) : new Date(),
            reviewed: entry.reviewed as boolean,
            reviewCount: entry.reviewCount as number,
            knowledgePoints: (entry.knowledgePoints as string[]) ?? [],
          }),
        );
        useSkyClassroomStore.getState().mergeMistakes(serverMistakes);
      })
      .catch(() => {
        /* local data is enough for the prototype */
      });
  }, []);

  const mainAction = missionSteps[0];
  const MainIcon = mainAction.icon;

  const scrollToDetailSection = () => {
    window.setTimeout(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const handleTabChange = (tab: DetailTabKey, scrollToSection = false) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/sky/learning?${params.toString()}`, { scroll: false });
    if (scrollToSection) scrollToDetailSection();
  };

  const handleStartDailyTask = () => {
    const tab = new URLSearchParams(mainAction.href.split('?')[1] ?? '').get('tab');
    if (tab && DETAIL_TABS.some((item) => item.key === tab)) {
      handleTabChange(tab as DetailTabKey, true);
      return;
    }
    router.push(mainAction.href);
  };

  const handleOpenFullProfile = () => {
    handleTabChange('profile', true);
  };

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-5xl space-y-5 pb-12">
        <section className="rounded-[28px] border border-emerald-200/20 bg-[#06101d] shadow-[0_26px_90px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="border-b border-emerald-200/15 bg-[linear-gradient(135deg,#123346_0%,#0e2741_45%,#111b36_100%)] px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200/30 bg-emerald-300/10">
                    <Sparkles className="h-4 w-4 text-emerald-100" />
                  </span>
                  <span className="rounded-full border border-emerald-200/25 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                    天梯工坊
                  </span>
                </div>
                <h1 className="mt-4 text-2xl font-semibold text-white md:text-3xl">
                  {insights.headline}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
                  {insights.focusReason}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200/25 bg-[#07111f]/75 px-4 py-3 text-right">
                <div className="text-[11px] font-medium text-emerald-100/75">策略判断</div>
                <div className="mt-0.5 text-base font-semibold text-white">
                  {insights.strategyLabel}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleStartDailyTask}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_rgba(52,211,153,0.18)] transition-transform hover:-translate-y-0.5"
              >
                <MainIcon className="h-4 w-4" />
                开始每日任务
              </button>
              <button
                type="button"
                onClick={handleOpenFullProfile}
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:border-indigo-200/40 hover:bg-white/[0.09]"
              >
                <ShieldCheck className="h-4 w-4 text-indigo-100" />
                查看完整画像
              </button>
            </div>
          </div>

          <div className="space-y-5 bg-[#07111f] p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricTile
                icon={CalendarClock}
                label="到期复习"
                value={insights.metrics.dueReviewCount}
                unit="题"
              />
              <MetricTile
                icon={BookOpenCheck}
                label="错题闭环"
                value={insights.metrics.reviewBacklogCount}
                unit="题"
              />
              <MetricTile
                icon={BarChart3}
                label="平均掌握"
                value={insights.metrics.averageMastery}
                unit="%"
              />
              <MetricTile
                icon={Layers}
                label="记忆主题"
                value={insights.metrics.memoryTopicCount}
                unit="个"
              />
            </div>

            <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-2xl border border-cyan-100/10 bg-[#0b1729]/80 p-4">
                <SectionTitle icon={Route} title="今日 15 分钟任务链" aside="按顺序推进" />
                <div className="mt-4 space-y-3">
                  {missionSteps.map((step, index) => (
                    <MissionStepRow
                      key={step.id}
                      step={step}
                      isLast={index === missionSteps.length - 1}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-100/10 bg-[#0b1729]/80 p-4">
                <SectionTitle
                  icon={Activity}
                  title="推荐理由证据链"
                  aside={insights.dataHealth.label}
                />
                <div className="mt-4 space-y-3">
                  {insights.dataHealth.signals.map((signal) => (
                    <div key={signal.label} className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <CheckCircle2
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0',
                            signal.ready ? 'text-emerald-200' : 'text-slate-500',
                          )}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-100">{signal.label}</div>
                          <div className="mt-0.5 text-xs text-slate-400">{signal.detail}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {insights.causeSummary.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {insights.causeSummary.map((cause) => (
                      <Link
                        key={cause.cause}
                        href="/sky/learning?tab=stats"
                        className="rounded-full border border-cyan-100/10 bg-white/[0.045] px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-indigo-200/35"
                      >
                        {cause.label} {cause.count}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-100/10 bg-[#0b1729]/80 p-4">
              <SectionTitle icon={Network} title="天梯路线预览" aside="薄弱点优先" />
              <div className="mt-4 space-y-3">
                {routeTopics.map((topic, index) => (
                  <RouteNode
                    key={`${topic.name}-${index}`}
                    topic={topic}
                    index={index}
                    isLast={index === routeTopics.length - 1}
                  />
                ))}
              </div>
              {priorityTopics.length > 0 && (
                <button
                  type="button"
                  onClick={() => prioritizeReview(priorityTopics)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200/25 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-300/15"
                >
                  <CalendarClock className="h-4 w-4" />
                  把路线薄弱点加入复习
                </button>
              )}
            </section>

            <section className="grid gap-3 md:grid-cols-4">
              <FeatureLink
                icon={BookOpenCheck}
                title="错题本"
                desc="查看错因与题目样本"
                href="/sky/learning?tab=mistakes"
              />
              <FeatureLink
                icon={CalendarClock}
                title="复习计划"
                desc="执行艾宾浩斯复习"
                href="/sky/learning?tab=review"
              />
              <FeatureLink
                icon={Network}
                title="知识图谱"
                desc="定位薄弱知识关系"
                href="/sky/learning?tab=graph"
              />
              <FeatureLink
                icon={Brain}
                title="智能授课"
                desc={`讲透 ${insights.focusTopic}`}
                href={`/sky/cloud-mind/teaching?topic=${encodeURIComponent(insights.focusTopic)}`}
              />
            </section>
          </div>
        </section>

        <section
          ref={detailSectionRef}
          className="rounded-[24px] border border-cyan-100/10 bg-[#07111f]/90 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.035)]"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">完整功能区</div>
              <div className="mt-1 text-xs text-slate-400">
                决策区负责推荐，下面保留原有错题、复习、图谱、统计和学情功能。
              </div>
            </div>
            <div className="flex rounded-2xl border border-cyan-100/10 bg-[#0b1729] p-1">
              {DETAIL_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors',
                      active
                        ? 'bg-emerald-300 text-slate-950 shadow-[0_8px_24px_rgba(52,211,153,0.14)]'
                        : 'text-slate-300 hover:bg-white/[0.05] hover:text-slate-100',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden min-w-0 sm:block">
                      <span className="block truncate text-xs font-semibold">{tab.label}</span>
                      <span
                        className={cn(
                          'block truncate text-[10px]',
                          active ? 'text-slate-700' : 'text-slate-500',
                        )}
                      >
                        {tab.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-100/10 bg-slate-950/20 p-4">
            {activeTab === 'mistakes' && <MistakeBook />}
            {activeTab === 'review' && <ReviewPlan />}
            {activeTab === 'graph' && (
              <div className="space-y-4">
                <KnowledgeGraphView />
                {weakPoints.length > 0 && (
                  <div className="rounded-2xl border border-rose-200/15 bg-rose-300/10 p-4">
                    <div className="text-sm font-semibold text-rose-100">薄弱知识点针对性复习</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {weakPoints.map((point) => (
                        <span
                          key={point}
                          className="rounded-full border border-rose-200/20 bg-rose-300/10 px-3 py-1 text-xs font-medium text-rose-100"
                        >
                          {point}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={buildMemoryHref(weakPoints[0], weakPoints)}
                        className="rounded-xl bg-rose-300 px-3 py-2 text-xs font-semibold text-slate-950"
                      >
                        生成记忆卡片
                      </Link>
                      <Link
                        href={`/sky/cloud-mind/quiz?topic=${encodeURIComponent(weakPoints.join('、'))}`}
                        className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950"
                      >
                        针对出题
                      </Link>
                      <button
                        type="button"
                        onClick={() => prioritizeReview(weakPoints)}
                        className="rounded-xl bg-indigo-300 px-3 py-2 text-xs font-semibold text-slate-950"
                      >
                        全部加入复习
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'stats' && <LearningStats />}
            {activeTab === 'profile' && <StudentProfilePage />}
          </div>
        </section>
      </div>
    </SkyAppShell>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  aside,
}: {
  icon: typeof Activity;
  title: string;
  aside: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <Icon className="h-4 w-4 text-emerald-100" />
        {title}
      </div>
      <span className="text-xs font-medium text-slate-400">{aside}</span>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-[#0c182b] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-100/12 bg-cyan-200/10 text-cyan-100">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tabular-nums text-white">{value}</span>
        <span className="text-xs font-medium text-slate-300">{unit}</span>
      </div>
    </div>
  );
}

function MissionStepRow({ step, isLast }: { step: MissionStep; isLast: boolean }) {
  const Icon = step.icon;
  const tone = toneClasses[step.tone];
  return (
    <Link href={step.href} className="group grid grid-cols-[32px_1fr_20px] gap-3">
      <div className="relative flex justify-center">
        <span
          className={cn('flex h-8 w-8 items-center justify-center rounded-xl border', tone.chip)}
        >
          <Icon className="h-4 w-4" />
        </span>
        {!isLast && (
          <span
            className={cn(
              'absolute top-9 h-[calc(100%+4px)] w-px bg-gradient-to-b to-transparent',
              tone.line,
            )}
          />
        )}
      </div>
      <div className="rounded-xl border border-cyan-100/10 bg-[#081423] px-3 py-2.5 transition-colors group-hover:border-emerald-200/35 group-hover:bg-[#0f2238]">
        <div className={cn('text-[11px] font-semibold', tone.text)}>{step.label}</div>
        <div className="mt-0.5 text-sm font-semibold text-slate-100">{step.title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-400">{step.detail}</div>
      </div>
      <ArrowRight className="mt-5 h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-100" />
    </Link>
  );
}

function RouteNode({
  topic,
  index,
  isLast,
}: {
  topic: LearningInsightTopic;
  index: number;
  isLast: boolean;
}) {
  return (
    <Link
      href="/sky/learning?tab=graph"
      className="group grid grid-cols-[36px_1fr_auto] gap-3 rounded-xl border border-cyan-100/10 bg-[#081423] px-3 py-3 transition-colors hover:border-emerald-200/35 hover:bg-[#0f2238]"
    >
      <div className="relative flex justify-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100/12 bg-cyan-200/10 text-xs font-semibold text-cyan-100">
          {index + 1}
        </span>
        {!isLast && <span className="absolute top-9 h-8 w-px bg-cyan-100/12" />}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-100">{topic.name}</div>
        <div className="mt-1 line-clamp-1 text-xs text-slate-400">
          {topic.reason} · {topic.mistakeCount} 题样本
        </div>
      </div>
      <div className="flex items-center">
        <span className="rounded-full border border-cyan-100/10 bg-white/[0.04] px-2 py-1 text-xs font-semibold text-slate-200">
          {topic.mastery}%
        </span>
      </div>
    </Link>
  );
}

function FeatureLink({
  icon: Icon,
  title,
  desc,
  href,
}: {
  icon: typeof Activity;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-cyan-100/10 bg-[#0c182b] p-4 transition-colors hover:border-emerald-200/35 hover:bg-[#10223a]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100/12 bg-cyan-200/10 text-cyan-100">
          <Icon className="h-4 w-4" />
        </span>
        <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-100" />
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-100">{title}</div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{desc}</div>
    </Link>
  );
}
