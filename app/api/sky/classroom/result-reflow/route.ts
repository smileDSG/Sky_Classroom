/**
 * POST /api/sky/classroom/result-reflow
 *
 * Receive classroom learning results and reflow them to the Teaching module.
 * Request body: {
 *   stageId: string,
 *   subject: string,
 *   topic: string,
 *   questions: Array<{
 *     question: string;
 *     options: string[];
 *     answer: number;
 *     userAnswer: number | null;
 *     isCorrect: boolean;
 *     knowledgePoints: string[];
 *     explanation?: string;
 *   }>
 * }
 * Response: { success: true, attemptId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createQuizAttemptDAO } from '@/lib/student/quiz-attempts';
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:ClassroomResultReflow');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stageId, subject, topic, questions } = body;

    if (!stageId || !Array.isArray(questions)) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '缺少 stageId 或 questions 参数');
    }

    if (questions.length === 0) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'questions 不能为空数组');
    }

    // Auth
    const authHeader = req.headers.get('authorization');
    const userId = authHeader?.startsWith('Bearer user-')
      ? authHeader.slice(7)
      : 'default-user';

    const storage = await getServerStorage();
    const quizAttemptDAO = createQuizAttemptDAO(storage);

    // Map questions to QuizAttemptQuestion format
    const attemptQuestions = questions.map((q: unknown) => {
      const question = q as {
        question: string;
        options?: string[];
        answer?: number;
        userAnswer?: number | null;
        isCorrect?: boolean;
        knowledgePoints?: string[];
        explanation?: string;
      };
      return {
        question: question.question || '',
        options: question.options ?? [],
        answer: typeof question.answer === 'number' ? question.answer : 0,
        userAnswer: question.userAnswer ?? null,
        isCorrect: question.isCorrect === true,
        explanation: question.explanation,
        knowledgePoints: question.knowledgePoints ?? [],
      };
    });

    // Save quiz attempt
    const validSubjects = ['math', 'physics', 'chemistry', 'biology', 'chinese', 'english', 'history', 'geography', 'politics', 'unknown'] as const;
    const validSubject = validSubjects.includes(subject) ? subject : 'math';

    const attempt = await quizAttemptDAO.add({
      userId,
      subject: validSubject as typeof validSubjects[number],
      difficulty: 'medium',
      topic: (topic as string) || '',
      source: 'ai',
      questions: attemptQuestions,
    });

    // Invalidate profile cache so Teaching module rebuilds profile with new data
    await invalidateProfileCache(userId);

    log.info(`Classroom result reflowed for user ${userId}, stage ${stageId}, attempt ${attempt.id}`);

    return apiSuccess({ attemptId: attempt.id }, 201);
  } catch (err) {
    log.error('Classroom result reflow failed:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to reflow classroom results',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
