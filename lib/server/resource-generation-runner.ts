import { createLogger } from '@/lib/logger';
import { runSoftwareCupGeneration } from '@/lib/software-cup/demo-service';
import {
  markResourceGenerationJobFailedHybrid,
  markResourceGenerationJobRunningHybrid,
  markResourceGenerationJobSucceededHybrid,
  readResourceGenerationJobHybrid,
  updateResourceGenerationJobProgressHybrid,
} from '@/lib/server/resource-generation-job-store';

const log = createLogger('ResourceGenerationJob');
const runningJobs = new Map<string, Promise<void>>();

export interface RunResourceGenerationJobOptions {
  enableLlm?: boolean;
}

export function runResourceGenerationJob(
  jobId: string,
  options: RunResourceGenerationJobOptions = {},
): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) {
    return existing;
  }

  const jobPromise = (async () => {
    try {
      const job = await readResourceGenerationJobHybrid(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }
      if (job.status === 'succeeded' || job.status === 'failed') {
        log.info(`Skipping resource generation for ${jobId}; job is already ${job.status}.`);
        return;
      }

      await markResourceGenerationJobRunningHybrid(jobId);

      const enableLlm = options.enableLlm ?? Boolean(job.userId);
      const result = await runSoftwareCupGeneration(job.input, {
        userId: job.userId,
        enableLlm,
        onProgress: async (progress) => {
          await updateResourceGenerationJobProgressHybrid(
            jobId,
            progress.step,
            progress.progress,
            progress.message,
          );
        },
      });

      await markResourceGenerationJobSucceededHybrid(jobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Resource generation job ${jobId} failed:`, error);
      try {
        await markResourceGenerationJobFailedHybrid(jobId, message);
      } catch (markFailedError) {
        log.error(`Failed to persist failed status for job ${jobId}:`, markFailedError);
      }
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}

/**
 * Resume a resource generation job after a server restart or HMR. Uses the
 * in-memory runningJobs map for idempotency.
 */
export function resumeResourceGenerationJob(
  jobId: string,
  options: RunResourceGenerationJobOptions = {},
): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) return existing;

  const jobPromise = (async () => {
    try {
      const job = await readResourceGenerationJobHybrid(jobId);
      if (!job) {
        log.warn(`Cannot resume resource generation job ${jobId}: job not found`);
        return;
      }
      if (job.status === 'succeeded' || job.status === 'failed') {
        return;
      }
      if (!job.input) {
        log.error(`Cannot resume resource generation job ${jobId}: persisted input is missing`);
        await markResourceGenerationJobFailedHybrid(jobId, '任务输入数据丢失，无法恢复生成');
        return;
      }
      await runResourceGenerationJob(jobId, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to resume resource generation job ${jobId}:`, error);
      try {
        await markResourceGenerationJobFailedHybrid(jobId, message);
      } catch (markFailedError) {
        log.error(`Failed to persist failed status for resumed job ${jobId}:`, markFailedError);
      }
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}
