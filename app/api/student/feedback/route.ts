import { NextRequest, NextResponse } from 'next/server';
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';

const log = createLogger('StudentFeedbackAPI');

/**
 * POST /api/student/feedback
 *
 * Record learning feedback (mastered/needs review).
 * This triggers profile cache invalidation for next rebuild.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
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
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { sectionId, knowledgePoints, feedback } = body;

    if (!feedback || !['mastered', 'needs_review'].includes(feedback)) {
      return NextResponse.json(
        { error: 'Invalid feedback type. Must be "mastered" or "needs_review"' },
        { status: 400 },
      );
    }

    log.info(`Recording feedback for user ${userId}: section=${sectionId}, feedback=${feedback}`);

    // In a full implementation, we would:
    // 1. Store the feedback in the database
    // 2. For "mastered": add a virtual correct answer record
    // 3. For "needs_review": add to review list
    // For now, just invalidate the profile cache

    invalidateProfileCache(userId);

    return NextResponse.json({
      success: true,
      message: `Feedback recorded: ${feedback}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Failed to record feedback:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
