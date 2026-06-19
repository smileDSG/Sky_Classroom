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
      const failedSections: { section: LessonSection; index: number }[] = [];
      for await (const { section, chunks, structured, index } of generateLessonConcurrent(plan, profile)) {
        await assertNotCancelled(jobId);
        completedCount++;
        // 使用 section 在 plan 中的真实索引，避免章节被丢弃/重试后 sectionIndex 错位
        const sectionIndex = typeof index === 'number' ? index : completedCount - 1;

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
          sectionIndex,
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

        // 收集生成失败的章节，Phase 2 结束后自动重试一次
        if (chunks.some((c) => c.failed)) {
          failedSections.push({ section, index: sectionIndex });
        }

        log.info(
          `[${jobId}] Section ${completedCount}/${totalSections} completed: ${section.title}`,
        );
      }

      // Phase 2.5: 自动重试失败的章节一次（并发执行），减少用户手动点"重新生成"
      // 并发重试避免串行 N×(structured+chunks LLM 调用) 严重拖慢总时长
      // 每个重试一完成就立即 emit progress/section_done，让进度条紧跟实际重试进度
      // （而非等全部重试完成才推进），避免重试期间进度条长时间卡住
      if (failedSections.length > 0) {
        await assertNotCancelled(jobId);
        const retryTotal = failedSections.length;
        log.info(
          `[${jobId}] ${retryTotal} section(s) failed, auto-retrying once (concurrent)`,
        );
        const jobForRetry = await readTeachingJob(jobId);

        // 累积成功的重试结果，全部完成后一次性写回 store（避免并发写竞态）
        const successMap = new Map<string, GeneratedSectionData>();
        let settledCount = 0;
        let replacedCount = 0;

        const retryTasks = failedSections.map(({ section, index }) => {
          // 提前为该失败章节构建前序上下文（用 Phase 2 的 sections 快照）
          const precedingSections: PrecedingSection[] = [];
          if (jobForRetry?.sections) {
            for (let i = 0; i < index; i++) {
              const ps = jobForRetry.sections.find(
                (s) => s.section.id === plan.sections[i]?.id,
              );
              if (ps) {
                precedingSections.push({
                  title: ps.section.title,
                  knowledgePoints: ps.section.knowledgePoints,
                  depth: ps.section.depth,
                  contentSummary: extractContentSummary(ps.chunks),
                });
              }
            }
          }

          return (async () => {
            const { chunks, structured } = await generateSectionContent(
              section,
              profile,
              precedingSections,
            );
            return { section, index, chunks, structured };
          })()
            .then((value) => {
              settledCount++;
              const { section: sec, index: idx, chunks, structured } = value;
              // 仍失败则保留原占位，等待用户手动重试
              if (chunks.some((c) => c.failed)) {
                log.warn(`[${jobId}] Auto-retry still failed for section ${sec.id}`);
                return;
              }
              successMap.set(sec.id, { section: sec, chunks, structured });
              replacedCount++;
              // 立即推送该章节，前端用真实索引覆盖
              teachingEvents.emit(`job:${jobId}`, {
                type: 'section_done',
                sectionIndex: idx,
                section: sec,
                chunks,
                structured,
              });
              log.info(`[${jobId}] Auto-retry succeeded for section ${sec.id}`);
            })
            .catch((retryErr) => {
              settledCount++;
              log.warn(`[${jobId}] Auto-retry threw for section ${section.id}:`, retryErr);
            })
            .finally(() => {
              // 每个重试结算后立即推进进度（95→99），紧跟实际重试完成节奏
              const retryProgress =
                retryTotal > 0 ? 95 + Math.round((settledCount / retryTotal) * 4) : 99;
              teachingEvents.emit(`job:${jobId}`, {
                type: 'progress',
                step: 'generating_content',
                progress: retryProgress,
                message: `正在重新生成失败章节（${settledCount}/${retryTotal}）`,
                sectionsCompleted: jobForRetry?.sectionsCompleted ?? completedCount,
                totalSections: jobForRetry?.totalSections ?? totalSections,
                done: false,
              });
            });
        });

        await Promise.allSettled(retryTasks);

        // 全部重试完成后一次性写回 store（替换成功章节）
        if (replacedCount > 0) {
          const jobBeforeReplace = await readTeachingJob(jobId);
          const newSections = [...(jobBeforeReplace?.sections ?? [])];
          for (const [sectionId, data] of successMap) {
            const replaceIdx = newSections.findIndex((s) => s.section.id === sectionId);
            if (replaceIdx >= 0) {
              newSections[replaceIdx] = data;
            } else {
              newSections.push(data);
            }
          }
          await updateTeachingJob(jobId, {
            sections: newSections,
            progress: 99,
            message: `已重新生成 ${replacedCount} 个失败章节`,
          });
        }
      }

      // Phase 3: Adaptive supplementation based on feedback/quiz results
      try {
        const jobAfterContent = await readTeachingJob(jobId);
        if (jobAfterContent) {
          const decision = decideAdaptiveAdjustment(
            jobAfterContent.sectionFeedbacks ?? [],
            jobAfterContent.quizResults ?? [],
            jobAfterContent.plan?.sections ?? [],
            profile.masteryByKnowledge,
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
                  await generateSectionContent(supSection, profile, precedingSections);
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
                  contentSummary: extractContentSummary(supChunks),
                });

                // Emit SSE event
                teachingEvents.emit(`job:${jobId}`, {
                  type: 'supplement_section',
                  sectionIndex: updatedSections.length - decision.supplementalSections.length + i,
                  section: supSection,
                  chunks: supChunks,
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

  // Re-build profile for the user so retry content is also personalized
  const profile = job.userId ? await buildStudentProfile(job.userId) : undefined;

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
  const { chunks, structured } = await generateSectionContent(section, profile, precedingSections);
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
