import { describe, expect, it } from 'vitest';
import { buildPersonalizationContext } from '@/lib/cloud-mind/personalization-context';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { LearningPath } from '@/lib/teaching/learning-path-types';

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
