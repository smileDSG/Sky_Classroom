import { describe, test, expect } from 'vitest';
import { classifyErrorCause, getCauseLabel, isValidCause } from '@/lib/solve/error-classifier';

describe('classifyErrorCause — 错误分类', () => {
  test('英文直接匹配: calculation-error', () => {
    expect(classifyErrorCause('calculation-error')).toBe('calculation-error');
  });

  test('英文直接匹配: misreading', () => {
    expect(classifyErrorCause('misreading')).toBe('misreading');
  });

  test('中文全称: 概念不清 → concept-unclear', () => {
    expect(classifyErrorCause('概念不清')).toBe('concept-unclear');
  });

  test('中文全称: 计算失误 → calculation-error', () => {
    expect(classifyErrorCause('计算失误')).toBe('calculation-error');
  });

  test('中文全称: 审题错误 → misreading', () => {
    expect(classifyErrorCause('审题错误')).toBe('misreading');
  });

  test('中文全称: 方法错误 → method-wrong', () => {
    expect(classifyErrorCause('方法错误')).toBe('method-wrong');
  });

  test('中文全称: 粗心 → careless', () => {
    expect(classifyErrorCause('粗心')).toBe('careless');
  });

  test('中文全称: 格式错误 → format-error', () => {
    expect(classifyErrorCause('格式错误')).toBe('format-error');
  });

  test('关键词匹配: 含"概念" → concept-unclear', () => {
    expect(classifyErrorCause('学生对基本概念不理解')).toBe('concept-unclear');
  });

  test('关键词匹配: 含"计算" → calculation-error', () => {
    expect(classifyErrorCause('计算过程中出了错误')).toBe('calculation-error');
  });

  test('大小写不敏感', () => {
    expect(classifyErrorCause('CARELESS')).toBe('careless');
  });

  test('去首尾空白', () => {
    expect(classifyErrorCause('  misreading  ')).toBe('misreading');
  });

  test('无法识别默认为 concept-unclear', () => {
    expect(classifyErrorCause('xyz-unknown')).toBe('concept-unclear');
  });

  test('空字符串默认 concept-unclear', () => {
    expect(classifyErrorCause('')).toBe('concept-unclear');
  });
});

describe('getCauseLabel — 中文标签', () => {
  test('concept-unclear → 概念不清', () => {
    expect(getCauseLabel('concept-unclear')).toBe('概念不清');
  });

  test('calculation-error → 计算失误', () => {
    expect(getCauseLabel('calculation-error')).toBe('计算失误');
  });

  test('无法识别返回原值', () => {
    expect(getCauseLabel('unknown' as any)).toBe('unknown');
  });
});

describe('isValidCause — 合法性检查', () => {
  test('合法值返回 true', () => {
    expect(isValidCause('concept-unclear')).toBe(true);
    expect(isValidCause('calculation-error')).toBe(true);
  });

  test('非法值返回 false', () => {
    expect(isValidCause('invalid')).toBe(false);
    expect(isValidCause('')).toBe(false);
  });
});
