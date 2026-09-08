import { describe, expect, it } from 'vitest';

import type { LearningPlan, LearningTask } from '@/lib/adaptive-learning/contracts';
import { replanLearningPlan } from '@/lib/adaptive-learning/planning/replan-learning-plan';

function makeTask(
  id: string,
  scheduledDate: string,
  status: LearningTask['status'] = 'pending',
): LearningTask {
  return {
    id,
    pathNodeId: 'path-node-1',
    nodeId: 'derivative-concept',
    type: 'practice',
    title: id,
    objective: 'Improve mastery',
    plannedMinutes: 30,
    difficulty: 2,
    resourceIds: [],
    successCriteria: ['Complete task'],
    status,
    scheduledDate,
    reasonCodes: ['low-mastery'],
  };
}

function makePlan(
  id: string,
  validFrom: string,
  validTo: string,
  tasks: LearningTask[],
): LearningPlan {
  return {
    id,
    userId: 'user-1',
    pathId: 'path-1',
    version: id === 'plan-old' ? 1 : 2,
    status: 'active',
    generatedAt: `${validFrom}T00:00:00.000Z`,
    validFrom,
    validTo,
    curriculumPackVersion: '2026.1',
    plannerVersion: '2.0.0',
    profileSnapshot: {
      userId: 'user-1',
      stage: 'senior-high',
      grade: 'grade-12',
      subject: 'math',
      curriculumPackVersion: '2026.1',
      examDate: '2026-09-03',
      weeklyAvailableMinutes: 180,
      dailyAvailability: { thu: 60 },
      preferredSessionMinutes: 30,
      constraints: {
        restDays: ['sun'],
        maxDailyMinutes: 60,
        teacherLockedNodeIds: [],
      },
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    tasks,
    weeklyTargets: [],
    constraintChecks: ['daily-capacity-respected'],
    evidenceEventIds: [],
  };
}

describe('replanLearningPlan', () => {
  it('micro replanning replaces only pending tasks in the next 48 hours', () => {
    const previousPlan = makePlan('plan-old', '2026-08-01', '2026-08-28', [
      makeTask('completed', '2026-08-05', 'completed'),
      makeTask('in-progress', '2026-08-06', 'in-progress'),
      makeTask('old-today', '2026-08-06'),
      makeTask('old-tomorrow', '2026-08-07'),
      makeTask('old-later', '2026-08-08'),
    ]);
    const proposedPlan = makePlan('plan-new', '2026-08-06', '2026-09-02', [
      makeTask('new-today', '2026-08-06'),
      makeTask('new-tomorrow', '2026-08-07'),
      makeTask('new-later', '2026-08-08'),
    ]);

    const result = replanLearningPlan({
      previousPlan,
      proposedPlan,
      mode: 'micro',
      triggerEventIds: ['event-1'],
      now: new Date('2026-08-06T00:00:00.000Z'),
      adjustmentId: 'adjustment-1',
    });

    expect(result.plan.tasks.map((task) => task.id)).toEqual([
      'completed',
      'in-progress',
      'new-today',
      'new-tomorrow',
      'old-later',
    ]);
    expect(result.plan.version).toBe(2);
    expect(result.adjustment.preservedTaskIds).toEqual(['completed', 'in-progress', 'old-later']);
    expect(result.adjustment.changedTaskIds).toEqual([
      'old-today',
      'old-tomorrow',
      'new-today',
      'new-tomorrow',
    ]);
    expect(result.adjustment.ruleEvidence).toEqual([
      {
        nodeId: 'derivative-concept',
        reasonCode: 'micro-window-recomputed',
        before: 2,
        after: 2,
      },
    ]);
    expect(
      result.plan.weeklyTargets.reduce((total, target) => total + target.plannedMinutes, 0),
    ).toBe(result.plan.tasks.reduce((total, task) => total + task.plannedMinutes, 0));
  });

  it('full replanning replaces every future pending task but preserves task history', () => {
    const previousPlan = makePlan('plan-old', '2026-08-01', '2026-08-28', [
      makeTask('completed', '2026-08-05', 'completed'),
      makeTask('overdue-pending', '2026-08-05'),
      makeTask('in-progress', '2026-08-06', 'in-progress'),
      makeTask('old-today', '2026-08-06'),
      makeTask('old-later', '2026-08-20'),
    ]);
    const proposedPlan = makePlan('plan-new', '2026-08-06', '2026-09-02', [
      makeTask('new-today', '2026-08-06'),
      makeTask('new-later', '2026-08-20'),
    ]);

    const result = replanLearningPlan({
      previousPlan,
      proposedPlan,
      mode: 'full',
      triggerEventIds: ['event-2'],
      now: new Date('2026-08-06T00:00:00.000Z'),
      adjustmentId: 'adjustment-2',
    });

    expect(result.plan.tasks.map((task) => task.id)).toEqual([
      'completed',
      'overdue-pending',
      'in-progress',
      'new-today',
      'new-later',
    ]);
    expect(result.adjustment.preservedTaskIds).toEqual([
      'completed',
      'overdue-pending',
      'in-progress',
    ]);
  });

  it('does not duplicate a preserved task regenerated with a new id', () => {
    const activeTask = makeTask('active', '2026-08-06', 'in-progress');
    const regeneratedTask = { ...activeTask, id: 'regenerated', status: 'pending' as const };

    const result = replanLearningPlan({
      previousPlan: makePlan('plan-old', '2026-08-01', '2026-08-28', [activeTask]),
      proposedPlan: makePlan('plan-new', '2026-08-06', '2026-09-02', [regeneratedTask]),
      mode: 'micro',
      triggerEventIds: ['event-3'],
      now: new Date('2026-08-06T00:00:00.000Z'),
      adjustmentId: 'adjustment-3',
    });

    expect(result.plan.tasks.map((task) => task.id)).toEqual(['active']);
    expect(result.adjustment.changedTaskIds).toEqual([]);
    expect(result.adjustment.preservedTaskIds).toEqual(['active']);
  });
});
