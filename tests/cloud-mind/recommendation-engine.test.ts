import { describe, expect, it } from 'vitest';
import { buildCloudMindDashboard } from '@/lib/cloud-mind/recommendation-engine';
import { canonicalizeKnowledgePoint } from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';
import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { StudentProfile } from '@/lib/student/profile-types';

function makeProfile(): StudentProfile {
  return {
    userId: 'u1',
    masteryBySubject: {} as StudentProfile['masteryBySubject'],
    masteryByKnowledge: { 二次函数: 42, 古诗鉴赏: 88 },
    weakPoints: ['二次函数'],
    strongPoints: ['古诗鉴赏'],
    errorPatterns: [],
    totalQuestions: 12,
    totalCorrect: 7,
    lastUpdated: new Date(),
  };
}

function makeMistake(): MistakeBookEntry {
  return {
    id: 'm1',
    problemText: '二次函数顶点式转化错误',
    userAnswer: 'A',
    correctAnswer: 'B',
    errorType: 'concept',
    knowledgePoints: ['二次函数'],
    reviewCount: 0,
    nextReview: Date.now() - 1000,
    masteryLevel: 0,
    reviewed: false,
  };
}

function makeProfileWithoutExplicitWeakPoints(): StudentProfile {
  return {
    userId: 'u2',
    masteryBySubject: {} as StudentProfile['masteryBySubject'],
    masteryByKnowledge: { 二次函数: 67, 导数: 82, 数列求和: 91 },
    weakPoints: [],
    strongPoints: ['数列求和'],
    errorPatterns: [],
    totalQuestions: 52,
    totalCorrect: 19,
    lastUpdated: new Date('2026-06-25T12:00:00Z'),
    recentQuizPerformance: {
      overallAccuracy: 33,
      accuracyByKnowledge: { 二次函数: 33 },
      topErrorCauses: [],
      recommendedDepthShift: 'shallower',
    },
  };
}

describe('cloud mind recommendation engine', () => {
  it('creates an onboarding recommendation for new learners', () => {
    const dashboard = buildCloudMindDashboard({
      userId: 'u1',
      profile: null,
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
    });

    expect(dashboard.hasLearningData).toBe(false);
    expect(dashboard.recommendations[0].actionType).toBe('practice_quiz');
    expect(dashboard.recommendations[0].evidence.length).toBeGreaterThan(0);
  });

  it('prioritizes due review and keeps weak-point evidence', () => {
    const dashboard = buildCloudMindDashboard({
      userId: 'u1',
      profile: makeProfile(),
      mistakes: [makeMistake()],
      dueMistakes: [makeMistake()],
      recentAttempts: [],
    });

    expect(dashboard.hasLearningData).toBe(true);
    expect(dashboard.recommendations[0].actionType).toBe('review_mistakes');
    expect(dashboard.weakPoints[0].knowledgePoint).toBe('二次函数');
    expect(dashboard.recommendations.some((item) => item.evidence.length > 0)).toBe(true);
  });
  it('uses cached profile mastery when raw attempts are unavailable', () => {
    const dashboard = buildCloudMindDashboard({
      userId: 'u2',
      profile: makeProfileWithoutExplicitWeakPoints(),
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
    });

    expect(dashboard.hasLearningData).toBe(true);
    expect(dashboard.weakPoints[0].knowledgePoint).toBe('二次函数');
    expect(dashboard.summary.recentAccuracy).toBe(33);
    expect(dashboard.recommendations[0].actionType).toBe('start_plan');
    expect(dashboard.recentRecords[0]).toMatchObject({
      source: 'profile',
      title: '学情画像更新',
    });
  });

  it('includes knowledge state weak points in the dashboard', () => {
    const knowledgeStates: KnowledgeState[] = [
      {
        userId: 'u3',
        nodeId: 'kp-0135ff99',
        displayName: '三角形',
        alpha: 2,
        beta: 4,
        mastery: 0.33,
        confidence: 0.4,
        retention: 0.9,
        reviewStabilityDays: 5,
        repeatedErrorCount: 2,
        evidenceCount: 2,
        version: 2,
      },
    ];

    const dashboard = buildCloudMindDashboard({
      userId: 'u3',
      profile: null,
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
      knowledgeStates,
    });

    expect(dashboard.hasLearningData).toBe(true);
    expect(dashboard.weakPoints).toHaveLength(1);
    expect(dashboard.weakPoints[0].knowledgePoint).toBe('三角形');
    expect(dashboard.weakPoints[0].mastery).toBe(33);
  });

  it('resolves generated knowledge-point ids from readable learning evidence', () => {
    const knowledgeStates: KnowledgeState[] = [
      {
        userId: 'u5',
        nodeId: canonicalizeKnowledgePoint('二次函数').id,
        alpha: 2,
        beta: 4,
        mastery: 0.33,
        confidence: 0.4,
        retention: 0.9,
        reviewStabilityDays: 5,
        repeatedErrorCount: 2,
        evidenceCount: 2,
        version: 2,
      },
    ];

    const dashboard = buildCloudMindDashboard({
      userId: 'u5',
      profile: null,
      mistakes: [makeMistake()],
      dueMistakes: [],
      recentAttempts: [],
      knowledgeStates,
    });

    expect(dashboard.weakPoints[0].knowledgePoint).toBe('二次函数');
    expect(JSON.stringify(dashboard)).not.toContain('kp-');
  });

  it('averages knowledge state mastery into summary', () => {
    const knowledgeStates: KnowledgeState[] = [
      {
        userId: 'u4',
        nodeId: 'node-a',
        alpha: 4,
        beta: 2,
        mastery: 0.67,
        confidence: 0.5,
        retention: 1,
        reviewStabilityDays: 7,
        repeatedErrorCount: 0,
        evidenceCount: 1,
        version: 1,
      },
    ];

    const dashboard = buildCloudMindDashboard({
      userId: 'u4',
      profile: null,
      mistakes: [],
      dueMistakes: [],
      recentAttempts: [],
      knowledgeStates,
    });

    expect(dashboard.summary.masteryAverage).toBe(67);
  });
});
