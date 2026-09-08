import { describe, expect, test } from 'vitest';
import { classifyProblem } from '@/lib/solve/solver-constants';
import type { ProblemSpec } from '@/lib/solve/types';

function spec(subject: string): ProblemSpec {
  return {
    id: '1',
    stage: '高中',
    subject,
    questionType: '解答题',
    stem: '无关键词题干',
    options: [],
    givens: [],
    asks: [],
    formulas: [],
    ambiguities: [],
    materials: [],
    subQuestions: [],
    diagram: null,
    confidence: 0.95,
  };
}

describe('classifyProblem', () => {
  test.each(['数学', '物理', '化学', '生物', 'math', 'physics'])(
    '%s routes to science from structured subject',
    (subject) => {
      expect(classifyProblem('没有明显关键词', spec(subject))).toBe('science');
    },
  );

  test.each(['语文', '英语', '历史', '政治', '地理', 'english'])(
    '%s routes to humanities from structured subject',
    (subject) => {
      expect(classifyProblem('计算这个表达式', spec(subject))).toBe('humanities');
    },
  );

  test('unknown structured subject falls back to text classification', () => {
    expect(classifyProblem('请计算方程 x + 1 = 2', spec('未知'))).toBe('science');
  });
});
