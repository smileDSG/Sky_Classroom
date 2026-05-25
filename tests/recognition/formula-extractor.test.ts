import { describe, test, expect } from 'vitest';
import { extractFormulas } from '@/lib/recognition/formula-extractor';

describe('extractFormulas — LaTeX公式提取', () => {
  test('提取行内公式 $...$', () => {
    const r = extractFormulas('解方程 $x^2 + 2x + 1 = 0$ 求值');
    expect(r.latex).toContain('x^2 + 2x + 1 = 0');
    expect(r.text).not.toContain('$');
  });

  test('提取块级公式 $$...$$', () => {
    const r = extractFormulas('$$\\int_0^1 x dx = \\frac{1}{2}$$');
    expect(r.latex).toContain('\\int_0^1 x dx = \\frac{1}{2}');
  });

  test('提取 \\(...\\) 行内公式', () => {
    const r = extractFormulas('\\(a^2 + b^2 = c^2\\)');
    expect(r.latex).toContain('a^2 + b^2 = c^2');
  });

  test('Unicode数学符号转为LaTeX', () => {
    const r = extractFormulas('2 × 3，π ≈ 3.14，√4 = 2，≤ 5，≠ 6');
    expect(r.text).toContain('\\times');
    expect(r.text).toContain('\\pi');
    expect(r.text).toContain('\\sqrt');
  });

  test('角度和上下标符号转换', () => {
    const r = extractFormulas('90°，体积 1m³，2²');
    expect(r.text).toContain('^\\circ');
    expect(r.text).toContain('^3');
    expect(r.text).toContain('^2');
  });

  test('希腊字母转换', () => {
    const r = extractFormulas('α + β = γ，θ = 30°，λ = 500');
    expect(r.text).toContain('\\alpha');
    expect(r.text).toContain('\\beta');
    expect(r.text).toContain('\\theta');
  });

  test('无公式时 latex 为空', () => {
    const r = extractFormulas('什么是光合作用？');
    expect(r.latex).toBe('');
    expect(r.text).toBe('什么是光合作用？');
  });

  test('清理多余空白', () => {
    const r = extractFormulas('  解方程   $x = 1$   ');
    expect(r.text).toBe('解方程');
  });

  test('空字符串不报错', () => {
    const r = extractFormulas('');
    expect(r.text).toBe('');
    expect(r.latex).toBe('');
  });

  test('多公式提取', () => {
    const r = extractFormulas('$a=1$ + $b=2$ = $c=3$');
    expect(r.latex.split('\n')).toHaveLength(3);
  });
});
