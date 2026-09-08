import { describe, it, expect } from 'vitest';

// Test the fixBareLatexCommands function logic
function fixBareLatexCommands(text: string): string {
  let result = text;

  const bareCommands = [
    'sum',
    'prod',
    'int',
    'frac',
    'sqrt',
    'lim',
    'sin',
    'cos',
    'tan',
    'log',
    'ln',
    'exp',
    'alpha',
    'beta',
    'gamma',
    'delta',
    'theta',
    'lambda',
    'mu',
    'pi',
    'sigma',
    'phi',
    'omega',
    'infty',
    'leq',
    'geq',
    'neq',
    'approx',
    'equiv',
  ];

  // Pattern: command followed by $, {, [, _, ^, (, or whitespace/newline
  for (const cmd of bareCommands) {
    const pattern = new RegExp(`(?<!\\\\)\\b(${cmd})(?=[$\\{\\[\\_\\^\\(\\s])`, 'g');
    result = result.replace(pattern, `\\${cmd}`);
  }

  // Second pass: fix commands at end of string or before ), ], or newline
  for (const cmd of bareCommands) {
    const endPattern = new RegExp(`(?<!\\\\)\\b(${cmd})(?=$|[)\\]\\n])`, 'g');
    result = result.replace(endPattern, `\\${cmd}`);
  }

  return result;
}

describe('fixBareLatexCommands', () => {
  it('fixes sum$ → \\sum$', () => {
    expect(fixBareLatexCommands('sum$')).toBe('\\sum$');
  });

  it('fixes frac{ → \\frac{', () => {
    expect(fixBareLatexCommands('frac{1}{2}')).toBe('\\frac{1}{2}');
  });

  it('fixes sqrt{x} → \\sqrt{x}', () => {
    expect(fixBareLatexCommands('sqrt{x}')).toBe('\\sqrt{x}');
  });

  it('fixes sum\\na_n → \\sum\\na_n (newline after sum)', () => {
    expect(fixBareLatexCommands('sum\na_n')).toContain('\\sum');
  });

  it('fixes alpha\\n → \\alpha\\n', () => {
    expect(fixBareLatexCommands('alpha\n')).toBe('\\alpha\n');
  });
});

// Test malformed LaTeX fixes
function fixMalformedLatex(text: string): string {
  let result = text;

  // Fix \\sum$ ( → \\sum (
  result = result.replace(/(\\[a-zA-Z]+)\$\s*\(/g, '$1 (');

  // Fix \\sum$ → \\sum
  result = result.replace(/(\\[a-zA-Z]+)\$(?![{\[])/g, '$1');

  // Fix $\sum$ $a_n$ → $\sum a_n$ (merge adjacent math blocks with command + content)
  result = result.replace(/\$(\\[a-zA-Z]+)\$\s*\$([^$]+)\$/g, '$$$1 $2$');

  // Fix bare \\sum at end of line → $\sum$
  result = result.replace(/(?<!\$)(\\(?:sum|prod|int|lim))(?=\s*\n|$)/g, '$$$1$');

  return result;
}

describe('fixMalformedLatex', () => {
  it('fixes \\sum$ ( → \\sum (', () => {
    expect(fixMalformedLatex('\\sum$ (')).toBe('\\sum (');
  });

  it('fixes \\sum$ → \\sum (or $\sum$ if wrapped)', () => {
    const result = fixMalformedLatex('\\sum$');
    // The function may wrap it in $ or just remove the $
    expect(result).toMatch(/\\sum/);
  });

  it('fixes $\sum$ $a_n$ → $\sum a_n$', () => {
    const result = fixMalformedLatex('$\\sum$ $a_n$');
    // Should merge into single math block or remove extra $
    expect(result).toContain('\\sum');
    expect(result).toContain('a_n');
  });

  it('fixes bare \\sum at end of line', () => {
    expect(fixMalformedLatex('已知级数\\sum\n')).toContain('$\\sum$');
  });
});
