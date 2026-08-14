import { beforeEach, describe, expect, it } from 'vitest';

import type { LearningPlan } from '@/lib/adaptive-learning/contracts';
import { createLearningPlanDAO } from '@/lib/storage/dao/learning-plans';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

const storage = new MemoryStorageProvider();

function makePlan(id: string, generatedAt: string, status: LearningPlan['status']): LearningPlan {
  return {
    id,
    userId: 'user-1',
    pathId: 'path-1',
    version: 1,
    status,
    generatedAt,
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
      targetScore: 130,
      latestScore: 95,
      weeklyAvailableMinutes: 180,
      dailyAvailability: { mon: 60 },
      preferredSessionMinutes: 30,
      constraints: {
        restDays: ['sun'],
        maxDailyMinutes: 60,
        teacherLockedNodeIds: [],
      },
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
    },
    tasks: [],
    weeklyTargets: [],
    constraintChecks: ['daily-capacity-respected'],
    evidenceEventIds: [],
  };
}

beforeEach(async () => {
  await storage.clear('learning_plans');
  await storage.clear('learning_plan_adjustments');
});

describe('LearningPlanDAO', () => {
  it('returns the most recently generated active plan for a user', async () => {
    const dao = createLearningPlanDAO(storage);
    await dao.add(makePlan('plan-old', '2026-08-03T00:00:00.000Z', 'superseded'));
    await dao.add(makePlan('plan-new', '2026-08-04T00:00:00.000Z', 'active'));

    const active = await dao.getActiveByUser('user-1');

    expect(active?.id).toBe('plan-new');
  });
});
