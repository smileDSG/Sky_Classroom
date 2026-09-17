import { describe, test, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MathRenderer } from '@/components/sky/solve/math-renderer';

function renderMath(content: string): string {
  return renderToStaticMarkup(createElement(MathRenderer, { content }));
}

/**
 * LLM 常把命令名误加空格拆开（\big triangleup），且长命令会被前缀匹配错误
 * 拆成短命令（\big）+ 文字后缀。验证最终渲染成数学（katex），而非 katex-error
 * 或把后缀当普通文本泄漏。注意：KaTeX 的 <annotation> 会内嵌原始 LaTeX 源，
 * 因此不应用 "不含 triangleup" 来判断——应以是否渲染错误为准。
 */
describe('MathRenderer 大三角命令归一化', () => {
  test('把 \\big triangleup 渲染成三角形 △（无渲染错误）', () => {
    const html = renderMath('\\big triangleup CDE∽\\big triangleup CAD');
    expect(html).not.toContain('katex-error');
    expect(html).toContain('katex');
    expect(html).toContain('>△<');
  });

  test('把 \\big triangledown 渲染成 ▽', () => {
    const html = renderMath('\\big triangledown ABC');
    expect(html).not.toContain('katex-error');
    expect(html).toContain('katex');
    expect(html).toContain('>▽<');
  });

  test('不含空格的正常命令 \\bigtriangleup 同样正确渲染', () => {
    const html = renderMath('\\bigtriangleup ABC');
    expect(html).not.toContain('katex-error');
    expect(html).toContain('katex');
    expect(html).toContain('>△<');
  });
});

/**
 * 回归：快速路径 isWellFormedMath 曾把「无 $ 分隔符但含裸上/下标或 Unicode
 * 数学符号」的内容误判为已规范，跳过 wrapBareLatex，导致填空题答案
 * x^2、x² 等按纯文本原样显示（"公式没有渲染"）。
 */
describe('MathRenderer 裸公式包裹', () => {
  test('x^2 渲染为上标数学而非纯文本', () => {
    const html = renderMath('x^2');
    expect(html).toContain('katex');
    expect(html).not.toContain('katex-error');
    expect(html).toContain('<msup><mi>x</mi><mn>2</mn></msup>');
  });

  test('a_1 渲染为下标数学而非纯文本', () => {
    const html = renderMath('a_1');
    expect(html).toContain('katex');
    expect(html).not.toContain('katex-error');
    expect(html).toContain('<msub><mi>a</mi><mn>1</mn></msub>');
  });

  test('Unicode 上标 x² 渲染为数学', () => {
    const html = renderMath('x²');
    expect(html).toContain('katex');
    expect(html).not.toContain('katex-error');
    expect(html).toContain('<msup>');
  });

  test('1+√2 渲染为数学而非纯文本', () => {
    const html = renderMath('1+√2');
    expect(html).toContain('katex');
    expect(html).not.toContain('katex-error');
    expect(html).toContain('<msqrt>');
  });

  test('含 $ 的规范公式仍走快速路径正常渲染', () => {
    const html = renderMath('函数 $f(x)=\\frac{1}{3}x^3-x^2-3x+4$ 的单调递减区间为');
    expect(html).toContain('katex');
    expect(html).not.toContain('katex-error');
    expect(html).toContain('>函数 </span>');
  });
});
