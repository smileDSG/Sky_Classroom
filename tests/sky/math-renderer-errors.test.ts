import { describe, test, expect } from 'vitest';
import { fixCommonLatexErrors } from '@/components/sky/solve/math-renderer';

/**
 * LLM 常把命令名误加空格拆开（\big triangleup）。验证归一化逻辑把它合并，
 * 避免 "triangleup" 被当成普通文本泄漏。
 */
describe('fixCommonLatexErrors 命令名空格归一化', () => {
  test('\\big triangleup → \\bigtriangleup', () => {
    expect(fixCommonLatexErrors('\\big triangleup CDE∽\\big triangleup CAD')).toBe(
      '\\bigtriangleup CDE∽\\bigtriangleup CAD',
    );
  });

  test('\\big triangledown → \\bigtriangledown', () => {
    expect(fixCommonLatexErrors('\\big triangledown ABC')).toBe('\\bigtriangledown ABC');
  });

  test('不含空格的命令保持不变', () => {
    expect(fixCommonLatexErrors('\\bigtriangleup ABC')).toBe('\\bigtriangleup ABC');
  });
});
