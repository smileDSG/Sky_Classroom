import { describe, test, expect, vi, beforeEach } from 'vitest';

// Shared state for LLM mock
const llmState = vi.hoisted(() => ({
  shouldFail: false,
  responseText: '',
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn().mockImplementation(async () => {
    if (llmState.shouldFail) throw new Error('API error');
    if (!llmState.responseText) throw new Error('No mock response configured');
    return { text: llmState.responseText };
  }),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn().mockImplementation((text: string) => {
    try { return JSON.parse(text); } catch { return null; }
  }),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue({ model: {}, modelId: 'test', provider: 'deepseek' }),
}));

import { gradeAnswer, gradeAnswerSync } from '@/lib/solve/grader';

beforeEach(() => {
  llmState.shouldFail = false;
  llmState.responseText = '';
});

describe('gradeAnswerSync (rule-based fallback)', () => {
  test('exact match returns score 100', () => {
    const result = gradeAnswerSync('4', '4');
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
  });

  test('contains answer returns score 80', () => {
    const result = gradeAnswerSync('答案是4', '4');
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(80);
  });

  test('answer contains expected returns score 80', () => {
    const result = gradeAnswerSync('4', '答案是4');
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(80);
  });

  test('partial match returns proportional score', () => {
    const result = gradeAnswerSync('x = 2', 'x = 3');
    expect(result.isCorrect).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(50);
  });

  test('completely wrong returns low score', () => {
    const result = gradeAnswerSync('4', '香蕉');
    expect(result.isCorrect).toBe(false);
    expect(result.score).toBeLessThanOrEqual(20);
  });
});

describe('gradeAnswer (LLM-based)', () => {
  const validGradeJson = {
    isCorrect: false,
    score: 60,
    errorAnalysis: '计算过程中有一步算错',
    cause: 'calculation-error',
    partialCredit: [
      { step: '步骤1：移项', maxScore: 50, earnedScore: 50, comment: '正确' },
      { step: '步骤2：计算', maxScore: 50, earnedScore: 10, comment: '算错' },
    ],
  };

  test('uses LLM when available', async () => {
    llmState.responseText = JSON.stringify(validGradeJson);

    const result = await gradeAnswer('解方程', 'x = 2', 'x = 3');

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(60);
    expect(result.cause).toBe('calculation-error');
  });

  test('falls back to rule-based when LLM fails', async () => {
    llmState.shouldFail = true;

    const result = await gradeAnswer('2+2=?', '4', '5');

    expect(result).toBeDefined();
    expect(typeof result.score).toBe('number');
    expect(result.cause).toBeDefined();
  });

  test('falls back when LLM response is unparseable', async () => {
    llmState.responseText = 'not json at all';

    const result = await gradeAnswer('2+2=?', '4', '4');

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
  });

  test('clamps score to 0-100 range', async () => {
    const outOfRange = { ...validGradeJson, score: 150 };
    llmState.responseText = JSON.stringify(outOfRange);

    const result = await gradeAnswer('test', 'A', 'B');
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('negative score clamped to 0', async () => {
    const negative = { ...validGradeJson, score: -10 };
    llmState.responseText = JSON.stringify(negative);

    const result = await gradeAnswer('test', 'A', 'B');
    expect(result.score).toBe(0);
  });

  test('normalizes Chinese cause to enum value', async () => {
    const chineseCause = { ...validGradeJson, cause: '概念不清' };
    llmState.responseText = JSON.stringify(chineseCause);

    const result = await gradeAnswer('test', 'A', 'B');
    expect(result.cause).toBe('concept-unclear');
  });

  test('normalizes calculation cause', async () => {
    const calcCause = { ...validGradeJson, cause: '计算失误' };
    llmState.responseText = JSON.stringify(calcCause);

    const result = await gradeAnswer('test', 'A', 'B');
    expect(result.cause).toBe('calculation-error');
  });

  test('defaults to concept-unclear for unrecognized cause', async () => {
    const unknownCause = { ...validGradeJson, cause: 'some-weird-cause' };
    llmState.responseText = JSON.stringify(unknownCause);

    const result = await gradeAnswer('test', 'A', 'B');
    expect(result.cause).toBe('concept-unclear');
  });

  test('includes partialCredit when provided', async () => {
    llmState.responseText = JSON.stringify(validGradeJson);

    const result = await gradeAnswer('解方程', 'x = 2', 'x = 3');

    expect(result.partialCredit).toHaveLength(2);
    expect(result.partialCredit?.[0].earnedScore).toBe(50);
    expect(result.partialCredit?.[1].earnedScore).toBe(10);
  });
});
