'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PlayCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTaskStore } from '@/lib/store/use-task-store';
import { unwrap } from '@/lib/animation/client-api';
import type { ScriptMeta } from '@/lib/animation/types';
import type { AnimationJob } from '@/lib/animation/animation-job-store';

const EXAMPLES = [
  '二叉堆的插入与上浮',
  '快速排序的 partition 过程',
  '梯度下降为什么能收敛',
  '单摆的运动规律',
];

export default function AnimationPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [history, setHistory] = useState<ScriptMeta[]>([]);
  const [activeJob, setActiveJob] = useState<AnimationJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);

  useEffect(() => {
    fetch('/api/animation/scripts')
      .then((r) => unwrap<{ scripts: ScriptMeta[] }>(r))
      .then((d) => setHistory(d.scripts ?? []))
      .catch(() => {});
  }, []);

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
      for (;;) {
        const r = await fetch(`/api/animation/jobs/${jobId}`);
        const { job } = await unwrap<{ job: AnimationJob }>(r);
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
        if (job.status === 'succeeded' && job.result) {
          router.push(`/sky/animation/${job.result.scriptId}`);
          return;
        }
        if (job.status === 'failed' || job.status === 'cancelled') return;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '生成请求失败');
    } finally {
      setSubmitting(false);
    }
  }, [topic, submitting, addTask, updateTask, router]);

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
            if (e.key === 'Enter') startGeneration();
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
