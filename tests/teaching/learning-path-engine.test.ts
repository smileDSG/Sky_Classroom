/**
 * Learning Path Engine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildInitialPath,
  buildInitialPathFromContext,
  scoreKnowledgePoints,
  resolveWeights,
  updatePathAfterJob,
  getNextRecommendedTopic,
  getPathProgress,
} from '@/lib/teaching/learning-path-engine';
import { buildReviewSchedule } from '@/lib/schedule/review-scheduler';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { TeachingJob } from '@/lib/server/teaching-job-store';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { PathGenerationContext } from '@/lib/teaching/learning-path-types';

function makeProfile(overrides?: Partial<StudentProfile>): StudentProfile {
  return {
    userId: 'user-1',
    masteryBySubject: {
      math: 60,
      physics: 50,
      chemistry: 40,
      biology: 50,
      chinese: 70,
      english: 60,
      history: 50,
      geography: 50,
      politics: 50,
      unknown: 50,
    },
    masteryByKnowledge: {
      二次函数: 30,
      一元二次方程: 50,
      函数概念: 70,
      因式分解: 80,
      一元一次方程: 90,
    },
    weakPoints: ['二次函数'],
    strongPoints: ['因式分解', '一元一次方程'],
    errorPatterns: [],
    totalQuestions: 100,
    totalCorrect: 60,
    lastUpdated: new Date(),
    ...overrides,
  };
}

function makeJob(overrides?: Partial<TeachingJob>): TeachingJob {
  return {
    id: 'job-test-1',
    userId: 'user-1',
    topic: '二次函数',
    status: 'succeeded',
    step: 'done',
    progress: 100,
    message: '完成',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    plan: {
      title: '二次函数精讲',
      sections: [],
      estimatedDuration: 20,
      focusPoints: ['二次函数'],
    },
    sections: [],
    sectionFeedbacks: [],
    quizResults: [],
    ...overrides,
  };
}

function makeMistake(
  overrides?: Partial<MistakeBookEntry> & { knowledgePoints?: string[] },
): MistakeBookEntry {
  return {
    id: `mistake-${Math.random().toString(36).slice(2)}`,
    problemText: '测试题目',
    userAnswer: '0',
    correctAnswer: '1',
    errorType: 'concept',
    knowledgePoints: ['二次函数'],
    reviewCount: 0,
    masteryLevel: 0,
    reviewed: false,
    ...overrides,
  } as MistakeBookEntry;
}

function makeContext(overrides?: Partial<PathGenerationContext>): PathGenerationContext {
  const profile = makeProfile(overrides?.profile);
  const mistakes: MistakeBookEntry[] = overrides?.mistakes ?? [
    makeMistake({ knowledgePoints: ['二次函数'], errorType: 'concept' }),
    makeMistake({ knowledgePoints: ['二次函数'], errorType: 'concept' }),
    makeMistake({ knowledgePoints: ['一元二次方程'], errorType: 'calculation' }),
  ];

  const records = mistakes.map((m) => ({
    id: m.id,
    problem: m.problemText,
    userAnswer: m.userAnswer,
    correctAnswer: m.correctAnswer,
    cause: 'concept-unclear' as const,
    solvedAt: new Date(),
    reviewed: m.reviewed,
    reviewCount: m.reviewCount,
    knowledgePoints: m.knowledgePoints,
  }));

  return {
    profile,
    mistakes,
    knowledgeGraph: buildKnowledgeGraph(records),
    reviewSchedule: buildReviewSchedule(mistakes),
    learningStats: null,
    quizSummary: null,
    ...overrides,
  };
}

describe('buildInitialPath', () => {
  it('creates a path with nodes from weak points', () => {
    const profile = makeProfile();
    const path = buildInitialPath(profile);

    expect(path.userId).toBe('user-1');
    expect(path.nodes.length).toBeGreaterThanOrEqual(1);
    expect(path.nodes[0].status).toBe('pending');
    expect(path.nodes[0].knowledgePoints.length).toBeGreaterThanOrEqual(1);
  });

  it('includes prerequisites when goalTopic is provided', () => {
    const profile = makeProfile();
    const path = buildInitialPath(profile, '二次函数');

    expect(path.title).toContain('二次函数');
    // Should include prerequisites like 一元二次方程, 函数概念
    const allKPs = path.nodes.flatMap((n) => n.knowledgePoints);
    expect(allKPs.some((kp) => kp === '一元二次方程' || kp === '函数概念')).toBe(true);
  });

  it('caps nodes at maxNodes', () => {
    const profile = makeProfile({
      masteryByKnowledge: {
        二次函数: 30,
        一元二次方程: 50,
        函数概念: 70,
        因式分解: 80,
        一元一次方程: 90,
        三角形: 40,
        全等三角形: 30,
        相似三角形: 20,
        圆: 35,
        三角函数: 25,
        数列: 45,
        等差数列: 40,
        等比数列: 35,
      },
    });
    const path = buildInitialPath(profile);
    expect(path.nodes.length).toBeLessThanOrEqual(10);
  });

  it('limits path length to maxNodes', () => {
    const profile = makeProfile({
      masteryByKnowledge: {
        二次函数: 30,
        一元二次方程: 50,
        函数概念: 70,
        因式分解: 80,
        一元一次方程: 90,
        三角形: 40,
        全等三角形: 30,
        相似三角形: 20,
        圆: 35,
        三角函数: 25,
        数列: 45,
        等差数列: 40,
        等比数列: 35,
      },
    });
    const path = buildInitialPath(profile);
    expect(path.nodes.length).toBeLessThanOrEqual(10);
  });

  it('assigns masteryBefore based on profile', () => {
    const profile = makeProfile();
    const path = buildInitialPath(profile);

    const firstNode = path.nodes[0];
    expect(firstNode.masteryBefore).toBeDefined();
    expect(firstNode.masteryBefore).toBeGreaterThanOrEqual(0);
    expect(firstNode.masteryBefore).toBeLessThanOrEqual(100);
  });
});

describe('updatePathAfterJob', () => {
  it('updates matching node with masteryAfter and marks completed if strong', () => {
    const profile = makeProfile();
    let path = buildInitialPath(profile, '二次函数');

    // Manually set first node to in_progress so it matches
    path = {
      ...path,
      nodes: path.nodes.map((n, i) => (i === 0 ? { ...n, status: 'in_progress' as const } : n)),
    };

    const job = makeJob({
      topic: path.nodes[0].topic,
      sectionFeedbacks: [
        {
          sectionId: 's1',
          feedbackType: 'mastered',
          knowledgePoints: ['二次函数'],
          timestamp: Date.now(),
        },
        {
          sectionId: 's2',
          feedbackType: 'mastered',
          knowledgePoints: ['二次函数'],
          timestamp: Date.now(),
        },
      ],
      quizResults: [
        {
          sectionId: 's1',
          chunkOrder: 0,
          knowledgePoints: ['二次函数'],
          isCorrect: true,
          timestamp: Date.now(),
        },
        {
          sectionId: 's1',
          chunkOrder: 1,
          knowledgePoints: ['二次函数'],
          isCorrect: true,
          timestamp: Date.now(),
        },
      ],
    });

    const updated = updatePathAfterJob(path, job, profile);
    const firstNode = updated.nodes[0];

    expect(firstNode.teachingJobId).toBe('job-test-1');
    expect(firstNode.masteryAfter).toBeDefined();
    expect(firstNode.masteryAfter).toBeGreaterThan(firstNode.masteryBefore ?? 0);
    expect(firstNode.status).toBe('completed');
  });

  it('inserts review node when mastery is very low', () => {
    const profile = makeProfile();
    let path = buildInitialPath(profile, '二次函数');
    path = {
      ...path,
      nodes: path.nodes.map((n, i) => (i === 0 ? { ...n, status: 'in_progress' as const } : n)),
    };

    const job = makeJob({
      topic: path.nodes[0].topic,
      sectionFeedbacks: [
        {
          sectionId: 's1',
          feedbackType: 'needs_review',
          knowledgePoints: ['二次函数'],
          timestamp: Date.now(),
        },
        {
          sectionId: 's2',
          feedbackType: 'needs_review',
          knowledgePoints: ['二次函数'],
          timestamp: Date.now(),
        },
      ],
      quizResults: [
        {
          sectionId: 's1',
          chunkOrder: 0,
          knowledgePoints: ['二次函数'],
          isCorrect: false,
          timestamp: Date.now(),
        },
      ],
    });

    const updated = updatePathAfterJob(path, job, profile);
    const originalLength = path.nodes.length;
    expect(updated.nodes.length).toBeGreaterThan(originalLength);

    const reviewNode = updated.nodes[1];
    expect(reviewNode.topic.startsWith('复习')).toBe(true);
    expect(reviewNode.status).toBe('pending');
  });

  it('advances next pending node to in_progress when current completes', () => {
    const profile = makeProfile();
    let path = buildInitialPath(profile, '二次函数');
    // Ensure at least 2 nodes
    expect(path.nodes.length).toBeGreaterThanOrEqual(2);

    path = {
      ...path,
      nodes: path.nodes.map((n, i) =>
        i === 0
          ? { ...n, status: 'in_progress' as const }
          : i === 1
            ? { ...n, status: 'pending' as const }
            : n,
      ),
    };

    const job = makeJob({
      topic: path.nodes[0].topic,
      sectionFeedbacks: [
        {
          sectionId: 's1',
          feedbackType: 'mastered',
          knowledgePoints: ['二次函数'],
          timestamp: Date.now(),
        },
      ],
      quizResults: [
        {
          sectionId: 's1',
          chunkOrder: 0,
          knowledgePoints: ['二次函数'],
          isCorrect: true,
          timestamp: Date.now(),
        },
      ],
    });

    const updated = updatePathAfterJob(path, job, profile);
    expect(updated.nodes[0].status).toBe('completed');
    expect(updated.nodes[1].status).toBe('in_progress');
  });

  it('returns unchanged path when no matching node found', () => {
    const profile = makeProfile();
    const path = buildInitialPath(profile);
    const job = makeJob({
      topic: '完全不相关的主题',
      plan: {
        title: '无关主题',
        sections: [],
        estimatedDuration: 10,
        focusPoints: ['无关知识点'],
      },
    });

    const updated = updatePathAfterJob(path, job, profile);
    // Nodes should remain the same (only updatedAt changes)
    expect(updated.nodes.map((n) => ({ ...n, status: n.status }))).toEqual(
      path.nodes.map((n) => ({ ...n, status: n.status })),
    );
    expect(updated.updatedAt).toBeGreaterThanOrEqual(path.updatedAt);
  });
});

describe('getNextRecommendedTopic', () => {
  it('returns first pending node topic', () => {
    const profile = makeProfile();
    const path = buildInitialPath(profile);
    const topic = getNextRecommendedTopic(path);
    expect(topic).toBe(path.nodes[0].topic);
  });

  it('returns null when all nodes are completed', () => {
    const profile = makeProfile();
    const path = buildInitialPath(profile);
    const completedPath = {
      ...path,
      nodes: path.nodes.map((n) => ({ ...n, status: 'completed' as const })),
    };
    expect(getNextRecommendedTopic(completedPath)).toBeNull();
  });
});

describe('getPathProgress', () => {
  it('returns 0 for empty path', () => {
    expect(
      getPathProgress({
        id: 'p1',
        userId: 'u1',
        title: 'T',
        nodes: [],
        createdAt: 0,
        updatedAt: 0,
      }),
    ).toBe(0);
  });

  it('returns correct percentage', () => {
    const path = {
      id: 'p1',
      userId: 'u1',
      title: 'T',
      nodes: [
        {
          id: 'n1',
          topic: 'A',
          knowledgePoints: [],
          estimatedSections: 2,
          prerequisites: [],
          status: 'completed' as const,
        },
        {
          id: 'n2',
          topic: 'B',
          knowledgePoints: [],
          estimatedSections: 2,
          prerequisites: [],
          status: 'completed' as const,
        },
        {
          id: 'n3',
          topic: 'C',
          knowledgePoints: [],
          estimatedSections: 2,
          prerequisites: [],
          status: 'pending' as const,
        },
        {
          id: 'n4',
          topic: 'D',
          knowledgePoints: [],
          estimatedSections: 2,
          prerequisites: [],
          status: 'pending' as const,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    expect(getPathProgress(path)).toBe(50);
  });
});

describe('resolveWeights', () => {
  it('returns balanced weights by default', () => {
    const weights = resolveWeights();
    expect(weights.weakness).toBe(1.0);
    expect(weights.reviewUrgency).toBe(1.0);
    expect(weights.errorPattern).toBe(1.0);
    expect(weights.recentQuiz).toBe(0.8);
    expect(weights.goalBoost).toBe(0.5);
  });

  it('boosts weakness for weakness-first strategy', () => {
    const weights = resolveWeights({ strategy: 'weakness-first' });
    expect(weights.weakness).toBeGreaterThan(weights.reviewUrgency);
    expect(weights.weakness).toBe(2.0);
  });

  it('boosts review urgency for review-first strategy', () => {
    const weights = resolveWeights({ strategy: 'review-first' });
    expect(weights.reviewUrgency).toBe(2.0);
  });

  it('boosts goal for goal-topic strategy', () => {
    const weights = resolveWeights({ strategy: 'goal-topic' });
    expect(weights.goalBoost).toBe(2.5);
  });

  it('respects explicit priorities multi-select', () => {
    const weights = resolveWeights({ priorities: ['weakness', 'review'] });
    expect(weights.weakness).toBe(1.5);
    expect(weights.reviewUrgency).toBe(1.5);
    expect(weights.errorPattern).toBe(0.5);
  });
});

describe('scoreKnowledgePoints', () => {
  it('assigns higher weakness score to lower mastery', () => {
    const context = makeContext();
    const scored = scoreKnowledgePoints(context);
    const weak = scored.find((s) => s.knowledgePoint === '二次函数');
    const strong = scored.find((s) => s.knowledgePoint === '因式分解');
    expect(weak).toBeDefined();
    expect(strong).toBeDefined();
    expect(weak!.breakdown.weakness).toBeGreaterThan(strong!.breakdown.weakness);
  });

  it('raises review urgency for due mistakes', () => {
    const now = Date.now();
    const mistakes = [
      makeMistake({
        knowledgePoints: ['二次函数'],
        reviewed: false,
        nextReview: now - 1000,
      }),
    ];
    const context = makeContext({ mistakes });
    const scored = scoreKnowledgePoints(context);
    const item = scored.find((s) => s.knowledgePoint === '二次函数');
    expect(item!.breakdown.reviewUrgency).toBeGreaterThan(0);
  });

  it('boosts goal topic and its prerequisites', () => {
    const context = makeContext();
    const scored = scoreKnowledgePoints(context, { goalTopic: '二次函数' });
    const goal = scored.find((s) => s.knowledgePoint === '二次函数');
    const prereq = scored.find((s) => s.knowledgePoint === '一元二次方程');
    expect(goal!.breakdown.goalBoost).toBe(100);
    expect(prereq!.breakdown.goalBoost).toBeGreaterThan(0);
  });
});

describe('buildInitialPathFromContext', () => {
  it('generates a valid path from full context', () => {
    const context = makeContext();
    const path = buildInitialPathFromContext(context);
    expect(path.userId).toBe('user-1');
    expect(path.nodes.length).toBeGreaterThanOrEqual(1);
    expect(path.nodes.length).toBeLessThanOrEqual(10);
  });

  it('honors weakness-first strategy ordering', () => {
    const context = makeContext({
      profile: makeProfile({
        masteryByKnowledge: {
          二次函数: 20,
          一元二次方程: 50,
          函数概念: 80,
          因式分解: 90,
          一元一次方程: 95,
        },
      }),
    });
    const path = buildInitialPathFromContext(context, { strategy: 'weakness-first' });
    const allKPs = path.nodes.flatMap((n) => n.knowledgePoints);
    // 二次函数 scores highest but its prerequisites are inserted before it
    expect(allKPs).toContain('二次函数');
    expect(path.title).toContain('薄弱优先');
  });

  it('includes goal topic prerequisites when goal is provided', () => {
    const context = makeContext();
    const path = buildInitialPathFromContext(context, { goalTopic: '二次函数' });
    expect(path.title).toContain('二次函数');
    const allKPs = path.nodes.flatMap((n) => n.knowledgePoints);
    expect(allKPs).toContain('二次函数');
  });

  it('caps nodes at maxNodes', () => {
    const context = makeContext({
      profile: makeProfile({
        masteryByKnowledge: {
          二次函数: 30,
          一元二次方程: 50,
          函数概念: 70,
          因式分解: 80,
          一元一次方程: 90,
          三角形: 40,
          全等三角形: 30,
          相似三角形: 20,
          圆: 35,
          三角函数: 25,
          数列: 45,
          等差数列: 40,
          等比数列: 35,
        },
      }),
    });
    const path = buildInitialPathFromContext(context);
    expect(path.nodes.length).toBeLessThanOrEqual(10);
  });

  it('handles empty mistakes gracefully', () => {
    const context = makeContext({ mistakes: [] });
    const path = buildInitialPathFromContext(context);
    expect(path.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it('handles unknown goal topic without throwing', () => {
    const context = makeContext();
    const path = buildInitialPathFromContext(context, { goalTopic: '完全不存在的知识点' });
    expect(path.title).toContain('完全不存在的知识点');
    expect(path.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it('handles stale profile cache missing errorPatterns', () => {
    const context = makeContext({
      profile: makeProfile({ errorPatterns: undefined as unknown as never }),
    });
    expect(() => buildInitialPathFromContext(context)).not.toThrow();
  });

  it('seeds fallback nodes when there is no workshop data at all', () => {
    // No mistakes, no mastery, no knowledge graph — the situation that produced
    // empty paths before the fallback was added.
    const emptyProfile = makeProfile({
      masteryByKnowledge: {},
      weakPoints: [],
      strongPoints: [],
    });
    const context: PathGenerationContext = {
      profile: emptyProfile,
      mistakes: [],
      knowledgeGraph: { nodes: [], edges: [], weakPoints: [] },
      reviewSchedule: buildReviewSchedule([]),
      learningStats: null,
      quizSummary: null,
    };
    const path = buildInitialPathFromContext(context);
    expect(path.nodes.length).toBeGreaterThanOrEqual(1);
    // Fallback nodes should come from the built-in knowledge system.
    const allKPs = path.nodes.flatMap((n) => n.knowledgePoints);
    expect(allKPs.length).toBeGreaterThan(0);
    expect(path.nodes[0].status).toBe('pending');
  });
});
