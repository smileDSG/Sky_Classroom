/**
 * LaTeX normalization tests — LLM-style math (Unicode sup/sub, linear
 * fractions) must be rewritten into standard TeX that MathJax can parse.
 */
import { describe, it, expect } from 'vitest';
import { normalizeLatex } from '@/lib/slides/latex-to-image';

describe('normalizeLatex', () => {
  it('converts Unicode superscripts to ^{...}', () => {
    expect(normalizeLatex('y=ax²+bx+c')).toBe('y=ax^{2}+bx+c');
    expect(normalizeLatex('10⁻⁹')).toBe('10^{-9}');
    expect(normalizeLatex('v³')).toBe('v^{3}');
  });

  it('converts Unicode subscripts to _{...}', () => {
    expect(normalizeLatex('CO₂ + H₂O')).toBe('CO_{2} + H_{2}O');
  });

  it('maps Unicode math symbols to TeX commands', () => {
    expect(normalizeLatex('Δ=b²-4ac')).toBe('\\Delta=b^{2}-4ac');
    expect(normalizeLatex('a×b≈c≠d≤e≥f')).toBe('a\\times b\\approx c\\neq d\\leq e\\geq f');
  });

  it('converts linear fractions to \\frac (the LLM-style vertex form)', () => {
    expect(normalizeLatex('y=ax²+bx+c=a\\left(x+(b)/(2a)\\right)²+(4ac-b²)/(4a)')).toBe(
      'y=ax^{2}+bx+c=a\\left(x+\\frac{b}{2a}\\right)^{2}+\\frac{4ac-b^{2}}{4a}',
    );
  });

  it('keeps function-call parentheses untouched', () => {
    expect(normalizeLatex('f(x)/(x-1)')).toBe('f(x)/(x-1)');
    expect(normalizeLatex('y=(x+1)/(x-1)')).toBe('y=\\frac{x+1}{x-1}');
  });

  it('leaves already-standard TeX unchanged', () => {
    expect(normalizeLatex('\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}')).toBe(
      '\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}',
    );
  });
});
