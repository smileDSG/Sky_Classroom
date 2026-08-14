import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import type {
  DomainLearnerProfile,
  LearnerPreferences,
} from '@/lib/adaptive-learning/contracts';
import {
  buildScheduledLearningPlan,
} from '@/lib/adaptive-learning/planning/scheduled-learning-plan';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { buildPlanningProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import { createLearningPathDAO } from '@/lib/storage/dao/learning-paths';
import { createLearningPlanDAO } from '@/lib/storage/dao/learning-plans';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import type { LearningPath } from '@/lib/teaching/learning-path-types';

const boundary = vi.hoisted(() => ({
  userId: 'user-replan',
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: boundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getRequiredServerStorage: vi.fn(async () => boundary.storage),
}));

vi.mock('server-only', () => ({}));

import { PATCH } from '@/app/api/sky/learning-plan/route';

const storage = new MemoryStorageProvider();
boundary.storage = storage;

function makePreferences(): LearnerPreferences {
  return {
    userId: boundary.userId,
    preferredLanguage: 'zh-CN',
    contentFormatPreferences: ['worked-example', 'interactive'],
    explanationDepth: 'detailed',
    learningPace: 'standard',
    stepByStepMode: 'when-needed',
    interactionTone: 'encouraging',
    assistantName: 'Sky',
    preferenceNotes: '',
    privacy: {
      conversationMemory: 'session',
      optionalBehaviorSignals: false,
      privateKnowledgeRetrieval: false,
    },
    version: 1,
    schemaVersion: '1.0.0',
    updatedAt: '2026-08-01T00:00:00.000Z',
    updatedBy: 'user',
  };
}

function makeDomainProfile(): DomainLearnerProfile {
  return {
    id: 'default',
    userId: boundary.userId,
    subjectId: 'math',
    educationStage: 'senior-high',
    gradeLevel: 'grade-12',
    curriculumPackId: 'gaokao-math-2026.1',
    curriculumPackVersion: '2026.1',
    examSystem: 'gaokao',
    examDate: '2026-09-03',
    targetScore: 130,
    scoreScaleMax: 150,
    weeklyAvailableMinutes: 180,
    dailyAvailability: { thu: 60, fri: 60, sat: 60 },
    preferredSessionMinutes: 30,
    constraints: {
      restDays: ['sun'],
      maxDailyMinutes: 60,
      teacherLockedNodeIds: [],
    },
    status: 'active',
    version: 1,
    schemaVersion: '1.0.0',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function makePath(): LearningPath {
  return {
    id: 'path-1',
    userId: boundary.userId,
    title: 'Derivative path',
    nodes: [
      {
        id: 'path-node-1',
        topic: 'derivative-concept',
        knowledgePoints: ['derivative-concept'],
        estimatedSections: 2,
        prerequisites: [],
        status: 'pending',
      },
    ],
    createdAt: Date.parse('2026-08-01T00:00:00.000Z'),
    updatedAt: Date.parse('2026-08-01T00:00:00.000Z'),
  };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-06T00:00:00.000Z'));
  for (const table of [
    'learner-preference-versions',
    'domain-learner-profile-versions',
    'learning-events',
    'knowledge-state',
    'learning_paths',
    'learning_plans',
    'learning_plan_adjustments',
  ]) {
    await storage.clear(table);
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PATCH /api/sky/learning-plan', () => {
  it('rebuilds the active plan from latest profile data and persists the adjustment', async () => {
    const repository = new LearnerProfileRepository(storage);
    const preferences = makePreferences();
    const domainProfile = makeDomainProfile();
    const path = makePath();
    await repository.insertPreferences(preferences);
    await repository.insertDomainProfile(domainProfile);
    await createLearningPathDAO(storage).add(path);

    const projection = buildPlanningProjection({
      userId: boundary.userId,
      snapshotId: 'snapshot:user-replan:v1:w0',
      profileVersion: 1,
      eventWatermark: 0,
      preferences,
      domainProfile,
      planningMode: 'exam',
    });
    const previousPlan = buildScheduledLearningPlan({
      path,
      projection,
      now: new Date(),
      planId: 'plan-old',
    });
    await createLearningPlanDAO(storage).add(previousPlan);

    const req = new NextRequest('http://localhost:3000/api/sky/learning-plan', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'micro', triggerEventIds: ['manual-replan-1'] }),
    });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.plan.id).not.toBe(previousPlan.id);
    expect(json.data.plan.version).toBe(2);
    expect(json.data.plan.pathId).toBe(path.id);
    expect(json.data.adjustment).toMatchObject({
      previousPlanId: previousPlan.id,
      nextPlanId: json.data.plan.id,
      mode: 'micro',
    });

    const planDAO = createLearningPlanDAO(storage);
    expect((await planDAO.get(previousPlan.id))?.status).toBe('superseded');
    expect((await planDAO.getActiveByUser(boundary.userId))?.id).toBe(json.data.plan.id);
    expect(await planDAO.listAdjustments(boundary.userId)).toHaveLength(1);
  });
});
