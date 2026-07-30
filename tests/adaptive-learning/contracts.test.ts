import { describe, expect, it } from 'vitest';
import {
  curriculumNodeSchema,
  curriculumPackSchema,
  governanceReportSchema,
  knowledgeStateSchema,
  learnerProfileSchema,
  learningEventSchema,
  learningPlanSchema,
  learningTaskSchema,
  mathResourceSchema,
  manualVerificationManifestSchema,
  mathResourceQuerySchema,
  planAdjustmentSchema,
  weeklyTargetSchema,
} from '@/lib/adaptive-learning/contracts';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

const node = {
  id: 'derivative-concept',
  version: '2026.1',
  subject: 'math',
  stage: 'senior-high',
  name: '导数概念',
  aliases: ['导数', 'derivative'],
  description: '理解导数作为瞬时变化率和切线斜率。',
  prerequisiteIds: ['functions-properties'],
  relatedIds: ['derivative-applications'],
  examWeight: 0.1,
  defaultStabilityDays: 7,
  commonErrorCodes: ['derivative_definition_confusion'],
  activityTypes: ['learn', 'worked-example', 'practice', 'review', 'diagnostic'],
};

const validProfileInput = {
  userId: 'user-1',
  stage: 'senior-high',
  grade: 'grade-12',
  subject: 'math',
  curriculumPackVersion: '2026.1',
  examDate: '2027-06-07',
  targetScore: 125,
  latestScore: 96,
  weeklyAvailableMinutes: 600,
  dailyAvailability: { monday: 90, tuesday: 90 },
  preferredSessionMinutes: 30,
  constraints: {
    restDays: ['sunday'],
    maxDailyMinutes: 120,
    teacherLockedNodeIds: [],
  },
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
};

const validTaskInput = {
  id: 'task-1',
  nodeId: 'derivative-concept',
  type: 'practice',
  title: 'Derivative practice',
  objective: 'Apply the derivative definition accurately.',
  plannedMinutes: 30,
  difficulty: 3,
  resourceIds: ['math_1234567890abcdef'],
  successCriteria: ['Solve four of five questions correctly.'],
  status: 'pending',
  scheduledDate: '2026-07-29',
  reasonCodes: ['low_mastery'],
};

const validPlanInput = {
  id: 'plan-1',
  userId: 'user-1',
  version: 1,
  status: 'active',
  generatedAt: '2026-07-28T00:00:00.000Z',
  validFrom: '2026-07-28',
  validTo: '2026-08-03',
  curriculumPackVersion: '2026.1',
  plannerVersion: '1.0.0',
  profileSnapshot: validProfileInput,
  tasks: [],
  weeklyTargets: [],
  constraintChecks: ['daily_minutes_ok'],
  evidenceEventIds: ['event-1'],
};

describe('adaptive learning curriculum and resource contracts', () => {
  it('accepts a strict curriculum node and pack', () => {
    expect(curriculumNodeSchema.parse(node).id).toBe('derivative-concept');
    expect(
      curriculumPackSchema.parse({
        id: 'gaokao-math-2026.1',
        version: '2026.1',
        title: '2026 高考数学最小课程包',
        subject: 'math',
        stage: 'senior-high',
        examSystem: 'gaokao',
        examYear: 2026,
        nodes: [node],
      }).nodes,
    ).toHaveLength(1);
  });

  it('rejects unknown fields and cross-subject resources', () => {
    expect(() => curriculumNodeSchema.parse({ ...node, unknown: true })).toThrow();
    expect(() =>
      mathResourceSchema.parse({
        id: 'math_1234567890abcdef',
        sourcePath: 'data/crawled/math/example.md',
        canonicalUrl: 'https://example.com/math',
        title: 'Example',
        language: 'en',
        subject: 'biology',
        stage: 'senior-high',
        examSystem: 'gaokao',
        nodeIds: ['derivative-concept'],
        resourceType: 'concept',
        difficulty: 3,
        qualityScore: 0.9,
        contentHash: 'a'.repeat(64),
        excerpt: 'A valid mathematical explanation.',
        status: 'verified',
        verifiedBy: 'reviewer-1',
        verifiedAt: '2026-07-28T00:00:00.000Z',
        rejectionReasons: [],
      }),
    ).toThrow();
  });

  it('requires verification metadata for verified resources', () => {
    expect(() =>
      mathResourceSchema.parse({
        id: 'math_1234567890abcdef',
        sourcePath: 'data/crawled/math/example.md',
        canonicalUrl: 'https://example.com/math',
        title: 'Example',
        language: 'en',
        subject: 'math',
        stage: 'senior-high',
        examSystem: 'gaokao',
        nodeIds: ['derivative-concept'],
        resourceType: 'concept',
        difficulty: 3,
        qualityScore: 0.9,
        contentHash: 'a'.repeat(64),
        excerpt: 'A valid mathematical explanation.',
        status: 'verified',
        rejectionReasons: [],
      }),
    ).toThrow();
  });

  it('validates manual verification and query coercion', () => {
    const manifest = manualVerificationManifestSchema.parse({
      schemaVersion: '1.0.0',
      curriculumPackId: 'gaokao-math-2026.1',
      entries: [
        {
          sourcePath: 'data/crawled/math/example.md',
          status: 'verified',
          nodeIds: ['derivative-concept'],
          resourceType: 'concept',
          difficulty: 3,
          reviewer: 'reviewer-1',
          reviewedAt: '2026-07-28T00:00:00.000Z',
          notes: 'Checked against the source.',
        },
      ],
    });
    expect(manifest.entries).toHaveLength(1);
    expect(mathResourceQuerySchema.parse({ maxDifficulty: '4', limit: '20' })).toEqual({
      maxDifficulty: 4,
      limit: 20,
    });
  });

  it('rejects unknown governance status count fields', () => {
    expect(() =>
      governanceReportSchema.parse({
        schemaVersion: '1.0.0',
        indexVersion: '2026.1',
        scanned: 1,
        parsed: 1,
        statusCounts: {
          verified: 1,
          needsReview: 0,
          rejected: 0,
          unknown: 0,
        },
        reasonCounts: {},
        parseFailures: [],
        resourceGapNodeIds: [],
      }),
    ).toThrow();
  });

  it('rejects incoherent curriculum pack identities and node versions', () => {
    const pack = {
      id: 'gaokao-math-2026.1',
      version: '2026.1',
      title: '2026 高考数学最小课程包',
      subject: 'math',
      stage: 'senior-high',
      examSystem: 'gaokao',
      examYear: 2026,
      nodes: [node],
    };

    expect(() =>
      curriculumPackSchema.parse({
        ...pack,
        id: 'gaokao-math-2026.2',
      }),
    ).toThrow();
    expect(() =>
      curriculumPackSchema.parse({
        ...pack,
        id: 'gaokao-math-2027.1',
        version: '2027.1',
        nodes: [{ ...node, version: '2027.1' }],
      }),
    ).toThrow();
    expect(() =>
      curriculumPackSchema.parse({
        ...pack,
        nodes: [{ ...node, version: '2026.2' }],
      }),
    ).toThrow();
  });

  it('validates learner, evidence, plan, and adjustment contracts', () => {
    const profile = learnerProfileSchema.parse({
      userId: 'user-1',
      stage: 'senior-high',
      grade: 'grade-12',
      subject: 'math',
      curriculumPackVersion: '2026.1',
      examDate: '2027-06-07',
      targetScore: 125,
      latestScore: 96,
      weeklyAvailableMinutes: 600,
      dailyAvailability: { monday: 90, tuesday: 90 },
      preferredSessionMinutes: 30,
      constraints: {
        restDays: ['sunday'],
        maxDailyMinutes: 120,
        teacherLockedNodeIds: [],
      },
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z',
    });
    const state = knowledgeStateSchema.parse({
      userId: profile.userId,
      nodeId: 'derivative-concept',
      alpha: 2,
      beta: 2,
      mastery: 0.5,
      confidence: 0,
      retention: 1,
      reviewStabilityDays: 7,
      repeatedErrorCount: 0,
      evidenceCount: 0,
      version: 1,
    });
    const event = learningEventSchema.parse({
      eventId: 'event-1',
      userId: profile.userId,
      type: 'answer-submitted',
      occurredAt: '2026-07-28T00:00:00.000Z',
      source: 'quiz',
      nodeIds: [state.nodeId],
      evidenceQuality: 'verified',
      payload: { correct: true },
      schemaVersion: '1.0.0',
    });
    const plan = learningPlanSchema.parse({
      id: 'plan-1',
      userId: profile.userId,
      version: 1,
      status: 'active',
      generatedAt: '2026-07-28T00:00:00.000Z',
      validFrom: '2026-07-28',
      validTo: '2026-08-03',
      curriculumPackVersion: '2026.1',
      plannerVersion: '1.0.0',
      profileSnapshot: profile,
      tasks: [],
      weeklyTargets: [],
      constraintChecks: ['daily_minutes_ok'],
      evidenceEventIds: [event.eventId],
    });
    expect(plan.userId).toBe('user-1');
    expect(
      planAdjustmentSchema.parse({
        id: 'adjustment-1',
        userId: 'user-1',
        previousPlanId: 'plan-1',
        nextPlanId: 'plan-2',
        mode: 'micro',
        triggerEventIds: ['event-1'],
        changedTaskIds: [],
        preservedTaskIds: [],
        ruleEvidence: [],
        explanation: '新证据未改变今日任务。',
        createdAt: '2026-07-28T00:00:01.000Z',
      }).mode,
    ).toBe('micro');
  });

  it('rejects impossible calendar dates across adaptive contracts', () => {
    expect(() =>
      learnerProfileSchema.parse({
        ...validProfileInput,
        examDate: '2026-02-31',
      }),
    ).toThrow();
    expect(() =>
      learningPlanSchema.parse({
        ...validPlanInput,
        validFrom: '2026-13-01',
      }),
    ).toThrow();
    expect(() =>
      learningPlanSchema.parse({
        ...validPlanInput,
        validTo: '2026-02-31',
      }),
    ).toThrow();
    expect(() =>
      learningTaskSchema.parse({
        ...validTaskInput,
        scheduledDate: '2026-02-31',
      }),
    ).toThrow();
    expect(() =>
      weeklyTargetSchema.parse({
        weekStart: '2026-13-01',
        targetNodeIds: ['derivative-concept'],
        plannedMinutes: 90,
        expectedOutcomes: ['Improve derivative fluency.'],
      }),
    ).toThrow();
  });

  it('rejects reversed plan ranges and tasks outside the plan window', () => {
    expect(() =>
      learningPlanSchema.parse({
        ...validPlanInput,
        validFrom: '2026-08-04',
        validTo: '2026-08-03',
      }),
    ).toThrow();
    expect(() =>
      learningPlanSchema.parse({
        ...validPlanInput,
        tasks: [{ ...validTaskInput, scheduledDate: '2026-07-27' }],
      }),
    ).toThrow();
    expect(() =>
      learningPlanSchema.parse({
        ...validPlanInput,
        tasks: [{ ...validTaskInput, scheduledDate: '2026-08-04' }],
      }),
    ).toThrow();

    expect(
      learningPlanSchema.parse({
        ...validPlanInput,
        tasks: [
          { ...validTaskInput, scheduledDate: '2026-07-28' },
          { ...validTaskInput, id: 'task-2', scheduledDate: '2026-08-03' },
        ],
      }).tasks,
    ).toHaveLength(2);
  });

  it('rejects unknown fields throughout adaptive domain contracts', () => {
    expect(() =>
      learnerProfileSchema.parse({
        ...validProfileInput,
        unknown: true,
      }),
    ).toThrow();
    expect(() =>
      learnerProfileSchema.parse({
        ...validProfileInput,
        constraints: {
          ...validProfileInput.constraints,
          unknown: true,
        },
      }),
    ).toThrow();
    expect(() =>
      learningPlanSchema.parse({
        ...validPlanInput,
        unknown: true,
      }),
    ).toThrow();
    expect(() =>
      planAdjustmentSchema.parse({
        id: 'adjustment-1',
        userId: 'user-1',
        previousPlanId: 'plan-1',
        nextPlanId: 'plan-2',
        mode: 'micro',
        triggerEventIds: ['event-1'],
        changedTaskIds: ['task-1'],
        preservedTaskIds: [],
        ruleEvidence: [
          {
            nodeId: 'derivative-concept',
            reasonCode: 'mastery_changed',
            before: 0.5,
            after: 0.6,
            unknown: true,
          },
        ],
        explanation: 'Mastery evidence changed the task.',
        createdAt: '2026-07-28T00:00:01.000Z',
      }),
    ).toThrow();
  });

  it('carries structured non-fallback errors', () => {
    const cause = new Error('resource index unavailable');
    const error = new AdaptiveLearningError({
      code: 'RESOURCE_GAP',
      message: 'No verified derivative resource',
      retryable: false,
      stage: 'resource-query',
      details: { nodeId: 'derivative-concept' },
      cause,
    });
    expect(error.name).toBe('AdaptiveLearningError');
    expect(error.code).toBe('RESOURCE_GAP');
    expect(error.retryable).toBe(false);
    expect(error.stage).toBe('resource-query');
    expect(error.details).toEqual({ nodeId: 'derivative-concept' });
    expect(error.cause).toBe(cause);
  });
});
