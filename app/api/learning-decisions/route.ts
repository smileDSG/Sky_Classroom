import { z } from 'zod';

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createInterventionDecisionDAO } from '@/lib/adaptive-learning/data/intervention-decisions';
import { recordInterventionPlanned, recordInterventionSelected } from '@/lib/adaptive-learning/profile/event-recorder';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';

const decisionInputSchema = z
  .object({
    sessionId: z.string().min(1).max(160),
    action: z.enum(['teach', 'review', 'quiz', 'diagnostic']),
    topic: z.string().min(1).max(200).nullable(),
    difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
    source: z.string().min(1).max(80),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const parsed = decisionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, 'Invalid learning decision', parsed.error.issues[0]?.message);
  }

  const storage = await getRequiredServerStorage();
  const preferences = await new LearnerProfileRepository(storage).getLatestPreferences(auth.user.id);
  if (!preferences?.privacy.optionalBehaviorSignals) {
    return apiSuccess({ recorded: false, decision: null });
  }
  const decisionId = crypto.randomUUID();
  const correlationId = decisionId;
  const now = new Date().toISOString();
  const plan = {
    id: `baseline:${parsed.data.action}`,
    action: parsed.data.action,
    topic: parsed.data.topic,
    ...(parsed.data.difficulty ? { difficulty: parsed.data.difficulty } : {}),
    rationale: ['client-learning-session'],
  };
  const decision = await createInterventionDecisionDAO(storage).add({
    decisionId,
    userId: auth.user.id,
    sessionId: parsed.data.sessionId,
    stateSnapshot: {
      topic: parsed.data.topic,
      action: parsed.data.action,
      difficulty: parsed.data.difficulty ?? null,
    },
    candidatePlans: [plan],
    selectedPlan: plan,
    fallbackUsed: true,
    modelId: null,
    correlationId,
    createdAt: now,
  });

  await recordInterventionPlanned({
    storage,
    userId: auth.user.id,
    source: parsed.data.source,
    decisionId,
    sessionId: parsed.data.sessionId,
    candidatePlanIds: [plan.id],
    fallbackUsed: true,
    correlationId,
  });
  await recordInterventionSelected({
    storage,
    userId: auth.user.id,
    source: parsed.data.source,
    decisionId,
    planId: plan.id,
    action: parsed.data.action,
    topic: parsed.data.topic,
    correlationId,
  });

  return apiSuccess({ recorded: true, decision }, 201);
}
