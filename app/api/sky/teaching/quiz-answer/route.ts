import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getServerStorage } from '@/lib/server/server-storage';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { recordAnswerSubmitted } from '@/lib/adaptive-learning/profile/event-recorder';
import { getLearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import {
  buildTeachingKnowledgeImpacts,
  type TeachingProfileUpdate,
} from '@/lib/teaching/profile-impact';
import { readTeachingJob, updateTeachingJob } from '@/lib/server/teaching-job-store';
import { safeErrorMessage } from '@/lib/server/sanitize-error';

const log = createLogger('QuizAnswerAPI');

const QuizAnswerSchema = z.object({
  sectionId: z.string().max(200).optional().default(''),
  chunkOrder: z.number().int().optional().default(0),
  selectedOption: z.number().int(),
  correctAnswer: z.number().int().optional().default(0),
  knowledgePoints: z.array(z.string().max(200)).max(50).optional().default([]),
  jobId: z.string().max(200).optional(),
});

/**
 * POST /api/sky/teaching/quiz-answer
 *
 * Verify a quiz answer server-side and track results.
 * Body: { sectionId, chunkOrder, selectedOption, correctAnswer, question?, options?, knowledgePoints? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;

    const body = await request.json();
    const parsed = QuizAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const { sectionId, chunkOrder, selectedOption, correctAnswer, knowledgePoints, jobId } =
      parsed.data;

    if (selectedOption === undefined || selectedOption === null) {
      return NextResponse.json({ error: 'Missing selectedOption parameter' }, { status: 400 });
    }

    // Use correctAnswer if provided (from structured quiz chunk), otherwise fallback to 0
    const expectedAnswer = typeof correctAnswer === 'number' ? correctAnswer : 0;
    const isCorrect = selectedOption === expectedAnswer;

    log.info(
      `Quiz answer verified: section=${sectionId}, chunk=${chunkOrder}, ` +
        `selected=${selectedOption}, expected=${expectedAnswer}, correct=${isCorrect}, user=${userId || 'anonymous'}`,
    );

    let resolvedKnowledgePoints = Array.isArray(knowledgePoints)
      ? knowledgePoints.filter(
          (value): value is string => typeof value === 'string' && Boolean(value.trim()),
        )
      : [];

    // Record quiz result in job store for adaptive engine
    if (jobId && typeof jobId === 'string') {
      try {
        const job = await readTeachingJob(jobId);
        if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        if (job.userId !== userId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        const section = job.plan?.sections.find((item) => item.id === sectionId);
        if (resolvedKnowledgePoints.length === 0) {
          resolvedKnowledgePoints = section?.knowledgePoints ?? [];
        }
        const existingResults = job.quizResults ?? [];
        existingResults.push({
          sectionId: sectionId || '',
          chunkOrder: typeof chunkOrder === 'number' ? chunkOrder : 0,
          knowledgePoints: resolvedKnowledgePoints,
          isCorrect,
          timestamp: Date.now(),
        });
        await updateTeachingJob(jobId, { quizResults: existingResults });
      } catch (jobErr) {
        log.warn('Failed to update job quiz result:', jobErr);
      }
    }

    let profileUpdate: TeachingProfileUpdate | null = null;
    if (userId && resolvedKnowledgePoints.length > 0) {
      try {
        const storage = await getServerStorage();
        const stateDAO = createKnowledgeStateDAO(storage);
        const before = await stateDAO.list(userId);
        const event = await recordAnswerSubmitted({
          storage,
          userId,
          source: 'teaching-quiz',
          correct: isCorrect,
          knowledgePoints: resolvedKnowledgePoints,
          correlationId: `${jobId ?? 'teaching'}:${sectionId ?? 'section'}:${chunkOrder ?? 0}`,
        });
        const after = await stateDAO.list(userId);
        profileUpdate = {
          recorded: Boolean(event),
          evidenceType: 'verified-answer',
          changes: buildTeachingKnowledgeImpacts({
            knowledgePoints: resolvedKnowledgePoints,
            before,
            after,
          }),
          learnerDecision: getLearnerDecision({
            knowledgeStates: after,
            explicitTopic: resolvedKnowledgePoints[0],
          }),
        };
      } catch (profileErr) {
        log.warn('Failed to update learner profile after teaching quiz:', profileErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        correct: isCorrect,
        selectedOption,
        expectedAnswer,
        profileUpdate,
      },
    });
  } catch (error) {
    const message = safeErrorMessage(error);
    log.error('Quiz answer verification failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
