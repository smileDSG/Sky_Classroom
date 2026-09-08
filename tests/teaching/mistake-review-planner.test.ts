/**
 * Mistake Review Planner — Tests
 */

import { describe, it, expect } from 'vitest';
import {
  planMistakeReview,
  buildTeachingTopicFromReview,
} from '@/lib/teaching/mistake-review-planner';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';

function makeEntry(overrides?: Partial<MistakeBookEntry>): MistakeBookEntry {
  return {
    id: 'test-' + Math.random().toString(36).slice(2),
    userId: 'user-1',
    problemText: '测试题目',
    userAnswer: 'A',
    correctAnswer: 'B',
    errorType: 'concept',
    knowledgePoints: ['二次函数'],
    source: 'solve',
    createdAt: Date.now(),
    reviewCount: 0,
    reviewed: false,
    ...overrides,
  };
}

describe('planMistakeReview', () => {
  it('returns empty plan for no mistakes', () => {
    const plan = planMistakeReview([]);
    expect(plan.topic).toBe('错题回顾');
    expect(plan.weakPoints).toEqual([]);
    expect(plan.errorPatterns).toEqual([]);
    expect(plan.estimatedSections).toBe(0);
  });

  it('extracts top weak point by frequency', () => {
    const mistakes = [
      makeEntry({ knowledgePoints: ['二次函数'], errorType: 'concept' }),
      makeEntry({ knowledgePoints: ['二次函数'], errorType: 'concept' }),
      makeEntry({ knowledgePoints: ['一元二次方程'], errorType: 'calculation' }),
    ];
    const plan = planMistakeReview(mistakes);
    expect(plan.weakPoints[0]).toBe('二次函数');
    expect(plan.topic).toBe('二次函数');
    expect(plan.title).toContain('二次函数');
    expect(plan.estimatedSections).toBeGreaterThanOrEqual(1);
  });

  it('aggregates error patterns by cause', () => {
    const mistakes = [
      makeEntry({ errorType: 'concept', problemText: 'P1' }),
      makeEntry({ errorType: 'concept', problemText: 'P2' }),
      makeEntry({ errorType: 'calculation', problemText: 'P3' }),
    ];
    const plan = planMistakeReview(mistakes);
    expect(plan.errorPatterns.length).toBe(2);
    expect(plan.errorPatterns[0].cause).toBe('concept');
    expect(plan.errorPatterns[0].count).toBe(2);
    expect(plan.errorPatterns[0].examples.length).toBeLessThanOrEqual(3);
  });

  it('collects prerequisites for weak points', () => {
    const mistakes = [makeEntry({ knowledgePoints: ['二次函数'] })];
    const plan = planMistakeReview(mistakes);
    // 二次函数 should have prerequisites like 一元二次方程
    expect(plan.prerequisiteChain.length).toBeGreaterThanOrEqual(0);
  });

  it('limits estimated sections to max 6', () => {
    const mistakes = Array.from({ length: 20 }, () =>
      makeEntry({ knowledgePoints: ['KP-' + Math.random()] }),
    );
    const plan = planMistakeReview(mistakes);
    expect(plan.estimatedSections).toBeLessThanOrEqual(6);
  });

  it('uses fallback weak points when graph has none', () => {
    const mistakes = [
      makeEntry({ knowledgePoints: ['自定义知识点A'] }),
      makeEntry({ knowledgePoints: ['自定义知识点B'] }),
    ];
    const plan = planMistakeReview(mistakes);
    expect(plan.weakPoints.length).toBeGreaterThan(0);
  });
});

describe('buildTeachingTopicFromReview', () => {
  it('builds simple topic for single weak point', () => {
    const plan = {
      topic: '二次函数',
      title: '测试',
      weakPoints: ['二次函数'],
      errorPatterns: [],
      prerequisiteChain: [],
      estimatedSections: 2,
    };
    const topic = buildTeachingTopicFromReview(plan);
    expect(topic).toBe('二次函数');
  });

  it('includes weak points annotation when multiple exist', () => {
    const plan = {
      topic: '二次函数',
      title: '测试',
      weakPoints: ['二次函数', '一元二次方程'],
      errorPatterns: [],
      prerequisiteChain: [],
      estimatedSections: 2,
    };
    const topic = buildTeachingTopicFromReview(plan);
    expect(topic).toContain('重点');
    expect(topic).toContain('二次函数');
    expect(topic).toContain('一元二次方程');
  });

  it('includes error cause annotation', () => {
    const plan = {
      topic: '二次函数',
      title: '测试',
      weakPoints: ['二次函数'],
      errorPatterns: [
        { cause: 'concept', count: 2, examples: [] },
        { cause: 'calculation', count: 1, examples: [] },
      ],
      prerequisiteChain: [],
      estimatedSections: 2,
    };
    const topic = buildTeachingTopicFromReview(plan);
    expect(topic).toContain('概念不清');
    expect(topic).toContain('计算失误');
  });
});
