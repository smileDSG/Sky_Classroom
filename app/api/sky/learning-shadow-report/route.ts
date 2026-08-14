import { buildAbilityShadowReport } from '@/lib/adaptive-learning/profile/shadow-report-service';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { requireAuth } from '@/lib/server/auth/helpers';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createInterventionDecisionDAO } from '@/lib/adaptive-learning/data/intervention-decisions';
import { createLearnerOutcomeDAO } from '@/lib/adaptive-learning/data/learner-outcomes';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const storage = await getRequiredServerStorage();
    const [events, decisions, outcomes] = await Promise.all([
      new LearnerProfileRepository(storage).listLearningEvents(auth.user.id),
      createInterventionDecisionDAO(storage).listByUser(auth.user.id),
      createLearnerOutcomeDAO(storage).listByUser(auth.user.id),
    ]);
    return apiSuccess({ ...buildAbilityShadowReport(events, decisions, outcomes) });
  } catch {
    return apiError('INTERNAL_ERROR', 500, '影子评估报告加载失败');
  }
}
