import { NextRequest, NextResponse } from 'next/server';
import { readTeachingJob, updateTeachingJobProgress } from '@/lib/server/teaching-job-store';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';

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

    // Verify authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    let userId: string | null = null;

    if (accessToken) {
      const payload = await verifyAccessToken(accessToken.value);
      if (payload) {
        userId = payload.sub;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Get job data
    const job = await readTeachingJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 },
      );
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
