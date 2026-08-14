/**
 * Learner profile integration for /api/sky/learning-path
 *
 * Verifies that learning path generation loads the authenticated user's
 * preferences and domain profile, builds a planning projection, and returns
 * a structured plan.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { createLearningPathDAO } from '@/lib/storage/dao/learning-paths';
import { createLearningPlanDAO } from '@/lib/storage/dao/learning-plans';
import type { DomainLearnerProfile, LearnerPreferences } from '@/lib/adaptive-learning/contracts';

const boundary = vi.hoisted(() => ({
  userId: 'user-lp',
  storage: null as StorageProvider | null,
}));

const generateLearningPlanMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/adaptive-learning/planning/learning-plan-service', () => ({
  generateLearningPlan: generateLearningPlanMock,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: boundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(async () => boundary.storage),
  getRequiredServerStorage: vi.fn(async () => boundary.storage),
}));

vi.mock('server-only', () => ({}));

import { POST } from '@/app/api/sky/learning-path/route';

const storage = new MemoryStorageProvider();
boundary.storage = storage;

async function seedPreferences(userId: string): Promise<LearnerPreferences> {
  const repository = new LearnerProfileRepository(storage);
  const preferences: LearnerPreferences = {
    userId,
    preferredLanguage: 'zh-CN',
    contentFormatPreferences: ['text', 'worked-example'],
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
    updatedAt: '2026-07-30T00:00:00.000Z',
    updatedBy: 'user',
  };
  await repository.insertPreferences(preferences);
  return preferences;
}

async function seedDomainProfile(userId: string): Promise<DomainLearnerProfile> {
  const repository = new LearnerProfileRepository(storage);
  const profile: DomainLearnerProfile = {
    id: 'default',
    userId,
    subjectId: 'math',
    educationStage: 'senior-high',
    gradeLevel: 'grade-12',
    curriculumPackId: 'gaokao-math-2026.1',
    curriculumPackVersion: '2026.1',
    examSystem: 'gaokao',
    examDate: '2026-06-07',
    targetScore: 130,
    scoreScaleMax: 150,
    latestVerifiedScore: 95,
    weeklyAvailableMinutes: 600,
    dailyAvailability: { mon: 120, tue: 90, wed: 90, thu: 90, fri: 90, sat: 60, sun: 60 },
    preferredSessionMinutes: 45,
    constraints: {
      restDays: ['sun'],
      maxDailyMinutes: 180,
      teacherLockedNodeIds: ['exam-prep-review'],
    },
    status: 'active',
    version: 1,
    schemaVersion: '1.0.0',
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  };
  await repository.insertDomainProfile(profile);
  return profile;
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/sky/learning-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  boundary.userId = 'user-lp';
  await storage.clear('learner-preference-versions');
  await storage.clear('domain-learner-profile-versions');
  await storage.clear('learning-events');
  await storage.clear('knowledge-state');
  await storage.clear('learning_paths');
  await storage.clear('learning_plans');
  await storage.clear('learning_plan_adjustments');
  generateLearningPlanMock.mockReset();
  generateLearningPlanMock.mockResolvedValue({
    goal: '攻克导数',
    strategy: '先理解概念，再刷题',
    weeklyPlans: [
      {
        week: 1,
        goal: '导数概念',
        dailyTasks: [{ day: 'mon', topic: '极限引入', materials: ['导数基础'], minutes: 45 }],
      },
    ],
    materials: [{ title: '导数基础', source: 'data/crawled/math/derivative.md' }],
  });
});

describe('POST /api/sky/learning-path learner profile integration', () => {
  it('returns PROFILE_NOT_FOUND when learner preferences are missing', async () => {
    const req = makeRequest({ goalTopic: '导数' });

    const res = await POST(req);
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('returns PROFILE_INCOMPLETE when domain profile is missing', async () => {
    await seedPreferences(boundary.userId);

    const req = makeRequest({ goalTopic: '导数' });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PROFILE_INCOMPLETE');
  });

  it('generates a learning plan using a planning projection', async () => {
    await seedPreferences(boundary.userId);
    await seedDomainProfile(boundary.userId);

    const req = makeRequest({ goalTopic: '导数' });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.narrativePlan.goal).toBe('攻克导数');
    expect(generateLearningPlanMock).toHaveBeenCalledTimes(1);

    const [input] = generateLearningPlanMock.mock.calls[0];
    expect(input.projection.kind).toBe('planning');
    expect(input.projection.userId).toBe(boundary.userId);
    expect(input.goalTopic).toBe('导数');
  });

  it('returns and persists the personal path alongside the planning output', async () => {
    await seedPreferences(boundary.userId);
    await seedDomainProfile(boundary.userId);

    const res = await POST(makeRequest({ goalTopic: '导数', strategy: 'goal-topic' }));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.path.userId).toBe(boundary.userId);
    expect(json.data.path.nodes.length).toBeGreaterThan(0);
    expect(json.data.plan.pathId).toBe(json.data.path.id);
    expect(json.data.plan.tasks.length).toBeGreaterThan(0);
    expect(json.data.narrativePlan.goal).toBe('攻克导数');

    const persisted = await createLearningPathDAO(storage).getActiveByUser(boundary.userId);
    expect(persisted?.id).toBe(json.data.path.id);
    const persistedPlan = await createLearningPlanDAO(storage).getActiveByUser(boundary.userId);
    expect(persistedPlan?.id).toBe(json.data.plan.id);
  });

  it('injects knowledge state and event evidence into the planning projection', async () => {
    await seedPreferences(boundary.userId);
    await seedDomainProfile(boundary.userId);
    await createKnowledgeStateDAO(storage).set(boundary.userId, {
      userId: boundary.userId,
      nodeId: 'functions-basic',
      alpha: 2,
      beta: 3,
      mastery: 0.4,
      confidence: 0.55,
      retention: 1,
      reviewStabilityDays: 5,
      repeatedErrorCount: 2,
      lastEvidenceAt: new Date().toISOString(),
      evidenceCount: 3,
      version: 3,
    });
    await new LearnerProfileRepository(storage).appendLearningEvent({
      eventId: 'answer-1',
      userId: boundary.userId,
      type: 'answer-submitted',
      occurredAt: new Date().toISOString(),
      source: 'quiz',
      nodeIds: ['functions-basic'],
      evidenceQuality: 'verified',
      payload: { correct: false },
      schemaVersion: '1.0.0',
    });

    const res = await POST(makeRequest({ goalTopic: 'function' }));

    expect(res.status).toBe(201);
    const [input] = generateLearningPlanMock.mock.calls[0];
    expect(input.projection.eventWatermark).toBe(1);
    expect(input.projection.data.knowledgeStatus).toBe('ready');
    expect(input.projection.data.targetKnowledge[0]).toMatchObject({
      nodeId: 'functions-basic',
      mastery: 0.4,
      evidenceCount: 3,
    });
  });

  it('ignores client-provided projection as authoritative', async () => {
    await seedPreferences(boundary.userId);
    await seedDomainProfile(boundary.userId);

    const req = makeRequest({ goalTopic: '导数', projection: { kind: 'CLIENT_OVERRIDE' } });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const [input] = generateLearningPlanMock.mock.calls[0];
    expect(input.projection.kind).toBe('planning');
    expect(input.projection.data.activeDomain.targetScore).toBe(130);
  });

  it('still creates the path and deterministic plan when narrative generation fails', async () => {
    await seedPreferences(boundary.userId);
    await seedDomainProfile(boundary.userId);
    generateLearningPlanMock.mockRejectedValueOnce(new Error('LLM unavailable'));

    const res = await POST(makeRequest({ goalTopic: '瀵兼暟' }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.path.nodes.length).toBeGreaterThan(0);
    expect(json.data.plan.tasks.length).toBeGreaterThan(0);
    expect(json.data.narrativePlan).toBeNull();
  });

  it('returns the deterministic path when narrative generation times out', async () => {
    await seedPreferences(boundary.userId);
    await seedDomainProfile(boundary.userId);
    generateLearningPlanMock.mockReturnValueOnce(new Promise(() => {}));
    const previousTimeout = process.env.LEARNING_PATH_NARRATIVE_TIMEOUT_MS;
    process.env.LEARNING_PATH_NARRATIVE_TIMEOUT_MS = '5';

    try {
      const res = await POST(makeRequest({ strategy: 'balanced' }));
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.path.nodes.length).toBeGreaterThan(0);
      expect(json.data.plan.tasks.length).toBeGreaterThan(0);
      expect(json.data.narrativePlan).toBeNull();
    } finally {
      if (previousTimeout === undefined) {
        delete process.env.LEARNING_PATH_NARRATIVE_TIMEOUT_MS;
      } else {
        process.env.LEARNING_PATH_NARRATIVE_TIMEOUT_MS = previousTimeout;
      }
    }
  });
});
