import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';
import { readTeachingJob, updateTeachingJob } from '@/lib/server/teaching-job-store';
import { decideAdaptiveAdjustment } from '@/lib/teaching/adaptive-engine';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { generateSectionContent, extractContentSummary } from '@/lib/teaching/content-generator';
import { safeErrorMessage } from '@/lib/server/sanitize-error';
import type { LessonPlan, LessonSection } from '@/lib/teaching/lesson-types';
import type { ContentChunk, PrecedingSection } from '@/lib/teaching/content-types';

const log = createLogger('TeachingAdaptAPI');

export interface AdaptSupplementResult {
  section: LessonSection;
  chunks: ContentChunk[];
}

/**
 * POST /api/sky/teaching/[jobId]/adapt
 *
 * Re-run the adaptive decision on the learner's collected quiz results and
 * section feedback. For weak knowledge points not yet reinforced, generate
 * supplemental sections and append them to the plan so subsequent content
 * adjusts to the learner's demonstrated gaps.
 *
 * Response: { success, data: { supplemental, weakKnowledgePoints, reason, hasSupplement } }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const userId = auth.user.id;

  const { jobId } = await params;
  const job = await readTeachingJob(jobId);
  if (!job) {
    return NextResponse.json({ error: '教案任务不存在' }, { status: 404 });
  }
  if (job.userId !== userId) {
    return NextResponse.json({ error: '无权访问此任务' }, { status: 403 });
  }

  try {
    const profile = await buildStudentProfile(userId);
    const decision = decideAdaptiveAdjustment(
      job.sectionFeedbacks ?? [],
      job.quizResults ?? [],
      job.plan?.sections ?? [],
      profile.masteryByKnowledge,
    );

    const supplemental: AdaptSupplementResult[] = [];
    if (decision.shouldSupplement && decision.supplementalSections.length > 0) {
      const precedingSections: PrecedingSection[] = [];
      if (job.sections) {
        for (const s of job.sections) {
          precedingSections.push({
            title: s.section.title,
            knowledgePoints: s.section.knowledgePoints,
            depth: s.section.depth,
            contentSummary: extractContentSummary(s.chunks),
          });
        }
      }

      // Generate first so a mid-way LLM failure does not persist a partial plan.
      for (const sup of decision.supplementalSections) {
        try {
          const { chunks } = await generateSectionContent(sup, profile, precedingSections);
          supplemental.push({ section: sup, chunks });
          precedingSections.push({
            title: sup.title,
            knowledgePoints: sup.knowledgePoints,
            depth: sup.depth,
            contentSummary: extractContentSummary(chunks),
          });
        } catch (supErr) {
          log.warn(`[${jobId}] Supplement generation failed for ${sup.id}:`, supErr);
        }
      }

      if (supplemental.length > 0 && job.plan) {
        const currentPlan = job.plan;
        const appendedSections = [...currentPlan.sections, ...supplemental.map((s) => s.section)];
        const updatedPlan: LessonPlan = {
          ...currentPlan,
          sections: appendedSections,
          estimatedDuration: appendedSections.reduce((sum, sec) => sum + sec.estimatedDuration, 0),
        };
        await updateTeachingJob(jobId, {
          plan: updatedPlan,
          sections: [...(job.sections ?? []), ...supplemental],
        });
      }
    }

    const reason = decision.shouldSupplement
      ? `检测到薄弱知识点：${decision.weakKnowledgePoints.join('、')}，正在补充强化内容`
      : '暂无需要补充的薄弱点';

    return NextResponse.json({
      success: true,
      data: {
        supplemental,
        weakKnowledgePoints: decision.weakKnowledgePoints,
        reason,
        hasSupplement: supplemental.length > 0,
      },
    });
  } catch (error) {
    const message = safeErrorMessage(error);
    log.error('Adaptive adjustment failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
