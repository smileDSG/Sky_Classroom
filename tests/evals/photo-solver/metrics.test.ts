import { describe, expect, it } from 'vitest';

import { evaluateAnswer } from '../../../evals/photo-solver/metrics/answer';
import {
  normalizeAnswer,
  normalizeFormula,
  normalizeText,
  normalizedExactMatch,
} from '../../../evals/photo-solver/metrics/normalization';
import { evaluateRecognition } from '../../../evals/photo-solver/metrics/recognition';
import { evaluateRetrieval } from '../../../evals/photo-solver/metrics/retrieval';

describe('normalization metrics', () => {
  it.each([
    [' Hello， WORLD！ ', 'hello,world!'],
    ['答案：  北京。', '答案:北京.'],
    ['甲\n\t乙', '甲乙'],
  ])('normalizes text %j', (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });

  it.each([
    [' Answer: 42。 ', '42'],
    ['答案为：x = 2', 'x=2'],
    ['（A）', '(a)'],
  ])('normalizes answer wrappers %j', (input, expected) => {
    expect(normalizeAnswer(input)).toBe(expected);
  });

  it.each([
    ['answerable', 'answerable'],
    ['answering', 'answering'],
    ['答案解析', '答案解析'],
  ])('does not strip answer-like words without a label boundary: %s', (input, expected) => {
    expect(normalizeAnswer(input)).toBe(expected);
  });

  it('only performs surface-safe formula normalization', () => {
    expect(normalizeFormula(' $ x ^ 2 ＋ 2 x = 3 $ ')).toBe('x^2+2x=3');
    expect(normalizeFormula('x-(y-z)')).not.toBe(normalizeFormula('x-y-z'));
    expect(normalizeFormula('a/b')).not.toBe(normalizeFormula('b/a'));
  });

  it.each([
    ['北京。', ' 北京', true],
    ['x + 1', 'x+1', true],
    ['2', '3', false],
  ])('computes normalized exact match', (actual, expected, matches) => {
    expect(normalizedExactMatch(actual, expected)).toBe(matches);
  });
});

describe('answer metrics', () => {
  it.each([
    {
      name: 'exact match',
      input: { predictedAnswer: '  北京。', standardAnswer: '北京' },
      expected: { normalizedExactMatch: 1, aliasMatch: 0, answerMatch: 1 },
    },
    {
      name: 'alias match',
      input: { predictedAnswer: 'B', standardAnswer: '乙', answerAliases: ['B', '选项 B'] },
      expected: { normalizedExactMatch: 0, aliasMatch: 1, answerMatch: 1 },
    },
    {
      name: 'mismatch',
      input: { predictedAnswer: '上海', standardAnswer: '北京', answerAliases: ['京'] },
      expected: { normalizedExactMatch: 0, aliasMatch: 0, answerMatch: 0 },
    },
  ])('$name', ({ input, expected }) => {
    expect(evaluateAnswer(input)).toMatchObject(expected);
  });

  it.each([
    ['absolute tolerance', '10.04', '10', { absolute: 0.05 }, 1],
    ['relative tolerance', '101', '100', { relative: 0.02 }, 1],
    ['outside tolerance', '10.2', '10', { absolute: 0.1 }, 0],
    ['non-numeric answer', 'about 10', '10', { absolute: 1 }, 0],
  ])('%s', (_name, predictedAnswer, standardAnswer, numericTolerance, numericMatch) => {
    expect(evaluateAnswer({ predictedAnswer, standardAnswer, numericTolerance }).numericMatch).toBe(
      numericMatch,
    );
  });

  it.each([
    ['correct rejection', true, true, 1],
    ['correct answer attempt', false, false, 1],
    ['incorrect rejection', false, true, 0],
  ])('%s', (_name, shouldReject, didReject, rejectionAccuracy) => {
    expect(evaluateAnswer({ standardAnswer: '', shouldReject, didReject }).rejectionAccuracy).toBe(
      rejectionAccuracy,
    );
  });

  it('scores normalized required evidence coverage and ignores duplicate evidence', () => {
    expect(
      evaluateAnswer({
        standardAnswer: '42',
        evidence: [' 牛顿第二定律。', '牛顿第二定律', '质量为 2kg'],
        requiredEvidence: ['牛顿第二定律', '加速度为 3m/s²'],
      }).requiredEvidenceCoverage,
    ).toBe(0.5);
  });

  it('defines empty required evidence as fully covered', () => {
    expect(
      evaluateAnswer({ standardAnswer: '42', requiredEvidence: [] }).requiredEvidenceCoverage,
    ).toBe(1);
  });

  it('marks subjective answers for human review without judging them', () => {
    expect(
      evaluateAnswer({ predictedAnswer: '开放作答', standardAnswer: '参考答案', subjective: true }),
    ).toMatchObject({ needsHumanReview: true, answerMatch: 0 });
  });
});

describe('recognition metrics', () => {
  it('scores exact fields, normalized stem similarity, set recall, and ordered options', () => {
    expect(
      evaluateRecognition(
        {
          stage: '高中',
          subject: '数学',
          questionType: '选择题',
          stem: '若 x ＋ 1 = 3，求 x。',
          formulas: ['x+1=3', 'x=2'],
          givenConditions: ['x+1=3', 'x 为实数'],
          options: ['A. 1', 'B. 2'],
        },
        {
          stage: '高中',
          subject: '物理',
          questionType: '选择题',
          stem: '若 x+1=3 求 x',
          formulas: ['x = 2'],
          givenConditions: ['x 为实数'],
          options: ['A、1', 'B、2'],
        },
      ),
    ).toEqual({
      stageAccuracy: 1,
      subjectAccuracy: 0,
      questionTypeAccuracy: 1,
      stemSimilarity: 1,
      formulaRecall: 0.5,
      givenConditionRecall: 0.5,
      optionAccuracy: 1,
    });
  });

  it('returns partial stem similarity for overlap and zero for mismatch', () => {
    const partial = evaluateRecognition({ stem: '求函数最大值' }, { stem: '求函数最小值' });
    const mismatch = evaluateRecognition({ stem: '计算面积' }, { stem: '解释历史原因' });
    expect(partial.stemSimilarity).toBeGreaterThan(0);
    expect(partial.stemSimilarity).toBeLessThan(1);
    expect(mismatch.stemSimilarity).toBe(0);
  });

  it('defines empty gold collections as perfect only when prediction is also empty', () => {
    expect(
      evaluateRecognition(
        { formulas: [], givenConditions: [], options: [] },
        { formulas: [], givenConditions: [], options: [] },
      ),
    ).toMatchObject({ formulaRecall: 1, givenConditionRecall: 1, optionAccuracy: 1 });
    expect(
      evaluateRecognition(
        { formulas: [], givenConditions: [], options: [] },
        { formulas: ['x=1'], givenConditions: ['x>0'], options: ['A'] },
      ),
    ).toMatchObject({ formulaRecall: 0, givenConditionRecall: 0, optionAccuracy: 0 });
  });

  it.each([
    ['penalizes extra predicted options', ['A'], ['A', 'B'], 0.5],
    ['penalizes missing predicted options', ['A', 'B'], ['A'], 0.5],
    ['penalizes reordered predicted options', ['A', 'B'], ['B', 'A'], 0],
  ])('%s', (_name, goldOptions, predictedOptions, expectedAccuracy) => {
    expect(
      evaluateRecognition({ options: goldOptions }, { options: predictedOptions }).optionAccuracy,
    ).toBe(expectedAccuracy);
  });
});

describe('retrieval metrics', () => {
  it.each([
    {
      name: 'normal ranking',
      gold: ['a', 'c'],
      retrieved: ['x', 'a', 'c'],
      k: 2,
      expected: { hitAtK: 1, precisionAtK: 0.5, recallAtK: 0.5, mrr: 0.5 },
    },
    {
      name: 'miss',
      gold: ['a'],
      retrieved: ['x', 'y'],
      k: 2,
      expected: { hitAtK: 0, precisionAtK: 0, recallAtK: 0, mrr: 0 },
    },
    {
      name: 'deduplicates retrieved ids before ranking',
      gold: ['a', 'b'],
      retrieved: ['a', 'a', 'b'],
      k: 2,
      expected: { hitAtK: 1, precisionAtK: 1, recallAtK: 1, mrr: 1 },
    },
    {
      name: 'caps k at available unique results',
      gold: ['a', 'b'],
      retrieved: ['a'],
      k: 10,
      expected: { hitAtK: 1, precisionAtK: 1, recallAtK: 0.5, mrr: 1 },
    },
  ])('$name', ({ gold, retrieved, k, expected }) => {
    expect(evaluateRetrieval(gold, retrieved, k)).toEqual(expected);
  });

  it('defines empty gold as perfect for empty retrieval and zero for non-empty retrieval', () => {
    expect(evaluateRetrieval([], [], 5)).toEqual({
      hitAtK: 1,
      precisionAtK: 1,
      recallAtK: 1,
      mrr: 1,
    });
    expect(evaluateRetrieval([], ['a'], 5)).toEqual({
      hitAtK: 0,
      precisionAtK: 0,
      recallAtK: 0,
      mrr: 0,
    });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid k=%s', (k) => {
    expect(() => evaluateRetrieval(['a'], ['a'], k)).toThrow('k must be a positive integer');
  });
});
