import { createLogger } from '@/lib/logger';
import {
  generateClassroom,
  generateClassroomContinue,
  type GenerateClassroomInput,
  type OutlineOnlyResult,
} from '@/lib/server/classroom-generation';
import {
  markClassroomGenerationJobFailedHybrid,
  markClassroomGenerationJobRunningHybrid,
  markClassroomGenerationJobSucceededHybrid,
  markClassroomGenerationJobAwaitingReviewHybrid,
  markClassroomGenerationJobResumedHybrid,
  readClassroomGenerationJobHybrid,
  savePhaseOneResultHybrid,
  updateClassroomGenerationJobProgressHybrid as updateClassroomGenerationJobProgress,
} from '@/lib/server/classroom-job-store-hybrid';

async function assertNotCancelled(jobId: string): Promise<void> {
  const job = await readClassroomGenerationJobHybrid(jobId);
  if (job?.status === 'cancelled') {
    throw new Error('Job was cancelled');
  }
}

const log = createLogger('ClassroomJob');
const runningJobs = new Map<string, Promise<void>>();
const CLASSROOM_KB_SEARCH_TIMEOUT_MS = 2000;
const KB_SEARCH_TIMEOUT = Symbol('KB_SEARCH_TIMEOUT');

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | typeof KB_SEARCH_TIMEOUT> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<typeof KB_SEARCH_TIMEOUT>((resolve) => {
        timeout = setTimeout(() => resolve(KB_SEARCH_TIMEOUT), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

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
      await markClassroomGenerationJobRunningHybrid(jobId);

      const job = await readClassroomGenerationJobHybrid(jobId);
      const modelConfig = job?.modelConfig;

      // Search classroom KB for similar templates
      let kbContext = '';
      try {
        await assertNotCancelled(jobId);
        await updateClassroomGenerationJobProgress(jobId, {
          step: 'initializing',
          progress: 3,
          message: 'Loading classroom references',
          scenesGenerated: 0,
        });

        const { search } = await import('@/lib/knowledge-base/kb-manager');
        const kbResults = await withTimeout(
          search({
            kbType: 'classroom',
            query: input.requirement,
            topK: 2,
            threshold: 0.05,
            verifiedOnly: true,
          }),
          CLASSROOM_KB_SEARCH_TIMEOUT_MS,
        );
        if (kbResults === KB_SEARCH_TIMEOUT) {
          log.warn(
            `Classroom KB search timed out after ${CLASSROOM_KB_SEARCH_TIMEOUT_MS}ms for job ${jobId}; continuing without references.`,
          );
        } else if (kbResults.length > 0) {
          const refs = kbResults.map((r) => r.chunk.content).join('\n---\n');
          kbContext = `\n\n【参考已有课堂模板】\n${refs}`;
          log.info(`Classroom KB retrieved ${kbResults.length} references for job ${jobId}`);
        }
        await assertNotCancelled(jobId);
        await updateClassroomGenerationJobProgress(jobId, {
          step: 'initializing',
          progress: 4,
          message: 'Preparing classroom generation',
          scenesGenerated: 0,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'Job was cancelled') {
          throw error;
        }
        // ignore KB search errors
      }

      const enrichedInput = kbContext
        ? { ...input, requirement: input.requirement + kbContext }
        : input;

      const result = (await generateClassroom(enrichedInput, {
        baseUrl,
        phase: 'outline_only',
        modelConfig,
        onProgress: async (progress) => {
          await assertNotCancelled(jobId);
          await updateClassroomGenerationJobProgress(jobId, progress);
        },
      })) as OutlineOnlyResult;

      // Persist full Phase 1 state for Phase 2 continuation
      await savePhaseOneResultHybrid(jobId, result as unknown as Record<string, unknown>);

      await markClassroomGenerationJobAwaitingReviewHybrid(jobId, result.outlines, {
        languageDirective: result.languageDirective,
        totalScenes: result.outlines.length,
      });
      // Set topicSummary separately
      if (result.topicSummary) {
        const { updateClassroomGenerationJobHybrid } =
          await import('@/lib/server/classroom-job-store-hybrid');
        await updateClassroomGenerationJobHybrid(jobId, { topicSummary: result.topicSummary });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Job was cancelled') {
        log.info(`Classroom outline job ${jobId} was cancelled.`);
      } else {
        log.error(`Classroom outline job ${jobId} failed:`, error);
        try {
          await markClassroomGenerationJobFailedHybrid(jobId, message);
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

export async function runClassroomContinueJob(jobId: string, baseUrl: string): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) {
    return existing;
  }

  const jobPromise = (async () => {
    try {
      const job = await readClassroomGenerationJobHybrid(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      if (!job.phaseOneResult) {
        throw new Error(`No Phase 1 result saved for job: ${jobId}`);
      }

      const saved = job.phaseOneResult as unknown as OutlineOnlyResult;

      const modelConfig = job.modelConfig;

      await markClassroomGenerationJobResumedHybrid(jobId);

      const result = await generateClassroomContinue(saved, {
        baseUrl,
        modelConfig,
        onProgress: async (progress) => {
          await assertNotCancelled(jobId);
          await updateClassroomGenerationJobProgress(jobId, progress);
        },
      });

      await markClassroomGenerationJobSucceededHybrid(jobId, result);

      // Save to classroom knowledge base (fire and forget)
      try {
        const { write } = await import('@/lib/knowledge-base/kb-manager');
        const kbContent = JSON.stringify({
          requirement: job.inputSummary?.requirementPreview || '',
          topicSummary: job.topicSummary || '',
          outlines: job.outlines || [],
          sceneCount: result?.scenesCount || 0,
        });
        write({
          kbType: 'classroom',
          title: `课堂: ${(job.inputSummary?.requirementPreview || '未知主题').slice(0, 60)}`,
          content: kbContent,
          tags: ['classroom'],
          sourceId: jobId,
          verified: true,
        }).catch((e) => log.warn('KB save failed:', e));
      } catch {
        // ignore KB save errors
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Job was cancelled') {
        log.info(`Classroom continue job ${jobId} was cancelled.`);
      } else {
        log.error(`Classroom continue job ${jobId} failed:`, error);
        try {
          await markClassroomGenerationJobFailedHybrid(jobId, message);
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
