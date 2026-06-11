/**
 * Teaching Job Runner — background execution engine for AI teaching.
 *
 * Runs lesson plan generation + content generation in the background,
 * updating job progress as each section completes.
 */

import { EventEmitter } from 'events';
import { createLogger } from '@/lib/logger';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { planLesson } from '@/lib/teaching/lesson-planner';
import { generateSectionContent, generateLessonConcurrent, extractContentSummary } from '@/lib/teaching/content-generator';
import type { GeneratedSectionData } from './teaching-job-store';
import type { PrecedingSection } from '@/lib/teaching/content-types';
import {
  readTeachingJob,
  markTeachingJobRunning,
  markTeachingJobSucceeded,
  markTeachingJobFailed,
  updateTeachingJobProgress,
} from './teaching-job-store';

const log = createLogger('TeachingJobRunner');

// EventEmitter for SSE streaming
const teachingEvents = new EventEmitter();
teachingEvents.setMaxListeners(100); // Allow many SSE connections

export function getTeachingEvents(): EventEmitter {
  return teachingEvents;
}

const runningJobs = new Map<string, Promise<void>>();

async function assertNotCancelled(jobId: string): Promise<void> {
  const job = await readTeachingJob(jobId);
  if (job?.status === 'cancelled') {
    throw new Error('Job was cancelled');
  }
}

/**
 * Run a teaching job: plan lesson → generate content concurrently.
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

      // Phase 2: Generate content concurrently
      let completedCount = 0;
      for await (const { section, chunks } of generateLessonConcurrent(plan)) {
        await assertNotCancelled(jobId);
        completedCount++;

        const sectionData: GeneratedSectionData = { section, chunks };
        await updateTeachingJobProgress(jobId, {
          step: 'generating_content',
          progress: Math.round(10 + (completedCount / totalSections) * 85),
          message: `第 ${completedCount}/${totalSections} 章节完成：${section.title}`,
          sectionsCompleted: completedCount,
          section: sectionData,
        });

        // Emit SSE event for this section
        teachingEvents.emit(`job:${jobId}`, {
          type: 'section_done',
          sectionIndex: completedCount - 1,
          section,
          chunks,
        });

        log.info(`[${jobId}] Section ${completedCount}/${totalSections} completed: ${section.title}`);
      }

      // Emit job done event
      teachingEvents.emit(`job:${jobId}`, {
        type: 'job_done',
        jobId,
      });

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

/**
 * Retry a single section: regenerate content and replace in job store.
 */
export async function retrySection(
  jobId: string,
  sectionId: string,
): Promise<GeneratedSectionData | null> {
  const job = await readTeachingJob(jobId);
  if (!job || !job.plan) {
    throw new Error('Job or plan not found');
  }

  const section = job.plan.sections.find((s) => s.id === sectionId);
  if (!section) {
    throw new Error(`Section ${sectionId} not found in plan`);
  }

  // Find preceding sections for context
  const sectionIndex = job.plan.sections.findIndex((s) => s.id === sectionId);
  const precedingSections: PrecedingSection[] = [];
  if (job.sections) {
    for (let i = 0; i < sectionIndex; i++) {
      const prevData = job.sections.find((s) => s.section.id === job.plan!.sections[i].id);
      if (prevData) {
        precedingSections.push({
          title: prevData.section.title,
          knowledgePoints: prevData.section.knowledgePoints,
          depth: prevData.section.depth,
          contentSummary: extractContentSummary(prevData.chunks),
        });
      }
    }
  }

  // Regenerate
  const chunks = await generateSectionContent(section, precedingSections);
  const sectionData: GeneratedSectionData = { section, chunks };

  // Replace in job store
  if (job.sections) {
    const idx = job.sections.findIndex((s) => s.section.id === sectionId);
    if (idx >= 0) {
      job.sections[idx] = sectionData;
    } else {
      job.sections.push(sectionData);
    }
    await updateTeachingJobProgress(jobId, {
      step: job.step,
      progress: job.progress,
      message: job.message,
    });
  }

  return sectionData;
}
