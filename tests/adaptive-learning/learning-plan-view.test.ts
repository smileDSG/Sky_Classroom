import { describe, expect, it } from 'vitest';

import type { LearningPlan } from '@/lib/adaptive-learning/contracts';
import { projectLearningPlan } from '@/lib/adaptive-learning/planning/learning-plan-view';

function makePlan(): LearningPlan {
  return {
    id: 'plan-1',
    userId: 'user-1',
    pathId: 'path-1',
    version: 1,
    status: 'active',
    generatedAt: '2026-08-03T00:00:00.000Z',
    validFrom: '2026-08-03',
    validTo: '2026-08-30',
    curriculumPackVersion: '2026.1',
    plannerVersion: '2.0.0',
    profileSnapshot: {
      userId: 'user-1',
      stage: 'senior-high',
      grade: 'grade-12',
      subject: 'math',
      curriculumPackVersion: '2026.1',
      examDate: '2026-09-01',
      weeklyAvailableMinutes: 180,
      dailyAvailability: { mon: 60, tue: 60, wed: 60 },
      preferredSessionMinutes: 30,
      constraints: {
        restDays: ['sun'],
        maxDailyMinutes: 60,
        teacherLockedNodeIds: [],
      },
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
    },
    tasks: [
      {
        id: 'task-1',
        pathNodeId: 'node-1',
        nodeId: 'derivative-concept',
        type: 'learn',
        title: '学习导数',
        objective: '理解导数',
        plannedMinutes: 30,
        difficulty: 2,
        resourceIds: [],
        successCriteria: ['完成学习'],
        status: 'completed',
        scheduledDate: '2026-08-03',
        reasonCodes: ['low-mastery'],
      },
      {
        id: 'task-2',
        pathNodeId: 'node-1',
        nodeId: 'derivative-concept',
        type: 'practice',
        title: '练习导数',
        objective: '巩固导数',
        plannedMinutes: 30,
        difficulty: 3,
        resourceIds: [],
        successCriteria: ['完成练习'],
        status: 'pending',
        scheduledDate: '2026-08-05',
        reasonCodes: ['low-mastery'],
      },
      {
        id: 'task-3',
        pathNodeId: 'node-2',
        nodeId: 'derivative-rules',
        type: 'review',
        title: '复习运算法则',
        objective: '保持记忆',
        plannedMinutes: 15,
        difficulty: 2,
        resourceIds: [],
        successCriteria: ['完成复习'],
        status: 'pending',
        scheduledDate: '2026-08-12',
        reasonCodes: ['retention-risk'],
      },
    ],
    weeklyTargets: [
      {
        weekStart: '2026-08-03',
        targetNodeIds: ['derivative-concept'],
        plannedMinutes: 60,
        expectedOutcomes: ['完成导数基础'],
      },
      {
        weekStart: '2026-08-10',
        targetNodeIds: ['derivative-rules'],
        plannedMinutes: 15,
        expectedOutcomes: ['复习运算法则'],
      },
    ],
    constraintChecks: ['daily-capacity-respected'],
    evidenceEventIds: [],
  };
}

describe('learning plan views', () => {
  it('projects only the selected day from the active rolling plan', () => {
    const view = projectLearningPlan(makePlan(), 'today', new Date('2026-08-05T00:00:00.000Z'));

    expect(view.from).toBe('2026-08-05');
    expect(view.to).toBe('2026-08-05');
    expect(view.tasks.map((task) => task.id)).toEqual(['task-2']);
    expect(view.summary).toMatchObject({ totalTasks: 1, plannedMinutes: 30 });
    expect(view.nextTask?.id).toBe('task-2');
  });

  it('projects the calendar week without creating another stored plan', () => {
    const view = projectLearningPlan(makePlan(), 'week', new Date('2026-08-05T00:00:00.000Z'));

    expect(view.from).toBe('2026-08-03');
    expect(view.to).toBe('2026-08-09');
    expect(view.tasks.map((task) => task.id)).toEqual(['task-1', 'task-2']);
    expect(view.weeklyTargets.map((target) => target.weekStart)).toEqual(['2026-08-03']);
    expect(view.summary).toMatchObject({ totalTasks: 2, completedTasks: 1, completionRate: 50 });
  });

  it('uses the rolling plan validity window as the month view', () => {
    const view = projectLearningPlan(makePlan(), 'month', new Date('2026-08-20T00:00:00.000Z'));

    expect(view.from).toBe('2026-08-03');
    expect(view.to).toBe('2026-08-30');
    expect(view.tasks.map((task) => task.id)).toEqual(['task-1', 'task-2', 'task-3']);
    expect(view.weeklyTargets).toHaveLength(2);
    expect(view.summary.plannedMinutes).toBe(75);
  });

  it('keeps a weekly target when its calendar week overlaps the month window', () => {
    const plan = makePlan();
    plan.validFrom = '2026-08-06';
    plan.tasks = plan.tasks.filter((task) => task.scheduledDate >= plan.validFrom);
    plan.weeklyTargets = [
      {
        weekStart: '2026-08-03',
        targetNodeIds: ['derivative-concept'],
        plannedMinutes: 30,
        expectedOutcomes: ['完成首周任务'],
      },
    ];

    const view = projectLearningPlan(plan, 'month', new Date('2026-08-06T00:00:00.000Z'));

    expect(view.weeklyTargets.map((target) => target.weekStart)).toEqual(['2026-08-03']);
  });
});
