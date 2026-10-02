/**
 * Course Studio 资源生成任务的流式（SSE）事件源。
 *
 * 采用「轮询 job store + 增量推送」的方式把后台生成任务转换为实时流，
 * 供 `/api/sky/resource-generation/jobs/[jobId]/stream` 使用，也便于单元测试直接驱动。
 */
import { createLogger } from '@/lib/logger';
import type { SoftwareCupGenerationResult } from '@/lib/software-cup/demo-service';
import { readResourceGenerationJobHybrid } from '@/lib/server/resource-generation-job-store';

const log = createLogger('ResourceGenerationStream');

export type ResourceStreamEvent =
  | {
      type: 'progress';
      jobId: string;
      step: string;
      progress: number;
      message: string;
    }
  | { type: 'done'; jobId: string; result: SoftwareCupGenerationResult }
  | { type: 'error'; jobId: string; message: string };

export interface StreamResourceGenerationJobOptions {
  /** 是否在开始时尝试恢复 running/initalizing 的任务。 */
  stageInitial?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
  /** 客户端断开/超时时立即结束流。 */
  abortSignal?: AbortSignal;
}

/**
 * 拉取 job 状态生成 SSE 事件流。任务成功推 done、失败/超时推 error。
 * abortSignal 触发时立即结束，避免空转连接。
 */
export async function* streamResourceGenerationJob(
  jobId: string,
  options: StreamResourceGenerationJobOptions = {},
): AsyncGenerator<ResourceStreamEvent> {
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;

  let lastStep = '';
  let lastProgress = -1;

  // 先尝试恢复可能被 HMR/重启丢弃的运行中任务。
  if (options.stageInitial) {
    try {
      const { resumeResourceGenerationJob } =
        await import('@/lib/server/resource-generation-runner');
      void resumeResourceGenerationJob(jobId).catch(() => {});
    } catch {
      /* best-effort */
    }
  }

  while (Date.now() < deadline) {
    if (options.abortSignal?.aborted) return;
    let job;
    try {
      job = await readResourceGenerationJobHybrid(jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to read resource generation job ${jobId}:`, error);
      yield { type: 'error', jobId, message: `读取生成任务失败：${message}` };
      return;
    }

    if (!job) {
      yield { type: 'error', jobId, message: '生成任务不存在或已失效。' };
      return;
    }

    if (job.status === 'succeeded') {
      if (job.result) {
        yield { type: 'done', jobId, result: job.result };
      } else {
        yield { type: 'error', jobId, message: '生成任务已完成，但缺少结果数据。' };
      }
      return;
    }

    if (job.status === 'failed') {
      yield { type: 'error', jobId, message: job.error || '生成失败，请重试。' };
      return;
    }

    const changed = job.step !== lastStep || job.progress !== lastProgress;
    lastStep = job.step as string;
    lastProgress = job.progress;

    if (changed) {
      yield {
        type: 'progress',
        jobId,
        step: job.step,
        progress: job.progress,
        message: job.message,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  log.warn(`Resource generation job ${jobId} stream timed out after ${timeoutMs}ms`);
  yield { type: 'error', jobId, message: '生成超时，请稍后重试。' };
}
