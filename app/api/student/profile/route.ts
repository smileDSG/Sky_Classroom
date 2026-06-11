import { NextResponse } from 'next/server';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';

const log = createLogger('StudentProfileAPI');

/**
 * GET /api/student/profile
 *
 * Returns a lightweight student profile for teaching recommendations.
 * Only returns weakPoints, knowledge points list, and whether profile data exists.
 */
export async function GET() {
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
      return NextResponse.json({
        success: true,
        data: {
          hasProfile: false,
          weakPoints: [],
          knowledgePoints: [],
        },
      });
    }

    const profile = await buildStudentProfile(userId);

    // Extract unique knowledge points
    const knowledgePoints = Object.keys(profile.masteryByKnowledge);

    return NextResponse.json({
      success: true,
      data: {
        hasProfile: knowledgePoints.length > 0,
        weakPoints: profile.weakPoints,
        knowledgePoints,
        masteryByKnowledge: profile.masteryByKnowledge,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Failed to get student profile:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
