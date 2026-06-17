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
import {
  generateSectionContent,
  generateLessonConcurrent,
  extractContentSummary,
} from '@/lib/teaching/content-generator';
import { decideAdaptiveAdjustment } from '@/lib/teaching/adaptive-engine';
import { updatePathAfterJob } from '@/lib/teaching/learning-path-engine';
import { createLearningPathDAO } from '@/lib/storage/dao/learning-paths';
import { getServerStorage } from '@/lib/server/server-storage';
import type { GeneratedSectionData } from './teaching-job-store';
import type { PrecedingSection } from '@/lib/teaching/content-types';
import type { LessonSection } from '@/lib/teaching/lesson-types';
import {
  readTeachingJob,
  markTeachingJobRunning,
  markTeachingJobSucceeded,
  markTeachingJobFailed,
  updateTeachingJobProgress,
  updateTeachingJob,
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
export function runTeachingJob(jobId: string, topic: string, userId: string): Promise<void> {
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
      const jobAfterPlan = await updateTeachingJobProgress(jobId, {
        step: 'generating_content',
        progress: 10,
        message: `教案计划已生成，共 ${totalSections} 个章节，开始生成内容...`,
        plan,
        totalSections,
        sectionsCompleted: 0,
      });

      // Emit progress so frontend knows plan is ready
      teachingEvents.emit(`job:${jobId}`, {
        type: 'progress',
        step: jobAfterPlan.step,
        progress: jobAfterPlan.progress,
        message: jobAfterPlan.message,
        plan: jobAfterPlan.plan,
        sectionsCompleted: jobAfterPlan.sectionsCompleted ?? 0,
        totalSections: jobAfterPlan.totalSections ?? totalSections,
        done: false,
      });

      // Phase 2: Generate content concurrently
      let completedCount = 0;
      for await (const { section, chunks, structured } of generateLessonConcurrent(plan)) {
        await assertNotCancelled(jobId);
        completedCount++;

        const sectionData: GeneratedSectionData = { section, chunks, structured };
        const jobAfterSection = await updateTeachingJobProgress(jobId, {
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
          structured,
        });

        // Emit progress update so frontend syncs plan/sections/message state
        teachingEvents.emit(`job:${jobId}`, {
          type: 'progress',
          step: jobAfterSection.step,
          progress: jobAfterSection.progress,
          message: jobAfterSection.message,
          plan: jobAfterSection.plan,
          sectionsCompleted: jobAfterSection.sectionsCompleted ?? completedCount,
          totalSections: jobAfterSection.totalSections ?? totalSections,
          done: false,
        });

        log.info(
          `[${jobId}] Section ${completedCount}/${totalSections} completed: ${section.title}`,
        );
      }

      // Phase 3: Adaptive supplementation based on feedback/quiz results
      try {
        const jobAfterContent = await readTeachingJob(jobId);
        if (jobAfterContent) {
          const decision = decideAdaptiveAdjustment(
            jobAfterContent.sectionFeedbacks ?? [],
            jobAfterContent.quizResults ?? [],
            jobAfterContent.plan?.sections ?? [],
          );

          if (decision.shouldSupplement && decision.supplementalSections.length > 0) {
            log.info(
              `[${jobId}] Generating ${decision.supplementalSections.length} supplemental sections`,
            );

            // Update plan with supplemental sections
            const currentPlan = jobAfterContent.plan;
            if (currentPlan) {
              const updatedSections = [...currentPlan.sections, ...decision.supplementalSections];
              const updatedPlan = {
                ...currentPlan,
                sections: updatedSections,
                estimatedDuration: updatedSections.reduce((s, sec) => s + sec.estimatedDuration, 0),
              };
              await updateTeachingJob(jobId, { plan: updatedPlan });

              // Emit plan adjustment event so frontend updates total section count
              teachingEvents.emit(`job:${jobId}`, {
                type: 'plan_adjusted',
                jobId,
                plan: updatedPlan,
                reason: `检测到薄弱知识点：${decision.weakKnowledgePoints.join('、')}，正在补充强化内容`,
              });

              // Generate supplemental sections sequentially
              const precedingSections: PrecedingSection[] = [];
              if (jobAfterContent.sections) {
                for (const s of jobAfterContent.sections) {
                  precedingSections.push({
                    title: s.section.title,
                    knowledgePoints: s.section.knowledgePoints,
                    depth: s.section.depth,
                    contentSummary: extractContentSummary(s.chunks),
                  });
                }
              }

              for (let i = 0; i < decision.supplementalSections.length; i++) {
                await assertNotCancelled(jobId);
                const supSection = decision.supplementalSections[i];
                const { chunks: supChunks, structured: supStructured } =
                  await generateSectionContent(supSection, precedingSections);
                const sectionData: GeneratedSectionData = {
                  section: supSection,
                  chunks: supChunks,
                  structured: supStructured,
                };

                const jobAfterSupplement = await updateTeachingJobProgress(jobId, {
                  step: 'generating_content',
                  progress: Math.round(95 + ((i + 1) / decision.supplementalSections.length) * 4),
                  message: `补充强化内容：${supSection.title}`,
                  sectionsCompleted: (jobAfterContent.sections?.length ?? 0) + i + 1,
                  section: sectionData,
                });

                // Update preceding sections for next supplement
                precedingSections.push({
                  title: supSection.title,
                  knowledgePoints: supSection.knowledgePoints,
                  depth: supSection.depth,
                  contentSummary: extractContentSummary(chunks),
                });

                // Emit SSE event
                teachingEvents.emit(`job:${jobId}`, {
                  type: 'supplement_section',
                  sectionIndex: updatedSections.length - decision.supplementalSections.length + i,
                  section: supSection,
                  chunks,
                  reason: decision.weakKnowledgePoints.join('、'),
                });

                // Emit progress update
                teachingEvents.emit(`job:${jobId}`, {
                  type: 'progress',
                  step: jobAfterSupplement.step,
                  progress: jobAfterSupplement.progress,
                  message: jobAfterSupplement.message,
                  plan: jobAfterSupplement.plan,
                  sectionsCompleted:
                    jobAfterSupplement.sectionsCompleted ??
                    (jobAfterContent.sections?.length ?? 0) + i + 1,
                  totalSections: jobAfterSupplement.totalSections ?? updatedSections.length,
                  done: false,
                });

                log.info(`[${jobId}] Supplemental section completed: ${supSection.title}`);
              }
            }
          }
        }
      } catch (adaptiveErr) {
        log.warn(`[${jobId}] Adaptive supplementation failed:`, adaptiveErr);
        // Non-fatal: continue to mark job as succeeded
      }

      // Emit job done event
      teachingEvents.emit(`job:${jobId}`, {
        type: 'job_done',
        jobId,
      });

      // Done
      await markTeachingJobSucceeded(jobId);
      log.info(`[${jobId}] Teaching job completed successfully`);

      // Async: update active learning path if exists
      (async () => {
        try {
          const storage = await getServerStorage();
          const pathDAO = createLearningPathDAO(storage);
          const activePath = await pathDAO.getActiveByUser(userId);
          if (activePath) {
            const profile = await buildStudentProfile(userId);
            const job = await readTeachingJob(jobId);
            if (job) {
              const updated = updatePathAfterJob(activePath, job, profile);
              await pathDAO.update(activePath.id, updated);
              log.info(`[${jobId}] Updated learning path ${activePath.id}`);
            }
          }
        } catch (pathErr) {
          log.warn(`[${jobId}] Failed to update learning path:`, pathErr);
        }
      })();
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
  const { chunks, structured } = await generateSectionContent(section, precedingSections);
  const sectionData: GeneratedSectionData = { section, chunks, structured };

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
