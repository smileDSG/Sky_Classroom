import { nanoid } from 'nanoid';

import {
  learningPlanSchema,
  planAdjustmentSchema,
  type LearningPlan,
  type LearningTask,
  type PlanAdjustment,
} from '@/lib/adaptive-learning/contracts';
import { planningDateFromInstant } from '@/lib/adaptive-learning/planning/learning-plan-date';
import { buildWeeklyTargets } from '@/lib/adaptive-learning/planning/scheduled-learning-plan';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReplanLearningPlanInput {
  previousPlan: LearningPlan;
  proposedPlan: LearningPlan;
  mode: PlanAdjustment['mode'];
  triggerEventIds: string[];
  now?: Date;
  adjustmentId?: string;
}

export interface ReplanLearningPlanResult {
  plan: LearningPlan;
  adjustment: PlanAdjustment;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isReplaceable(
  task: LearningTask,
  mode: PlanAdjustment['mode'],
  from: string,
  microToExclusive: string,
): boolean {
  if (task.status !== 'pending' || task.scheduledDate < from) return false;
  return mode === 'full' || task.scheduledDate < microToExclusive;
}

function taskFingerprint(task: LearningTask): string {
  return [
    task.scheduledDate,
    task.pathNodeId ?? '',
    task.nodeId,
    task.type,
    task.title,
    task.objective,
  ].join('|');
}

function buildRuleEvidence(
  replacedTasks: LearningTask[],
  replacementTasks: LearningTask[],
  mode: PlanAdjustment['mode'],
): PlanAdjustment['ruleEvidence'] {
  const nodeIds = Array.from(
    new Set([
      ...replacedTasks.map((task) => task.nodeId),
      ...replacementTasks.map((task) => task.nodeId),
    ]),
  ).sort();

  return nodeIds.map((nodeId) => ({
    nodeId,
    reasonCode: `${mode}-window-recomputed`,
    before: replacedTasks.filter((task) => task.nodeId === nodeId).length,
    after: replacementTasks.filter((task) => task.nodeId === nodeId).length,
  }));
}

export function replanLearningPlan(input: ReplanLearningPlanInput): ReplanLearningPlanResult {
  if (input.previousPlan.userId !== input.proposedPlan.userId) {
    throw new Error('Cannot replan across users');
  }
  if (input.previousPlan.pathId !== input.proposedPlan.pathId) {
    throw new Error('Cannot replan across learning paths');
  }

  const now = input.now ?? new Date();
  const learnerDate = planningDateFromInstant(now);
  const from = formatDate(learnerDate);
  const microToExclusive = formatDate(new Date(learnerDate.getTime() + 2 * DAY_MS));
  const replacedTasks = input.previousPlan.tasks.filter((task) =>
    isReplaceable(task, input.mode, from, microToExclusive),
  );
  const preservedTasks = input.previousPlan.tasks.filter(
    (task) => !isReplaceable(task, input.mode, from, microToExclusive),
  );
  const preservedTaskFingerprints = new Set(preservedTasks.map(taskFingerprint));
  const replacementTasks = input.proposedPlan.tasks.filter(
    (task) =>
      isReplaceable(task, input.mode, from, microToExclusive) &&
      !preservedTaskFingerprints.has(taskFingerprint(task)),
  );
  const tasks = [...preservedTasks, ...replacementTasks].sort((left, right) =>
    left.scheduledDate.localeCompare(right.scheduledDate),
  );
  const validFrom =
    input.previousPlan.validFrom < input.proposedPlan.validFrom
      ? input.previousPlan.validFrom
      : input.proposedPlan.validFrom;
  const validTo =
    input.previousPlan.validTo > input.proposedPlan.validTo
      ? input.previousPlan.validTo
      : input.proposedPlan.validTo;

  const plan = learningPlanSchema.parse({
    ...input.proposedPlan,
    version: input.previousPlan.version + 1,
    generatedAt: now.toISOString(),
    validFrom,
    validTo,
    status: tasks.length > 0 ? 'active' : 'draft',
    tasks,
    weeklyTargets: buildWeeklyTargets(tasks),
    constraintChecks: Array.from(
      new Set([
        ...input.proposedPlan.constraintChecks,
        `replan-${input.mode}`,
        'completed-and-in-progress-preserved',
      ]),
    ),
    evidenceEventIds: Array.from(
      new Set([
        ...input.previousPlan.evidenceEventIds,
        ...input.proposedPlan.evidenceEventIds,
        ...input.triggerEventIds,
      ]),
    ),
  });

  const adjustment = planAdjustmentSchema.parse({
    id: input.adjustmentId ?? `adjustment-${nanoid(10)}`,
    userId: input.previousPlan.userId,
    previousPlanId: input.previousPlan.id,
    nextPlanId: plan.id,
    mode: input.mode,
    triggerEventIds: input.triggerEventIds,
    changedTaskIds: [
      ...replacedTasks.map((task) => task.id),
      ...replacementTasks.map((task) => task.id),
    ],
    preservedTaskIds: preservedTasks.map((task) => task.id),
    ruleEvidence: buildRuleEvidence(replacedTasks, replacementTasks, input.mode),
    explanation:
      `${input.mode} replan replaced ${replacedTasks.length} pending tasks ` +
      `with ${replacementTasks.length} updated tasks`,
    createdAt: now.toISOString(),
  });

  return { plan, adjustment };
}
