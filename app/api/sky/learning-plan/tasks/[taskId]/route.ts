import { NextRequest } from 'next/server';
import { z } from 'zod';

import { buildWeeklyTargets } from '@/lib/adaptive-learning/planning/scheduled-learning-plan';
import { syncLearningPathNodeFromTask } from '@/lib/adaptive-learning/planning/path-task-sync';
import { recordLearningEvent } from '@/lib/adaptive-learning/profile/event-recorder';
import { requireAuth } from '@/lib/server/auth/helpers';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createLearningPlanDAO } from '@/lib/storage/dao/learning-plans';

const taskStatusSchema = z.enum(['in-progress', 'completed', 'skipped']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { taskId } = await params;
  if (!taskId) {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'taskId is required');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Request body must be valid JSON');
  }

  const parsed = z
    .object({ status: taskStatusSchema })
    .strict()
    .safeParse(body);
  if (!parsed.success) {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'status must be in-progress, completed, or skipped');
  }

  try {
    const storage = await getRequiredServerStorage();
    const planDAO = createLearningPlanDAO(storage);
    const plan = await planDAO.getActiveByUser(auth.user.id);
    if (!plan) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Active learning plan not found');
    }

    const task = plan.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Learning plan task not found');
    }

    const status = parsed.data.status;
    if (task.status === status) {
      return apiSuccess({ data: { plan, task, event: null } });
    }
    if (task.status === 'completed' || task.status === 'skipped') {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 409, 'Completed or skipped tasks cannot be changed');
    }

    const tasks = plan.tasks.map((candidate) =>
      candidate.id === taskId ? { ...candidate, status } : candidate,
    );
    const allFinished = tasks.length > 0 && tasks.every(
      (candidate) => candidate.status === 'completed' || candidate.status === 'skipped',
    );
    const updatedPlan = await planDAO.update(plan.id, {
      tasks,
      weeklyTargets: buildWeeklyTargets(tasks),
      status: allFinished ? 'completed' : 'active',
    });
    if (!updatedPlan) {
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, 'Failed to update learning plan');
    }

    let pathSync: Awaited<ReturnType<typeof syncLearningPathNodeFromTask>> = null;
    try {
      pathSync = await syncLearningPathNodeFromTask(
        storage,
        auth.user.id,
        updatedPlan.pathId,
        { ...task, status },
        status,
      );
    } catch {
      // Route synchronization is secondary to the task status update.
    }

    const event = await recordLearningEvent(
      {
        userId: auth.user.id,
        type: status === 'in-progress' ? 'task-started' : 'task-completed',
        source: 'learning-plan-task',
        nodeIds: [task.nodeId],
        evidenceQuality: 'self-reported',
        payload: {
          taskId: task.id,
          taskType: task.type,
          status,
          plannedMinutes: task.plannedMinutes,
          knowledgePoints: [task.nodeId],
        },
        correlationId: task.id,
      },
      { storage },
    );

    return apiSuccess({
      data: {
        plan: updatedPlan,
        task: { ...task, status },
        event,
        path: pathSync?.path ?? null,
        pathNode: pathSync?.node ?? null,
      },
    });
  } catch {
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, 'Failed to update learning plan task');
  }
}
