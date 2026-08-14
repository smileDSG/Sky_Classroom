import { describe, expect, it } from 'vitest';
import { buildPersonalizationContext } from '@/lib/cloud-mind/personalization-context';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { ProfileSignal } from '@/lib/student/profile-signals';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { LearningPath } from '@/lib/teaching/learning-path-types';
import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';
import { canonicalizeKnowledgePoint } from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';

function makeProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    userId: 'u1',
    masteryBySubject: {} as StudentProfile['masteryBySubject'],
    masteryByKnowledge: { 二次函数: 42, 导数: 86 },
    weakPoints: ['二次函数'],
    strongPoints: ['导数'],
    errorPatterns: [
      {
        knowledgePoint: '二次函数',
        errorType: 'concept-unclear',
        frequency: 3,
        lastOccurrence: new Date('2026-06-20T00:00:00Z'),
      },
    ],
    totalQuestions: 20,
    totalCorrect: 11,
    lastUpdated: new Date('2026-06-25T00:00:00Z'),
    recentQuizPerformance: {
      overallAccuracy: 52,
      accuracyByKnowledge: { 二次函数: 44 },
      topErrorCauses: [],
      recommendedDepthShift: 'shallower',
    },
    ...overrides,
  };
}

function makeMistake(overrides: Partial<MistakeBookEntry> = {}): MistakeBookEntry {
  return {
    id: 'm1',
    problemText: '二次函数顶点式转换',
    userAnswer: 'A',
    correctAnswer: 'B',
    errorType: 'concept',
    knowledgePoints: ['二次函数'],
    reviewCount: 0,
    nextReview: Date.now() - 1000,
    masteryLevel: 0,
    reviewed: false,
    ...overrides,
  };
}

function makeLearningPath(): LearningPath {
  return {
    id: 'path1',
    userId: 'u1',
    title: '函数专题学习路径',
    nodes: [
      {
        id: 'n1',
        topic: '一次函数复习',
        knowledgePoints: ['一次函数'],
        estimatedSections: 2,
        prerequisites: [],
        status: 'completed',
      },
      {
        id: 'n2',
        topic: '二次函数图像',
        knowledgePoints: ['二次函数'],
        estimatedSections: 3,
        prerequisites: ['一次函数'],
        status: 'in_progress',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('cloud mind personalization context', () => {
  it('uses persisted knowledge state decision for the next action', () => {
    const knowledgeStates: KnowledgeState[] = [
      {
        userId: 'u1',
        nodeId: 'functions-basic',
        displayName: '函数基础',
        alpha: 2,
        beta: 5,
        mastery: 0.28,
        confidence: 0.7,
        retention: 1,
        reviewStabilityDays: 7,
        repeatedErrorCount: 2,
        evidenceCount: 4,
        lastEvidenceAt: '2026-07-30T08:00:00.000Z',
        version: 5,
      },
    ];

    const context = buildPersonalizationContext({
      userId: 'u1',
      profile: makeProfile(),
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
      learningPath: null,
      knowledgeStates,
    });

    expect(context.learnerDecision?.action).toBe('teach');
    expect(context.recommendation).toMatchObject({
      targetTool: 'teaching',
    });
    expect(context.shadowComparison).toMatchObject({
      baselineTargetTool: 'quiz',
      newTargetTool: 'teaching',
      changed: true,
    });
    expect(context.recommendation?.href).toContain('topic=%E5%87%BD%E6%95%B0%E5%9F%BA%E7%A1%80');
  });

  it('keeps learner decision shadow-only when rollout is disabled', () => {
    const context = buildPersonalizationContext({
      userId: 'u1',
      profile: makeProfile(),
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
      learningPath: null,
      knowledgeStates: [
        {
          userId: 'u1',
          nodeId: 'functions-basic',
          displayName: '鍑芥暟鍩虹',
          alpha: 2,
          beta: 5,
          mastery: 0.28,
          confidence: 0.7,
          retention: 1,
          reviewStabilityDays: 7,
          repeatedErrorCount: 2,
          evidenceCount: 4,
          lastEvidenceAt: '2026-07-30T08:00:00.000Z',
          version: 5,
        },
      ],
      useLearnerDecision: false,
    });

    expect(context.learnerDecision?.action).toBe('teach');
    expect(context.shadowComparison?.newTargetTool).toBe('teaching');
    expect(context.recommendation?.targetTool).toBe('quiz');
  });

  it('never exposes generated knowledge-point ids in personalization output', () => {
    const context = buildPersonalizationContext({
      userId: 'u1',
      profile: makeProfile(),
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
      learningPath: null,
      knowledgeStates: [
        {
          userId: 'u1',
          nodeId: canonicalizeKnowledgePoint('二次函数').id,
          alpha: 2,
          beta: 5,
          mastery: 0.28,
          confidence: 0.7,
          retention: 1,
          reviewStabilityDays: 7,
          repeatedErrorCount: 2,
          evidenceCount: 4,
          version: 5,
        },
      ],
    });

    expect(
      JSON.stringify({
        topic: context.learnerDecision?.topic,
        tutoringTopic: context.tutoringPolicy?.targetTopic,
        recommendation: context.recommendation,
        toolPolicies: context.toolPolicies,
      }),
    ).not.toContain('kp-');
    expect(context.learnerDecision?.topic).toBe('二次函数');
    expect(context.tutoringPolicy?.targetTopic).toBe('二次函数');
  });

  it('returns medium defaults and quiz onboarding for empty learning data', () => {
    const context = buildPersonalizationContext({
      userId: 'new-user',
      profile: null,
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
      learningPath: null,
    });

    expect(context.hasLearningData).toBe(false);
    expect(context.preferredDifficulty).toBe('medium');
    expect(context.weakPoints).toEqual([]);
    expect(context.recommendation).toMatchObject({
      targetTool: 'quiz',
    });
  });

  it('includes conversation profile signals before behavioral learning data exists', () => {
    const profileSignals: ProfileSignal[] = [
      {
        id: 'goal',
        userId: 'new-user',
        dimension: 'learningGoal',
        value: 'finish a RAG project',
        source: 'onboarding_chat',
        confidence: 0.9,
        evidence: ['I need a RAG project'],
        createdAt: 1000,
      },
      {
        id: 'weak',
        userId: 'new-user',
        dimension: 'knowledgeBase',
        value: {
          strongPoints: ['Python'],
          weakPoints: ['vector retrieval'],
        },
        source: 'onboarding_chat',
        confidence: 0.82,
        evidence: ['vector retrieval is confusing'],
        createdAt: 1001,
      },
      {
        id: 'pref',
        userId: 'new-user',
        dimension: 'resourcePreference',
        value: ['code cases', 'diagrams'],
        source: 'onboarding_chat',
        confidence: 0.8,
        evidence: ['prefers code and diagrams'],
        createdAt: 1002,
      },
      {
        id: 'state',
        userId: 'new-user',
        dimension: 'currentLearningState',
        value: '自评基础：有基础但不稳定',
        source: 'onboarding_chat',
        confidence: 0.6,
        evidence: ['onboarding baseline'],
        createdAt: 1003,
      },
      {
        id: 'pace',
        userId: 'new-user',
        dimension: 'learningPace',
        value: 'slow',
        source: 'onboarding_chat',
        confidence: 0.75,
        evidence: ['weekly time'],
        createdAt: 1004,
      },
    ];

    const context = buildPersonalizationContext({
      userId: 'new-user',
      profile: null,
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
      learningPath: null,
      profileSignals,
    });

    expect(context.hasLearningData).toBe(false);
    expect(context.hasPersonalizationSignals).toBe(true);
    expect(context.conversationProfile?.learningGoal?.value).toBe('finish a RAG project');
    expect(context.conversationProfile?.knowledgeBase?.weakPoints).toEqual(['vector retrieval']);
    expect(context.conversationProfile?.resourcePreference?.value).toEqual([
      'code cases',
      'diagrams',
    ]);
    expect(context.tutoringPolicy).toMatchObject({
      targetTopic: 'vector retrieval',
      difficulty: 'easy',
      explanationStyle: 'example_first',
      resourceFormats: ['code_case', 'diagram'],
      pacing: 'remedial',
    });
    expect(context.tutoringPolicy?.directives).toEqual(
      expect.arrayContaining([
        expect.stringContaining('vector retrieval'),
        expect.stringContaining('code cases'),
      ]),
    );
    expect(context.recommendation).toMatchObject({
      targetTool: 'quiz',
    });
    expect(context.recommendation?.href).toContain('topic=vector+retrieval');
  });

  it('recommends a diagnostic for the first self-reported weak subject on cold start', () => {
    const context = buildPersonalizationContext({
      userId: 'new-user',
      profile: null,
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
      learningPath: null,
      selfReportedWeakSubjects: ['physics'],
    });

    expect(context.recommendation).toMatchObject({
      targetTool: 'quiz',
      href: '/sky/cloud-mind/quiz?subject=physics&mode=diagnostic',
    });
  });

  it('keeps observed weak points ahead of self-reported subjects', () => {
    const context = buildPersonalizationContext({
      userId: 'u1',
      profile: makeProfile({
        masteryByKnowledge: { 数学: 20 },
        weakPoints: ['数学'],
        strongPoints: [],
      }),
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
      learningPath: null,
      selfReportedWeakSubjects: ['physics'],
    });

    const recommendationUrl = new URL(context.recommendation!.href, 'http://localhost');
    expect(recommendationUrl.searchParams.get('topic')).toBe('数学');
    expect(recommendationUrl.searchParams.get('subject')).toBeNull();
  });

  it('uses profile data for weak points, recent accuracy, difficulty, and error patterns', () => {
    const context = buildPersonalizationContext({
      userId: 'u1',
      profile: makeProfile(),
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
      learningPath: makeLearningPath(),
    });

    expect(context.hasLearningData).toBe(true);
    expect(context.weakPoints[0]).toMatchObject({
      knowledgePoint: '二次函数',
      mastery: 42,
    });
    expect(context.masteryByKnowledge).toMatchObject({ 二次函数: 42 });
    expect(context.recentAccuracy).toBe(52);
    expect(context.preferredDifficulty).toBe('easy');
    expect(context.tutoringPolicy).toMatchObject({
      targetTopic: '二次函数',
      difficulty: 'easy',
      explanationStyle: 'step_first',
      pacing: 'remedial',
    });
    expect(context.tutoringPolicy?.directives).toEqual(
      expect.arrayContaining([
        expect.stringContaining('低负荷'),
        expect.stringContaining('二次函数'),
      ]),
    );
    expect(context.errorPatterns[0]).toMatchObject({
      knowledgePoint: '二次函数',
      errorType: 'concept-unclear',
      frequency: 3,
    });
    expect(context.learningPath).toMatchObject({
      current: '二次函数图像',
      next: '二次函数图像',
    });
  });

  it('prioritizes due reviews as memory actions without recommending removed tools', () => {
    const context = buildPersonalizationContext({
      userId: 'u1',
      profile: makeProfile(),
      mistakes: [makeMistake()],
      dueMistakes: [makeMistake()],
      recentAttempts: [],
      learningPath: null,
    });

    expect(context.dueReviews).toHaveLength(1);
    expect(context.recommendation).toMatchObject({
      targetTool: 'memory',
    });
    expect(context.recommendation?.href).toContain('/sky/cloud-mind/memory');
    expect(['knowledge', 'write', 'translate']).not.toContain(context.recommendation?.targetTool);
  });
});
