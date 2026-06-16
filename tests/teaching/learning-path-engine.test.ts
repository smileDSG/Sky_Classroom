/**
 * Learning Path Engine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildInitialPath,
  updatePathAfterJob,
  getNextRecommendedTopic,
  getPathProgress,
} from '@/lib/teaching/learning-path-engine';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { TeachingJob } from '@/lib/server/teaching-job-store';

function makeProfile(overrides?: Partial<StudentProfile>): StudentProfile {
  return {
    userId: 'user-1',
    masteryBySubject: { math: 60, physics: 50, chemistry: 40, biology: 50, chinese: 70, english: 60, history: 50, geography: 50, politics: 50, unknown: 50 },
    masteryByKnowledge: {
      '二次函数': 30,
      '一元二次方程': 50,
      '函数概念': 70,
      '因式分解': 80,
      '一元一次方程': 90,
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
        '二次函数': 30,
        '一元二次方程': 50,
        '函数概念': 70,
        '因式分解': 80,
        '一元一次方程': 90,
        '三角形': 40,
        '全等三角形': 30,
        '相似三角形': 20,
        '圆': 35,
        '三角函数': 25,
        '数列': 45,
        '等差数列': 40,
        '等比数列': 35,
      },
    });
    const path = buildInitialPath(profile);
    expect(path.nodes.length).toBeLessThanOrEqual(10);
  });

  it('limits path length to maxNodes', () => {
    const profile = makeProfile({
      masteryByKnowledge: {
        '二次函数': 30,
        '一元二次方程': 50,
        '函数概念': 70,
        '因式分解': 80,
        '一元一次方程': 90,
        '三角形': 40,
        '全等三角形': 30,
        '相似三角形': 20,
        '圆': 35,
        '三角函数': 25,
        '数列': 45,
        '等差数列': 40,
        '等比数列': 35,
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
        { sectionId: 's1', feedbackType: 'mastered', knowledgePoints: ['二次函数'], timestamp: Date.now() },
        { sectionId: 's2', feedbackType: 'mastered', knowledgePoints: ['二次函数'], timestamp: Date.now() },
      ],
      quizResults: [
        { sectionId: 's1', chunkOrder: 0, knowledgePoints: ['二次函数'], isCorrect: true, timestamp: Date.now() },
        { sectionId: 's1', chunkOrder: 1, knowledgePoints: ['二次函数'], isCorrect: true, timestamp: Date.now() },
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
        { sectionId: 's1', feedbackType: 'needs_review', knowledgePoints: ['二次函数'], timestamp: Date.now() },
        { sectionId: 's2', feedbackType: 'needs_review', knowledgePoints: ['二次函数'], timestamp: Date.now() },
      ],
      quizResults: [
        { sectionId: 's1', chunkOrder: 0, knowledgePoints: ['二次函数'], isCorrect: false, timestamp: Date.now() },
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
        { sectionId: 's1', feedbackType: 'mastered', knowledgePoints: ['二次函数'], timestamp: Date.now() },
      ],
      quizResults: [
        { sectionId: 's1', chunkOrder: 0, knowledgePoints: ['二次函数'], isCorrect: true, timestamp: Date.now() },
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
    expect(getPathProgress({ id: 'p1', userId: 'u1', title: 'T', nodes: [], createdAt: 0, updatedAt: 0 })).toBe(0);
  });

  it('returns correct percentage', () => {
    const path = {
      id: 'p1',
      userId: 'u1',
      title: 'T',
      nodes: [
        { id: 'n1', topic: 'A', knowledgePoints: [], estimatedSections: 2, prerequisites: [], status: 'completed' as const },
        { id: 'n2', topic: 'B', knowledgePoints: [], estimatedSections: 2, prerequisites: [], status: 'completed' as const },
        { id: 'n3', topic: 'C', knowledgePoints: [], estimatedSections: 2, prerequisites: [], status: 'pending' as const },
        { id: 'n4', topic: 'D', knowledgePoints: [], estimatedSections: 2, prerequisites: [], status: 'pending' as const },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    expect(getPathProgress(path)).toBe(50);
  });
});
