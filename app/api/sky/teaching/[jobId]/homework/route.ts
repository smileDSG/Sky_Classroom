/**
 * GET /api/sky/teaching/[jobId]/homework
 *
 * Generate a personalized homework assignment based on the teaching job's
 * feedback and quiz results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { generateHomework } from '@/lib/teaching/homework-generator';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { resolveSubject } from '@/lib/student/profile-config';

const log = createLogger('TeachingHomeworkAPI');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    const quota = await requireQuota('llmCalls');
    if ('error' in quota) return quota.error;
    const userId = quota.userId;

    // Read job
    const job = await readTeachingJob(jobId);
    if (!job) {
      return NextResponse.json({ error: '教案任务不存在' }, { status: 404 });
    }

    if (job.userId !== userId) {
      return NextResponse.json({ error: '无权访问此任务' }, { status: 403 });
    }

    // Build profile to resolve the real subject for the topic
    const profile = await buildStudentProfile(userId);
    const subject = resolveSubject(job.topic, profile);

    // Generate homework based on job feedback/quiz results
    const homework = await generateHomework(
      job.sectionFeedbacks ?? [],
      job.quizResults ?? [],
      job.topic,
      subject,
    );
    await recordUsage(quota.userId, quota.planType, 'llmCalls');

    log.info(`Homework generated for job ${jobId}: ${homework.questions.length} questions`);

    return NextResponse.json({
      success: true,
      data: homework,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Homework generation failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
