import { NextRequest } from 'next/server';

import type {
  LearningPlan,
  PlanningProfileProjection,
} from '@/lib/adaptive-learning/contracts';
import {
  projectLearningPlan,
  type LearningPlanViewKind,
} from '@/lib/adaptive-learning/planning/learning-plan-view';
import { replanLearningPlan } from '@/lib/adaptive-learning/planning/replan-learning-plan';
import {
  buildScheduledLearningPlan,
} from '@/lib/adaptive-learning/planning/scheduled-learning-plan';
import { buildPlanningEvidence } from '@/lib/adaptive-learning/profile/planning-evidence';
import { buildPlanningProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { planningDateFromInstant } from '@/lib/adaptive-learning/planning/learning-plan-date';
import { requireAuth } from '@/lib/server/auth/helpers';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { createLearningPathDAO } from '@/lib/storage/dao/learning-paths';
import { createLearningPlanDAO } from '@/lib/storage/dao/learning-plans';
import type { StorageProvider } from '@/lib/storage/storage-types';
import type { LearningPath, LearningPathNode } from '@/lib/teaching/learning-path-types';

const VALID_VIEWS = new Set<LearningPlanViewKind>(['today', 'week', 'month']);

async function loadPlanningContext(
  storage: StorageProvider,
  userId: string,
  domainProfileId: string,
  now: Date,
) {
  const profileRepository = new LearnerProfileRepository(storage);
  const [preferences, domainProfile, knowledgeStates, learningEvents] = await Promise.all([
    profileRepository.getLatestPreferences(userId),
    profileRepository.getLatestDomainProfile(userId, domainProfileId),
    createKnowledgeStateDAO(storage).list(userId),
    profileRepository.listLearningEvents(userId),
  ]);
  if (!preferences || !domainProfile) return null;

  const evidence = buildPlanningEvidence({
    states: knowledgeStates,
    events: learningEvents,
    targetNodeIds: domainProfile.targetNodeIds,
    now,
  });
  const projection = buildPlanningProjection({
    userId,
    snapshotId: `snapshot:${userId}:v${preferences.version}:w${evidence.eventWatermark}`,
    profileVersion: preferences.version,
    eventWatermark: evidence.eventWatermark,
    preferences,
    domainProfile,
    planningMode:
      domainProfile.examDate && domainProfile.targetScore !== undefined ? 'exam' : 'mastery',
    knowledgeStatus: evidence.knowledgeStatus,
    targetKnowledge: evidence.targetKnowledge,
    engagementSummary: evidence.engagementSummary,
  });

  return { projection, learningEvents };
}

function pathNodeMatchesSignal(
  node: Pick<LearningPathNode, 'topic' | 'knowledgePoints'>,
  signal: { nodeId: string; displayName?: string },
): boolean {
  const labels = new Set([node.topic, ...node.knowledgePoints]);
  return (
    labels.has(signal.nodeId) ||
    (signal.displayName !== undefined && labels.has(signal.displayName))
  );
}

function shouldAutoReplan(
  plan: LearningPlan,
  path: LearningPath,
  projection: PlanningProfileProjection,
  now: Date,
): boolean {
  const snapshot = plan.profileSnapshot;
  if (!('kind' in snapshot) || snapshot.kind !== 'planning') return true;
  if (
    snapshot.profileVersion !== projection.profileVersion ||
    snapshot.eventWatermark !== projection.eventWatermark ||
    snapshot.data.activeDomain.domainProfileId !== projection.data.activeDomain.domainProfileId ||
    snapshot.data.activeDomain.curriculumPackVersion !==
      projection.data.activeDomain.curriculumPackVersion
  ) {
    return true;
  }

  const focus = projection.data.targetKnowledge[0];
  if (!focus) return false;
  const focusNode = path.nodes.find((node) => pathNodeMatchesSignal(node, focus));
  if (!focusNode) return false;

  const today = planningDateFromInstant(now).toISOString().slice(0, 10);
  const nextTask = plan.tasks
    .filter(
      (task) =>
        task.scheduledDate === today &&
        (task.status === 'in-progress' || task.status === 'pending'),
    )
    .sort(
      (left, right) => Number(right.status === 'in-progress') - Number(left.status === 'in-progress'),
    )[0];

  return Boolean(
    nextTask && nextTask.nodeId !== focus.nodeId && nextTask.pathNodeId !== focusNode.id,
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const searchParams = new URL(req.url).searchParams;
    const requestedView = searchParams.get('view') ?? 'today';
    if (!VALID_VIEWS.has(requestedView as LearningPlanViewKind)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'view must be today, week, or month');
    }

    const date = searchParams.get('date');
    const selectedDate = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(selectedDate.getTime()) ||
        selectedDate.toISOString().slice(0, 10) !== date)
    ) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'date must be a valid YYYY-MM-DD');
    }

    const storage = await getRequiredServerStorage();
    const planDAO = createLearningPlanDAO(storage);
    let plan = await planDAO.getActiveByUser(auth.user.id);

    if (!plan) {
      return apiSuccess({ data: { plan: null, view: null } });
    }

    const path = plan.pathId ? await createLearningPathDAO(storage).get(plan.pathId) : null;
    const snapshot = plan.profileSnapshot;
    const domainProfileId =
      'kind' in snapshot && snapshot.kind === 'planning'
        ? snapshot.data.activeDomain.domainProfileId
        : 'default';
    const now = new Date();
    const context = path
      ? await loadPlanningContext(storage, auth.user.id, domainProfileId, now)
      : null;

    if (path && context && shouldAutoReplan(plan, path, context.projection, now)) {
      const proposedPlan = buildScheduledLearningPlan({
        path,
        projection: context.projection,
        evidenceEventIds: context.learningEvents.map((event) => event.eventId),
        now,
        version: plan.version + 1,
      });
      const triggerEventId = `auto-profile-sync:${context.projection.snapshotId}`;
      const result = replanLearningPlan({
        previousPlan: plan,
        proposedPlan,
        mode: 'micro',
        triggerEventIds: [triggerEventId],
        now,
      });
      await planDAO.add(result.plan);
      await planDAO.addAdjustment(result.adjustment);
      await planDAO.update(plan.id, { status: 'superseded' });
      plan = result.plan;
    }

    const view = projectLearningPlan(plan, requestedView as LearningPlanViewKind, selectedDate);
    return apiSuccess({ data: { plan, view } });
  } catch {
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, 'Failed to load learning plan');
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = (await req.json()) as {
      mode?: 'micro' | 'full';
      triggerEventIds?: string[];
      domainProfileId?: string;
    };
    if (body.mode !== 'micro' && body.mode !== 'full') {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'mode must be micro or full');
    }
    if (
      !Array.isArray(body.triggerEventIds) ||
      body.triggerEventIds.length === 0 ||
      body.triggerEventIds.some((id) => typeof id !== 'string' || !id.trim())
    ) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        'triggerEventIds must contain at least one event id',
      );
    }

    const storage = await getRequiredServerStorage();
    const planDAO = createLearningPlanDAO(storage);
    const previousPlan = await planDAO.getActiveByUser(auth.user.id);
    if (!previousPlan) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Active learning plan not found');
    }

    const path = previousPlan.pathId
      ? await createLearningPathDAO(storage).get(previousPlan.pathId)
      : null;
    if (!path || path.userId !== auth.user.id) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Learning path for active plan not found');
    }

    const snapshot = previousPlan.profileSnapshot;
    const snapshotDomainProfileId =
      'kind' in snapshot && snapshot.kind === 'planning'
        ? snapshot.data.activeDomain.domainProfileId
        : undefined;
    const domainProfileId = body.domainProfileId ?? snapshotDomainProfileId ?? 'default';
    const now = new Date();
    const context = await loadPlanningContext(storage, auth.user.id, domainProfileId, now);
    if (!context) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 422, 'Learner profile is incomplete');
    }
    const proposedPlan = buildScheduledLearningPlan({
      path,
      projection: context.projection,
      evidenceEventIds: context.learningEvents.map((event) => event.eventId),
      now,
      version: previousPlan.version + 1,
    });
    const { plan, adjustment } = replanLearningPlan({
      previousPlan,
      proposedPlan,
      mode: body.mode,
      triggerEventIds: body.triggerEventIds,
      now,
    });

    await planDAO.add(plan);
    await planDAO.addAdjustment(adjustment);
    await planDAO.update(previousPlan.id, { status: 'superseded' });

    return apiSuccess({ data: { plan, adjustment } });
  } catch {
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, 'Failed to replan learning plan');
  }
}
