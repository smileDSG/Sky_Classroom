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
