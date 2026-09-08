import { NextRequest, NextResponse } from 'next/server';
import { retrySection } from '@/lib/server/teaching-job-runner';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { requireQuota } from '@/lib/server/billing/require-quota';
import { createLogger } from '@/lib/logger';

const log = createLogger('RetrySectionAPI');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    const { jobId } = await params;
    const body = await request.json();
    const { sectionId } = body;

    if (!sectionId) {
      return NextResponse.json({ error: 'Missing sectionId parameter' }, { status: 400 });
    }

    // Verify job exists and belongs to user
    const job = await readTeachingJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.userId !== quota.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    log.info(`Retrying section ${sectionId} for job ${jobId}`);

    const result = await retrySection(jobId, sectionId);

    if (!result) {
      return NextResponse.json({ error: 'Failed to retry section' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Retry section failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
