import type { LearningTask } from '@/lib/adaptive-learning/contracts';
import { sameKnowledgePoint } from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';
import { refreshLearningPlanAfterEvidence } from './refresh-learning-plan';

function matchesEvidence(taskNodeId: string | undefined, knowledgePoints: string[]): boolean {
  if (!taskNodeId) return false;
  return knowledgePoints.some((point) => sameKnowledgePoint(taskNodeId, point));
}

/**
 * Complete only a matching practice/review task after a verified tool result.
 * Unrelated evidence leaves the plan untouched and manual completion remains
 * available for tools that need a longer session.
 */
export async function completeLearningPlanTaskFromEvidence(
  knowledgePoints: string[],
  allowedTaskTypes: LearningTask['type'][] = ['practice', 'diagnostic'],
): Promise<boolean> {
  if (knowledgePoints.length === 0) return false;

  const snapshot = await refreshLearningPlanAfterEvidence();
  const task = snapshot?.view?.nextTask;
  if (
    !task?.id ||
    (task.type && !allowedTaskTypes.includes(task.type as LearningTask['type'])) ||
    !matchesEvidence(task.nodeId, knowledgePoints)
  ) {
    return false;
  }

  try {
    const response = await fetch(
      `/api/sky/learning-plan/tasks/${encodeURIComponent(task.id)}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      },
    );
    const payload = (await response.json().catch(() => null)) as { success?: boolean } | null;
    return response.ok && payload?.success === true;
  } catch {
    return false;
  }
}
