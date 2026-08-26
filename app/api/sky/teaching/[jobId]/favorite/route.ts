import { NextRequest, NextResponse } from 'next/server';
import { readTeachingJob, updateTeachingJobProgress } from '@/lib/server/teaching-job-store';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';

const log = createLogger('TeachingFavoriteAPI');

/**
 * POST /api/sky/teaching/[jobId]/favorite
 *
 * Toggle favorite status for a teaching job.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;

    // Get job data
    const job = await readTeachingJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 },
      );
    }
    if (job.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Toggle favorite status
    const isFavorited = !job.isFavorited;

    // Update job with favorite status
    await updateTeachingJobProgress(jobId, {
      step: job.step,
      progress: job.progress,
      message: job.message,
      isFavorited,
    });

    log.info(`Job ${jobId} favorite toggled to ${isFavorited} by user ${userId}`);

    return NextResponse.json({
      success: true,
      data: {
        isFavorited,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Toggle favorite failed:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
