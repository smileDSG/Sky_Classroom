'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Circle,
  Clock3,
  Gauge,
  Loader2,
  MapPinned,
  PlayCircle,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import type {
  LearningPath,
  LearningPathNode,
  StrategyAlias,
} from '@/lib/teaching/learning-path-types';
import { MistakeReviewStrip } from '@/components/sky/learning/mistake-review-strip';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<LearningPathNode['status'], string> = {
  completed: '已完成',
  in_progress: '进行中',
  pending: '待学习',
  skipped: '已跳过',
};

const STRATEGIES: Array<{ value: StrategyAlias; label: string; description: string }> = [
  { value: 'balanced', label: '均衡安排', description: '综合薄弱点、复习和目标' },
  { value: 'weakness-first', label: '先补薄弱内容', description: '先练习目前最不熟悉的内容' },
  { value: 'review-first', label: '复习优先', description: '先处理已经到期的内容' },
  { value: 'goal-topic', label: '目标主题', description: '围绕指定目标生成路线' },
];

function matchesTopic(values: string[], topic: string): boolean {
  const normalizedTopic = topic.trim().toLocaleLowerCase();
  return values.some((value) => {
    const normalizedValue = value.trim().toLocaleLowerCase();
    return (
      normalizedValue === normalizedTopic ||
      normalizedValue.includes(normalizedTopic) ||
      normalizedTopic.includes(normalizedValue)
    );
  });
}

function getNodeMastery(
  node: LearningPathNode,
  context: PersonalizationContext | null,
): number | null {
  if (node.masteryAfter !== undefined) return node.masteryAfter;
  if (node.masteryBefore !== undefined) return node.masteryBefore;
  const direct = context?.masteryByKnowledge[node.topic];
  if (typeof direct === 'number') return direct;
  const weakPoint = context?.weakPoints.find((item) =>
    matchesTopic([item.knowledgePoint], node.topic),
  );
  return weakPoint?.mastery ?? null;
}

function getNodeReason(
  node: LearningPathNode,
  index: number,
  context: PersonalizationContext | null,
): string {
  const topics = [node.topic, ...node.knowledgePoints];
  const dueCount =
    context?.dueReviews.filter((review) =>
      review.knowledgePoints.some((point) => matchesTopic(topics, point)),
    ).length ?? 0;
  const weakPoint = context?.weakPoints.find((item) => matchesTopic(topics, item.knowledgePoint));
  const targetTopic = context?.toolPolicies?.learningPath.targetTopic;

  if (node.status === 'completed') {
    return '该节点已经达到完成条件，后续只需按遗忘曲线保持记忆。';
  }
  if (dueCount > 0) {
    return `命中 ${dueCount} 项到期复习内容，因此提前安排，避免遗忘继续扩大。`;
  }
  if (weakPoint) {
    return `当前掌握情况约为 ${Math.round(weakPoint.mastery)}%，这是目前最需要加强的部分。`;
  }
  if (targetTopic && matchesTopic(topics, targetTopic)) {
    return context?.learnerDecision?.summary ?? '这是系统根据近期学习记录排出的第一优先主题。';
  }
  if (node.prerequisites.length > 0) {
    return `需要先建立 ${node.prerequisites.slice(0, 2).join('、')} 等前置能力，再进入后续内容。`;
  }
  return index === 0
    ? '作为当前路线入口，用来了解后续学习需要的基础。'
    : '根据知识依赖关系和前面节点的完成顺序安排。';
}

function getPrimaryTool(
  node: LearningPathNode,
  mastery: number | null,
  context: PersonalizationContext | null,
): { label: string; detail: string; href: string; icon: typeof BookOpen } {
  const encodedTopic = encodeURIComponent(node.topic);
  const topics = [node.topic, ...node.knowledgePoints];
  const isDue =
    context?.dueReviews.some((review) =>
      review.knowledgePoints.some((point) => matchesTopic(topics, point)),
    ) ?? false;

  if (isDue || node.status === 'completed') {
    return {
      label: '记忆卡复习',
      detail: isDue ? '先恢复记忆保持度' : '保持已掌握内容',
      href: `/sky/cloud-mind/memory?topic=${encodedTopic}`,
      icon: Brain,
    };
  }
  if (mastery === null || mastery < 55) {
    return {
      label: '智能授课',
      detail: '先补概念和前置知识',
      href: `/sky/cloud-mind/teaching?topic=${encodedTopic}&from=learning-path`,
      icon: BookOpen,
    };
  }
  return {
    label: '智能测验',
    detail: mastery >= 80 ? '用挑战题确认稳定掌握' : '用专项题提升到完成线',
    href: `/sky/cloud-mind/quiz?topic=${encodedTopic}&difficulty=${mastery >= 80 ? 'hard' : 'medium'}&count=5`,
    icon: Target,
  };
}

function StatusIcon({ status }: { status: LearningPathNode['status'] }) {
  if (status === 'completed')
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (status === 'in_progress')
    return <PlayCircle className="h-4 w-4 text-amber-600 dark:text-amber-300" />;
  return <Circle className="h-4 w-4 text-slate-500" />;
}

export function LearningPathPage() {
  const [path, setPath] = useState<LearningPath | null>(null);
  const [context, setContext] = useState<PersonalizationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [strategy, setStrategy] = useState<StrategyAlias>('balanced');
  const [goalTopic, setGoalTopic] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pathResponse, contextResponse] = await Promise.all([
        fetch('/api/sky/learning-path', { credentials: 'include' }),
        fetch('/api/sky/cloud-mind/personalization-context', { credentials: 'include' }),
      ]);
      const [pathJson, contextJson] = await Promise.all([
        pathResponse.json(),
        contextResponse.json(),
      ]);
      if (!pathResponse.ok || !pathJson.success) {
        throw new Error(pathJson.error || '学习路线加载失败');
      }
      setPath(pathJson.data?.path ?? null);
      if (contextResponse.ok && contextJson.success && contextJson.data) {
        setContext(contextJson.data as PersonalizationContext);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '学习路线加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch('/api/sky/learning-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          strategy,
          goalTopic: strategy === 'goal-topic' ? goalTopic.trim() : undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success || !json.data?.path) {
        throw new Error(json.error || '学习路线生成失败');
      }
      setPath(json.data.path as LearningPath);
      setShowPlanner(false);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : '学习路线生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const completedCount = path?.nodes.filter((node) => node.status === 'completed').length ?? 0;
  const progress = path?.nodes.length ? Math.round((completedCount / path.nodes.length) * 100) : 0;
  const nextNode = path?.nodes.find(
    (node) => node.status === 'in_progress' || node.status === 'pending',
  );
  const nextMastery = nextNode ? getNodeMastery(nextNode, context) : null;
  const profileReason = context?.dueReviews.length
    ? `当前有 ${context.dueReviews.length} 项到期内容，路线会优先插入复习节点。`
    : context?.weakPoints[0]
      ? `当前最薄弱的是「${context.weakPoints[0].knowledgePoint}」，路线会优先补足。`
      : (context?.learnerDecision?.summary ?? '路线会随着新的学习记录自动调整。');
  const totalSections =
    path?.nodes.reduce((sum, node) => sum + Math.max(1, node.estimatedSections), 0) ?? 0;
  const planUpdatedAt = useMemo(
    () => (path ? new Date(path.updatedAt).toLocaleString('zh-CN') : null),
    [path],
  );

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-slate-50 text-slate-900 dark:bg-[#07101f] dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(14,165,233,0.1),transparent_32%),radial-gradient(circle_at_85%_25%,rgba(124,58,237,0.08),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_50%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.11),transparent_32%),radial-gradient(circle_at_85%_25%,rgba(139,92,246,0.12),transparent_34%),linear-gradient(180deg,#07101f_0%,#0a1426_50%,#07101f_100%)]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-3 sm:px-6 lg:pb-10 lg:pt-4">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setShowPlanner((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/50 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition-colors hover:bg-cyan-100 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100 dark:hover:bg-cyan-300/15"
          >
            <RefreshCw className="h-4 w-4" /> {path ? '重新规划' : '生成路线'}
          </button>
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-sky-200 bg-white/85 p-6 shadow-[0_18px_50px_-30px_rgba(14,165,233,0.35)] dark:border-cyan-300/15 dark:bg-white/[0.04] dark:shadow-[0_0_50px_-24px_rgba(34,211,238,0.45)] sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">
                <MapPinned className="h-4 w-4" /> Personal Learning Route
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                {path?.title ?? '个人学习路线'}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                这不是固定课程表。每次测验、复习和课堂反馈都会更新你的学习情况，并调整内容顺序和推荐工具。
              </p>
            </div>
            {path && (
              <div className="min-w-48 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-black/15">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>路线进度</span>
                  <span>
                    {completedCount}/{path.nodes.length}
                  </span>
                </div>
                <div className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-300">
                  {progress}%
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {(showPlanner || (!path && !loading)) && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/80 p-5 dark:border-violet-300/20 dark:bg-violet-300/[0.06]"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
              <Sparkles className="h-4 w-4" /> 选择规划策略
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STRATEGIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStrategy(item.value)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all',
                    strategy === item.value
                      ? 'border-violet-300 bg-violet-100 dark:border-violet-300/40 dark:bg-violet-300/12'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-black/10 dark:hover:border-white/20',
                  )}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.label}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {item.description}
                  </div>
                </button>
              ))}
            </div>
            {strategy === 'goal-topic' && (
              <input
                value={goalTopic}
                onChange={(event) => setGoalTopic(event.target.value)}
                placeholder="输入目标主题，例如：高考函数综合题"
                className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 dark:border-white/10 dark:bg-black/15 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-violet-300/40"
              />
            )}
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating || (strategy === 'goal-topic' && !goalTopic.trim())}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Route className="h-4 w-4" />
              )}
              {generating ? '正在计算路线…' : '生成个人路线'}
            </button>
          </motion.section>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-600 dark:text-cyan-300" />{' '}
            正在读取个人路线…
          </div>
        ) : path ? (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Target,
                  label: '下一站',
                  value: nextNode?.topic ?? '路线已完成',
                  detail:
                    nextMastery === null
                      ? '等待掌握情况'
                      : `当前掌握情况 ${Math.round(nextMastery)}%`,
                },
                {
                  icon: Route,
                  label: '节点规模',
                  value: `${path.nodes.length} 个节点`,
                  detail: `预计 ${totalSections} 个学习章节`,
                },
                {
                  icon: ShieldCheck,
                  label: '完成条件',
                  value: '掌握情况达到 80%',
                  detail: '并完成一次结果验证',
                },
                {
                  icon: Clock3,
                  label: '最近更新',
                  value: planUpdatedAt ?? '刚刚',
                  detail: '新的学习记录会触发调整',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-300" /> {item.label}
                    </div>
                    <div className="mt-2 truncate text-base font-semibold text-slate-900 dark:text-white">
                      {item.value}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                  </div>
                );
              })}
            </section>

            <section className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-5 dark:border-cyan-300/15 dark:bg-cyan-300/[0.05]">
              <div className="flex items-start gap-3">
                <Brain className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
                <div>
                  <div className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">
                    为什么这样安排
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {profileReason}
                  </p>
                </div>
              </div>
            </section>

            <MistakeReviewStrip className="mt-5" />

            <section className="mt-6 space-y-4">
              {path.nodes.map((node, index) => {
                const mastery = getNodeMastery(node, context);
                const primaryTool = getPrimaryTool(node, mastery, context);
                const ToolIcon = primaryTool.icon;
                const masteryBefore = node.masteryBefore;
                const masteryAfter = node.masteryAfter ?? mastery;
                return (
                  <motion.article
                    key={node.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.04, 0.3) }}
                    className={cn(
                      'relative overflow-hidden rounded-2xl border p-5 sm:p-6',
                      node.status === 'in_progress'
                        ? 'border-amber-200 bg-amber-50/80 dark:border-amber-300/30 dark:bg-amber-300/[0.07]'
                        : node.status === 'completed'
                          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-300/20 dark:bg-emerald-300/[0.05]'
                          : 'border-slate-200 bg-white/85 shadow-sm dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none',
                    )}
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <div className="flex flex-col items-center">
                          <span
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold',
                              node.status === 'completed'
                                ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-300/15 dark:text-emerald-200'
                                : node.status === 'in_progress'
                                  ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-300/30 dark:bg-amber-300/15 dark:text-amber-200'
                                  : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
                            )}
                          >
                            {node.status === 'completed' ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          {index < path.nodes.length - 1 && (
                            <span className="mt-2 h-full min-h-12 w-px bg-gradient-to-b from-slate-300 to-transparent dark:from-white/20" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusIcon status={node.status} />
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                              {node.topic}
                            </h2>
                            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-400">
                              {STATUS_LABELS[node.status]}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                            {getNodeReason(node, index, context)}
                          </p>
                          {node.knowledgePoints.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {node.knowledgePoints.slice(0, 5).map((point) => (
                                <span
                                  key={point}
                                  className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] text-violet-700 dark:border-violet-300/15 dark:bg-violet-300/[0.06] dark:text-violet-200"
                                >
                                  {point}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="w-full space-y-3 lg:w-80">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-black/10">
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Gauge className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />{' '}
                              掌握情况变化
                            </span>
                            <span>目标 80%</span>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                            {masteryBefore !== undefined
                              ? `${Math.round(masteryBefore)}%`
                              : '待建立'}
                            <span className="mx-2 text-cyan-600 dark:text-cyan-300">→</span>
                            {masteryAfter !== null && masteryAfter !== undefined
                              ? `${Math.round(masteryAfter)}%`
                              : '学习后更新'}
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                              style={{
                                width: `${Math.max(3, Math.min(100, masteryAfter ?? masteryBefore ?? 3))}%`,
                              }}
                            />
                          </div>
                        </div>

                        <Link
                          href={primaryTool.href}
                          className="flex items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 transition-colors hover:bg-cyan-100 dark:border-cyan-300/20 dark:bg-cyan-300/[0.07] dark:hover:bg-cyan-300/12"
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-200">
                              <ToolIcon className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                                {primaryTool.label}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                                {primaryTool.detail}
                              </span>
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                        </Link>

                        <div className="flex items-start gap-2 text-[11px] leading-5 text-slate-500 dark:text-slate-500">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          完成条件：掌握情况达到 80%，并通过专项练习确认；完成后自动进入下一项。
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </section>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/75 p-8 text-center dark:border-white/15 dark:bg-white/[0.03]">
            <Route className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              还没有个人学习路线
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              先完善学习情况，或直接选择上面的方式生成第一条路线。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
