/**
 * Slides Job Runner — wraps runPipeline with hybrid store persistence.
 *
 * Follows the same pattern as classroom-job-runner.ts.
 */
import { createLogger } from '@/lib/logger';
import { getJob, runPipeline, type GenerateOptions, type JobState } from './pipeline';
import {
  markSlidesJobRunningHybrid,
  markSlidesJobSucceededHybrid,
  markSlidesJobFailedHybrid,
  readSlidesJobHybrid,
  type QAReport,
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

function normalizeQAReport(report: JobState['qaReport']): QAReport | undefined {
  if (!report) return undefined;
  return {
    totalScore: report.totalScore,
    pass: report.pass,
    issues: report.issues.map((issue) => ({
      pageNum: issue.pageNum,
      severity: issue.severity === 'high' || issue.severity === 'medium' ? issue.severity : 'low',
      type: issue.type,
      layer:
        issue.layer === 'structural' || issue.layer === 'content' || issue.layer === 'visual'
          ? issue.layer
          : 'content',
      detail: issue.detail,
    })),
  };
}

/**
 * Run a slides generation job with hybrid store persistence.
 */
export async function runSlidesGenerationJob(
  jobId: string,
  options: Omit<GenerateOptions, 'jobId'>,
  _modelConfig?: { modelString?: string; apiKey?: string; baseUrl?: string },
): Promise<void> {
  // Prevent duplicate runs
  const existing = runningJobs.get(jobId);
  if (existing) return existing;

  const jobPromise = (async () => {
    try {
      await markSlidesJobRunningHybrid(jobId);

      await assertNotCancelled(jobId);
      await runPipeline({
        ...options,
        jobId,
      });

      await assertNotCancelled(jobId);
      const pipelineJob = getJob(jobId);
      if (!pipelineJob?.pptxUrl || !pipelineJob.fileName) {
        throw new Error('Slides pipeline finished without an exported PPTX result');
      }

      await markSlidesJobSucceededHybrid(jobId, {
        pptxUrl: pipelineJob.pptxUrl,
        fileName: pipelineJob.fileName,
        ...(pipelineJob.previewImages ? { previewImages: pipelineJob.previewImages } : {}),
        ...(pipelineJob.qaReport ? { qaReport: normalizeQAReport(pipelineJob.qaReport) } : {}),
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
