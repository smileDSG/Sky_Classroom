import { promises as fs } from 'fs';
import path from 'path';
import type {
  ClassroomGenerationProgress,
  ClassroomGenerationStep,
  GenerateClassroomInput,
  GenerateClassroomResult,
} from '@/lib/server/classroom-generation';
import {
  CLASSROOM_JOBS_DIR,
  ensureClassroomJobsDir,
  writeJsonFileAtomic,
} from '@/lib/server/classroom-storage';

export type ClassroomGenerationJobStatus =
  | 'initializing'
  | 'running'
  | 'awaiting_review'
  | 'cancelled'
  | 'succeeded'
  | 'failed';

export interface ClassroomGenerationJob {
  id: string;
  /** Owner for API authorization. Legacy jobs may omit this and are inaccessible. */
  userId?: string;
  status: ClassroomGenerationJobStatus;
  step: ClassroomGenerationStep | 'initializing' | 'failed';
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  inputSummary: {
    requirementPreview: string;
    hasPdf: boolean;
    pdfTextLength: number;
    pdfImageCount: number;
  };
  topicSummary?: string;
  scenesGenerated: number;
  totalScenes?: number;
  outlines?: import('@/lib/types/generation').SceneOutline[];
  outlinesMeta?: {
    languageDirective: string;
    totalScenes: number;
  };
  phaseOneResult?: Record<string, unknown>;
  modelConfig?: {
    modelString?: string;
    apiKey?: string;
    baseUrl?: string;
  };
  /** Persisted generation input so we can resume after a process restart/HMR. */
  input?: GenerateClassroomInput;
  result?: {
    classroomId: string;
    url: string;
    scenesCount: number;
  };
  error?: string;
}

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

function jobFilePath(jobId: string) {
  return path.join(CLASSROOM_JOBS_DIR, `${jobId}.json`);
}

function buildInputSummary(input: GenerateClassroomInput): ClassroomGenerationJob['inputSummary'] {
  return {
    requirementPreview:
      input.requirement.length > 200 ? `${input.requirement.slice(0, 197)}...` : input.requirement,
    hasPdf: !!input.pdfContent,
    pdfTextLength: input.pdfContent?.text.length || 0,
    pdfImageCount: input.pdfContent?.images.length || 0,
  };
}

/** Simple per-job mutex to serialize read-modify-write on the same job file. */
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

/** Max age (ms) before a "running" job without an active runner is considered stale. */
const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** Max age (ms) to keep terminal-state job files before cleanup. */
const TERMINAL_JOB_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

async function cleanupOldClassroomJobs(): Promise<void> {
  try {
    const files = await fs.readdir(CLASSROOM_JOBS_DIR);
    const now = Date.now();
    let removed = 0;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(CLASSROOM_JOBS_DIR, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const job = JSON.parse(content) as ClassroomGenerationJob;
        const isTerminal =
          job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled';
        if (!isTerminal) continue;

        const completedAt = job.completedAt ? new Date(job.completedAt).getTime() : 0;
        if (now - completedAt > TERMINAL_JOB_RETENTION_MS) {
          await fs.unlink(filePath);
          removed++;
        }
      } catch {
        // Skip files that can't be read/parsed (corrupt, locked, etc.)
      }
    }

    if (removed > 0) {
      // Logging happens at call site; keep this function quiet
    }
  } catch {
    // Directory may not exist yet
  }
}

function markStaleIfNeeded(job: ClassroomGenerationJob): ClassroomGenerationJob {
  if (job.status !== 'running') return job;
  const updatedAt = new Date(job.updatedAt).getTime();
  if (Date.now() - updatedAt > STALE_JOB_TIMEOUT_MS) {
    return {
      ...job,
      status: 'failed',
      step: 'failed',
      message: 'Job appears stale (no progress update for 30 minutes)',
      error: 'Stale job: process may have restarted during generation',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return job;
}

export function isValidClassroomJobId(jobId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(jobId);
}

export async function createClassroomGenerationJob(
  jobId: string,
  input: GenerateClassroomInput,
  modelConfig?: {
    modelString?: string;
    apiKey?: string;
    baseUrl?: string;
  },
): Promise<ClassroomGenerationJob> {
  const now = new Date().toISOString();
  const job: ClassroomGenerationJob = {
    id: jobId,
    status: 'initializing',
    step: 'initializing',
    progress: 1,
    message: 'Starting classroom generation',
    createdAt: now,
    updatedAt: now,
    inputSummary: buildInputSummary(input),
    scenesGenerated: 0,
    modelConfig: sanitizeModelConfig(modelConfig),
    input: sanitizeInputForPersistence(input),
  };

  await ensureClassroomJobsDir();
  await writeJsonFileAtomic(jobFilePath(jobId), sanitizeJobForPersistence(job));

  // Lazy cleanup: remove terminal jobs older than 24h (don't block)
  cleanupOldClassroomJobs().catch(() => {});

  return job;
}

export async function readClassroomGenerationJob(
  jobId: string,
): Promise<ClassroomGenerationJob | null> {
  try {
    const content = await fs.readFile(jobFilePath(jobId), 'utf-8');
    const job = JSON.parse(content) as ClassroomGenerationJob;
    return markStaleIfNeeded(job);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function updateClassroomGenerationJob(
  jobId: string,
  patch: Partial<ClassroomGenerationJob>,
): Promise<ClassroomGenerationJob> {
  return withJobLock(jobId, async () => {
    const existing = await readClassroomGenerationJob(jobId);
    if (!existing) {
      throw new Error(`Classroom generation job not found: ${jobId}`);
    }

    const safePatch: Partial<ClassroomGenerationJob> = {
      ...patch,
      ...(patch.modelConfig !== undefined ? { modelConfig: sanitizeModelConfig(patch.modelConfig) } : {}),
      ...(patch.input !== undefined ? { input: sanitizeInputForPersistence(patch.input) } : {}),
    };

    const updated: ClassroomGenerationJob = {
      ...existing,
      ...safePatch,
      updatedAt: new Date().toISOString(),
    };

    await writeJsonFileAtomic(jobFilePath(jobId), sanitizeJobForPersistence(updated));
    return updated;
  });
}

export async function markClassroomGenerationJobRunning(
  jobId: string,
): Promise<ClassroomGenerationJob> {
  return withJobLock(jobId, async () => {
    const existing = await readClassroomGenerationJob(jobId);
    if (!existing) {
      throw new Error(`Classroom generation job not found: ${jobId}`);
    }

    const updated: ClassroomGenerationJob = {
      ...existing,
      status: 'running',
      startedAt: existing.startedAt || new Date().toISOString(),
      message: 'Classroom generation started',
      updatedAt: new Date().toISOString(),
    };

    await writeJsonFileAtomic(jobFilePath(jobId), sanitizeJobForPersistence(updated));
    return updated;
  });
}

export async function updateClassroomGenerationJobProgress(
  jobId: string,
  progress: ClassroomGenerationProgress,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJob(jobId, {
    status: 'running',
    step: progress.step,
    progress: progress.progress,
    message: progress.message,
    scenesGenerated: progress.scenesGenerated,
    totalScenes: progress.totalScenes,
  });
}

export async function markClassroomGenerationJobSucceeded(
  jobId: string,
  result: GenerateClassroomResult,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJob(jobId, {
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

export async function markClassroomGenerationJobCancelled(
  jobId: string,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJob(jobId, {
    status: 'cancelled',
    step: 'failed',
    message: '课堂生成已取消',
    completedAt: new Date().toISOString(),
    error: '用户取消了生成',
  });
}

export async function markClassroomGenerationJobFailed(
  jobId: string,
  error: string,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJob(jobId, {
    status: 'failed',
    step: 'failed',
    message: 'Classroom generation failed',
    completedAt: new Date().toISOString(),
    error,
  });
}

export async function markClassroomGenerationJobAwaitingReview(
  jobId: string,
  outlines: import('@/lib/types/generation').SceneOutline[],
  outlinesMeta: { languageDirective: string; totalScenes: number },
  topicSummary?: string,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJob(jobId, {
    status: 'awaiting_review',
    step: 'generating_outlines',
    progress: 30,
    message: '大纲已生成，等待审阅',
    outlines,
    outlinesMeta,
    totalScenes: outlines.length,
    topicSummary,
  });
}

export async function markClassroomGenerationJobResumed(
  jobId: string,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJob(jobId, {
    status: 'running',
    step: 'generating_scenes',
    progress: 30,
    message: '大纲已审阅，继续生成场景',
  });
}

export async function savePhaseOneResult(
  jobId: string,
  result: Record<string, unknown>,
): Promise<ClassroomGenerationJob> {
  return updateClassroomGenerationJob(jobId, { phaseOneResult: result });
}
