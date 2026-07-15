import { NextRequest, NextResponse } from 'next/server';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { shareTokens } from '@/app/api/sky/teaching/[jobId]/share/route';
import { createLogger } from '@/lib/logger';

const log = createLogger('TeachingSharedAPI');

/**
 * GET /api/sky/teaching/shared/[token]
 *
 * Get shared teaching job data by token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    // Find share token
    const shareInfo = shareTokens.get(token);
    if (!shareInfo) {
      return NextResponse.json(
        { error: 'Share link not found or expired' },
        { status: 404 },
      );
    }

    // Check if token is expired (7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (shareInfo.createdAt < sevenDaysAgo) {
      shareTokens.delete(token);
      return NextResponse.json(
        { error: 'Share link has expired' },
        { status: 410 },
      );
    }

    // Get job data
    const job = await readTeachingJob(shareInfo.jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Teaching job not found' },
        { status: 404 },
      );
    }

    if (!job.plan || !job.sections) {
      return NextResponse.json(
        { error: 'Teaching job not completed' },
        { status: 400 },
      );
    }

    // Get user info (simplified - in production, fetch from user database)
    const sharedBy = `User ${shareInfo.userId.slice(0, 8)}...`;

    return NextResponse.json({
      success: true,
      data: {
        topic: job.topic,
        plan: job.plan,
        sections: job.sections,
        sharedBy,
        sharedAt: new Date(shareInfo.createdAt).toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Get shared teaching failed:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
