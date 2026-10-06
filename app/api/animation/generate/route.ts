import { after, type NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import {
  createAnimationJob,
  markAnimationJobRunning,
  markAnimationJobSucceeded,
  markAnimationJobFailed,
  updateAnimationJob,
} from '@/lib/animation/animation-job-store';
import { saveAnimationScript } from '@/lib/animation/script-store';
import {
  runAnimationGeneration,
  AnimationGenerationError,
} from '@/lib/animation/generate/pipeline';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnimationGenerateAPI');

const bodySchema = z.object({ topic: z.string().trim().min(2).max(120) });

export async function POST(request: NextRequest) {
  let topic: string;
  try {
    const body = bodySchema.parse(await request.json());
    topic = body.topic;
  } catch {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '话题长度需在 2~120 字符之间');
  }

  const job = await createAnimationJob(topic);

  after(async () => {
    const progressPromises: Promise<unknown>[] = [];
    try {
      await markAnimationJobRunning(job.jobId, 'planning');
      const { script, warnings } = await runAnimationGeneration(topic, {
        onProgress: (stage, progress, message) => {
          progressPromises.push(
            updateAnimationJob(job.jobId, {
              // pipeline 的 'done' 只代表脚本校验完成，落库前映射为 'validating'
              stage: stage === 'done' ? 'validating' : stage,
              progress,
              message: message ?? '',
            }).catch((err) => {
              log.warn('动画生成进度写入失败', err);
            }),
          );
        },
      });
      // 先等所有进度写落盘再写终态，避免 fire-and-forget 进度写覆盖终态（丢失 §8.1 planOutline）
      await Promise.allSettled(progressPromises);
      const savedScriptId = await saveAnimationScript(script);
      if (warnings.length) log.warn('生成完成但有警告', warnings);
      await markAnimationJobSucceeded(job.jobId, {
        scriptId: savedScriptId,
        title: script.title,
        stepCount: script.steps.length,
      });
    } catch (err) {
      await Promise.allSettled(progressPromises);
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`生成失败: ${msg}`);
      // plan 成功而 script 失败：保留大纲供前端降级展示（spec §8.1）
      if (err instanceof AnimationGenerationError && err.plan) {
        await updateAnimationJob(job.jobId, {
          status: 'failed',
          stage: 'failed',
          message: '分镜生成失败，已保留讲解大纲',
          error: msg,
          completedAt: new Date().toISOString(),
          planOutline: { title: err.plan.title, steps: err.plan.steps },
        });
      } else {
        await markAnimationJobFailed(job.jobId, msg);
      }
    }
  });

  return apiSuccess({ jobId: job.jobId });
}
