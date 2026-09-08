/**
 * Slides Job Store — type definitions and pure-disk operations for PPT generation jobs.
 *
 * Follows the same pattern as classroom-job-store.ts.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { writeJsonFileAtomic } from '@/lib/server/classroom-storage';

// ── Types ────────────────────────────────────────────────────────────

export type SlidesJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type PipelineStage =
  | 'planning'
  | 'sections_generating'
  | 'pages_designing'
  | 'merging'
  | 'qa_reviewing'
  | 'repairing'
  | 'done';

export interface QAIssue {
  pageNum: number;
  severity: 'high' | 'medium' | 'low';
  type: string;
  layer: 'structural' | 'content' | 'visual';
  detail: string;
}

export interface QAReport {
  totalScore: number;
  pass: boolean;
  issues: QAIssue[];
}

export interface SlidesJob {
  id: string;
  status: SlidesJobStatus;
  stage: PipelineStage | 'queued' | 'failed';
  progress: number;
  message: string;
  totalPages: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  inputSummary: {
    topic: string;
    difficulty: string;
    styleName: string;
    minPages: number;
    maxPages: number;
  };
  modelConfig?: {
    modelString?: string;
    apiKey?: string;
    baseUrl?: string;
  };
  result?: {
    pptxUrl: string;
    fileName: string;
    previewImages?: string[];
  };
  qaReport?: QAReport;
  error?: string;
}

// ── Storage ──────────────────────────────────────────────────────────

export const SLIDES_JOBS_DIR = path.join(process.cwd(), 'data', 'slides-jobs');

async function ensureSlidesJobsDir() {
  await fs.mkdir(SLIDES_JOBS_DIR, { recursive: true });
}

function jobFilePath(jobId: string) {
  return path.join(SLIDES_JOBS_DIR, `${jobId}.json`);
}

// ── Validation ───────────────────────────────────────────────────────

export function isValidSlidesJobId(jobId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(jobId);
}

// ── Stale Detection ──────────────────────────────────────────────────

const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const TERMINAL_JOB_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

function markStaleIfNeeded(job: SlidesJob): SlidesJob {
  if (job.status !== 'running') return job;
  const updatedAt = new Date(job.updatedAt).getTime();
  if (Date.now() - updatedAt > STALE_JOB_TIMEOUT_MS) {
    return {
      ...job,
      status: 'failed',
      stage: 'failed',
      message: 'Job appears stale (no progress update for 30 minutes)',
      error: 'Stale job: process may have restarted during generation',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return job;
}

// ── Cleanup ──────────────────────────────────────────────────────────

async function cleanupOldSlidesJobs(): Promise<void> {
  try {
    const files = await fs.readdir(SLIDES_JOBS_DIR);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(SLIDES_JOBS_DIR, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const job = JSON.parse(content) as SlidesJob;
        const isTerminal =
          job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled';
        if (!isTerminal) continue;

        const completedAt = job.completedAt ? new Date(job.completedAt).getTime() : 0;
        if (now - completedAt > TERMINAL_JOB_RETENTION_MS) {
          await fs.unlink(filePath);
        }
      } catch {
        // Skip files that can't be read/parsed
      }
    }
  } catch {
    // Directory may not exist yet
  }
}

// ── Mutex ────────────────────────────────────────────────────────────

const jobLocks = new Map<string, Promise<void>>();

async function withJobLock<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
  const prev = jobLocks.get(jobId) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>((r) => {
    resolve = r;
  });
  jobLocks.set(jobId, next);
  try {
    await prev;
    return await fn();
  } finally {
    resolve!();
    if (jobLocks.get(jobId) === next) jobLocks.delete(jobId);
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────

export async function createSlidesJob(
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

  // Lazy cleanup
  cleanupOldSlidesJobs().catch(() => {});

  return job;
}

export async function readSlidesJob(jobId: string): Promise<SlidesJob | null> {
  try {
    const content = await fs.readFile(jobFilePath(jobId), 'utf-8');
    const job = JSON.parse(content) as SlidesJob;
    return markStaleIfNeeded(job);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function updateSlidesJob(
  jobId: string,
  patch: Partial<SlidesJob>,
): Promise<SlidesJob> {
  return withJobLock(jobId, async () => {
    const existing = await readSlidesJob(jobId);
    if (!existing) {
      throw new Error(`Slides job not found: ${jobId}`);
    }

    const updated: SlidesJob = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await writeJsonFileAtomic(jobFilePath(jobId), updated);
    return updated;
  });
}

// ── State Transitions ────────────────────────────────────────────────

export async function markSlidesJobRunning(jobId: string): Promise<SlidesJob> {
  return updateSlidesJob(jobId, {
    status: 'running',
    stage: 'planning',
    startedAt: new Date().toISOString(),
    message: '课件生成已开始',
  });
}

export async function updateSlidesJobProgress(
  jobId: string,
  progress: {
    stage: PipelineStage;
    progress: number;
    message: string;
    totalPages?: number;
  },
): Promise<SlidesJob> {
  return updateSlidesJob(jobId, {
    status: 'running',
    stage: progress.stage,
    progress: progress.progress,
    message: progress.message,
    ...(progress.totalPages !== undefined ? { totalPages: progress.totalPages } : {}),
  });
}

export async function markSlidesJobSucceeded(
  jobId: string,
  result: {
    pptxUrl: string;
    fileName: string;
    previewImages?: string[];
    qaReport?: QAReport;
  },
): Promise<SlidesJob> {
  return updateSlidesJob(jobId, {
    status: 'succeeded',
    stage: 'done',
    progress: 100,
    message: '课件生成完毕',
    completedAt: new Date().toISOString(),
    result,
    qaReport: result.qaReport,
  });
}

export async function markSlidesJobFailed(jobId: string, error: string): Promise<SlidesJob> {
  return updateSlidesJob(jobId, {
    status: 'failed',
    stage: 'failed',
    message: '课件生成失败',
    completedAt: new Date().toISOString(),
    error,
  });
}

export async function markSlidesJobCancelled(jobId: string): Promise<SlidesJob> {
  return updateSlidesJob(jobId, {
    status: 'cancelled',
    stage: 'failed',
    message: '课件生成已取消',
    completedAt: new Date().toISOString(),
    error: '用户取消了生成',
  });
}
