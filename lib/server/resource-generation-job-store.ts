/**
 * Resource generation Job Store — memory-first with periodic disk persistence.
 * Mirrors the classroom generation job store pattern for course-studio
 * resource generation so the heavy LLM step can run in the background.
 */
import { promises as fs } from 'fs';
import path from 'path';

import { writeJsonFileAtomic } from '@/lib/server/classroom-storage';
import type { SoftwareCupGenerationResult } from '@/lib/software-cup/demo-service';

export const RESOURCE_JOBS_DIR = path.join(process.cwd(), 'data', 'resource-jobs');

export type ResourceGenerationJobStatus = 'initializing' | 'running' | 'succeeded' | 'failed';

export type ResourceGenerationStep =
  | 'initializing'
  | 'safety'
  | 'profile'
  | 'search'
  | 'generate'
  | 'review'
  | 'path'
  | 'completed'
  | 'failed';

export interface ResourceGenerationJob {
  id: string;
  userId?: string;
  status: ResourceGenerationJobStatus;
  step: ResourceGenerationStep;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  input: string;
  inputPreview: string;
  result?: SoftwareCupGenerationResult;
  error?: string;
}

// In-memory cache
const inMemoryJobs = new Map<string, ResourceGenerationJob>();
const dirtyJobs = new Set<string>();
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

const FLUSH_INTERVAL_MS = 5000;
const TERMINAL_STATUSES: ResourceGenerationJobStatus[] = ['succeeded', 'failed'];

function buildInputPreview(input: string): string {
  const singleLine = input.replace(/\s+/g, ' ').trim();
  return singleLine.length > 200 ? `${singleLine.slice(0, 197)}...` : singleLine;
}

async function ensureResourceJobsDir() {
  await fs.mkdir(RESOURCE_JOBS_DIR, { recursive: true });
}

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(async () => {
    if (isFlushing || dirtyJobs.size === 0) return;
    isFlushing = true;
    const toFlush = [...dirtyJobs];
    dirtyJobs.clear();
    for (const jobId of toFlush) {
      const job = inMemoryJobs.get(jobId);
      if (job) {
        try {
          await writeJsonFileAtomic(jobFilePath(jobId), job);
        } catch {
          dirtyJobs.add(jobId);
        }
      }
    }
    isFlushing = false;
  }, FLUSH_INTERVAL_MS);
}

function jobFilePath(jobId: string) {
  return path.join(RESOURCE_JOBS_DIR, `${jobId}.json`);
}

async function readJobFromDisk(jobId: string): Promise<ResourceGenerationJob | null> {
  try {
    const content = await fs.readFile(jobFilePath(jobId), 'utf-8');
    return JSON.parse(content) as ResourceGenerationJob;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function isDiskJobNewerOrMoreComplete(
  cached: ResourceGenerationJob,
  disk: ResourceGenerationJob,
): boolean {
  if (disk.id !== cached.id) return false;
  if (new Date(disk.updatedAt).getTime() > new Date(cached.updatedAt).getTime()) return true;
  if (TERMINAL_STATUSES.includes(disk.status) && disk.status !== cached.status) return true;
  return disk.progress > cached.progress;
}

function markStaleIfNeeded(job: ResourceGenerationJob): ResourceGenerationJob {
  if (job.status !== 'running') return job;
  const updatedAt = new Date(job.updatedAt).getTime();
  if (Date.now() - updatedAt > 30 * 60 * 1000) {
    return {
      ...job,
      status: 'failed',
      step: 'failed',
      message: '任务长时间无进展，已标记为失败',
      error: '任务超时：进程可能在生成期间重启',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return job;
}

// ========== Hybrid API ==========

export async function createResourceGenerationJobHybrid(
  jobId: string,
  input: string,
  userId?: string,
): Promise<ResourceGenerationJob> {
  const now = new Date().toISOString();
  const job: ResourceGenerationJob = {
    id: jobId,
    userId,
    status: 'initializing',
    step: 'initializing',
    progress: 3,
    message: '准备生成学习资料',
    createdAt: now,
    updatedAt: now,
    input,
    inputPreview: buildInputPreview(input),
  };

  await ensureResourceJobsDir();
  await writeJsonFileAtomic(jobFilePath(jobId), job);
  inMemoryJobs.set(jobId, job);
  return job;
}

export async function readResourceGenerationJobHybrid(
  jobId: string,
): Promise<ResourceGenerationJob | null> {
  const cached = inMemoryJobs.get(jobId);
  if (cached) {
    if (!TERMINAL_STATUSES.includes(cached.status)) {
      const diskJob = await readJobFromDisk(jobId);
      if (diskJob && isDiskJobNewerOrMoreComplete(cached, diskJob)) {
        inMemoryJobs.set(jobId, diskJob);
        return markStaleIfNeeded(diskJob);
      }
    }
    return markStaleIfNeeded(cached);
  }

  const job = await readJobFromDisk(jobId);
  if (!job) return null;
  inMemoryJobs.set(jobId, job);
  return markStaleIfNeeded(job);
}

export async function updateResourceGenerationJobHybrid(
  jobId: string,
  patch: Partial<ResourceGenerationJob>,
): Promise<ResourceGenerationJob> {
  const existing = await readResourceGenerationJobHybrid(jobId);
  if (!existing) {
    throw new Error(`Resource generation job not found: ${jobId}`);
  }

  const updated: ResourceGenerationJob = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  inMemoryJobs.set(jobId, updated);
  dirtyJobs.add(jobId);
  startFlushTimer();

  if (
    patch.status === 'succeeded' ||
    patch.status === 'failed' ||
    patch.startedAt ||
    (patch.status === 'running' && patch.progress !== undefined && patch.progress >= 100)
  ) {
    try {
      await writeJsonFileAtomic(jobFilePath(jobId), updated);
      dirtyJobs.delete(jobId);
    } catch {
      // Will retry on next flush
    }
  }

  return updated;
}

export async function markResourceGenerationJobRunningHybrid(
  jobId: string,
): Promise<ResourceGenerationJob> {
  return updateResourceGenerationJobHybrid(jobId, {
    status: 'running',
    startedAt: new Date().toISOString(),
    message: '开始生成学习资料',
  });
}

export async function updateResourceGenerationJobProgressHybrid(
  jobId: string,
  step: ResourceGenerationStep,
  progress: number,
  message: string,
): Promise<ResourceGenerationJob> {
  return updateResourceGenerationJobHybrid(jobId, {
    status: 'running',
    step,
    progress,
    message,
  });
}

export async function markResourceGenerationJobSucceededHybrid(
  jobId: string,
  result: SoftwareCupGenerationResult,
): Promise<ResourceGenerationJob> {
  return updateResourceGenerationJobHybrid(jobId, {
    status: 'succeeded',
    step: 'completed',
    progress: 100,
    message: '学习资料已生成完成',
    completedAt: new Date().toISOString(),
    result,
  });
}

export async function markResourceGenerationJobFailedHybrid(
  jobId: string,
  error: string,
): Promise<ResourceGenerationJob> {
  return updateResourceGenerationJobHybrid(jobId, {
    status: 'failed',
    step: 'failed',
    message: '学习资料生成失败',
    completedAt: new Date().toISOString(),
    error,
  });
}

export function isValidResourceJobId(jobId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(jobId);
}

export async function listResourceGenerationJobsHybrid(
  userId: string,
  opts?: { limit?: number },
): Promise<ResourceGenerationJob[]> {
  const limit = opts?.limit ?? 50;
  const jobs: ResourceGenerationJob[] = [];

  let fileNames: string[] = [];
  try {
    fileNames = await fs.readdir(RESOURCE_JOBS_DIR);
  } catch {
    return jobs;
  }

  const candidates = (
    await Promise.all(
      fileNames
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const id = f.slice(0, -'.json'.length);
          try {
            return await readJobFromDisk(id);
          } catch {
            return null;
          }
        }),
    )
  ).filter((job): job is ResourceGenerationJob => job !== null);

  for (const diskJob of candidates) {
    const job = inMemoryJobs.get(diskJob.id) ?? diskJob;
    if (!job.userId || job.userId !== userId) continue;
    jobs.push(markStaleIfNeeded(job));
  }

  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return jobs.slice(0, limit);
}
