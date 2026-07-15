/**
 * Cloud Mind Quiz Job Runner - executes quiz generation in the background.
 */

import { createLogger } from '@/lib/logger';
import { generateQuiz } from '@/lib/agents/cloud-mind/quiz-agent';
import type { StudentProfile } from '@/lib/student/profile-types';
import { updateCloudMindQuizJob } from './cloud-mind-quiz-job-store';

const log = createLogger('CloudMindQuizJobRunner');

const globalForRunningJobs = globalThis as unknown as {
  _cloudMindQuizRunningJobs: Map<string, Promise<void>> | undefined;
};

const runningJobs: Map<string, Promise<void>> =
  globalForRunningJobs._cloudMindQuizRunningJobs ??
  (globalForRunningJobs._cloudMindQuizRunningJobs = new Map());

export function runCloudMindQuizJob(
  jobId: string,
  input: {
    subject: string;
    difficulty: string;
    topic: string;
    count: number;
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
      );

      updateCloudMindQuizJob(jobId, {
        status: 'completed',
        phase: 'done',
        progress: 100,
        result,
      });

      log.info(`Quiz job ${jobId} completed with ${result.questions.length} questions`);
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
