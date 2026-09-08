import { describe, test, expect } from 'vitest';
import { generateFourPartOutput, generateGradedFourPartOutput } from '@/lib/solve/four-part-output';
import type { GradeResult } from '@/lib/solve/types';

describe('generateFourPartOutput', () => {
  test('formats a complete solution with all fields', () => {
    const raw = {
      answer: 'x = 2',
      steps: [
        { label: '移项', content: '2x = 6', keyPoints: ['等式两边同时除以2'] },
        { label: '计算', content: 'x = 3', keyPoints: [] },
      ],
      knowledgePoints: [{ name: '一元一次方程', description: '基础代数', difficulty: 'easy' }],
      similarQuestions: [
        { problem: '3x + 1 = 7', difficulty: 0.4, knowledgePoint: '一元一次方程' },
      ],
    };

    const result = generateFourPartOutput(raw);

    expect(result.answer).toBe('$x = 2$');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].label).toBe('移项');
    expect(result.steps[0].keyPoints).toContain('等式两边同时除以2');
    expect(result.knowledgePoints).toHaveLength(1);
    expect(result.knowledgePoints[0].difficulty).toBe('easy');
    expect(result.similarQuestions).toHaveLength(1);
  });

  test('handles empty/null answer gracefully', () => {
    const result = generateFourPartOutput({ answer: '' });
    expect(result.answer).toBe('暂无答案');
  });

  test('generates default step when no steps provided', () => {
    const result = generateFourPartOutput({ answer: '42' });
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].label).toBe('解答');
    expect(result.steps[0].content).toBe('42');
  });

  test('generates default step label when missing', () => {
    const result = generateFourPartOutput({
      answer: 'x=2',
      steps: [{ label: '', content: 'step content' }],
    });
    expect(result.steps[0].label).toBe('步骤1');
  });

  test('normalizes missing knowledge points', () => {
    const result = generateFourPartOutput({ answer: 'x=2' });
    expect(result.knowledgePoints).toEqual([]);
  });

  test('normalizes missing similar questions', () => {
    const result = generateFourPartOutput({ answer: 'x=2' });
    expect(result.similarQuestions).toEqual([]);
  });

  test('normalizes difficulty from Chinese text', () => {
    const raw = {
      answer: 'test',
      knowledgePoints: [
        { name: '简单题', description: '', difficulty: '简单' },
        { name: '难题', description: '', difficulty: '困难' },
        { name: '中等', description: '', difficulty: '中等' },
      ],
    };

    const result = generateFourPartOutput(raw);

    expect(result.knowledgePoints[0].difficulty).toBe('easy');
    expect(result.knowledgePoints[1].difficulty).toBe('hard');
    expect(result.knowledgePoints[2].difficulty).toBe('medium');
  });

  test('caps similar questions to 5', () => {
    const raw = {
      answer: 'test',
      similarQuestions: Array.from({ length: 10 }, (_, i) => ({
        problem: `Q${i}`,
        difficulty: 0.5,
        knowledgePoint: 'test',
      })),
    };

    const result = generateFourPartOutput(raw);
    expect(result.similarQuestions).toHaveLength(5);
  });

  test('trims whitespace from answer', () => {
    const result = generateFourPartOutput({ answer: '  x = 2  ' });
    expect(result.answer).toBe('$x = 2$');
  });
});

describe('generateGradedFourPartOutput', () => {
  const baseGradeResult: GradeResult = {
    isCorrect: false,
    score: 40,
    correctAnswer: 'x = 2',
    userAnswer: 'x = 3',
    errorAnalysis: '计算过程中有一步算错',
    cause: 'calculation-error',
  };

  const raw = {
    answer: 'x = 2',
    steps: [{ label: '解', content: 'x = 2' }],
    similarQuestions: [
      { problem: '2x + 1 = 5', difficulty: 0.4, knowledgePoint: '方程' },
      { problem: '3x - 2 = 7', difficulty: 0.5, knowledgePoint: '方程' },
    ],
  };

  test('includes gradeResult in output', () => {
    const result = generateGradedFourPartOutput(raw, baseGradeResult);
    expect(result.gradeResult).toBe(baseGradeResult);
  });

  test('builds mistakeAnalysis for wrong answers', () => {
    const result = generateGradedFourPartOutput(raw, baseGradeResult);
    expect(result.mistakeAnalysis).toContain('计算失误');
    expect(result.mistakeAnalysis).toContain('计算过程中有一步算错');
  });

  test('builds encouragement for correct answers', () => {
    const correctGrade: GradeResult = {
      ...baseGradeResult,
      isCorrect: true,
      score: 100,
      cause: 'careless',
    };

    const result = generateGradedFourPartOutput(raw, correctGrade);
    expect(result.mistakeAnalysis).toBe('回答正确，请继续保持！');
  });

  test('generates recommended practice from similar questions', () => {
    const result = generateGradedFourPartOutput(raw, baseGradeResult);
    expect(result.recommendedPractice.length).toBeGreaterThan(0);
    expect(result.recommendedPractice[0].problem).toBe('2x + 1 = 5');
    expect(result.recommendedPractice[0].reason).toContain('检查计算');
  });

  test('generates challenge questions when correct', () => {
    const correctGrade: GradeResult = {
      ...baseGradeResult,
      isCorrect: true,
      score: 100,
      cause: 'careless',
    };

    const result = generateGradedFourPartOutput(raw, correctGrade);
    expect(result.recommendedPractice.length).toBe(2);
    expect(result.recommendedPractice[0].reason).toBe('同类练习，巩固知识');
  });

  test('generates fallback practice when no similar questions', () => {
    const rawNoQuestions = {
      answer: 'x = 2',
      similarQuestions: [],
    };

    const result = generateGradedFourPartOutput(rawNoQuestions, baseGradeResult);
    expect(result.recommendedPractice.length).toBeGreaterThan(0);
    expect(result.recommendedPractice[0].problem).toContain('教材');
  });

  test('all cause types produce valid mistakeAnalysis', () => {
    const causes: GradeResult['cause'][] = [
      'concept-unclear',
      'calculation-error',
      'misreading',
      'method-wrong',
      'careless',
      'format-error',
    ];

    for (const cause of causes) {
      const grade: GradeResult = { ...baseGradeResult, cause };
      const result = generateGradedFourPartOutput(raw, grade);
      expect(result.mistakeAnalysis).toBeTruthy();
      expect(result.mistakeAnalysis).not.toBe('');
    }
  });

  test('extends FourPartOutput base fields', () => {
    const result = generateGradedFourPartOutput(raw, baseGradeResult);
    expect(result.answer).toBe('$x = 2$');
    expect(result.steps).toBeDefined();
    expect(result.knowledgePoints).toBeDefined();
    expect(result.similarQuestions).toBeDefined();
    expect(result.gradeResult).toBeDefined();
    expect(result.mistakeAnalysis).toBeDefined();
    expect(result.recommendedPractice).toBeDefined();
  });
});
