/**
 * tests/mistakes/cause-analyzer.test.ts
 * Sky Classroom — 错因分析器测试
 *
 * 测试模块：
 *   - extractNumbers          数字提取
 *   - analyzeMistakeCause     规则化错因分析
 *
 * 纯函数测试，无 DOM / IndexedDB 依赖。
 */

import { describe, it, expect } from 'vitest';
import { analyzeMistakeCause, extractNumbers } from '@/lib/mistakes/cause-analyzer';

// ── 测试工厂 ──────────────────────────────────────────────────────────

/**
 * 快捷构造 analyzeMistakeCause 所需的三个参数。
 */
function makeProblem(problem: string, correctAnswer: string, userAnswer: string) {
  return { problem, correctAnswer, userAnswer };
}

// ── extractNumbers ────────────────────────────────────────────────────

describe('extractNumbers', () => {
  it('正确提取整数', () => {
    expect(extractNumbers('42')).toEqual([42]);
  });

  it('正确提取小数', () => {
    expect(extractNumbers('3.14')).toEqual([3.14]);
  });

  it('正确提取负数', () => {
    expect(extractNumbers('-2.5')).toEqual([-2.5]);
  });

  it('正确提取混合文本中的多个数字', () => {
    expect(extractNumbers('x=5 且 y=-3.2')).toEqual([5, -3.2]);
  });

  it('文本中无数字时返回空数组', () => {
    expect(extractNumbers('没有数字的文本')).toEqual([]);
  });

  it('空字符串返回空数组', () => {
    expect(extractNumbers('')).toEqual([]);
  });
});

// ── analyzeMistakeCause ──────────────────────────────────────────────

describe('analyzeMistakeCause', () => {
  // ── 1. 空答案 → concept-unclear ──────────────────────────────────
  it('用户答案为空白字符串时返回 concept-unclear', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '1 + 1 = ?',
      '2',
      '',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'concept-unclear',
    );
  });

  it('用户答案为纯空格时也返回 concept-unclear', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '1 + 1 = ?',
      '2',
      '   ',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'concept-unclear',
    );
  });

  // ── 2. 计算错误（数量级差 ~10x）─────────────────────────────────
  it('数字差约 10 倍时返回 calculation-error', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '1 + 1 = ?',
      '42',
      '4.2',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'calculation-error',
    );
  });

  it('数字差约 0.1 倍时也是 calculation-error', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '计算距离',
      '5',
      '50',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'calculation-error',
    );
  });

  // ── 3. 方法错误（正负号反了 / 数字顺序颠倒）───────────────────
  it('正负号反了返回 method-wrong', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '计算温差',
      '5',
      '-5',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'method-wrong',
    );
  });

  it('数字顺序颠倒返回 method-wrong', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '写出坐标',
      '3, 5',
      '5, 3',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'method-wrong',
    );
  });

  // ── 4. 审题错误（题干含关键词）─────────────────────────────────
  it('题干含"错误的是"时返回 misreading', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '下列选项中，错误的是：2 + 2 = ?',
      '4',
      '0',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'misreading',
    );
  });

  it('题干含"正确的是"时返回 misreading', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '下列选项中，正确的是：面积 = ?',
      'πr²',
      '2πr',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'misreading',
    );
  });

  it('题干含"下列选项中"时返回 misreading', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '下列选项中，不属于三角形的是？',
      '正方形',
      '四边形',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'misreading',
    );
  });

  // ── 5. 格式错误（核心内容对但格式不一致）───────────────────────
  it('数字相同但单位/空格不一致返回 format-error', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '计算长度',
      '10 cm',
      '10cm',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'format-error',
    );
  });

  it('去空白后核心内容一致返回 format-error', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '翻译单词',
      'Hello World',
      'HELLOWORLD',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'format-error',
    );
  });

  // ── 6. 默认返回 concept-unclear ──────────────────────────────────
  it('完全不同的非数字答案返回 concept-unclear', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '中国的首都是哪里？',
      '北京',
      '上海',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'concept-unclear',
    );
  });

  it('无数字、无关键词、也无格式匹配时返回 concept-unclear', () => {
    const { problem, correctAnswer, userAnswer } = makeProblem(
      '解释光合作用',
      '光能转化为化学能',
      '植物呼吸作用',
    );
    expect(analyzeMistakeCause(problem, correctAnswer, userAnswer)).toBe(
      'concept-unclear',
    );
  });
});
