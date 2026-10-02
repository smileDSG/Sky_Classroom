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

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createQuizAttemptDAO } from '@/lib/student/quiz-attempts';
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';

const log = createLogger('API:ClassroomResultReflow');

const validSubjects = [
  'math',
  'physics',
  'chemistry',
  'biology',
  'chinese',
  'english',
  'history',
  'geography',
  'politics',
  'unknown',
] as const;

const ResultReflowSchema = z.object({
  stageId: z.string().max(200),
  subject: z.enum(validSubjects).default('math'),
  topic: z.string().max(500).default(''),
  questions: z
    .array(
      z.object({
        question: z.string().min(1).max(20000),
        options: z.array(z.string().max(2000)).max(20).optional().default([]),
        answer: z.number().int().optional().default(0),
        userAnswer: z.number().int().nullable().optional().default(null),
        isCorrect: z.boolean().optional().default(false),
        knowledgePoints: z.array(z.string().max(200)).max(20).optional().default([]),
        explanation: z.string().max(20000).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const parsed = ResultReflowSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '缺少 stageId 或 questions 参数');
    }

    const { stageId, subject, topic, questions } = parsed.data;

    if (questions.length === 0) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'questions 不能为空数组');
    }

    const userId = auth.user.id;

    const storage = await getServerStorage();
    const quizAttemptDAO = createQuizAttemptDAO(storage);

    // Map questions to QuizAttemptQuestion format
    const attemptQuestions = questions.map((question) => ({
      question: question.question || '',
      options: question.options ?? [],
      answer: typeof question.answer === 'number' ? question.answer : 0,
      userAnswer: question.userAnswer ?? null,
      isCorrect: question.isCorrect === true,
      explanation: question.explanation,
      knowledgePoints: question.knowledgePoints ?? [],
    }));

    // Save quiz attempt
    const validSubject = validSubjects.includes(subject) ? subject : 'math';

    const attempt = await quizAttemptDAO.add({
      userId,
      subject: validSubject as (typeof validSubjects)[number],
      difficulty: 'medium',
      topic: (topic as string) || '',
      source: 'ai',
      questions: attemptQuestions,
    });

    // Invalidate profile cache so Teaching module rebuilds profile with new data
    await invalidateProfileCache(userId);

    log.info(
      `Classroom result reflowed for user ${userId}, stage ${stageId}, attempt ${attempt.id}`,
    );

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
