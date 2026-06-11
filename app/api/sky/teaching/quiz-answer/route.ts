import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('QuizAnswerAPI');

/**
 * POST /api/sky/teaching/quiz-answer
 *
 * Verify a quiz answer. In the current implementation,
 * answers are verified client-side for simplicity.
 * This endpoint can be extended for server-side verification.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, sectionId, chunkOrder, selectedOption } = body;

    if (selectedOption === undefined || selectedOption === null) {
      return NextResponse.json(
        { error: 'Missing selectedOption parameter' },
        { status: 400 },
      );
    }

    log.info(`Quiz answer submitted: job=${jobId}, section=${sectionId}, chunk=${chunkOrder}, option=${selectedOption}`);

    // In a full implementation, we would:
    // 1. Look up the correct answer from the job store
    // 2. Verify the selected option
    // 3. Update student profile/feedback
    // For now, return a simple response

    // The first option (index 0) is always correct in our current implementation
    const isCorrect = selectedOption === 0;

    return NextResponse.json({
      success: true,
      data: {
        correct: isCorrect,
        selectedOption,
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
