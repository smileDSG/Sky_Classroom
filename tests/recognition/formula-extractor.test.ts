import { describe, test, expect } from 'vitest';
import { extractFormulas } from '@/lib/recognition/formula-extractor';

describe('extractFormulas — LaTeX公式提取', () => {
  test('提取行内公式 $...$', () => {
    const r = extractFormulas('解方程 $x^2 + 2x + 1 = 0$ 求值');
    expect(r.latex).toContain('x^2 + 2x + 1 = 0');
    expect(r.text).toContain('$x^2 + 2x + 1 = 0$'); // formulas kept in text
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
    expect(r.text).toBe('解方程 $x = 1$');
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

  test('自动包裹裸 LaTeX \\frac{}{}', () => {
    const r = extractFormulas('分数是 \\frac{1}{2} 加上 \\frac{3}{4}');
    expect(r.latex).toContain('\\frac{1}{2}');
    expect(r.latex).toContain('\\frac{3}{4}');
    expect(r.text).toContain('$\\frac{1}{2}$');
  });

  test('自动包裹裸 LaTeX \\sqrt{}', () => {
    const r = extractFormulas('根号表达式 \\sqrt{x^2 + y^2} 的值');
    expect(r.latex).toContain('\\sqrt{x^2 + y^2}');
    expect(r.text).toContain('$\\sqrt{x^2 + y^2}$');
  });

  test('自动包裹裸 LaTeX \\int', () => {
    const r = extractFormulas('积分 \\int_0^1 x dx 计算');
    expect(r.latex).toContain('\\int');
    expect(r.text).toContain('$\\int');
  });

  test('已在 $ 内的公式不重复包裹', () => {
    const r = extractFormulas('求解 $\\frac{a}{b}$ 的值');
    // Formula preserved in text with $ delimiters
    expect(r.text).toContain('$\\frac{a}{b}$');
    expect(r.latex).toContain('a}{b');
  });

  test('自动包裹裸下标 u_n', () => {
    const r = extractFormulas('如果级数 u_n 收敛');
    expect(r.text).toContain('$u_n$');
    expect(r.latex).toContain('u_n');
  });

  test('自动包裹裸下标与上标组合 u_n^2', () => {
    const r = extractFormulas('极限 u_n^2 计算');
    expect(r.text).toContain('$u_n^2$');
    expect(r.latex).toContain('u_n^2');
  });

  test('自动包裹花括号下标 u_{n+1}', () => {
    const r = extractFormulas('序列 u_{n+1} 的极限');
    expect(r.text).toContain('$u_{n+1}$');
    expect(r.latex).toContain('u_{n+1}');
  });

  test('自动包裹花括号上标 x^{2k}', () => {
    const r = extractFormulas('表达式 x^{2k} 的值');
    expect(r.text).toContain('$x^{2k}$');
    expect(r.latex).toContain('x^{2k}');
  });

  test('已在 $ 内的下标不重复包裹', () => {
    const r = extractFormulas('级数 $u_n$ 收敛');
    // Should have exactly one pair of $ around u_n
    expect(r.text).toContain('$u_n$');
    // Check it doesn't double-wrap: $$u_n$$ or $ $u_n$ $
    expect(r.text).not.toContain('$$u_n$$');
  });

  test('多下标同时包裹', () => {
    const r = extractFormulas('u_n + v_n 发散，a_1 收敛');
    expect(r.text).toContain('$u_n$');
    expect(r.text).toContain('$v_n$');
    expect(r.text).toContain('$a_1$');
  });

  test('自动包裹裸 LaTeX \\begin{...} 环境', () => {
    const r = extractFormulas('矩阵 \\begin{matrix} a & b \\\\ c & d \\end{matrix}');
    expect(r.latex).toContain('\\begin{matrix}');
    expect(r.text).toContain('$\\begin{matrix}');
  });
});
