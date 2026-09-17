/**
 * Cloud Mind Quiz Job Runner - executes quiz generation in the background.
 */

import { createLogger } from '@/lib/logger';
import { generateQuiz, type QuizQuestionType } from '@/lib/agents/cloud-mind/quiz-agent';
import { backfillQuizToQuestionBank } from '@/lib/agents/cloud-mind/quiz-backfill';
import type { StudentProfile } from '@/lib/student/profile-types';
import { updateCloudMindQuizJob } from './cloud-mind-quiz-job-store';

const log = createLogger('CloudMindQuizJobRunner');

const globalForRunningJobs = globalThis as unknown as {
  _cloudMindQuizRunningJobs: Map<string, Promise<void>> | undefined;
};

const runningJobs: Map<string, Promise<void>> = globalForRunningJobs._cloudMindQuizRunningJobs ??
(globalForRunningJobs._cloudMindQuizRunningJobs = new Map());

export function runCloudMindQuizJob(
  jobId: string,
  input: {
    subject: string;
    difficulty: string;
    topic: string;
    count: number;
    questionType?: QuizQuestionType;
    profile?: StudentProfile;
  },
): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) return existing;

  const jobPromise = (async () => {
    try {
      updateCloudMindQuizJob(jobId, { status: 'running', phase: 'preparing', progress: 5 });
      updateCloudMindQuizJob(jobId, { phase: 'retrieving_context', progress: 20 });

      const result = await generateQuiz(
        input.subject,
        input.difficulty,
        input.topic,
        input.count,
        input.profile,
        input.questionType ?? 'choice',
      );

      // 自动回填题库（去重 + 题型标记）；失败不影响出题结果
      let backfill;
      try {
        backfill = await backfillQuizToQuestionBank(result, {
          subject: input.subject,
          difficulty: input.difficulty,
          topic: input.topic,
        });
      } catch (backfillError) {
        log.warn(`Quiz job ${jobId} backfill failed:`, backfillError);
      }

      updateCloudMindQuizJob(jobId, {
        status: 'completed',
        phase: 'done',
        progress: 100,
        result,
        backfill,
      });

      log.info(
        `Quiz job ${jobId} completed with ${result.questions.length} questions` +
          (backfill
            ? ` (backfilled: ${backfill.backfilled}, duplicates: ${backfill.duplicates})`
            : ''),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Quiz job ${jobId} failed:`, error);
      updateCloudMindQuizJob(jobId, {
        status: 'failed',
        phase: 'failed',
        progress: 0,
        error: message,
      });
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}
