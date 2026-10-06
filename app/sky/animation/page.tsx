'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PlayCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTaskStore } from '@/lib/store/use-task-store';
import { HttpError, unwrap } from '@/lib/animation/client-api';
import type { ScriptMeta } from '@/lib/animation/types';
import type { AnimationJob } from '@/lib/animation/animation-job-store';

const EXAMPLES = [
  '二叉堆的插入与上浮',
  '快速排序的 partition 过程',
  '梯度下降为什么能收敛',
  '单摆的运动规律',
];

const POLL_INTERVAL_MS = 2000;
/** 轮询连续失败容忍次数（5 次 ≈ 10s），超过后停止轮询并将任务标记失败 */
const MAX_POLL_FAILURES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AnimationPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [history, setHistory] = useState<ScriptMeta[]>([]);
  const [activeJob, setActiveJob] = useState<AnimationJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);

  // 卸载标记：轮询循环据此停止写状态 / 跳转（避免离开页面后被成功跳转“拉回”）。
  // effect body 内重置为 true 以兼容 StrictMode 的卸载-重挂模拟。
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    fetch('/api/animation/scripts')
      .then((r) => unwrap<{ scripts: ScriptMeta[] }>(r))
      .then((d) => setHistory(d.scripts ?? []))
      .catch((err) => {
        console.warn('[AnimationPage] 历史记录加载失败', err);
      });
  }, []);

  // 轮询单个 job 直到终态。可从「提交生成」和「挂载恢复」两个入口进入。
  const pollJob = useCallback(
    async (jobId: string) => {
      let consecutivePollFailures = 0;
      for (;;) {
        let job: AnimationJob;
        try {
          const r = await fetch(`/api/animation/jobs/${jobId}`);
          ({ job } = await unwrap<{ job: AnimationJob }>(r));
          consecutivePollFailures = 0;
        } catch (err) {
          // 404：job 文件已不存在（被清理/丢失），重试无意义，立即终止
          if (err instanceof HttpError && err.status === 404) {
            if (mountedRef.current) {
              updateTask(jobId, {
                status: 'failed',
                phase: '任务不存在',
                error: '任务不存在或已被清理',
              });
              setSubmitError('任务不存在或已被清理，请重新生成。');
            }
            return;
          }
          // 单次瞬时失败（网络抖动等）不终止轮询、不翻转任务状态；
          // 连续超过阈值才判定轮询不可用并停止（job 本身可能仍在后台正常生成）。
          consecutivePollFailures += 1;
          console.warn(
            `[AnimationPage] 进度查询失败（${consecutivePollFailures}/${MAX_POLL_FAILURES}），jobId=${jobId}`,
            err,
          );
          if (consecutivePollFailures >= MAX_POLL_FAILURES) {
            if (mountedRef.current) {
              updateTask(jobId, {
                status: 'failed',
                phase: '进度查询中断',
                error: '进度查询连续失败，已停止轮询',
              });
              setSubmitError(
                '生成进度查询连续失败，已停止轮询。生成可能仍在后台进行，稍后可在历史记录中查看，或重新生成。',
              );
            }
            return;
          }
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
        // 卸载后不再写任何状态、不再发生跳转
        if (!mountedRef.current) return;
        setActiveJob(job);
        updateTask(jobId, {
          progress: job.progress,
          phase: job.message,
          status:
            job.status === 'failed' || job.status === 'cancelled'
              ? 'failed'
              : job.status === 'succeeded'
                ? 'completed'
                : 'running',
        });
        if (job.status === 'succeeded') {
          if (job.result) {
            router.push(`/sky/animation/${job.result.scriptId}`);
          } else {
            // 数据异常兜底：succeeded 却缺 result，按失败处理避免卡在 running
            updateTask(jobId, { status: 'failed', phase: '生成结果缺失', error: '生成结果缺失' });
            setSubmitError('生成完成但结果缺失，请重新生成。');
          }
          return;
        }
        if (job.status === 'failed' || job.status === 'cancelled') return;
        await sleep(POLL_INTERVAL_MS);
      }
    },
    [updateTask, router],
  );

  const startGeneration = useCallback(async () => {
    const t = topic.trim();
    if (t.length < 2 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/animation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t }),
      });
      const { jobId } = await unwrap<{ jobId: string }>(res);
      if (!mountedRef.current) return;
      addTask({
        id: jobId,
        type: 'animation',
        label: t,
        status: 'running',
        progress: 0,
        phase: '排队中',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        jobId,
      });
      await pollJob(jobId);
    } catch (err) {
      if (mountedRef.current) setSubmitError(err instanceof Error ? err.message : '生成请求失败');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [topic, submitting, addTask, pollJob]);

  // 挂载恢复：store 里存在进行中的动画任务时接续轮询，
  // 避免「离开页面再回来后任务芯片永远转圈」（后台任务 store 的既有契约）。
  const resumedJobRef = useRef<string | null>(null);
  useEffect(() => {
    const running = Object.values(useTaskStore.getState().tasks).find(
      (t) => t.type === 'animation' && t.status === 'running' && t.jobId,
    );
    if (!running?.jobId || resumedJobRef.current === running.jobId) return;
    resumedJobRef.current = running.jobId;
    void pollJob(running.jobId);
  }, [pollJob]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" />
          动画讲解
        </h1>
        <p className="text-sm text-muted-foreground">
          输入算法、数据结构、数学或物理话题，AI 生成逐步动画 + 语音讲解。
        </p>
      </header>

      <div className="flex gap-2">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            // isComposing：中文等 IME 组词期间的 Enter 不触发提交（与 components/stage.tsx 一致）
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) startGeneration();
          }}
          placeholder="例如：二叉堆的插入与上浮"
          maxLength={120}
        />
        <Button onClick={startGeneration} disabled={topic.trim().length < 2 || submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
          生成
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => setTopic(e)}
            className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {e}
          </button>
        ))}
      </div>

      {submitError ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{submitError}</p>
          <Button variant="outline" size="sm" onClick={startGeneration}>
            重试
          </Button>
        </div>
      ) : null}

      {activeJob ? (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">{activeJob.message}</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${activeJob.progress}%` }}
              role="progressbar"
              aria-valuenow={activeJob.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          {activeJob.status === 'failed' ? (
            <div className="mt-3 space-y-2">
              {activeJob.planOutline ? (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    讲解大纲（分镜生成失败，仅供参考）
                  </p>
                  <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                    {activeJob.planOutline.steps.map((s, i) => (
                      <li key={i}>
                        {s.title}：{s.intent}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-destructive">{activeJob.error}</p>
                <Button variant="outline" size="sm" onClick={startGeneration}>
                  重试
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">历史记录</h2>
          <ul className="divide-y rounded-xl border">
            {history.map((h) => (
              <li key={h.scriptId}>
                <button
                  onClick={() => router.push(`/sky/animation/${h.scriptId}`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
                >
                  <span className="text-sm">{h.title}</span>
                  <span className="text-xs text-muted-foreground">{h.stepCount} 步</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
