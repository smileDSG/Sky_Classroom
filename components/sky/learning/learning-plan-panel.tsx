'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Loader2,
  Route,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LearningPlan, LearningTask } from '@/lib/adaptive-learning/contracts';
import type {
  LearningPlanView,
  LearningPlanViewKind,
} from '@/lib/adaptive-learning/planning/learning-plan-view';
import { cn } from '@/lib/utils';
import { PanelShell } from '../study-lab/panel-shell';

type ReplanMode = 'micro' | 'full';

export interface LearningPlanPanelData {
  plan: LearningPlan | null;
  view: LearningPlanView | null;
}

const VIEW_OPTIONS: Array<{ kind: LearningPlanViewKind; label: string }> = [
  { kind: 'today', label: '今日' },
  { kind: 'week', label: '本周' },
  { kind: 'month', label: '未来28天' },
];

const STATUS_META: Record<LearningTask['status'], { label: string; className: string }> = {
  pending: {
    label: '待完成',
    className:
      'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300',
  },
  'in-progress': {
    label: '进行中',
    className:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-200/20 dark:bg-sky-300/10 dark:text-sky-100',
  },
  completed: {
    label: '已完成',
    className:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-200/20 dark:bg-sky-300/10 dark:text-sky-100',
  },
  skipped: {
    label: '已跳过',
    className:
      'border-slate-200 bg-white text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500',
  },
};

const TASK_META: Record<
  LearningTask['type'],
  {
    tool: string;
    toolDescription: string;
    buttonLabel: string;
    titlePrefix: string;
    description: string;
  }
> = {
  diagnostic: {
    tool: '智能测验',
    toolDescription: '先测清楚你会不会',
    buttonLabel: '开始测一测',
    titlePrefix: '先测一测',
    description: '先做几道基础题，看看你现在会到哪一步。',
  },
  learn: {
    tool: 'AI 授课',
    toolDescription: '把不会的地方讲明白',
    buttonLabel: '打开授课',
    titlePrefix: '先学懂',
    description: '先听一段针对你的讲解，再做一个小练习。',
  },
  'worked-example': {
    tool: 'AI 授课',
    toolDescription: '跟着例题学会怎么做',
    buttonLabel: '跟着例题学',
    titlePrefix: '跟着例题学会',
    description: '看一遍完整解题过程，再自己试一次。',
  },
  practice: {
    tool: '智能测验',
    toolDescription: '练几道题，把方法用熟',
    buttonLabel: '开始练习',
    titlePrefix: '练一练',
    description: '做几道针对练习，把刚学的内容用起来。',
  },
  review: {
    tool: '记忆卡',
    toolDescription: '把学过的内容重新记牢',
    buttonLabel: '开始复习',
    titlePrefix: '复习一下',
    description: '用记忆卡快速回顾，避免学过的内容忘掉。',
  },
};

const REASON_EXPLANATIONS: Record<string, string> = {
  'no-evidence': '这部分还没做过题，我们还不知道你会不会，先用几道题摸摸底。',
  'low-confidence': '你做过的题还不够多，我们先多确认几道，看看哪些地方已经会了。',
  'low-mastery': '这部分目前还不熟练，先把基础补清楚，再继续往后学。',
  'repeated-errors': '这部分最近反复出错，先针对易错点练习，避免同样的问题再出现。',
  'low-retention': '这部分以前学过，但有一段时间没复习，先把记忆找回来。',
  'stable-mastery': '这部分已经掌握得不错，继续练习让它变得更稳。',
  'path-sequence': '这是后面内容的基础，所以先从这里开始。',
};

function asPayload(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

async function readApiPayload(response: Response): Promise<Record<string, unknown>> {
  const payload = asPayload(await response.json().catch(() => null));
  if (!response.ok || !payload?.success) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : '学习计划更新失败');
  }
  return payload;
}

async function requestPlanView(kind: LearningPlanViewKind): Promise<LearningPlanPanelData> {
  const response = await fetch(`/api/sky/learning-plan?view=${kind}`, {
    credentials: 'include',
  });
  const payload = await readApiPayload(response);
  return payload.data as LearningPlanPanelData;
}

async function requestReplan(mode: ReplanMode): Promise<void> {
  const randomId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}`;
  const response = await fetch('/api/sky/learning-plan', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode,
      triggerEventIds: [`manual-replan:${randomId}`],
    }),
  });
  await readApiPayload(response);
}

async function requestTaskStatus(
  taskId: string,
  status: Extract<LearningTask['status'], 'in-progress' | 'completed' | 'skipped'>,
): Promise<void> {
  const response = await fetch(`/api/sky/learning-plan/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  await readApiPayload(response);
}

function formatDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function formatRange(from: string, to: string): string {
  return from === to ? formatDate(from) : `${formatDate(from)}—${formatDate(to)}`;
}

function taskHref(task: LearningTask): string {
  return task.actionHref ?? '/sky/learning/path';
}

function taskTopic(task: LearningTask): string {
  const quotedObjective = task.objective.match(/[“"]([^”"]+)[”"]/);
  if (quotedObjective?.[1]) return quotedObjective[1];
  const titleTopic = task.title.split('：').slice(1).join('：').trim();
  if (titleTopic) return titleTopic;
  return task.objective || task.title;
}

function taskDisplayTitle(task: LearningTask): string {
  const meta = TASK_META[task.type];
  const topic = taskTopic(task);
  if (task.title.includes('：')) return `${meta.titlePrefix}：${topic}`;
  return task.title;
}

function taskReason(task: LearningTask): string {
  const reasons = task.reasonCodes
    .map((code) => REASON_EXPLANATIONS[code])
    .filter(
      (reason): reason is string =>
        Boolean(reason) && reason !== REASON_EXPLANATIONS['path-sequence'],
    );
  return reasons[0] ?? REASON_EXPLANATIONS['path-sequence'];
}

function difficultyLabel(value: number): string {
  if (value <= 1) return '先摸底';
  if (value === 2) return '基础';
  if (value === 3) return '标准';
  if (value === 4) return '进阶';
  return '挑战';
}

export function LearningPlanPanel({
  initialData,
  error,
  onPlanChanged,
  compact = false,
}: {
  initialData: LearningPlanPanelData | null;
  error?: string;
  onPlanChanged: () => Promise<void> | void;
  /** 首页只展示今天的关键任务；完整编排仍在独立的今日计划页。 */
  compact?: boolean;
}) {
  const [activeView, setActiveView] = useState<LearningPlanViewKind>('today');
  const [viewData, setViewData] = useState<
    Partial<Record<LearningPlanViewKind, LearningPlanPanelData | null>>
  >({ today: initialData });
  const [loadingView, setLoadingView] = useState<LearningPlanViewKind | null>(null);
  const [replanning, setReplanning] = useState<ReplanMode | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    setViewData((current) => ({ ...current, today: initialData }));
  }, [initialData]);

  const loadView = useCallback(async (kind: LearningPlanViewKind) => {
    setLoadingView(kind);
    setOperationError(undefined);
    try {
      const data = await requestPlanView(kind);
      setViewData((current) => ({ ...current, [kind]: data }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '学习计划加载失败';
      setOperationError(message);
      throw loadError;
    } finally {
      setLoadingView(null);
    }
  }, []);

  const selectView = (kind: LearningPlanViewKind) => {
    setActiveView(kind);
    setNotice(undefined);
    if (viewData[kind] === undefined) {
      void loadView(kind).catch(() => undefined);
    }
  };

  const updateTask = async (
    taskId: string,
    status: Extract<LearningTask['status'], 'in-progress' | 'completed' | 'skipped'>,
  ) => {
    setUpdatingTaskId(taskId);
    setOperationError(undefined);
    setNotice(undefined);
    try {
      await requestTaskStatus(taskId, status);
      await Promise.all([loadView(activeView), Promise.resolve(onPlanChanged())]);
      setNotice(status === 'completed' ? '做完了，接下来会按你的结果安排下一步。' : '已经记下了。');
    } catch (taskError) {
      setOperationError(taskError instanceof Error ? taskError.message : '任务状态更新失败');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const replan = async (mode: ReplanMode) => {
    setReplanning(mode);
    setOperationError(undefined);
    setNotice(undefined);
    try {
      await requestReplan(mode);
      await Promise.all([loadView(activeView), Promise.resolve(onPlanChanged())]);
      setNotice(
        mode === 'micro'
          ? '今天和明天会按你最新的学习情况调整。'
          : '后面的任务会按你最新的学习情况重新安排。',
      );
    } catch (replanError) {
      setOperationError(replanError instanceof Error ? replanError.message : '学习计划更新失败');
    } finally {
      setReplanning(null);
    }
  };

  const currentData = viewData[activeView];
  const plan = currentData?.plan ?? null;
  const view = currentData?.view ?? null;
  const isLoading = loadingView === activeView;
  const isReplanning = replanning !== null;
  const visibleTasks = compact ? view?.tasks.slice(0, 3) : view?.tasks;

  return (
    <PanelShell
      icon={CalendarRange}
      title={compact ? '今天的安排' : '个人学习计划'}
      eyebrow={compact ? '完成这几项就够了' : '接下来怎么学'}
      error={operationError ?? error}
      className="rounded-2xl border-slate-200/80 bg-white/80 p-5 shadow-none dark:border-white/10 dark:bg-[#0a1524]/90 sm:p-6"
      action={
        plan?.pathId ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Route className="h-3.5 w-3.5" />
            跟着你的学习路径
          </span>
        ) : undefined
      }
    >
      {!compact && (
        <div
          role="tablist"
          aria-label="学习计划时间范围"
          className="flex gap-6 border-b border-slate-200 dark:border-white/10"
        >
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              role="tab"
              aria-selected={activeView === option.kind}
              onClick={() => selectView(option.kind)}
              className={cn(
                'min-h-10 rounded-none border-b-2 border-transparent px-1 text-xs font-semibold transition-colors sm:text-sm',
                activeView === option.kind
                  ? 'border-sky-500 text-slate-950 dark:border-sky-300 dark:text-white'
                  : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {isLoading && !view ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载计划投影…
        </div>
      ) : !plan || !view ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600 dark:border-sky-100/15 dark:bg-white/[0.04] dark:text-slate-300">
          还没有学习计划。先生成一份个人安排，我们会结合你的情况、可用时间和休息日排好每天的任务。
          <Link
            href="/sky/learning/path"
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 font-semibold text-white dark:bg-sky-300 dark:text-slate-950"
          >
            开始安排学习路线
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className={cn('mt-4 space-y-4', isLoading && 'opacity-60')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">
              {formatRange(view.from, view.to)}
            </div>
            {compact ? (
              <Link
                href="/sky/learning/today"
                className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-sky-700 transition-colors hover:text-sky-800 dark:text-sky-200 dark:hover:text-sky-100"
              >
                查看完整计划
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                会根据你的学习情况调整 · 安排到 {formatDate(plan.validTo)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 border-y border-slate-200 py-2 dark:border-white/10">
            {[
              { label: '今天安排', value: `${view.summary.totalTasks} 项` },
              { label: '预计用时', value: `${view.summary.plannedMinutes} 分钟` },
              { label: '完成情况', value: `${view.summary.completionRate}%` },
            ].map((metric) => (
              <div
                key={metric.label}
                className="border-r border-slate-200 px-3 py-2 last:border-r-0 dark:border-white/10"
              >
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{metric.label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white sm:text-base">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          {!compact && view.weeklyTargets.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">周目标</div>
              <div className="grid gap-2 md:grid-cols-2">
                {view.weeklyTargets.map((target) => (
                  <div
                    key={target.weekStart}
                    className="border-l-2 border-sky-400/60 px-3 py-2 dark:border-sky-300/60"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {formatDate(target.weekStart)}起
                      </span>
                      <span className="text-sky-700 dark:text-sky-200">
                        {target.plannedMinutes} 分钟
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {target.expectedOutcomes.join('；')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            className={cn(
              !compact && 'divide-y divide-slate-200 dark:divide-white/10',
              compact && 'space-y-2',
            )}
          >
            {visibleTasks?.length === 0 ? (
              <div className="border-y border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                今天先休息一下，暂时没有必须完成的任务。
              </div>
            ) : (
              visibleTasks?.map((task) => {
                const status = STATUS_META[task.status];
                const taskMeta = TASK_META[task.type];
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'py-5 first:pt-2 last:pb-2',
                      compact &&
                        'rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04]',
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {!compact && (
                            <span className="text-xs font-semibold text-sky-700 dark:text-sky-200">
                              {formatDate(task.scheduledDate)}
                            </span>
                          )}
                          <span
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              status.className,
                            )}
                          >
                            {status.label}
                          </span>
                          {!compact && task.pathNodeId && (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-100/15 dark:bg-sky-300/[0.08] dark:text-sky-100">
                              按你的学习路线
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                          {taskDisplayTitle(task)}
                        </h3>
                        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                          {taskMeta.description}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-sky-700 dark:text-sky-200">
                            今天用：{taskMeta.tool}
                          </span>
                          <span>{taskMeta.toolDescription}</span>
                          <span>约 {task.plannedMinutes} 分钟</span>
                          {!compact && <span>难度：{difficultyLabel(task.difficulty)}</span>}
                        </div>
                        {compact ? (
                          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {taskReason(task)}
                          </p>
                        ) : (
                          <div className="mt-3 border-l-2 border-sky-300/80 pl-3 dark:border-sky-200/60">
                            <p className="text-xs font-semibold text-sky-800 dark:text-sky-100">
                              为什么需要做？
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {taskReason(task)}
                            </p>
                          </div>
                        )}
                      </div>
                      <Link
                        href={taskHref(task)}
                        onClick={() => {
                          if (task.status === 'pending') {
                            void requestTaskStatus(task.id, 'in-progress').catch(() => undefined);
                          }
                        }}
                        className={cn(
                          'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
                          task.status === 'completed'
                            ? 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]'
                            : 'bg-sky-500 text-white shadow-sm hover:bg-sky-600 dark:bg-sky-300 dark:text-slate-950 dark:hover:bg-sky-200',
                        )}
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Clock3 className="h-3.5 w-3.5" />
                        )}
                        {taskMeta.buttonLabel}
                      </Link>
                      {(task.status === 'pending' || task.status === 'in-progress') && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          title="标记任务完成"
                          aria-label="标记任务完成"
                          onClick={() => void updateTask(task.id, 'completed')}
                          disabled={updatingTaskId === task.id}
                        >
                          {updatingTaskId === task.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <CheckCircle2 />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!compact && (
            <div className="border-t border-slate-200 pt-4 dark:border-white/10">
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                “调整未来48小时”只会更新今天和明天；“重新安排剩余计划”会更新后面的任务。已经开始或完成的任务会保留。
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void replan('micro')}
                  disabled={isReplanning}
                  className="min-h-10 flex-1"
                >
                  {replanning === 'micro' ? <Loader2 className="animate-spin" /> : <RotateCw />}
                  调整未来48小时
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void replan('full')}
                  disabled={isReplanning}
                  className="min-h-10 flex-1"
                >
                  {replanning === 'full' ? <Loader2 className="animate-spin" /> : <CalendarRange />}
                  重排剩余计划
                </Button>
              </div>
              {notice && (
                <div className="mt-2 text-xs font-medium text-sky-700 dark:text-sky-200">
                  {notice}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
}
