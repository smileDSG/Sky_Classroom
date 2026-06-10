/**
 * Slides Job Store Hybrid — Memory-first with periodic disk persistence.
 *
 * Same pattern as classroom-job-store-hybrid.ts:
 * - In-memory Map for fast reads
 * - Dirty Set + 5s flush timer for batched writes
 * - Terminal states flush immediately
 */
import { promises as fs } from 'fs';
import path from 'path';
import { writeJsonFileAtomic } from '@/lib/server/classroom-storage';
import {
  SLIDES_JOBS_DIR,
  type SlidesJob,
  type SlidesJobStatus,
  type PipelineStage,
  type QAReport,
  isValidSlidesJobId,
} from './slides-job-store';

// Re-export for convenience
export { isValidSlidesJobId, type SlidesJob, type SlidesJobStatus, type PipelineStage, type QAReport };

// ── In-Memory Cache ──────────────────────────────────────────────────

const inMemoryJobs = new Map<string, SlidesJob>();
const dirtyJobs = new Set<string>();
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

const FLUSH_INTERVAL_MS = 5000;

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

export function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

export async function flushAllJobs(): Promise<void> {
  if (dirtyJobs.size === 0) return;
  const toFlush = [...dirtyJobs];
  dirtyJobs.clear();
  for (const jobId of toFlush) {
    const job = inMemoryJobs.get(jobId);
    if (job) {
      await writeJsonFileAtomic(jobFilePath(jobId), job);
    }
  }
}

function jobFilePath(jobId: string) {
  return path.join(SLIDES_JOBS_DIR, `${jobId}.json`);
}

// ── Stale Detection ──────────────────────────────────────────────────

const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function markStaleIfNeeded(job: SlidesJob): SlidesJob {
  if (job.status !== 'running') return job;
  const updatedAt = new Date(job.updatedAt).getTime();
  if (Date.now() - updatedAt > STALE_JOB_TIMEOUT_MS) {
    return {
      ...job,
      status: 'failed' as SlidesJobStatus,
      stage: 'failed',
      message: 'Job appears stale (no progress update for 30 minutes)',
      error: 'Stale job: process may have restarted during generation',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return job;
}

// ── Ensure Directory ─────────────────────────────────────────────────

async function ensureSlidesJobsDir() {
  await fs.mkdir(SLIDES_JOBS_DIR, { recursive: true });
}

// ── Hybrid API ───────────────────────────────────────────────────────

export async function createSlidesJobHybrid(
  jobId: string,
  input: {
    topic: string;
    difficulty: string;
    styleName: string;
    minPages: number;
    maxPages: number;
  },
  modelConfig?: { modelString?: string; apiKey?: string; baseUrl?: string },
): Promise<SlidesJob> {
  const now = new Date().toISOString();
  const job: SlidesJob = {
    id: jobId,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    message: '课件生成任务已排队',
    totalPages: 0,
    createdAt: now,
    updatedAt: now,
    inputSummary: input,
    modelConfig,
  };

  await ensureSlidesJobsDir();
  await writeJsonFileAtomic(jobFilePath(jobId), job);
  inMemoryJobs.set(jobId, job);
  return job;
}

export async function readSlidesJobHybrid(jobId: string): Promise<SlidesJob | null> {
  // Memory first
  const cached = inMemoryJobs.get(jobId);
  if (cached) {
    return markStaleIfNeeded(cached);
  }

  // Fallback to disk
  try {
    const content = await fs.readFile(jobFilePath(jobId), 'utf-8');
    const job = JSON.parse(content) as SlidesJob;
    inMemoryJobs.set(jobId, job);
    return markStaleIfNeeded(job);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function updateSlidesJobHybrid(
  jobId: string,
  patch: Partial<SlidesJob>,
): Promise<SlidesJob> {
  const existing = await readSlidesJobHybrid(jobId);
  if (!existing) {
    throw new Error(`Slides job not found: ${jobId}`);
  }

  const updated: SlidesJob = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  inMemoryJobs.set(jobId, updated);
  dirtyJobs.add(jobId);
  startFlushTimer();

  // Terminal states flush immediately
  if (patch.status === 'succeeded' || patch.status === 'failed' || patch.status === 'cancelled') {
    try {
      await writeJsonFileAtomic(jobFilePath(jobId), updated);
      dirtyJobs.delete(jobId);
    } catch {
      // Will retry on next flush
    }
  }

  return updated;
}

// ── State Transitions ────────────────────────────────────────────────

export async function markSlidesJobRunningHybrid(jobId: string): Promise<SlidesJob> {
  return updateSlidesJobHybrid(jobId, {
    status: 'running',
    stage: 'planning',
    startedAt: new Date().toISOString(),
    message: '课件生成已开始',
  });
}

export async function updateSlidesJobProgressHybrid(
  jobId: string,
  progress: {
    stage: PipelineStage;
    progress: number;
    message: string;
    totalPages?: number;
  },
): Promise<SlidesJob> {
  return updateSlidesJobHybrid(jobId, {
    status: 'running',
    stage: progress.stage,
    progress: progress.progress,
    message: progress.message,
    ...(progress.totalPages !== undefined ? { totalPages: progress.totalPages } : {}),
  });
}

export async function markSlidesJobSucceededHybrid(
  jobId: string,
  result: {
    pptxUrl: string;
    fileName: string;
    previewImages?: string[];
    qaReport?: QAReport;
  },
): Promise<SlidesJob> {
  return updateSlidesJobHybrid(jobId, {
    status: 'succeeded',
    stage: 'done',
    progress: 100,
    message: '课件生成完毕',
    completedAt: new Date().toISOString(),
    result,
    qaReport: result.qaReport,
  });
}

export async function markSlidesJobFailedHybrid(
  jobId: string,
  error: string,
): Promise<SlidesJob> {
  return updateSlidesJobHybrid(jobId, {
    status: 'failed',
    stage: 'failed',
    message: '课件生成失败',
    completedAt: new Date().toISOString(),
    error,
  });
}

export async function markSlidesJobCancelledHybrid(jobId: string): Promise<SlidesJob> {
  return updateSlidesJobHybrid(jobId, {
    status: 'cancelled',
    stage: 'failed',
    message: '课件生成已取消',
    completedAt: new Date().toISOString(),
    error: '用户取消了生成',
  });
}
