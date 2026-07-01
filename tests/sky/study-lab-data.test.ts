import { describe, expect, it } from 'vitest';
import { buildStudyLabViewModel, type StudyLabApiSnapshots } from '@/lib/sky/study-lab-data';

const personalization = {
  userId: 'u1',
  generatedAt: 1000,
  hasLearningData: true,
  weakPoints: [
    {
      knowledgePoint: '神经网络基础',
      mastery: 42,
      recentMistakeCount: 3,
      actionHref: '/sky/cloud-mind/quiz?topic=nn',
    },
  ],
  masteryByKnowledge: { 神经网络基础: 42 },
  recentAccuracy: 58,
  dueReviews: [
    {
      id: 'r1',
      kind: 'mistake' as const,
      title: '复习激活函数',
      knowledgePoints: ['激活函数'],
      dueAt: 900,
      href: '/sky/cloud-mind/memory',
    },
  ],
  errorPatterns: [],
  preferredDifficulty: 'easy' as const,
  recommendation: {
    title: '先练神经网络基础',
    reason: '掌握度偏低，适合先做针对练习。',
    targetTool: 'quiz' as const,
    href: '/sky/cloud-mind/quiz?topic=nn',
  },
};

const workshop = {
  generatedAt: 1200,
  mistakeTotal: 7,
  mistakes: [],
  review: {
    dueCount: 2,
    overdue: 1,
    completed: 4,
    total: 9,
  },
  learningStats: {
    masteryPercent: 64,
    todayStudyMinutes: 18,
    streakDays: 5,
  },
  memoryProgress: {
    totalFlipped: 12,
    topicCount: 3,
    lastStudied: 1100,
  },
  dataSources: {
    mistakes: 'server',
    profile: 'server',
  },
};

const learningPath = {
  id: 'path1',
  userId: 'u1',
  title: '人工智能导论补强路线',
  nodes: [
    {
      id: 'n1',
      topic: '机器学习概览',
      knowledgePoints: ['监督学习'],
      estimatedSections: 2,
      prerequisites: [],
      status: 'completed' as const,
    },
    {
      id: 'n2',
      topic: '神经网络基础',
      knowledgePoints: ['激活函数', '反向传播'],
      estimatedSections: 3,
      prerequisites: ['监督学习'],
      status: 'in_progress' as const,
    },
  ],
  createdAt: 800,
  updatedAt: 1200,
};

function makeSnapshots(overrides: Partial<StudyLabApiSnapshots> = {}): StudyLabApiSnapshots {
  return {
    personalization: { status: 'fulfilled', data: personalization },
    workshop: { status: 'fulfilled', data: workshop },
    learningPath: { status: 'fulfilled', data: { path: learningPath } },
    ...overrides,
  };
}

describe('buildStudyLabViewModel', () => {
  it('combines personalization, workshop, and learning path snapshots', () => {
    const viewModel = buildStudyLabViewModel(makeSnapshots());

    expect(viewModel.generatedAt).toBe(1200);
    expect(viewModel.profile).toMatchObject({
      hasLearningData: true,
      recentAccuracy: 58,
      preferredDifficulty: 'easy',
      recommendation: {
        title: '先练神经网络基础',
        href: '/sky/cloud-mind/quiz?topic=nn',
        targetTool: 'quiz',
      },
    });
    expect(viewModel.profile.weakPoints).toHaveLength(1);
    expect(viewModel.workshop).toMatchObject({
      mistakeTotal: 7,
      dueReviewCount: 2,
      todayStudyMinutes: 18,
      streakDays: 5,
      masteryPercent: 64,
    });
    expect(viewModel.learningPath?.nodes).toHaveLength(2);
  });

  it('keeps workshop data usable when personalization fails', () => {
    const viewModel = buildStudyLabViewModel(
      makeSnapshots({
        personalization: { status: 'rejected', error: '画像加载失败' },
      }),
    );

    expect(viewModel.profile.hasLearningData).toBe(false);
    expect(viewModel.profile.recommendation).toBeNull();
    expect(viewModel.profile.weakPoints).toEqual([]);
    expect(viewModel.workshop.dueReviewCount).toBe(2);
    expect(viewModel.errors.personalization).toBe('画像加载失败');
  });

  it('returns a null path when learning path is empty', () => {
    const viewModel = buildStudyLabViewModel(
      makeSnapshots({
        learningPath: { status: 'fulfilled', data: { path: null } },
      }),
    );

    expect(viewModel.learningPath).toBeNull();
    expect(viewModel.errors.learningPath).toBeUndefined();
  });

  it('does not fabricate profile data for users without learning signals', () => {
    const viewModel = buildStudyLabViewModel(
      makeSnapshots({
        personalization: {
          status: 'fulfilled',
          data: {
            ...personalization,
            hasLearningData: false,
            weakPoints: [],
            recentAccuracy: null,
            recommendation: null,
          },
        },
        workshop: {
          status: 'fulfilled',
          data: {
            ...workshop,
            mistakeTotal: 0,
            review: { dueCount: 0, overdue: 0, completed: 0, total: 0 },
            learningStats: null,
          },
        },
      }),
    );

    expect(viewModel.profile.hasLearningData).toBe(false);
    expect(viewModel.profile.weakPoints).toEqual([]);
    expect(viewModel.profile.recentAccuracy).toBeNull();
    expect(viewModel.workshop.masteryPercent).toBe(0);
  });
});
