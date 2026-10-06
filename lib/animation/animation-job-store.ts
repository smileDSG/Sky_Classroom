/**
 * 动画生成 job 的文件式持久化（模式与 lib/slides/agent/slides-job-store.ts 一致）：
 * data/animation-jobs/{jobId}.json，stale 30 分钟、终态保留 24 小时。
 * 测试可通过 ANIMATION_JOBS_DIR 覆盖目录。
 */
import fsp from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';
import { writeJsonFileAtomic } from '@/lib/server/classroom-storage';

const log = createLogger('AnimationJobStore');

export type AnimationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type AnimationJobStage = 'planning' | 'scripting' | 'validating' | 'done' | 'failed';

export interface AnimationJob {
  jobId: string;
  topic: string;
  status: AnimationJobStatus;
  stage: AnimationJobStage;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: { scriptId: string; title: string; stepCount: number };
  error?: string;
  /** script 失败但 plan 成功时保留大纲，前端降级展示（spec §8.1） */
  planOutline?: { title: string; steps: { title: string; intent: string }[] };
}

const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000;
const TERMINAL_JOB_RETENTION_MS = 24 * 60 * 60 * 1000;

function jobsDir(): string {
  return process.env.ANIMATION_JOBS_DIR ?? path.join(process.cwd(), 'data', 'animation-jobs');
}

function jobFilePath(jobId: string): string {
  return path.join(jobsDir(), `${jobId}.json`);
}

export function isValidAnimationJobId(jobId: string): boolean {
  return /^[A-Za-z0-9_-]{6,64}$/.test(jobId);
}

async function markStaleIfNeeded(job: AnimationJob): Promise<AnimationJob> {
  if (job.status !== 'running' && job.status !== 'queued') return job;
  if (Date.now() - new Date(job.updatedAt).getTime() < STALE_JOB_TIMEOUT_MS) return job;
  const stale: AnimationJob = {
    ...job,
    status: 'failed',
    stage: 'failed',
    message: '任务超时（可能因进程重启中断）',
    error: '任务超时（可能因进程重启中断）',
    completedAt: new Date().toISOString(),
  };
  try {
    await writeJsonFileAtomic(jobFilePath(job.jobId), stale);
  } catch (err) {
    log.error('标记 stale 失败', err);
  }
  return stale;
}

async function cleanupTerminalJobs(): Promise<void> {
  try {
    const names = await fsp.readdir(jobsDir());
    const now = Date.now();
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      try {
        const raw = await fsp.readFile(path.join(jobsDir(), name), 'utf-8');
        const job = JSON.parse(raw) as AnimationJob;
        if (
          (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') &&
          job.completedAt &&
          now - new Date(job.completedAt).getTime() > TERMINAL_JOB_RETENTION_MS
        ) {
          await fsp.unlink(path.join(jobsDir(), name));
        }
      } catch {
        // 单个文件损坏不影响清理
      }
    }
  } catch {
    // 目录不存在等
  }
}

export async function createAnimationJob(topic: string): Promise<AnimationJob> {
  const now = new Date().toISOString();
  const job: AnimationJob = {
    jobId: `animjob-${nanoid(12)}`,
    topic,
    status: 'queued',
    stage: 'planning',
    progress: 0,
    message: '排队中',
    createdAt: now,
    updatedAt: now,
  };
  await writeJsonFileAtomic(jobFilePath(job.jobId), job);
  void cleanupTerminalJobs();
  return job;
}

export async function readAnimationJob(jobId: string): Promise<AnimationJob | null> {
  if (!isValidAnimationJobId(jobId)) return null;
  try {
    const raw = await fsp.readFile(jobFilePath(jobId), 'utf-8');
    return await markStaleIfNeeded(JSON.parse(raw) as AnimationJob);
  } catch (error) {
    // ENOENT 是正常的不存在；其他错误（权限/损坏）记录日志以便排查
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.warn(`读取 job 失败（文件可能损坏）: ${jobFilePath(jobId)}`, error);
    }
    return null;
  }
}

export async function updateAnimationJob(
  jobId: string,
  update: Partial<Omit<AnimationJob, 'jobId' | 'createdAt'>>,
): Promise<AnimationJob | null> {
  const job = await readAnimationJob(jobId);
  if (!job) return null;
  const next: AnimationJob = { ...job, ...update, updatedAt: new Date().toISOString() };
  await writeJsonFileAtomic(jobFilePath(jobId), next);
  return next;
}

export async function markAnimationJobRunning(
  jobId: string,
  stage: AnimationJobStage,
): Promise<AnimationJob | null> {
  return updateAnimationJob(jobId, { status: 'running', stage, progress: 5, message: '开始生成' });
}

export async function markAnimationJobSucceeded(
  jobId: string,
  result: { scriptId: string; title: string; stepCount: number },
): Promise<AnimationJob | null> {
  return updateAnimationJob(jobId, {
    status: 'succeeded',
    stage: 'done',
    progress: 100,
    message: '生成完成',
    completedAt: new Date().toISOString(),
    result,
  });
}

export async function markAnimationJobFailed(
  jobId: string,
  error: string,
): Promise<AnimationJob | null> {
  return updateAnimationJob(jobId, {
    status: 'failed',
    stage: 'failed',
    message: '生成失败',
    error,
    completedAt: new Date().toISOString(),
  });
}
