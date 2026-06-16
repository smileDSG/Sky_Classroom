/**
 * POST /api/sky/teaching/diagnostic/submit
 *
 * Submit diagnostic answers and get analysis result.
 * Body: {
 *   sessionId: string,
 *   answers: Array<{
 *     questionId: number,
 *     selectedOption: number
 *   }>,
 *   topic?: string
 * }
 *
 * Server validates answers against the stored session, no client-side isCorrect trusted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { invalidateProfileCache } from '@/lib/student/profile-builder';
import { createQuizAttemptDAO } from '@/lib/student/quiz-attempts';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { getServerStorage } from '@/lib/server/server-storage';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { getSession } from '../route';

const log = createLogger('TeachingDiagnosticSubmitAPI');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, answers, topic = '前置知识诊断' } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: 'Missing answers array' }, { status: 400 });
    }

    // Verify authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    let userId: string | null = null;

    if (accessToken) {
      const payload = await verifyAccessToken(accessToken.value);
      if (payload) userId = payload.sub;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load session from persistent storage
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session expired or not found' }, { status: 410 });
    }

    if (session.userId !== userId) {
      return NextResponse.json({ error: 'Session ownership mismatch' }, { status: 403 });
    }

    // Server-side validation: compare selectedOption against stored correct answer
    const questionMap = new Map(session.questions.map((q) => [q.id, q]));
    const validatedAnswers = answers.map((a: { questionId?: number; selectedOption?: number }) => {
      const q = questionMap.get(a.questionId ?? -1);
      const selected = a.selectedOption ?? -1;
      const isCorrect = q ? selected === q.answer : false;
      return {
        questionId: a.questionId ?? -1,
        question: q?.question ?? '',
        options: q?.options ?? [],
        answer: q?.answer ?? 0,
        selectedOption: selected,
        knowledgePoint: q?.knowledgePoint ?? '',
        explanation: q?.explanation,
        isCorrect,
      };
    });

    const total = validatedAnswers.length;
    const correct = validatedAnswers.filter((a) => a.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const weakPrerequisites: string[] = [];
    for (const a of validatedAnswers) {
      if (!a.isCorrect && a.knowledgePoint) {
        weakPrerequisites.push(a.knowledgePoint);
      }
    }

    let recommendedDepth: 'basic' | 'normal' | 'advanced';
    if (accuracy >= 80) recommendedDepth = 'advanced';
    else if (accuracy >= 50) recommendedDepth = 'normal';
    else recommendedDepth = 'basic';

    // Record wrong answers to quiz attempts and mistake book
    try {
      const storage = await getServerStorage();
      const quizDAO = createQuizAttemptDAO(storage);
      const mistakeDAO = createMistakeBookDAO(storage);

      const wrongAnswers = validatedAnswers.filter((a) => !a.isCorrect);

      if (wrongAnswers.length > 0) {
        await quizDAO.add({
          userId,
          subject: 'unknown',
          difficulty: 'easy',
          topic,
          source: 'ai',
          questions: wrongAnswers.map((a) => ({
            question: a.question,
            options: a.options,
            answer: a.answer,
            userAnswer: a.selectedOption,
            isCorrect: false,
            explanation: a.explanation,
            knowledgePoints: a.knowledgePoint ? [a.knowledgePoint] : [],
          })),
        });

        for (const a of wrongAnswers) {
          await mistakeDAO.add({
            id: `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            problemText: a.question,
            userAnswer: String(a.selectedOption),
            correctAnswer: String(a.answer),
            errorType: 'concept',
            knowledgePoints: a.knowledgePoint ? [a.knowledgePoint] : [],
            source: 'classroom-diagnostic',
          });
        }
      }

      await invalidateProfileCache(userId);
    } catch (err) {
      log.warn('Failed to record diagnostic results:', err);
    }

    return NextResponse.json({
      success: true,
      data: {
        accuracy,
        weakPrerequisites: [...new Set(weakPrerequisites)],
        recommendedDepth,
        canProceed: accuracy >= 50,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Diagnostic submission failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
