/**
 * Teaching Job Runner — background execution engine for AI teaching.
 *
 * Runs lesson plan generation + content generation in the background,
 * updating job progress as each section completes.
 */

import { createLogger } from '@/lib/logger';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { planLesson } from '@/lib/teaching/lesson-planner';
import { generateSectionContent } from '@/lib/teaching/content-generator';
import type { GeneratedSectionData } from './teaching-job-store';
import {
  readTeachingJob,
  markTeachingJobRunning,
  markTeachingJobSucceeded,
  markTeachingJobFailed,
  updateTeachingJobProgress,
} from './teaching-job-store';

const log = createLogger('TeachingJobRunner');

const runningJobs = new Map<string, Promise<void>>();

async function assertNotCancelled(jobId: string): Promise<void> {
  const job = await readTeachingJob(jobId);
  if (job?.status === 'cancelled') {
    throw new Error('Job was cancelled');
  }
}

/**
 * Run a teaching job: plan lesson → generate content section by section.
 * Each completed section is persisted to the job store immediately.
 */
export function runTeachingJob(
  jobId: string,
  topic: string,
  userId: string,
): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) return existing;

  const jobPromise = (async () => {
    try {
      await markTeachingJobRunning(jobId);

      // Phase 1: Build student profile & plan lesson
      log.info(`[${jobId}] Building student profile for ${userId}`);
      const profile = await buildStudentProfile(userId);

      await assertNotCancelled(jobId);
      await updateTeachingJobProgress(jobId, {
        step: 'planning',
        progress: 5,
        message: '正在根据学情生成教案计划...',
      });

      log.info(`[${jobId}] Planning lesson for topic: ${topic}`);
      const plan = await planLesson(profile, topic);

      await assertNotCancelled(jobId);
      const totalSections = plan.sections.length;
      await updateTeachingJobProgress(jobId, {
        step: 'generating_content',
        progress: 10,
        message: `教案计划已生成，共 ${totalSections} 个章节，开始生成内容...`,
        plan,
        totalSections,
        sectionsCompleted: 0,
      });

      // Phase 2: Generate content for each section
      for (let i = 0; i < plan.sections.length; i++) {
        await assertNotCancelled(jobId);

        const section = plan.sections[i];
        const sectionProgress = Math.round(10 + (i / totalSections) * 85);

        await updateTeachingJobProgress(jobId, {
          step: 'generating_content',
          progress: sectionProgress,
          message: `正在生成第 ${i + 1}/${totalSections} 章节：${section.title}`,
          sectionsCompleted: i,
        });

        log.info(`[${jobId}] Generating content for section ${i + 1}/${totalSections}: ${section.title}`);
        const chunks = await generateSectionContent(section);

        await assertNotCancelled(jobId);

        const sectionData: GeneratedSectionData = { section, chunks };
        await updateTeachingJobProgress(jobId, {
          step: 'generating_content',
          progress: Math.round(10 + ((i + 1) / totalSections) * 85),
          message: `第 ${i + 1}/${totalSections} 章节完成：${section.title}`,
          sectionsCompleted: i + 1,
          section: sectionData,
        });
      }

      // Done
      await markTeachingJobSucceeded(jobId);
      log.info(`[${jobId}] Teaching job completed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Job was cancelled') {
        log.info(`[${jobId}] Teaching job was cancelled`);
      } else {
        log.error(`[${jobId}] Teaching job failed:`, error);
        try {
          await markTeachingJobFailed(jobId, message);
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
