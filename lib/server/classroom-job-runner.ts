import { createLogger } from '@/lib/logger';
import {
  generateClassroom,
  generateClassroomContinue,
  type GenerateClassroomInput,
  type OutlineOnlyResult,
} from '@/lib/server/classroom-generation';
import {
  markClassroomGenerationJobFailed,
  markClassroomGenerationJobRunning,
  markClassroomGenerationJobSucceeded,
  markClassroomGenerationJobAwaitingReview,
  markClassroomGenerationJobResumed,
  readClassroomGenerationJob,
  savePhaseOneResult,
  updateClassroomGenerationJobProgressHybrid as updateClassroomGenerationJobProgress,
} from '@/lib/server/classroom-job-store-hybrid';

async function assertNotCancelled(jobId: string): Promise<void> {
  const job = await readClassroomGenerationJob(jobId);
  if (job?.status === 'cancelled') {
    throw new Error('Job was cancelled');
  }
}

const log = createLogger('ClassroomJob');
const runningJobs = new Map<string, Promise<void>>();

export function runClassroomGenerationJob(
  jobId: string,
  input: GenerateClassroomInput,
  baseUrl: string,
): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) {
    return existing;
  }

  const jobPromise = (async () => {
    try {
      await markClassroomGenerationJobRunning(jobId);

      const job = await readClassroomGenerationJob(jobId);
      const modelConfig = job?.modelConfig;

      const result = await generateClassroom(input, {
        baseUrl,
        phase: 'outline_only',
        modelConfig,
        onProgress: async (progress) => {
          await assertNotCancelled(jobId);
          await updateClassroomGenerationJobProgress(jobId, progress);
        },
      }) as OutlineOnlyResult;

      // Persist full Phase 1 state for Phase 2 continuation
      await savePhaseOneResult(jobId, result as unknown as Record<string, unknown>);

      await markClassroomGenerationJobAwaitingReview(
        jobId,
        result.outlines,
        {
          languageDirective: result.languageDirective,
          totalScenes: result.outlines.length,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Job was cancelled') {
        log.info(`Classroom outline job ${jobId} was cancelled.`);
      } else {
        log.error(`Classroom outline job ${jobId} failed:`, error);
        try {
          await markClassroomGenerationJobFailed(jobId, message);
        } catch (markFailedError) {
          log.error(`Failed to persist failed status for job ${jobId}:`, markFailedError);
        }
      }
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}

export async function runClassroomContinueJob(
  jobId: string,
  baseUrl: string,
): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) {
    return existing;
  }

  const jobPromise = (async () => {
    try {
      const job = await readClassroomGenerationJob(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      if (!job.phaseOneResult) {
        throw new Error(`No Phase 1 result saved for job: ${jobId}`);
      }

      const saved = job.phaseOneResult as unknown as OutlineOnlyResult;

      const modelConfig = job.modelConfig;

      await markClassroomGenerationJobResumed(jobId);

      const result = await generateClassroomContinue(saved, {
        baseUrl,
        modelConfig,
        onProgress: async (progress) => {
          await assertNotCancelled(jobId);
          await updateClassroomGenerationJobProgress(jobId, progress);
        },
      });

      await markClassroomGenerationJobSucceeded(jobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Job was cancelled') {
        log.info(`Classroom continue job ${jobId} was cancelled.`);
      } else {
        log.error(`Classroom continue job ${jobId} failed:`, error);
        try {
          await markClassroomGenerationJobFailed(jobId, message);
        } catch (markFailedError) {
          log.error(`Failed to persist failed status for job ${jobId}:`, markFailedError);
        }
      }
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}
