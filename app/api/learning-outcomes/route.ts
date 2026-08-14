import { z } from 'zod';

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { createInterventionDecisionDAO } from '@/lib/adaptive-learning/data/intervention-decisions';
import {
  createLearnerOutcomeDAO,
  learnerOutcomeSchema,
} from '@/lib/adaptive-learning/data/learner-outcomes';
import { recordLearningEvent } from '@/lib/adaptive-learning/profile/event-recorder';

const outcomeInputSchema = learnerOutcomeSchema.omit({
  outcomeId: true,
  userId: true,
  createdAt: true,
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = outcomeInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'INVALID_REQUEST',
      400,
      'Invalid learner outcome',
      parsed.error.issues[0]?.message,
    );
  }

  const storage = await getRequiredServerStorage();
  const preferences = await new LearnerProfileRepository(storage).getLatestPreferences(
    auth.user.id,
  );
  if (!preferences?.privacy.optionalBehaviorSignals) {
    return apiSuccess({ recorded: false, reason: 'behavior-signals-disabled' });
  }

  const decision = await createInterventionDecisionDAO(storage).get(parsed.data.decisionId);
  if (!decision || decision.userId !== auth.user.id) {
    return apiError('NOT_FOUND', 404, 'Intervention decision not found');
  }

  const outcomeDAO = createLearnerOutcomeDAO(storage);
  const existingOutcome = await outcomeDAO.getByDecisionId(parsed.data.decisionId);
  if (existingOutcome) return apiSuccess({ recorded: true, outcome: existingOutcome });

  const outcome = await outcomeDAO.add({
    ...parsed.data,
    outcomeId: `outcome:${parsed.data.decisionId}`,
    userId: auth.user.id,
    createdAt: new Date().toISOString(),
  });

  await recordLearningEvent(
    {
      userId: auth.user.id,
      type: outcome.exited ? 'session-exited' : 'session-completed',
      source: 'learning-outcome',
      evidenceQuality: 'verified',
      correlationId: decision.correlationId,
      payload: outcome.exited
        ? {
            decisionId: outcome.decisionId,
            durationSeconds: outcome.durationSeconds,
            reason: 'learner-exited',
          }
        : {
            decisionId: outcome.decisionId,
            durationSeconds: outcome.durationSeconds,
            questionCount: outcome.questionCount,
            correctCount: outcome.correctCount,
          },
    },
    { storage },
  );

  return apiSuccess({ recorded: true, outcome }, 201);
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const storage = await getRequiredServerStorage();
  const dao = createLearnerOutcomeDAO(storage);
  const decisionId = new URL(request.url).searchParams.get('decisionId');

  if (decisionId) {
    const outcome = await dao.getByDecisionId(decisionId);
    if (!outcome || outcome.userId !== auth.user.id) {
      return apiError('NOT_FOUND', 404, 'Learner outcome not found');
    }
    return apiSuccess({ outcome });
  }

  return apiSuccess({ outcomes: await dao.listByUser(auth.user.id) });
}
