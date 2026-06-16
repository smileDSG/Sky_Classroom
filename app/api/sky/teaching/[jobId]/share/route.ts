import { NextRequest, NextResponse } from 'next/server';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { randomUUID } from 'crypto';

const log = createLogger('TeachingShareAPI');

// In-memory share token store (in production, use Redis or database)
const shareTokens = new Map<string, { jobId: string; userId: string; createdAt: number }>();

/**
 * POST /api/sky/teaching/[jobId]/share
 *
 * Generate a share token for a teaching job.
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

    // Generate share token
    const token = randomUUID().replace(/-/g, '').slice(0, 12);
    shareTokens.set(token, {
      jobId,
      userId,
      createdAt: Date.now(),
    });

    // Clean up old tokens (older than 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [key, value] of shareTokens.entries()) {
      if (value.createdAt < sevenDaysAgo) {
        shareTokens.delete(key);
      }
    }

    log.info(`Share token generated for job ${jobId}: ${token}`);

    const shareUrl = `${request.nextUrl.origin}/sky/teaching/shared/${token}`;

    return NextResponse.json({
      success: true,
      data: {
        token,
        shareUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Generate share token failed:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/sky/teaching/[jobId]/share
 *
 * Get share info for a teaching job (if already shared).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    // Find existing share token for this job
    let existingToken: string | null = null;
    for (const [token, value] of shareTokens.entries()) {
      if (value.jobId === jobId) {
        existingToken = token;
        break;
      }
    }

    if (!existingToken) {
      return NextResponse.json({
        success: true,
        data: {
          isShared: false,
        },
      });
    }

    const shareUrl = `${request.nextUrl.origin}/sky/teaching/shared/${existingToken}`;

    return NextResponse.json({
      success: true,
      data: {
        isShared: true,
        token: existingToken,
        shareUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Get share info failed:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

// Export shareTokens for use in shared route
export { shareTokens };
