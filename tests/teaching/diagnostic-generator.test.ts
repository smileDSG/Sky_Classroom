/**
 * Diagnostic Generator — Tests
 */

import { describe, it, expect } from 'vitest';
import { extractPrerequisites, analyzeDiagnosticResult } from '@/lib/teaching/diagnostic-generator';
import type { StudentProfile } from '@/lib/student/profile-types';

function makeProfile(overrides?: Partial<StudentProfile>): StudentProfile {
  return {
    userId: 'test-user',
    masteryBySubject: {
      math: 60,
      physics: 40,
      chemistry: 0,
      biology: 0,
      chinese: 0,
      english: 0,
      history: 0,
      geography: 0,
      politics: 0,
      unknown: 0,
    },
    masteryByKnowledge: {},
    weakPoints: [],
    strongPoints: [],
    errorPatterns: [],
    totalQuestions: 10,
    totalCorrect: 5,
    lastUpdated: new Date(),
    ...overrides,
  };
}

describe('extractPrerequisites', () => {
  it('returns empty for unknown topic with no weak points', () => {
    const profile = makeProfile();
    const result = extractPrerequisites('未知主题', profile);
    expect(result).toEqual([]);
  });

  it('extracts prerequisites from KNOWLEDGE_RELATIONS', () => {
    const profile = makeProfile();
    // 二次函数 has prereqs: 一元二次方程, 函数概念
    const result = extractPrerequisites('二次函数', profile);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('一元二次方程');
    expect(result).toContain('函数概念');
  });

  it('filters out mastered prerequisites (mastery > 80)', () => {
    const profile = makeProfile({
      masteryByKnowledge: { 函数概念: 90 },
    });
    const result = extractPrerequisites('二次函数', profile);
    // 函数概念 is mastered, should be filtered out
    expect(result).not.toContain('函数概念');
    expect(result).toContain('一元二次方程');
  });

  it('returns weak points matching topic as fallback', () => {
    const profile = makeProfile({
      weakPoints: ['二次函数求根', '二次函数图像'],
    });
    const result = extractPrerequisites('二次函数', profile);
    expect(result.length).toBeGreaterThan(0);
  });

  it('limits to max 5 prerequisites', () => {
    const profile = makeProfile();
    // Use a broad topic that might have many prerequisites
    const result = extractPrerequisites('解析几何', profile);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe('analyzeDiagnosticResult', () => {
  const questions = [
    {
      id: 1,
      question: 'Q1',
      options: ['A', 'B'],
      answer: 0,
      explanation: '',
      knowledgePoint: 'KP1',
    },
    {
      id: 2,
      question: 'Q2',
      options: ['A', 'B'],
      answer: 1,
      explanation: '',
      knowledgePoint: 'KP2',
    },
    {
      id: 3,
      question: 'Q3',
      options: ['A', 'B'],
      answer: 0,
      explanation: '',
      knowledgePoint: 'KP3',
    },
  ];

  it('calculates 100% accuracy', () => {
    const answers = [
      { questionId: 1, selectedOption: 0 },
      { questionId: 2, selectedOption: 1 },
      { questionId: 3, selectedOption: 0 },
    ];
    const result = analyzeDiagnosticResult(questions, answers);
    expect(result.accuracy).toBe(100);
    expect(result.recommendedDepth).toBe('advanced');
    expect(result.weakPrerequisites).toEqual([]);
  });

  it('calculates 0% accuracy', () => {
    const answers = [
      { questionId: 1, selectedOption: 1 },
      { questionId: 2, selectedOption: 0 },
      { questionId: 3, selectedOption: 1 },
    ];
    const result = analyzeDiagnosticResult(questions, answers);
    expect(result.accuracy).toBe(0);
    expect(result.recommendedDepth).toBe('basic');
    expect(result.weakPrerequisites).toEqual(['KP1', 'KP2', 'KP3']);
  });

  it('calculates 50% accuracy', () => {
    const answers = [
      { questionId: 1, selectedOption: 0 },
      { questionId: 2, selectedOption: 0 },
      { questionId: 3, selectedOption: 1 },
    ];
    const result = analyzeDiagnosticResult(questions, answers);
    expect(result.accuracy).toBe(33); // 1/3 rounded
    expect(result.recommendedDepth).toBe('basic');
  });

  it('handles empty answers', () => {
    const result = analyzeDiagnosticResult(questions, []);
    expect(result.accuracy).toBe(0);
  });
});
