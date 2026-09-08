import { z } from 'zod';

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { createLearnerReflectionDAO } from '@/lib/adaptive-learning/data/learner-reflections';
import {
  getReflectionTriggerStatus,
  runLearnerReflection,
} from '@/lib/adaptive-learning/profile/reflection-service';

const runInputSchema = z.object({ run: z.boolean().optional() }).strict();

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const storage = await getRequiredServerStorage();
  const preferences = await new LearnerProfileRepository(storage).getLatestPreferences(
    auth.user.id,
  );
  if (!preferences?.privacy.optionalBehaviorSignals) {
    return apiSuccess({ reflection: null, reason: 'behavior-signals-disabled' });
  }
  const reflection = await createLearnerReflectionDAO(storage).getLatest(auth.user.id);
  return apiSuccess({ reflection });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const parsed = runInputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError('INVALID_REQUEST', 400, 'Invalid reflection request');
  const storage = await getRequiredServerStorage();
  const preferences = await new LearnerProfileRepository(storage).getLatestPreferences(
    auth.user.id,
  );
  if (!preferences?.privacy.optionalBehaviorSignals) {
    return apiSuccess({ recorded: false, reflection: null, reason: 'behavior-signals-disabled' });
  }
  const events = await new LearnerProfileRepository(storage).listLearningEvents(auth.user.id);
  const status = await getReflectionTriggerStatus(storage, auth.user.id, events);
  const reflection =
    parsed.data.run === false || !status.shouldRun
      ? status.latestReflection
      : await runLearnerReflection({ storage, userId: auth.user.id, events });
  return apiSuccess({ recorded: Boolean(reflection), reflection, status });
}
