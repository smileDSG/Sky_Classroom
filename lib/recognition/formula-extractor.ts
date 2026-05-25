/**
 * Formula extractor — extracts LaTeX formulas from recognized text.
 * Converts common math notations to LaTeX format.
 * Handles both $-delimited formulas and bare LaTeX commands.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('FormulaExtractor');

/** Patterns that indicate bare LaTeX content (not inside $ delimiters) */
const BARE_LATEX_PATTERNS = [
  /\\frac\{[^}]*\}\{[^}]*\}/g,            // \frac{a}{b}
  /\\sqrt(?:\[.*?\])?\{[^}]*\}/g,         // \sqrt{x}, \sqrt[n]{x}
  /\\int(?:_[^{}]*\{[^}]*\})?(?:\^[^{}]*\{[^}]*\})?/g,  // \int with sub/superscripts
  /\\sum(?:_[^{}]*\{[^}]*\})?(?:\^[^{}]*\{[^}]*\})?/g,  // \sum
  /\\prod(?:_[^{}]*\{[^}]*\})?(?:\^[^{}]*\{[^}]*\})?/g, // \prod
  /\\lim(?:_\{[^}]*\})?/g,                 // \lim
  /\\infty/g,                              // \infty
  /\\left[()[\]|]/g,                       // \left( \right)
  /\\right[()[\]|]/g,
  /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, // \begin{...}...\end{...}
  /[=<>≠≈≤≥±∞π]\s*(?:[\d]+\s*[+\-×÷=<>]|[a-z]\s*[+\-×÷=<>])/gi, // mixed Unicode math expressions
  // Bare subscripts and superscripts — wrap in $...$ so KaTeX can render them
  /[a-zA-Z]_\{[^}]+\}(?:\^\{[^}]+\})?/g,   // u_{n+1}, x_{i}^{2}  (braced)
  /[a-zA-Z]\^\{[^}]+\}/g,                   // x^{2k}  (braced)
  /[a-zA-Z]_[a-zA-Z0-9]+\^[a-zA-Z0-9]+/g,  // u_n^2  (simple sub + sup)
  /[a-zA-Z]_[a-zA-Z0-9]+/g,                 // u_n, x_1  (simple subscript)
  /[a-zA-Z]\^[a-zA-Z0-9]+/g,                // x^2  (simple superscript)
];

/**
 * Extract and convert LaTeX formulas from recognized OCR text.
 * Returns the text (with formulas preserved inline) and a separate latex string
 * with extracted formulas for rendering.
 */
export function extractFormulas(text: string): { text: string; latex: string } {
  const formulas: string[] = [];
  let cleaned = text;

  // Extract inline math patterns: $...$ or \(...\)
  // Preserve formula in text, also add to latex array
  cleaned = cleaned.replace(/\$([^\$]+)\$/g, (_match, formula) => {
    formulas.push(formula);
    return `$${formula}$`; // keep in text
  });

  cleaned = cleaned.replace(/\\\(([^\\]+)\\\)/g, (_match, formula) => {
    formulas.push(formula);
    return `\\(${formula}\\)`; // keep in text
  });

  // Extract display math patterns: $$...$$ or \[...\]
  cleaned = cleaned.replace(/\$\$([^$]+)\$\$/g, (_match, formula) => {
    formulas.push(`\\[${formula}\\]`);
    return `$$${formula}$$`; // keep in text
  });

  // Detect and wrap bare LaTeX commands not inside $ delimiters
  cleaned = wrapBareLaTeX(cleaned, formulas);

  // Convert common Unicode math symbols to LaTeX
  cleaned = convertUnicodeMath(cleaned);

  const latex = formulas.length > 0 ? formulas.join('\n') : '';

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  log.debug(`Extracted ${formulas.length} formulas from text`);
  return { text: cleaned, latex };
}

/**
 * Find bare LaTeX commands in text (not inside $ delimiters)
 * and wrap them with $...$, adding to the formulas array.
 */
function wrapBareLaTeX(text: string, formulas: string[]): string {
  let result = text;

  for (const pattern of BARE_LATEX_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    const matches: Array<{ index: number; match: string }> = [];

    while ((match = pattern.exec(result)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check if already inside $ delimiters
      const before = result.substring(0, start);
      const dollarCount = (before.match(/\$/g) || []).length;
      if (dollarCount % 2 === 1) continue; // inside $...$, skip

      matches.push({ index: start, match: match[0] });
    }

    // Wrap from end to start to preserve indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const { index, match: m } = matches[i];
      formulas.push(m);
      result = result.substring(0, index) + `$${m}$` + result.substring(index + m.length);
    }
  }

  return result;
}

function convertUnicodeMath(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/×/g, '\\times'],
    [/÷/g, '\\div'],
    [/±/g, '\\pm'],
    [/≤/g, '\\leq'],
    [/≥/g, '\\geq'],
    [/≠/g, '\\neq'],
    [/≈/g, '\\approx'],
    [/∞/g, '\\infty'],
    [/π/g, '\\pi'],
    [/√/g, '\\sqrt'],
    [/∫/g, '\\int'],
    [/∑/g, '\\sum'],
    [/∏/g, '\\prod'],
    [/α/g, '\\alpha'],
    [/β/g, '\\beta'],
    [/γ/g, '\\gamma'],
    [/θ/g, '\\theta'],
    [/λ/g, '\\lambda'],
    [/μ/g, '\\mu'],
    [/σ/g, '\\sigma'],
    [/Δ/g, '\\Delta'],
    [/°/g, '^\\circ'],
    [/²/g, '^2'],
    [/³/g, '^3'],
    [/¹/g, '^1'],
  ];

  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}
