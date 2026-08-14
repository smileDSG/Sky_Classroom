import {
  getLearnerDecision,
  type LearnerDecision,
} from '@/lib/adaptive-learning/decision/learner-decision';
import { getAbilityState } from '@/lib/adaptive-learning/profile/ability-state-repository';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { getServerStorage } from '@/lib/server/server-storage';
import {
  teachingPolicyFromLearnerDecision,
  type TeachingGenerationPolicy,
} from '@/lib/teaching/personalization-policy';

/** Resolve a safe server-side default when caller did not send a policy. */
export async function resolveLearnerDecisionForUser(
  userId: string,
  topic?: string,
): Promise<LearnerDecision | undefined> {
  try {
    const storage = await getServerStorage();
    const [knowledgeStates, abilityState] = await Promise.all([
      createKnowledgeStateDAO(storage).list(userId),
      getAbilityState(storage, userId, 'math'),
    ]);

    const decision = getLearnerDecision({
      knowledgeStates,
      explicitTopic: topic ?? null,
      abilityTheta: abilityState?.theta,
    });
    return decision;
  } catch {
    // Personalization is an enhancement; generation must remain available if storage is degraded.
    return undefined;
  }
}

export async function resolveTeachingPersonalizationPolicy(
  userId: string,
  topic?: string,
): Promise<TeachingGenerationPolicy | undefined> {
  const decision = await resolveLearnerDecisionForUser(userId, topic);
  return decision ? teachingPolicyFromLearnerDecision(decision) : undefined;
}
