import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import type { LearningPlan } from '@/lib/adaptive-learning/contracts';
import { createLearningPlanDAO } from '@/lib/storage/dao/learning-plans';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';

const boundary = vi.hoisted(() => ({
  userId: 'user-plan',
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: boundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getRequiredServerStorage: vi.fn(async () => boundary.storage),
}));

vi.mock('server-only', () => ({}));

import { GET } from '@/app/api/sky/learning-plan/route';

const storage = new MemoryStorageProvider();
boundary.storage = storage;

function makePlan(): LearningPlan {
  return {
    id: 'plan-1',
    userId: boundary.userId,
    pathId: 'path-1',
    version: 1,
    status: 'active',
    generatedAt: '2026-08-06T00:00:00.000Z',
    validFrom: '2026-08-06',
    validTo: '2026-09-02',
    curriculumPackVersion: '2026.1',
    plannerVersion: '2.0.0',
    profileSnapshot: {
      userId: boundary.userId,
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
      createdAt: '2026-08-06T00:00:00.000Z',
      updatedAt: '2026-08-06T00:00:00.000Z',
    },
    tasks: [
      {
        id: 'task-today',
        pathNodeId: 'path-node-1',
        nodeId: 'derivative-concept',
        type: 'practice',
        title: '导数练习',
        objective: '巩固导数',
        plannedMinutes: 30,
        difficulty: 2,
        resourceIds: [],
        successCriteria: ['完成练习'],
        status: 'pending',
        scheduledDate: '2026-08-06',
        reasonCodes: ['low-mastery'],
      },
    ],
    weeklyTargets: [],
    constraintChecks: ['daily-capacity-respected'],
    evidenceEventIds: [],
  };
}

beforeEach(async () => {
  await storage.clear('learning_plans');
  await storage.clear('learning_plan_adjustments');
});

describe('GET /api/sky/learning-plan', () => {
  it('returns an empty projection when the user has no active plan', async () => {
    const req = new NextRequest('http://localhost:3000/api/sky/learning-plan?view=today');

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ plan: null, view: null });
  });

  it('returns the requested view from the active plan', async () => {
    await createLearningPlanDAO(storage).add(makePlan());
    const req = new NextRequest(
      'http://localhost:3000/api/sky/learning-plan?view=today&date=2026-08-06',
    );

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.plan.id).toBe('plan-1');
    expect(json.data.view.kind).toBe('today');
    expect(json.data.view.tasks.map((task: { id: string }) => task.id)).toEqual(['task-today']);
  });

  it('rejects an invalid projection date', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/sky/learning-plan?view=today&date=not-a-date',
    );

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.errorCode).toBe('INVALID_REQUEST');
  });

  it('rejects an unknown view', async () => {
    const req = new NextRequest('http://localhost:3000/api/sky/learning-plan?view=quarter');

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.errorCode).toBe('INVALID_REQUEST');
  });
});
