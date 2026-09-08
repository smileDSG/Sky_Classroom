/**
 * Hybrid Job Store — Memory-first with periodic disk persistence
 *
 * Solves high-concurrency disk I/O bottleneck by keeping job state in memory
 * and flushing to disk every 5 seconds. This reduces disk writes from
 * ~25/sec (50 concurrent jobs) to ~10/5sec.
 *
 * Trade-off: at most 5 seconds of progress updates may be lost on process crash.
 * Completed jobs are flushed immediately and never lost.
 */

import type {
  ClassroomGenerationJob,
  ClassroomGenerationJobStatus,
} from '@/lib/server/classroom-job-store';
import type {
  ClassroomGenerationProgress,
  GenerateClassroomInput,
  GenerateClassroomResult,
} from '@/lib/server/classroom-generation';
import {
  CLASSROOM_JOBS_DIR,
  ensureClassroomJobsDir,
  writeJsonFileAtomic,
} from '@/lib/server/classroom-storage';
import { promises as fs } from 'fs';
import path from 'path';

// In-memory cache
const inMemoryJobs = new Map<string, ClassroomGenerationJob>();
const dirtyJobs = new Set<string>();
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

const FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
const TERMINAL_STATUSES: ClassroomGenerationJobStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
  'awaiting_review',
];

type RuntimeModelConfig = NonNullable<ClassroomGenerationJob['modelConfig']>;

function sanitizeModelConfig(
  modelConfig: RuntimeModelConfig | undefined,
): ClassroomGenerationJob['modelConfig'] | undefined {
  const modelString = modelConfig?.modelString?.trim();
  return modelString ? { modelString } : undefined;
}

function sanitizeInputForPersistence(input: GenerateClassroomInput): GenerateClassroomInput {
  const { webSearchApiKey: _webSearchApiKey, ...safeInput } = input;
  return safeInput;
}

function sanitizeJobForPersistence(job: ClassroomGenerationJob): ClassroomGenerationJob {
  return {
    ...job,
    modelConfig: sanitizeModelConfig(job.modelConfig),
    input: job.input ? sanitizeInputForPersistence(job.input) : undefined,
  };
}

/** Start the background flush timer if not already running. */
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
          await writeJsonFileAtomic(jobFilePath(jobId), sanitizeJobForPersistence(job));
        } catch {
          // Mark as dirty again to retry on next flush
          dirtyJobs.add(jobId);
        }
      }
    }
    isFlushing = false;
  }, FLUSH_INTERVAL_MS);
}

/** Stop the flush timer (for graceful shutdown). */
export function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/** Force immediate flush of all dirty jobs. */
export async function flushAllJobs(): Promise<void> {
  if (dirtyJobs.size === 0) return;
  const toFlush = [...dirtyJobs];
  dirtyJobs.clear();
  for (const jobId of toFlush) {
    const job = inMemoryJobs.get(jobId);
    if (job) {
      await writeJsonFileAtomic(jobFilePath(jobId), sanitizeJobForPersistence(job));
    }
  }
}

function jobFilePath(jobId: string) {
  return path.join(CLASSROOM_JOBS_DIR, `${jobId}.json`);
}

async function readJobFromDisk(jobId: string): Promise<ClassroomGenerationJob | null> {
  try {
    const content = await fs.readFile(jobFilePath(jobId), 'utf-8');
    return JSON.parse(content) as ClassroomGenerationJob;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function isDiskJobNewerOrMoreComplete(
  cached: ClassroomGenerationJob,
  disk: ClassroomGenerationJob,
): boolean {
  if (disk.id !== cached.id) return false;
  if (new Date(disk.updatedAt).getTime() > new Date(cached.updatedAt).getTime()) return true;
  if (TERMINAL_STATUSES.includes(disk.status) && disk.status !== cached.status) return true;
  return disk.progress > cached.progress;
}

/** Mark stale jobs as failed if no progress for 30 min. */
function markStaleIfNeeded(job: ClassroomGenerationJob): ClassroomGenerationJob {
  if (job.status !== 'running') return job;
  const updatedAt = new Date(job.updatedAt).getTime();
  if (Date.now() - updatedAt > 30 * 60 * 1000) {
    return {
      ...job,
      status: 'failed' as ClassroomGenerationJobStatus,
      step: 'failed',
      message: 'Job appears stale (no progress update for 30 minutes)',
      error: 'Stale job: process may have restarted during generation',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return job;
}

// ========== Hybrid API ==========

export async function createClassroomGenerationJobHybrid(
  jobId: string,
  input: GenerateClassroomInput,
  userIdOrModelConfig?:
    | string
    | {
        modelString?: string;
        apiKey?: string;
        baseUrl?: string;
      },
  modelConfig?: {
    modelString?: string;
    apiKey?: string;
    baseUrl?: string;
  },
): Promise<ClassroomGenerationJob> {
  const userId =
    typeof userIdOrModelConfig === 'string' ? userIdOrModelConfig : 'legacy-unowned-job';
  const resolvedModelConfig =
    typeof userIdOrModelConfig === 'string' ? modelConfig : userIdOrModelConfig;
  const now = new Date().toISOString();
  const job: ClassroomGenerationJob = {
    id: jobId,
    userId,
    status: 'initializing',
    step: 'initializing',
    progress: 1,
    message: 'Starting classroom generation',
    createdAt: now,
    updatedAt: now,
    inputSummary: {
      requirementPreview:
        input.requirement.length > 200
          ? `${input.requirement.slice(0, 197)}...`
          : input.requirement,
      hasPdf: !!input.pdfContent,
      pdfTextLength: input.pdfContent?.text.length || 0,
      pdfImageCount: input.pdfContent?.images.length || 0,
    },
    scenesGenerated: 0,
    modelConfig: sanitizeModelConfig(resolvedModelConfig),
    input: sanitizeInputForPersistence(input),
  };

  await ensureClassroomJobsDir();
  await writeJsonFileAtomic(jobFilePath(jobId), sanitizeJobForPersistence(job));
  inMemoryJobs.set(jobId, job);
  return job;
}

export async function readClassroomGenerationJobHybrid(
  jobId: string,
): Promise<ClassroomGenerationJob | null> {
  // Check memory first
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

  // Fallback to disk
  const job = await readJobFromDisk(jobId);
  if (!job) return null;
  // Load into memory for future reads
  inMemoryJobs.set(jobId, job);
  return markStaleIfNeeded(job);
}

export async function updateClassroomGenerationJobHybrid(
  jobId: string,
  patch: Partial<ClassroomGenerationJob>,
): Promise<ClassroomGenerationJob> {
  const existing = await readClassroomGenerationJobHybrid(jobId);
  if (!existing) {
    throw new Error(`Classroom generation job not found: ${jobId}`);
  }

  const safePatch: Partial<ClassroomGenerationJob> = {
    ...patch,
    ...(patch.modelConfig !== undefined
      ? { modelConfig: sanitizeModelConfig(patch.modelConfig) }
      : {}),
    ...(patch.input !== undefined ? { input: sanitizeInputForPersistence(patch.input) } : {}),
  };

  const updated: ClassroomGenerationJob = {
    ...existing,
    ...safePatch,
    updatedAt: new Date().toISOString(),
  };

  inMemoryJobs.set(jobId, updated);
  dirtyJobs.add(jobId);
  startFlushTimer();

  // If terminal state, flush immediately
  if (
    patch.status === 'succeeded' ||
    patch.status === 'failed' ||
    patch.status === 'cancelled' ||
    patch.startedAt
  ) {
    try {
      await writeJsonFileAtomic(jobFilePath(jobId), sanitizeJobForPersistence(updated));
      dirtyJobs.delete(jobId);
    } catch {
      // Will retry on next flush
    }
  }

  return updated;
}

export async function markClassroomGenerationJobRunningHybrid(
  jobId: string,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJobHybrid(jobId, {
    status: 'running',
    startedAt: new Date().toISOString(),
    message: 'Classroom generation started',
  });
}

export async function updateClassroomGenerationJobProgressHybrid(
  jobId: string,
  progress: ClassroomGenerationProgress,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJobHybrid(jobId, {
    status: 'running',
    step: progress.step,
    progress: progress.progress,
    message: progress.message,
    scenesGenerated: progress.scenesGenerated,
    totalScenes: progress.totalScenes,
  });
}

export async function markClassroomGenerationJobSucceededHybrid(
  jobId: string,
  result: GenerateClassroomResult,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJobHybrid(jobId, {
    status: 'succeeded',
    step: 'completed',
    progress: 100,
    message: 'Classroom generation completed',
    completedAt: new Date().toISOString(),
    scenesGenerated: result.scenesCount,
    result: {
      classroomId: result.id,
      url: result.url,
      scenesCount: result.scenesCount,
    },
  });
}

export async function markClassroomGenerationJobCancelledHybrid(
  jobId: string,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJobHybrid(jobId, {
    status: 'cancelled',
    step: 'failed',
    message: '课堂生成已取消',
    completedAt: new Date().toISOString(),
    error: '用户取消了生成',
  });
}

export async function markClassroomGenerationJobFailedHybrid(
  jobId: string,
  error: string,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJobHybrid(jobId, {
    status: 'failed',
    step: 'failed',
    message: 'Classroom generation failed',
    completedAt: new Date().toISOString(),
    error,
  });
}

export async function markClassroomGenerationJobAwaitingReviewHybrid(
  jobId: string,
  outlines: import('@/lib/types/generation').SceneOutline[],
  outlinesMeta: { languageDirective: string; totalScenes: number },
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJobHybrid(jobId, {
    status: 'awaiting_review',
    step: 'generating_outlines',
    progress: 30,
    message: '大纲已生成，等待审阅',
    outlines,
    outlinesMeta,
    totalScenes: outlines.length,
  });
}

export async function markClassroomGenerationJobResumedHybrid(
  jobId: string,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJobHybrid(jobId, {
    status: 'running',
    step: 'generating_scenes',
    progress: 30,
    message: '大纲已审阅，继续生成场景',
  });
}

export async function savePhaseOneResultHybrid(
  jobId: string,
  result: Record<string, unknown>,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJobHybrid(jobId, { phaseOneResult: result });
}

export function isValidClassroomJobId(jobId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(jobId);
}

/**
 * List a user's classroom generation jobs, newest first. Uses the in-memory
 * cache as the source of truth for jobs touched by this process (fresher than
 * the 5s disk flush) and falls back to disk for the rest. Legacy jobs without
 * a userId are excluded.
 */
export async function listClassroomGenerationJobsHybrid(
  userId: string,
  opts?: { limit?: number },
): Promise<ClassroomGenerationJob[]> {
  const limit = opts?.limit ?? 50;
  const jobs: ClassroomGenerationJob[] = [];

  let fileNames: string[] = [];
  try {
    fileNames = await fs.readdir(CLASSROOM_JOBS_DIR);
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
  ).filter((job): job is ClassroomGenerationJob => job !== null);

  for (const diskJob of candidates) {
    // In-memory is always at least as fresh as disk within this process.
    const job = inMemoryJobs.get(diskJob.id) ?? diskJob;
    if (job.userId !== userId) continue;
    jobs.push(markStaleIfNeeded(job));
  }

  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return jobs.slice(0, limit);
}
