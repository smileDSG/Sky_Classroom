import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import { readTeachingJob, updateTeachingJob } from '@/lib/server/teaching-job-store';

const log = createLogger('QuizAnswerAPI');

/**
 * POST /api/sky/teaching/quiz-answer
 *
 * Verify a quiz answer server-side and track results.
 * Body: { sectionId, chunkOrder, selectedOption, correctAnswer, question?, options?, knowledgePoints? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sectionId, chunkOrder, selectedOption, correctAnswer, question, options, knowledgePoints, jobId } = body;

    if (selectedOption === undefined || selectedOption === null) {
      return NextResponse.json(
        { error: 'Missing selectedOption parameter' },
        { status: 400 },
      );
    }

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

    // Use correctAnswer if provided (from structured quiz chunk), otherwise fallback to 0
    const expectedAnswer = typeof correctAnswer === 'number' ? correctAnswer : 0;
    const isCorrect = selectedOption === expectedAnswer;

    log.info(
      `Quiz answer verified: section=${sectionId}, chunk=${chunkOrder}, ` +
      `selected=${selectedOption}, expected=${expectedAnswer}, correct=${isCorrect}, user=${userId || 'anonymous'}`
    );

    // If the user is authenticated and answered incorrectly, invalidate their profile cache
    // so the next profile build reflects this mistake
    if (userId && !isCorrect) {
      try {
        await invalidateProfileCache(userId);
        log.info(`Profile cache invalidated for user ${userId} after wrong answer`);
      } catch (cacheErr) {
        log.warn('Failed to invalidate profile cache:', cacheErr);
      }
    }

    // Record quiz result in job store for adaptive engine
    if (jobId && typeof jobId === 'string') {
      try {
        const job = await readTeachingJob(jobId);
        if (job) {
          const existingResults = job.quizResults ?? [];
          existingResults.push({
            sectionId: sectionId || '',
            chunkOrder: typeof chunkOrder === 'number' ? chunkOrder : 0,
            knowledgePoints: Array.isArray(knowledgePoints) ? knowledgePoints : [],
            isCorrect,
            timestamp: Date.now(),
          });
          await updateTeachingJob(jobId, { quizResults: existingResults });
        }
      } catch (jobErr) {
        log.warn('Failed to update job quiz result:', jobErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        correct: isCorrect,
        selectedOption,
        expectedAnswer,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Quiz answer verification failed:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
