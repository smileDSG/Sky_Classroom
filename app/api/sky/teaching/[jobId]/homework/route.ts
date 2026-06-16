/**
 * GET /api/sky/teaching/[jobId]/homework
 *
 * Generate a personalized homework assignment based on the teaching job's
 * feedback and quiz results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { generateHomework } from '@/lib/teaching/homework-generator';

const log = createLogger('TeachingHomeworkAPI');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    // Verify authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    let userId: string | null = null;

    if (accessToken) {
      const payload = await verifyAccessToken(accessToken.value);
      if (payload) userId = payload.sub;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read job
    const job = await readTeachingJob(jobId);
    if (!job) {
      return NextResponse.json({ error: '教案任务不存在' }, { status: 404 });
    }

    if (job.userId !== userId) {
      return NextResponse.json({ error: '无权访问此任务' }, { status: 403 });
    }

    // Generate homework based on job feedback/quiz results
    const homework = await generateHomework(
      job.sectionFeedbacks ?? [],
      job.quizResults ?? [],
      job.topic,
      'math',
    );

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
