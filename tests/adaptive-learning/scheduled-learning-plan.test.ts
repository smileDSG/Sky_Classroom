import { describe, expect, it } from 'vitest';

import { buildPlanningProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import {
  buildScheduledLearningPlan,
  buildWeeklyTargets,
} from '@/lib/adaptive-learning/planning/scheduled-learning-plan';
import type {
  DomainLearnerProfile,
  LearnerPreferences,
  LearningTask,
} from '@/lib/adaptive-learning/contracts';
import type { LearningPath } from '@/lib/teaching/learning-path-types';

function makePreferences(): LearnerPreferences {
  return {
    userId: 'user-1',
    preferredLanguage: 'zh-CN',
    contentFormatPreferences: ['worked-example', 'interactive'],
    explanationDepth: 'detailed',
    learningPace: 'standard',
    stepByStepMode: 'when-needed',
    interactionTone: 'encouraging',
    assistantName: '小云',
    preferenceNotes: '',
    privacy: {
      conversationMemory: 'session',
      optionalBehaviorSignals: false,
      privateKnowledgeRetrieval: false,
    },
    version: 1,
    schemaVersion: '1.0.0',
    updatedAt: '2026-08-03T00:00:00.000Z',
    updatedBy: 'user',
  };
}

function makeDomainProfile(): DomainLearnerProfile {
  return {
    id: 'default',
    userId: 'user-1',
    subjectId: 'math',
    educationStage: 'senior-high',
    gradeLevel: 'grade-12',
    curriculumPackId: 'gaokao-math-2026.1',
    curriculumPackVersion: '2026.1',
    examSystem: 'gaokao',
    examDate: '2026-09-01',
    targetScore: 130,
    scoreScaleMax: 150,
    latestVerifiedScore: 95,
    weeklyAvailableMinutes: 180,
    dailyAvailability: { mon: 60, tue: 60, wed: 60, thu: 60, fri: 60, sat: 0, sun: 0 },
    preferredSessionMinutes: 30,
    constraints: {
      restDays: ['sun'],
      maxDailyMinutes: 60,
      teacherLockedNodeIds: [],
    },
    status: 'active',
    version: 1,
    schemaVersion: '1.0.0',
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  };
}

function makePath(): LearningPath {
  return {
    id: 'path-1',
    userId: 'user-1',
    title: '导数提升路径',
    nodes: [
      {
        id: 'path-node-1',
        topic: 'derivative-concept',
        knowledgePoints: ['derivative-concept'],
        estimatedSections: 2,
        prerequisites: [],
        status: 'in_progress',
        masteryBefore: 40,
      },
      {
        id: 'path-node-2',
        topic: 'derivative-rules',
        knowledgePoints: ['derivative-rules'],
        estimatedSections: 2,
        prerequisites: ['derivative-concept'],
        status: 'pending',
        masteryBefore: 20,
      },
    ],
    createdAt: Date.parse('2026-08-03T00:00:00.000Z'),
    updatedAt: Date.parse('2026-08-03T00:00:00.000Z'),
  };
}

describe('scheduled learning plan', () => {
  it('turns path nodes into a constrained 28-day task schedule', () => {
    const projection = buildPlanningProjection({
      userId: 'user-1',
      snapshotId: 'snapshot:user-1:v1:w2',
      profileVersion: 1,
      eventWatermark: 2,
      preferences: makePreferences(),
      domainProfile: makeDomainProfile(),
      planningMode: 'exam',
      knowledgeStatus: 'ready',
      targetKnowledge: [
        {
          nodeId: 'derivative-concept',
          mastery: 0.4,
          confidence: 0.7,
          retention: 0.8,
          reviewStabilityDays: 7,
          evidenceCount: 4,
          reasonCodes: ['low-mastery'],
        },
      ],
      engagementSummary: { studyMinutes7d: 120, activeDays7d: 3 },
    });

    const plan = buildScheduledLearningPlan({
      path: makePath(),
      projection,
      evidenceEventIds: ['event-1', 'event-2'],
      now: new Date('2026-08-03T00:00:00.000Z'),
      planId: 'plan-1',
    });

    expect(plan.pathId).toBe('path-1');
    expect(plan.validFrom).toBe('2026-08-03');
    expect(plan.validTo).toBe('2026-08-30');
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.tasks.every((task) => task.pathNodeId)).toBe(true);
    expect(plan.tasks.some((task) => task.pathNodeId === 'path-node-2')).toBe(true);
    expect(
      plan.tasks.every(
        (task) => new Date(`${task.scheduledDate}T00:00:00.000Z`).getUTCDay() !== 0,
      ),
    ).toBe(true);

    const minutesByDate = new Map<string, number>();
    for (const task of plan.tasks) {
      minutesByDate.set(
        task.scheduledDate,
        (minutesByDate.get(task.scheduledDate) ?? 0) + task.plannedMinutes,
      );
    }
    expect([...minutesByDate.values()].every((minutes) => minutes <= 60)).toBe(true);
    expect(plan.weeklyTargets.every((target) => target.plannedMinutes <= 180)).toBe(true);
  });

  it('groups weekly targets by calendar weeks starting on Monday', () => {
    const task = (id: string, scheduledDate: string): LearningTask => ({
      id,
      pathNodeId: 'path-node-1',
      nodeId: 'derivative-concept',
      type: 'practice',
      title: id,
      objective: 'Practice derivatives',
      plannedMinutes: 30,
      difficulty: 2,
      resourceIds: [],
      successCriteria: ['Complete task'],
      status: 'pending',
      scheduledDate,
      reasonCodes: ['low-mastery'],
    });

    const targets = buildWeeklyTargets([
      task('thu-task', '2026-08-06'),
      task('mon-task', '2026-08-10'),
    ]);

    expect(targets.map((target) => target.weekStart)).toEqual(['2026-08-03', '2026-08-10']);
  });

  it('matches a localized path topic through the profile signal display name', () => {
    const projection = buildPlanningProjection({
      userId: 'user-1',
      snapshotId: 'snapshot:user-1:v1:w1',
      profileVersion: 1,
      eventWatermark: 1,
      preferences: makePreferences(),
      domainProfile: makeDomainProfile(),
      planningMode: 'exam',
      knowledgeStatus: 'ready',
      targetKnowledge: [
        {
          nodeId: 'derivative-concept',
          displayName: '导数概念',
          mastery: 0.4,
          confidence: 0.7,
          retention: 0.8,
          reviewStabilityDays: 7,
          evidenceCount: 4,
          reasonCodes: ['low-mastery'],
        },
      ],
      engagementSummary: { studyMinutes7d: 60, activeDays7d: 2 },
    });
    const path = makePath();
    path.nodes = [
      {
        ...path.nodes[0]!,
        topic: '导数概念',
        knowledgePoints: ['导数概念'],
      },
    ];

    const plan = buildScheduledLearningPlan({
      path,
      projection,
      now: new Date('2026-08-03T00:00:00.000Z'),
      planId: 'plan-localized',
    });

    expect(plan.tasks.some((task) => task.type === 'learn')).toBe(true);
    expect(plan.tasks.some((task) => task.type === 'diagnostic')).toBe(false);
  });

  it('uses the learner day in Asia/Shanghai instead of the UTC calendar day', () => {
    const projection = buildPlanningProjection({
      userId: 'user-1',
      snapshotId: 'snapshot:user-1:v1:w0',
      profileVersion: 1,
      eventWatermark: 0,
      preferences: makePreferences(),
      domainProfile: makeDomainProfile(),
      planningMode: 'exam',
    });

    const plan = buildScheduledLearningPlan({
      path: makePath(),
      projection,
      now: new Date('2026-08-05T17:00:00.000Z'),
      planId: 'plan-timezone',
    });

    expect(plan.validFrom).toBe('2026-08-06');
  });
});
