import { describe, expect, it } from 'vitest';

import {
  assessmentProfileProjectionSchema,
  audienceProfileSchema,
  dashboardProfileProjectionSchema,
  domainLearnerProfileSchema,
  learnerPreferencesSchema,
  learnerProfileSnapshotSchema,
  learningEventSchema,
  planningProfileProjectionSchema,
  profileDecisionTraceSchema,
  retrievalProfileProjectionSchema,
  teachingProfileProjectionSchema,
} from '@/lib/adaptive-learning/contracts';
import { ADAPTIVE_LEARNING_ERROR_CODES } from '@/lib/adaptive-learning/errors';

const validPreferencesInput = {
  userId: 'user-1',
  preferredLanguage: 'zh-CN',
  contentFormatPreferences: ['worked-example', 'diagram'],
  explanationDepth: 'detailed',
  learningPace: 'standard',
  stepByStepMode: 'always',
  interactionTone: 'encouraging',
  assistantName: '小智',
  preferenceNotes: '讲解时优先给出例题，再总结规律。',
  privacy: {
    conversationMemory: 'persistent',
    optionalBehaviorSignals: true,
    privateKnowledgeRetrieval: false,
  },
  version: 1,
  schemaVersion: '1.0.0',
  updatedAt: '2026-07-28T00:00:00.000Z',
  updatedBy: 'user',
} as const;

const validDomainProfileInput = {
  id: 'domain-physics-1',
  userId: 'user-1',
  subjectId: 'physics',
  educationStage: 'junior-high',
  gradeLevel: 'grade-9',
  curriculumPackId: 'cn-junior-high-physics',
  curriculumPackVersion: '2026.1',
  examSystem: 'zhongkao',
  examDate: '2027-06-20',
  targetScore: 70,
  scoreScaleMax: 80,
  latestVerifiedScore: 56,
  weeklyAvailableMinutes: 300,
  dailyAvailability: { monday: 45, saturday: 90 },
  preferredSessionMinutes: 30,
  constraints: {
    restDays: ['sunday'],
    maxDailyMinutes: 90,
    teacherLockedNodeIds: [],
  },
  status: 'active',
  version: 1,
  schemaVersion: '1.0.0',
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
} as const;

describe('learner profile contracts', () => {
  it('accepts versioned explicit learner preferences', () => {
    const preferences = learnerPreferencesSchema.parse(validPreferencesInput);

    expect(preferences.contentFormatPreferences).toEqual(['worked-example', 'diagram']);
    expect(preferences.privacy.conversationMemory).toBe('persistent');
  });

  it('rejects duplicate content format preferences', () => {
    expect(() =>
      learnerPreferencesSchema.parse({
        ...validPreferencesInput,
        contentFormatPreferences: ['diagram', 'diagram'],
      }),
    ).toThrow();
  });

  it('accepts a non-math domain learner profile', () => {
    const profile = domainLearnerProfileSchema.parse(validDomainProfileInput);

    expect(profile.subjectId).toBe('physics');
    expect(profile.educationStage).toBe('junior-high');
  });

  it('rejects a target score above the declared score scale', () => {
    expect(() =>
      domainLearnerProfileSchema.parse({
        ...validDomainProfileInput,
        targetScore: 81,
      }),
    ).toThrow();
  });

  it('rejects unknown fields in an answer-submitted event payload', () => {
    expect(() =>
      learningEventSchema.parse({
        eventId: 'event-1',
        userId: 'user-1',
        type: 'answer-submitted',
        occurredAt: '2026-07-28T00:00:00.000Z',
        source: 'quiz',
        nodeIds: ['linear-motion'],
        evidenceQuality: 'verified',
        payload: { correct: true, unexpected: true },
        schemaVersion: '1.0.0',
      }),
    ).toThrow();
  });

  it('requires every learning event to declare evidence quality', () => {
    expect(() =>
      learningEventSchema.parse({
        eventId: 'event-2',
        userId: 'user-1',
        type: 'answer-submitted',
        occurredAt: '2026-07-28T00:00:00.000Z',
        source: 'quiz',
        nodeIds: ['linear-motion'],
        payload: { correct: true },
        schemaVersion: '1.0.0',
      }),
    ).toThrow();
  });

  it('accepts a versioned learner profile snapshot at an event watermark', () => {
    const snapshot = learnerProfileSnapshotSchema.parse({
      snapshotId: 'snapshot-1',
      userId: 'user-1',
      version: 1,
      schemaVersion: '1.0.0',
      preferencesVersion: 1,
      domainProfileVersions: { 'domain-physics-1': 1 },
      eventWatermark: 12,
      completeness: {
        status: 'incomplete',
        score: 0.8,
        missingFields: ['planning.examDate'],
        byProjection: {
          teaching: { complete: true, missingFields: [] },
          assessment: { complete: true, missingFields: [] },
          retrieval: { complete: true, missingFields: [] },
          planning: { complete: false, missingFields: ['examDate'] },
          dashboard: { complete: true, missingFields: [] },
        },
      },
      strengths: [],
      growthAreas: [
        {
          domainProfileId: 'domain-physics-1',
          nodeId: 'linear-motion',
          mastery: 0.35,
          confidence: 0.8,
          reasonCodes: ['low-mastery'],
        },
      ],
      engagementSummary: {
        studyMinutes7d: 180,
        activeDays7d: 4,
        checkInStreak: 3,
      },
      progressSummary: {
        completedTasks: 6,
        totalTasks: 10,
      },
      evidenceSummary: {
        verifiedEvidenceCount: 8,
        totalEvidenceCount: 10,
        lastEvidenceAt: '2026-07-28T00:00:00.000Z',
      },
      generatedAt: '2026-07-28T00:00:01.000Z',
      builderVersion: '1.0.0',
    });

    expect(snapshot.eventWatermark).toBe(12);
    expect(snapshot.completeness.byProjection.planning.complete).toBe(false);
  });

  it('accepts a structured teaching projection for a specific snapshot', () => {
    const projection = teachingProfileProjectionSchema.parse({
      projectionId: 'teaching-projection-1',
      kind: 'teaching',
      userId: 'user-1',
      snapshotId: 'snapshot-1',
      profileVersion: 1,
      eventWatermark: 12,
      schemaVersion: '1.0.0',
      generatedAt: '2026-07-28T00:00:02.000Z',
      data: {
        preferredLanguage: 'zh-CN',
        contentFormatPreferences: ['worked-example', 'diagram'],
        explanationDepth: 'detailed',
        learningPace: 'standard',
        stepByStepMode: 'always',
        interactionTone: 'encouraging',
        assistantName: '小智',
        activeDomain: {
          domainProfileId: 'domain-physics-1',
          subjectId: 'physics',
          educationStage: 'junior-high',
          gradeLevel: 'grade-9',
          curriculumPackId: 'cn-junior-high-physics',
          curriculumPackVersion: '2026.1',
        },
        knowledgeStatus: 'ready',
        strengths: [],
        growthAreas: [
          {
            nodeId: 'linear-motion',
            mastery: 0.35,
            confidence: 0.8,
            reasonCodes: ['low-mastery'],
          },
        ],
      },
    });

    expect(projection.kind).toBe('teaching');
    expect(projection.data.growthAreas[0]?.nodeId).toBe('linear-motion');
  });

  it('requires teaching projections to declare whether knowledge evidence exists', () => {
    expect(() =>
      teachingProfileProjectionSchema.parse({
        projectionId: 'teaching-projection-2',
        kind: 'teaching',
        userId: 'user-1',
        snapshotId: 'snapshot-1',
        profileVersion: 1,
        eventWatermark: 12,
        schemaVersion: '1.0.0',
        generatedAt: '2026-07-28T00:00:02.000Z',
        data: {
          preferredLanguage: 'zh-CN',
          contentFormatPreferences: ['worked-example'],
          explanationDepth: 'detailed',
          learningPace: 'standard',
          stepByStepMode: 'always',
          interactionTone: 'encouraging',
          assistantName: '小智',
          activeDomain: {
            domainProfileId: 'domain-physics-1',
            subjectId: 'physics',
            educationStage: 'junior-high',
            gradeLevel: 'grade-9',
            curriculumPackId: 'cn-junior-high-physics',
            curriculumPackVersion: '2026.1',
          },
          strengths: [],
          growthAreas: [],
        },
      }),
    ).toThrow();
  });

  it('exposes explicit learner profile platform error codes', () => {
    expect(ADAPTIVE_LEARNING_ERROR_CODES).toEqual(
      expect.arrayContaining([
        'PROFILE_NOT_FOUND',
        'PROFILE_INCOMPLETE',
        'PROFILE_STALE',
        'PROFILE_VERSION_CONFLICT',
        'PROFILE_PROJECTION_FAILED',
        'PROFILE_EVIDENCE_REJECTED',
        'PERSISTENT_STORAGE_UNAVAILABLE',
      ]),
    );
  });

  it('records profile decisions with versions, field paths, and reason codes only', () => {
    const trace = profileDecisionTraceSchema.parse({
      traceId: 'trace-1',
      userId: 'user-1',
      consumer: 'sky-assistant',
      decisionType: 'teaching-strategy-selected',
      projectionKind: 'teaching',
      projectionId: 'teaching-projection-1',
      snapshotId: 'snapshot-1',
      profileVersion: 1,
      eventWatermark: 12,
      fieldPaths: ['data.explanationDepth', 'data.growthAreas'],
      reasonCodes: ['detailed-explanation-preferred', 'low-mastery-focus'],
      createdAt: '2026-07-28T00:00:03.000Z',
      schemaVersion: '1.0.0',
    });

    expect(trace.fieldPaths).toEqual(['data.explanationDepth', 'data.growthAreas']);
    expect(trace.reasonCodes).toContain('low-mastery-focus');
  });

  it('accepts a course audience that is separate from the authenticated learner', () => {
    const audience = audienceProfileSchema.parse({
      audienceId: 'audience-1',
      audienceType: 'cohort',
      label: '九年级物理入门学习者',
      preferredLanguage: 'zh-CN',
      educationStage: 'junior-high',
      gradeLevel: 'grade-9',
      priorKnowledgeLevel: 'beginner',
      learningGoals: ['理解牛顿运动定律'],
      backgroundNotes: '已有基础代数能力。',
      accessibilityNeeds: [],
      schemaVersion: '1.0.0',
    });

    expect(audience.audienceType).toBe('cohort');
    expect(audience.learningGoals).toEqual(['理解牛顿运动定律']);
  });

  it('accepts an assessment projection without changing grading truth', () => {
    const projection = assessmentProfileProjectionSchema.parse({
      projectionId: 'assessment-projection-1',
      kind: 'assessment',
      userId: 'user-1',
      snapshotId: 'snapshot-1',
      profileVersion: 1,
      eventWatermark: 12,
      schemaVersion: '1.0.0',
      generatedAt: '2026-07-28T00:00:04.000Z',
      data: {
        preferredLanguage: 'zh-CN',
        explanationDepth: 'detailed',
        stepByStepMode: 'always',
        interactionTone: 'encouraging',
        activeDomain: {
          domainProfileId: 'domain-physics-1',
          subjectId: 'physics',
          educationStage: 'junior-high',
          gradeLevel: 'grade-9',
          curriculumPackId: 'cn-junior-high-physics',
          curriculumPackVersion: '2026.1',
          examSystem: 'zhongkao',
        },
        knowledgeStatus: 'ready',
        targetKnowledge: [
          {
            nodeId: 'linear-motion',
            mastery: 0.35,
            confidence: 0.8,
            retention: 0.6,
            evidenceCount: 8,
            repeatedErrorCount: 2,
            lastEvidenceAt: '2026-07-28T00:00:00.000Z',
            reasonCodes: ['low-mastery'],
          },
        ],
      },
    });

    expect(projection.kind).toBe('assessment');
    expect(projection.data.targetKnowledge[0]?.repeatedErrorCount).toBe(2);
  });

  it('accepts a retrieval projection with explicit source permissions', () => {
    const projection = retrievalProfileProjectionSchema.parse({
      projectionId: 'retrieval-projection-1',
      kind: 'retrieval',
      userId: 'user-1',
      snapshotId: 'snapshot-1',
      profileVersion: 1,
      eventWatermark: 12,
      schemaVersion: '1.0.0',
      generatedAt: '2026-07-28T00:00:05.000Z',
      data: {
        preferredLanguage: 'zh-CN',
        activeDomain: {
          domainProfileId: 'domain-physics-1',
          subjectId: 'physics',
          educationStage: 'junior-high',
          gradeLevel: 'grade-9',
          curriculumPackId: 'cn-junior-high-physics',
          curriculumPackVersion: '2026.1',
        },
        focusNodeIds: ['linear-motion'],
        allowedSourceScopes: [
          {
            kbType: 'curriculum',
            scope: 'public-curriculum',
            verifiedOnly: true,
          },
          {
            kbType: 'uploaded-notes',
            scope: 'private-user',
            verifiedOnly: false,
          },
        ],
        privateKnowledgeRetrieval: true,
      },
    });

    expect(projection.data.allowedSourceScopes).toHaveLength(2);
    expect(projection.data.privateKnowledgeRetrieval).toBe(true);
  });

  it('rejects private retrieval sources when learner consent is disabled', () => {
    expect(() =>
      retrievalProfileProjectionSchema.parse({
        projectionId: 'retrieval-projection-2',
        kind: 'retrieval',
        userId: 'user-1',
        snapshotId: 'snapshot-1',
        profileVersion: 1,
        eventWatermark: 12,
        schemaVersion: '1.0.0',
        generatedAt: '2026-07-28T00:00:05.000Z',
        data: {
          preferredLanguage: 'zh-CN',
          activeDomain: {
            domainProfileId: 'domain-physics-1',
            subjectId: 'physics',
            educationStage: 'junior-high',
            gradeLevel: 'grade-9',
            curriculumPackId: 'cn-junior-high-physics',
            curriculumPackVersion: '2026.1',
          },
          focusNodeIds: ['linear-motion'],
          allowedSourceScopes: [
            {
              kbType: 'uploaded-notes',
              scope: 'private-user',
              verifiedOnly: false,
            },
          ],
          privateKnowledgeRetrieval: false,
        },
      }),
    ).toThrow();
  });

  it('accepts a planning projection with structured goals and availability', () => {
    const projection = planningProfileProjectionSchema.parse({
      projectionId: 'planning-projection-1',
      kind: 'planning',
      userId: 'user-1',
      snapshotId: 'snapshot-1',
      profileVersion: 1,
      eventWatermark: 12,
      schemaVersion: '1.0.0',
      generatedAt: '2026-07-28T00:00:06.000Z',
      data: {
        planningMode: 'exam',
        activeDomain: {
          domainProfileId: 'domain-physics-1',
          subjectId: 'physics',
          educationStage: 'junior-high',
          gradeLevel: 'grade-9',
          curriculumPackId: 'cn-junior-high-physics',
          curriculumPackVersion: '2026.1',
          examSystem: 'zhongkao',
          examDate: '2027-06-20',
          targetScore: 70,
          scoreScaleMax: 80,
          latestVerifiedScore: 56,
        },
        availability: {
          weeklyAvailableMinutes: 300,
          dailyAvailability: { monday: 45, saturday: 90 },
          preferredSessionMinutes: 30,
          restDays: ['sunday'],
          maxDailyMinutes: 90,
        },
        teacherLockedNodeIds: [],
        knowledgeStatus: 'ready',
        targetKnowledge: [
          {
            nodeId: 'linear-motion',
            mastery: 0.35,
            confidence: 0.8,
            retention: 0.6,
            reviewStabilityDays: 3,
            evidenceCount: 8,
            lastEvidenceAt: '2026-07-28T00:00:00.000Z',
            reasonCodes: ['low-mastery'],
          },
        ],
        engagementSummary: {
          studyMinutes7d: 180,
          activeDays7d: 4,
        },
        contentFormatPreferences: ['worked-example', 'diagram'],
      },
    });

    expect(projection.data.planningMode).toBe('exam');
    expect(projection.data.availability.weeklyAvailableMinutes).toBe(300);
  });

  it('represents a dashboard with no evidence instead of fake zero mastery', () => {
    const projection = dashboardProfileProjectionSchema.parse({
      projectionId: 'dashboard-projection-1',
      kind: 'dashboard',
      userId: 'user-1',
      snapshotId: 'snapshot-1',
      profileVersion: 1,
      eventWatermark: 0,
      schemaVersion: '1.0.0',
      generatedAt: '2026-07-28T00:00:07.000Z',
      data: {
        status: 'no-evidence',
        engagement: {
          todayStudyMinutes: 0,
          studyMinutes7d: 0,
          activeDays7d: 0,
          checkInStreak: 0,
          checkedInToday: false,
        },
        progress: {
          completedTasks: 0,
          totalTasks: 0,
          problemsAttempted: 0,
          problemsCorrect: 0,
          scenesCompleted: 0,
          dueReviewCount: 0,
        },
        knowledge: {
          overallMastery: null,
          strengths: [],
          growthAreas: [],
        },
        trend: [],
        recentActivities: [],
        profileCompleteness: {
          score: 0.6,
          missingByProjection: {
            teaching: [],
            assessment: [],
            retrieval: [],
            planning: ['examDate'],
            dashboard: [],
          },
        },
      },
    });

    expect(projection.data.status).toBe('no-evidence');
    expect(projection.data.knowledge.overallMastery).toBeNull();
  });
});
