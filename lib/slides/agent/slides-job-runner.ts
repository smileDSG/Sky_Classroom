/**
 * Slides Job Runner — wraps runPipeline with hybrid store persistence.
 *
 * Follows the same pattern as classroom-job-runner.ts.
 */
import { createLogger } from '@/lib/logger';
import { runPipeline, type GenerateOptions } from './pipeline';
import {
  markSlidesJobRunningHybrid,
  markSlidesJobSucceededHybrid,
  markSlidesJobFailedHybrid,
  readSlidesJobHybrid,
  updateSlidesJobProgressHybrid,
  type SlidesJob,
} from './slides-job-store-hybrid';

const log = createLogger('SlidesJobRunner');
const runningJobs = new Map<string, Promise<void>>();

/**
 * Assert that the job has not been cancelled.
 */
async function assertNotCancelled(jobId: string): Promise<void> {
  const job = await readSlidesJobHybrid(jobId);
  if (job?.status === 'cancelled') {
    throw new Error('Job was cancelled');
  }
}

/**
 * Run a slides generation job with hybrid store persistence.
 */
export async function runSlidesGenerationJob(
  jobId: string,
  options: Omit<GenerateOptions, 'jobId'>,
  modelConfig?: { modelString?: string; apiKey?: string; baseUrl?: string },
): Promise<void> {
  // Prevent duplicate runs
  const existing = runningJobs.get(jobId);
  if (existing) return existing;

  const jobPromise = (async () => {
    try {
      await markSlidesJobRunningHybrid(jobId);

      // Run pipeline with progress callback
      await runPipeline({
        ...options,
        jobId,
        onProgress: async (progress) => {
          await assertNotCancelled(jobId);
          await updateSlidesJobProgressHybrid(jobId, progress);
        },
        onComplete: async (result) => {
          await markSlidesJobSucceededHybrid(jobId, result);
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Job was cancelled') {
        log.info(`Slides job ${jobId} was cancelled.`);
      } else {
        log.error(`Slides job ${jobId} failed: ${message}`);
        await markSlidesJobFailedHybrid(jobId, message);
      }
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}

/**
 * Get the count of currently running jobs.
 */
export function getRunningSlidesJobCount(): number {
  return runningJobs.size;
}
