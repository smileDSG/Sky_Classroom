'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  BarChart3,
  Check,
  CircleAlert,
  Clock3,
  FlaskConical,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type {
  PersonalizationLabAction,
  PersonalizationLabDecision,
  PersonalizationLabEventType,
  PersonalizationLabKnowledgeState,
  PersonalizationLabState,
} from '@/lib/adaptive-learning/decision/personalization-lab';

interface ShadowReport {
  status: 'insufficient-data' | 'ready';
  eligibleResponses: number;
  skippedResponses: number;
  minimumResponses: number;
  behavior: {
    replayEvents: number;
    replayCount: number;
    mappedReplayEvents: number;
    pauseEvents: number;
    dwellEvents: number;
    questionEvents: number;
    selfReportedEvents: number;
    latestReplayAt?: string;
  };
  decisions: {
    recorded: number;
    changed: number;
    unchanged: number;
    latestAt?: string;
  };
  report: {
    newModel: { brier: number; auc: number };
    baseline: { brier: number; auc: number };
  } | null;
}

const SESSION_ID = 'client-demo';

const actionLabels: Record<PersonalizationLabAction, string> = {
  diagnostic: '先做基础练习',
  teach: '先补充概念',
  review: '安排记忆复习',
  quiz: '进入针对练习',
};

const actionDescriptions: Record<PersonalizationLabAction, string> = {
  diagnostic: '先做少量练习，避免过早判断。',
  teach: '掌握情况偏低，先降低难度补足概念。',
  review: '之前学过，但当前记忆度已经下降。',
  quiz: '学习情况稳定，可以用练习验证并提高难度。',
};

const reasonLabels: Record<string, string> = {
  'no-evidence': '暂无学习记录',
  'low-confidence': '学习记录还不够',
  'low-mastery': '掌握情况偏低',
  'repeated-errors': '重复错误较多',
  'low-retention': '记忆度下降',
  'stable-mastery': '掌握和记忆情况稳定',
  'no-knowledge-point': '暂无知识点数据',
};

interface MetricProps {
  label: string;
  value: number;
  help: string;
  color: string;
}

function Metric({ label, value, help, color }: MetricProps) {
  const percent = Math.round(value * 100);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-lg font-semibold text-white">{percent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{help}</p>
    </div>
  );
}

function DecisionPanel({ decision }: { decision: PersonalizationLabDecision }) {
  return (
    <section className="rounded-2xl border border-sky-300/20 bg-sky-300/[0.07] p-5 shadow-[0_0_32px_rgba(56,189,248,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-200/70">
            当前决策
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {actionLabels[decision.action]}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{decision.summary}</p>
        </div>
        <div className="rounded-xl border border-sky-200/20 bg-sky-100/10 px-3 py-2 text-right">
          <div className="text-xs text-sky-100/60">目标知识点</div>
          <div className="mt-1 font-medium text-sky-50">{decision.topic}</div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-black/20 p-3">
          <div className="text-xs text-slate-500">难度</div>
          <div className="mt-1 text-sm font-medium text-white">{decision.difficulty}</div>
        </div>
        <div className="rounded-lg bg-black/20 p-3">
          <div className="text-xs text-slate-500">呈现方式</div>
          <div className="mt-1 text-sm font-medium text-white">{decision.format}</div>
        </div>
        <div className="rounded-lg bg-black/20 p-3">
          <div className="text-xs text-slate-500">建议时长</div>
          <div className="mt-1 text-sm font-medium text-white">{decision.durationMinutes} 分钟</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {decision.reasonCodes.map((code) => (
          <span
            key={code}
            className="rounded-full border border-sky-200/20 bg-sky-100/10 px-3 py-1 text-xs text-sky-100"
          >
            {reasonLabels[code] ?? code}
          </span>
        ))}
      </div>
    </section>
  );
}

export function PersonalizationLab() {
  const [state, setState] = useState<PersonalizationLabState | null>(null);
  const [busyEvent, setBusyEvent] = useState<PersonalizationLabEventType | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shadowReport, setShadowReport] = useState<ShadowReport | null>(null);

  const loadState = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(
        `/api/sky/personalization-lab?sessionId=${encodeURIComponent(SESSION_ID)}`,
        { credentials: 'include' },
      );
      const payload = (await response.json()) as {
        success?: boolean;
        data?: PersonalizationLabState;
      };
      if (!response.ok || !payload.success || !payload.data) throw new Error('实验状态加载失败');
      setState(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '实验状态加载失败');
    }
  }, []);

  const loadShadowReport = useCallback(async () => {
    try {
      const response = await fetch('/api/sky/learning-shadow-report', { credentials: 'include' });
      const payload = (await response.json()) as { success?: boolean; data?: ShadowReport };
      if (response.ok && payload.success && payload.data) setShadowReport(payload.data);
    } catch {
      // The simulation remains available when a real-user report is unavailable.
    }
  }, []);

  useEffect(() => {
    void loadState();
    void loadShadowReport();
  }, [loadShadowReport, loadState]);

  const sendEvent = useCallback(async (eventType: PersonalizationLabEventType | 'reset') => {
    setBusyEvent(eventType);
    setError(null);
    try {
      const response = await fetch('/api/sky/personalization-lab', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: SESSION_ID, eventType }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: PersonalizationLabState;
      };
      if (!response.ok || !payload.success || !payload.data) throw new Error('实验事件提交失败');
      setState(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '实验事件提交失败');
    } finally {
      setBusyEvent(null);
    }
  }, []);

  const knowledgeState: PersonalizationLabKnowledgeState | undefined = state?.knowledgeStates[0];
  const decision = state?.decision;
  const statusText = useMemo(() => {
    if (!state) return '正在加载实验状态';
    if (state.eventCount === 0) return '等待第一条学习记录';
    return `已模拟 ${state.eventCount} 个学习事件`;
  }, [state]);

  return (
    <div className="min-h-[calc(100dvh-4rem)] text-white">
      <div className=" px-4 pt-6 pb-12 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-300/10 text-sky-200">
              <FlaskConical className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-white">学习情况实验室</h1>
              <p className="mt-1 line-clamp-1 text-sm text-slate-400">
                用模拟学习记录观察：掌握情况、判断把握和记忆情况如何影响下一步安排。
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
            <span className="size-2 rounded-full bg-sky-400" />
            演示状态仅保存在当前服务进程
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100"
          >
            <CircleAlert className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {state && knowledgeState && decision ? (
          <div className=" space-y-6">
            <section className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  当前观测对象
                </p>
                <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
                  <Target className="size-5 text-sky-300" />
                  {knowledgeState.displayName}
                </h2>
              </div>
              <span className="text-sm text-slate-500">{statusText}</span>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <Metric
                label="掌握情况"
                value={knowledgeState.mastery}
                help="系统估计用户能否独立完成该知识点。"
                color="#38bdf8"
              />
              <Metric
                label="判断把握"
                value={knowledgeState.confidence}
                help="学习记录越多，系统越能判断你的情况。"
                color="#38bdf8"
              />
              <Metric
                label="当前记忆度"
                value={knowledgeState.retention}
                help="结合距离上次学习的时间估计当前记忆状态。"
                color="#38bdf8"
              />
            </section>

            <DecisionPanel decision={decision} />

            {shadowReport && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <div className="flex items-start gap-3">
                  <BarChart3 className="mt-0.5 size-5 text-sky-300" />
                  <div>
                    <h2 className="text-lg font-semibold">真实数据影子评估</h2>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                      <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                        回放记录：{shadowReport.behavior.replayEvents}
                      </div>
                      <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                        累计回放：{shadowReport.behavior.replayCount}
                      </div>
                      <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                        已绑定知识点：{shadowReport.behavior.mappedReplayEvents}
                      </div>
                      <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                        暂停：{shadowReport.behavior.pauseEvents}
                      </div>
                      <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                        停留：{shadowReport.behavior.dwellEvents}
                      </div>
                      <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                        提问：{shadowReport.behavior.questionEvents}
                      </div>
                      <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                        自评：{shadowReport.behavior.selfReportedEvents}
                      </div>
                      <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                        决策对照：{shadowReport.decisions.recorded}
                      </div>
                      <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                        发生变化：{shadowReport.decisions.changed}
                      </div>
                    </div>
                    {shadowReport.status === 'insufficient-data' ? (
                      <p className="mt-1 text-sm text-slate-400">
                        已收集 {shadowReport.eligibleResponses}/{shadowReport.minimumResponses}{' '}
                        条有效答题记录；达到门槛后才显示模型结论。
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                        <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                          新模型：Brier {shadowReport.report?.newModel.brier.toFixed(3)} · AUC{' '}
                          {shadowReport.report?.newModel.auc.toFixed(3)}
                        </div>
                        <div className="rounded-lg bg-black/20 p-3 text-slate-200">
                          Beta 基线：Brier {shadowReport.report?.baseline.brier.toFixed(3)} · AUC{' '}
                          {shadowReport.report?.baseline.auc.toFixed(3)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">模拟学习记录</h2>
                    <p className="mt-1 text-sm text-slate-500">每次操作都会更新学习情况和推荐。</p>
                  </div>
                  <BrainCircuit className="size-5 text-sky-300" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="justify-start border-sky-300/20 bg-sky-300/[0.06] text-sky-100 hover:bg-sky-300/10"
                    disabled={busyEvent !== null}
                    onClick={() => void sendEvent('answer-correct')}
                  >
                    <Check />
                    答对一题
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start border-rose-300/20 bg-rose-300/[0.06] text-rose-100 hover:bg-rose-300/10"
                    disabled={busyEvent !== null}
                    onClick={() => void sendEvent('answer-incorrect')}
                  >
                    <X />
                    答错一题
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start border-sky-300/20 bg-sky-300/[0.06] text-sky-100 hover:bg-sky-300/10"
                    disabled={busyEvent !== null}
                    onClick={() => void sendEvent('review-success')}
                  >
                    <Sparkles />
                    复习成功
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start border-sky-300/20 bg-sky-300/[0.06] text-sky-100 hover:bg-sky-300/10"
                    disabled={busyEvent !== null}
                    onClick={() => void sendEvent('review-failure')}
                  >
                    <Clock3 />
                    复习失败
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="mt-4 text-slate-400 hover:text-white"
                  disabled={busyEvent !== null}
                  onClick={() => void sendEvent('reset')}
                >
                  <RotateCcw />
                  重置演示状态
                </Button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">功能接入预览</h2>
                <p className="mt-1 text-sm text-slate-500">
                  同一份决策会被不同功能翻译成不同参数。
                </p>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="rounded-xl bg-black/20 p-3">
                    <div className="text-xs text-slate-500">智能测验</div>
                    <div className="mt-1 text-slate-200">
                      {decision.topic} · {decision.difficulty} · 3 道题
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-3">
                    <div className="text-xs text-slate-500">AI 授课</div>
                    <div className="mt-1 text-slate-200">
                      {actionDescriptions[decision.action]} · {decision.format}
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-3">
                    <div className="text-xs text-slate-500">首页下一步</div>
                    <div className="mt-1 text-slate-200">
                      {actionLabels[decision.action]} · {decision.durationMinutes} 分钟
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.035] p-8 text-sm text-slate-400">
            正在加载实验状态…
          </div>
        )}
      </div>
    </div>
  );
}
