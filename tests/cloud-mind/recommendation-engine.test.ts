import { describe, expect, it } from 'vitest';
import { buildCloudMindDashboard } from '@/lib/cloud-mind/recommendation-engine';
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
});
