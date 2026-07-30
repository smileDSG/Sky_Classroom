/**
 * Tests for the learning plan service.
 *
 * The service consumes a planning projection and generates a structured plan.
 * File-system and LLM dependencies are injected so tests remain deterministic.
 */
import { describe, it, expect, vi } from 'vitest';
import { generateLearningPlan } from '@/lib/adaptive-learning/planning/learning-plan-service';
import { buildPlanningProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import type { DomainLearnerProfile, LearnerPreferences } from '@/lib/adaptive-learning/contracts';

function makePreferences(overrides: Partial<LearnerPreferences> = {}): LearnerPreferences {
  return {
    userId: 'user-1',
    preferredLanguage: 'zh-CN',
    contentFormatPreferences: ['text', 'worked-example'],
    explanationDepth: 'detailed',
    learningPace: 'standard',
    stepByStepMode: 'when-needed',
    interactionTone: 'friendly',
    assistantName: '小云',
    preferenceNotes: '',
    privacy: {
      conversationMemory: 'session',
      optionalBehaviorSignals: false,
      privateKnowledgeRetrieval: false,
    },
    version: 1,
    schemaVersion: '1.0.0',
    updatedAt: '2026-07-28T00:00:00.000Z',
    updatedBy: 'user',
    ...overrides,
  };
}

function makeDomainProfile(overrides: Partial<DomainLearnerProfile> = {}): DomainLearnerProfile {
  return {
    id: 'dp-1',
    userId: 'user-1',
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
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:00:00.000Z',
    ...overrides,
  };
}

function makeProjection() {
  return buildPlanningProjection({
    userId: 'user-1',
    snapshotId: 'snapshot:user-1:v1:w0',
    profileVersion: 1,
    eventWatermark: 0,
    preferences: makePreferences(),
    domainProfile: makeDomainProfile(),
    knowledgeStatus: 'ready',
    targetKnowledge: [
      {
        nodeId: 'derivative-concept',
        mastery: 0.35,
        confidence: 0.6,
        retention: 0.5,
        reviewStabilityDays: 7,
        evidenceCount: 3,
        reasonCodes: ['repeated-errors'],
      },
    ],
    engagementSummary: { studyMinutes7d: 300, activeDays7d: 5 },
  });
}

describe('generateLearningPlan', () => {
  it('returns a structured plan from injected dependencies', async () => {
    const projection = makeProjection();
    const retrieveChunks = vi.fn(async () => [
      {
        source: 'data/crawled/math/derivative.md',
        title: '导数基础',
        course: 'math',
        tags: ['derivative'],
        content: '导数是变化率。',
        wordCount: 100,
        score: 10,
      },
    ]);
    const generatePlan = vi.fn(async () =>
      JSON.stringify({
        goal: '攻克导数',
        strategy: '先理解概念，再刷题',
        weeklyPlans: [
          {
            week: 1,
            goal: '导数概念',
            dailyTasks: [
              { day: 'mon', topic: '极限引入', materials: ['导数基础'], minutes: 45 },
            ],
          },
        ],
        materials: [{ title: '导数基础', source: 'data/crawled/math/derivative.md' }],
      }),
    );

    const result = await generateLearningPlan(
      { projection, goalTopic: '导数' },
      { retrieveChunks, generatePlan },
    );

    expect(retrieveChunks).toHaveBeenCalledWith(projection, 12);
    expect(generatePlan).toHaveBeenCalled();
    const [, userPrompt] = generatePlan.mock.calls[0] as unknown as [string, string];
    expect(userPrompt).toContain('130');
    expect(userPrompt).toContain('导数');
    expect(result.goal).toBe('攻克导数');
    expect(result.weeklyPlans).toHaveLength(1);
  });

  it('rejects when the LLM returns invalid JSON', async () => {
    const projection = makeProjection();
    const retrieveChunks = vi.fn(async () => []);
    const generatePlan = vi.fn(async () => 'not-json');

    await expect(
      generateLearningPlan({ projection }, { retrieveChunks, generatePlan }),
    ).rejects.toThrow('学习计划解析失败');
  });

  it('rejects when no chunks are found and no goal topic is given', async () => {
    const projection = makeProjection();
    const retrieveChunks = vi.fn(async () => []);
    const generatePlan = vi.fn(async () => '{}');

    await expect(
      generateLearningPlan({ projection }, { retrieveChunks, generatePlan }),
    ).rejects.toThrow('未找到匹配资料');
  });
});
