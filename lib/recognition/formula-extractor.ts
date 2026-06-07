/**
 * Formula extractor — extracts LaTeX formulas from recognized text.
 * Converts common math notations to LaTeX format.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('FormulaExtractor');

/**
 * Extract and convert LaTeX formulas from recognized OCR text.
 * Returns the cleaned text and extracted LaTeX formulas.
 */
export function extractFormulas(text: string): { text: string; latex: string } {
  const formulas: string[] = [];
  let cleaned = text;

  // Extract inline math patterns: $...$ or \(...\)
  cleaned = cleaned.replace(/\$([^\$]+)\$/g, (_match, formula) => {
    formulas.push(formula);
    return '';
  });

  cleaned = cleaned.replace(/\\\(([^\\]+)\\\)/g, (_match, formula) => {
    formulas.push(formula);
    return '';
  });

  // Extract display math patterns: $$...$$ or \[...\]
  cleaned = cleaned.replace(/\$\$([^$]+)\$\$/g, (_match, formula) => {
    formulas.push(`\\[${formula}\\]`);
    return '';
  });

  // Convert common Unicode math symbols to LaTeX
  cleaned = convertUnicodeMath(cleaned);

  const latex = formulas.length > 0 ? formulas.join('\n') : '';

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  log.debug(`Extracted ${formulas.length} formulas from text`);
  return { text: cleaned, latex };
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
