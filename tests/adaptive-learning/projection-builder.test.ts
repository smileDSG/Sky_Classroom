import { describe, it, expect } from 'vitest';
import {
  buildTeachingProjection,
  buildPlanningProjection,
} from '@/lib/adaptive-learning/profile/projection-builder';
import type { DomainLearnerProfile, LearnerPreferences } from '@/lib/adaptive-learning/contracts';

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

describe('buildTeachingProjection', () => {
  it('builds a valid teaching projection from preferences', () => {
    const preferences = makePreferences();
    const projection = buildTeachingProjection({
      userId: preferences.userId,
      snapshotId: 'snapshot:user-1:v1:w0',
      profileVersion: preferences.version,
      eventWatermark: 0,
      preferences,
    });

    expect(projection.kind).toBe('teaching');
    expect(projection.userId).toBe('user-1');
    expect(projection.profileVersion).toBe(1);
    expect(projection.data.assistantName).toBe('小云');
    expect(projection.data.explanationDepth).toBe('detailed');
    expect(projection.data.knowledgeStatus).toBe('no-evidence');
    expect(projection.data.strengths).toEqual([]);
    expect(projection.data.growthAreas).toEqual([]);
  });

  it('includes strengths and growth areas when provided', () => {
    const preferences = makePreferences();
    const projection = buildTeachingProjection({
      userId: preferences.userId,
      snapshotId: 'snapshot:user-1:v1:w0',
      profileVersion: preferences.version,
      eventWatermark: 0,
      preferences,
      knowledgeStatus: 'ready',
      strengths: [
        {
          nodeId: 'functions-basic',
          mastery: 0.85,
          confidence: 0.8,
          reasonCodes: ['verified-answers'],
        },
      ],
      growthAreas: [
        {
          nodeId: 'derivative-concept',
          mastery: 0.35,
          confidence: 0.6,
          reasonCodes: ['repeated-errors'],
        },
      ],
    });

    expect(projection.data.knowledgeStatus).toBe('ready');
    expect(projection.data.strengths).toHaveLength(1);
    expect(projection.data.growthAreas).toHaveLength(1);
  });
});

describe('buildPlanningProjection', () => {
  it('builds a valid exam-mode planning projection from preferences and domain profile', () => {
    const preferences = makePreferences();
    const domainProfile = makeDomainProfile();

    const projection = buildPlanningProjection({
      userId: preferences.userId,
      snapshotId: 'snapshot:user-1:v1:w0',
      profileVersion: preferences.version,
      eventWatermark: 0,
      preferences,
      domainProfile,
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

    expect(projection.kind).toBe('planning');
    expect(projection.data.planningMode).toBe('exam');
    expect(projection.data.activeDomain.targetScore).toBe(130);
    expect(projection.data.availability.weeklyAvailableMinutes).toBe(600);
    expect(projection.data.targetKnowledge).toHaveLength(1);
    expect(projection.data.engagementSummary.activeDays7d).toBe(5);
  });

  it('builds a mastery-mode projection when targetNodeIds are provided', () => {
    const preferences = makePreferences();
    const domainProfile = makeDomainProfile({
      targetScore: undefined,
      scoreScaleMax: undefined,
      examDate: undefined,
      examSystem: undefined,
      targetNodeIds: ['functions-basic', 'derivative-concept'],
      horizonDays: 30,
    });

    const projection = buildPlanningProjection({
      userId: preferences.userId,
      snapshotId: 'snapshot:user-1:v1:w0',
      profileVersion: preferences.version,
      eventWatermark: 0,
      preferences,
      domainProfile,
      planningMode: 'mastery',
      knowledgeStatus: 'no-evidence',
      targetKnowledge: [],
      engagementSummary: { studyMinutes7d: 0, activeDays7d: 0 },
    });

    expect(projection.data.planningMode).toBe('mastery');
    expect(projection.data.activeDomain.targetNodeIds).toEqual([
      'functions-basic',
      'derivative-concept',
    ]);
    expect(projection.data.activeDomain.horizonDays).toBe(30);
  });
});
