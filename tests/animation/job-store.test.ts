// 说明：store 通过 path.join(process.cwd(), 'data', 'animation-jobs') 定位目录，
// 并优先读环境变量 ANIMATION_JOBS_DIR / ANIMATION_SCRIPTS_DIR —— 测试用它指向临时目录。
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, promises as fsp } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createAnimationJob,
  readAnimationJob,
  markAnimationJobRunning,
  updateAnimationJob,
  markAnimationJobSucceeded,
} from '@/lib/animation/animation-job-store';

describe('animation job store', () => {
  beforeEach(() => {
    process.env.ANIMATION_JOBS_DIR = mkdtempSync(join(tmpdir(), 'anim-jobs-'));
  });

  it('创建 → running → succeeded 全生命周期', async () => {
    const job = await createAnimationJob('二叉堆');
    expect(job.status).toBe('queued');

    await markAnimationJobRunning(job.jobId, 'planning');
    let read = await readAnimationJob(job.jobId);
    expect(read?.status).toBe('running');
    expect(read?.stage).toBe('planning');

    await updateAnimationJob(job.jobId, { stage: 'scripting', progress: 40, message: '编写分镜' });
    read = await readAnimationJob(job.jobId);
    expect(read?.progress).toBe(40);

    await markAnimationJobSucceeded(job.jobId, { scriptId: 'anim-1', title: 't', stepCount: 8 });
    read = await readAnimationJob(job.jobId);
    expect(read?.status).toBe('succeeded');
    expect(read?.result?.scriptId).toBe('anim-1');
  });

  it('failed 记录错误，planOutline 可随 job 保存（spec §8.1 降级）', async () => {
    const job = await createAnimationJob('快排');
    await updateAnimationJob(job.jobId, {
      status: 'failed',
      stage: 'failed',
      message: '分镜生成失败，已保留讲解大纲',
      error: 'LLM 超时',
      planOutline: {
        title: '快排大纲',
        steps: [{ title: '建堆', intent: '介绍初始数组' }],
      },
    });
    const read = await readAnimationJob(job.jobId);
    expect(read?.status).toBe('failed');
    expect(read?.error).toBe('LLM 超时');
    expect(read?.planOutline?.steps).toHaveLength(1);
  });

  it('非法 job id 读取返回 null', async () => {
    expect(await readAnimationJob('../etc')).toBeNull();
  });

  it('超过 30 分钟无更新的任务读取时被标记为 stale 失败', async () => {
    const job = await createAnimationJob('归并排序');
    const jobPath = join(process.env.ANIMATION_JOBS_DIR ?? '', `${job.jobId}.json`);
    const raw = JSON.parse(await fsp.readFile(jobPath, 'utf-8')) as { updatedAt: string };
    raw.updatedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    await fsp.writeFile(jobPath, JSON.stringify(raw));

    const read = await readAnimationJob(job.jobId);
    expect(read?.status).toBe('failed');
    expect(read?.message).toBe('任务超时（可能因进程重启中断）');
    expect(read?.completedAt).toBeTruthy();
  });
});
