/**
 * Math content post-processor for the solve pipeline.
 *
 * Ensures all mathematical expressions in step.content, keyPoints,
 * answer, and knowledge points are properly wrapped in `$...$` delimiters
 * so MathRenderer can render them correctly.
 *
 * Applied AFTER LLM response parsing, BEFORE content reaches the UI.
 * Only processes text outside existing `$...$` / `$$...$$` blocks.
 */

import type { FourPartOutput } from './types';

// ── Unicode superscript normalization ──────────────────────────────

const UNICODE_SUPERSCRIPTS: Array<[string, string]> = [
  ['²', '^2'], ['³', '^3'], ['⁰', '^0'], ['¹', '^1'],
  ['⁴', '^4'], ['⁵', '^5'], ['⁶', '^6'], ['⁷', '^7'], ['⁸', '^8'], ['⁹', '^9'],
];

const UNICODE_PRIME = '′';

function normalizeUnicodeSuperscripts(text: string): string {
  let result = text;
  for (const [uni, replacement] of UNICODE_SUPERSCRIPTS) {
    result = result.replaceAll(uni, replacement);
  }
  // Convert Unicode prime to ASCII apostrophe for consistent handling
  result = result.replaceAll(UNICODE_PRIME, "'");
  return result;
}

// ── Protect existing $...$ blocks ──────────────────────────────────

function splitByMathBlocks(text: string): { parts: string[]; isMath: boolean[] } {
  const parts: string[] = [];
  const isMath: boolean[] = [];

  // Split on $$...$$ first, then $...$
  const segments = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g);

  for (const seg of segments) {
    if (seg.startsWith('$$') && seg.endsWith('$$')) {
      parts.push(seg);
      isMath.push(true);
    } else if (seg.startsWith('$') && seg.endsWith('$') && seg.length > 2) {
      parts.push(seg);
      isMath.push(true);
    } else if (seg) {
      parts.push(seg);
      isMath.push(false);
    }
  }

  return { parts, isMath };
}

// ── Core text processing (applied to non-math segments only) ────────

function processTextSegment(text: string): string {
  let result = text;

  // Step 1: Normalize Unicode superscripts
  result = normalizeUnicodeSuperscripts(result);

  // Step 2: Wrap chained math expressions
  // Matches patterns like: 1/4·1/2kA^2=1/4E  or  A/2=B/4  or  3/4×2/3=1/2
  result = wrapChainedExpressions(result);

  // Step 3: Wrap single fractions: 1/4, A/2, kA/2
  result = result.replace(
    /(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?|[a-zA-Z][a-zA-Z0-9]*)/g,
    (_m, num: string, den: string) => `$\\frac{${num}}{${den}}$`,
  );
  result = result.replace(
    /([a-zA-Z][a-zA-Z0-9]*)\/(\d+(?:\.\d+)?|[a-zA-Z][a-zA-Z0-9]*)/g,
    (_m, num: string, den: string) => `$\\frac{${num}}{${den}}$`,
  );

  // Step 4: Wrap variables with primes: A', E'', f'''
  // Match 1+ consecutive apostrophes after a letter
  result = result.replace(
    /([A-Z])('+)(?!\w)/g,
    (_m, v: string, p: string) => `$${v}${p}$`,
  );

  // Step 5: Wrap bare equations: variable = value
  // Handles: A = B, E = 4E, x = 5, but avoids matching Chinese text
  result = result.replace(
    /(?<![a-zA-Z一-鿿])([a-zA-Z0-9')\]]\s*[=<>]\s*[a-zA-Z0-9(^'\[])(?![a-zA-Z一-鿿])/g,
    (m) => `$${m}$`,
  );

  // Step 6: Wrap expressions with ^ superscripts that aren't yet wrapped
  result = result.replace(
    /(?<![a-zA-Z$\\])([a-zA-Z][a-zA-Z0-9]*)(\^\{[^}]+\}|\^[a-zA-Z0-9])(?![^$]*\$)/g,
    (_m, base: string, sup: string) => `$${base}${sup}$`,
  );

  // Step 7: Wrap Unicode math operators that slipped through
  // · × ÷ ± ∞ α β γ δ etc. when adjacent to other math
  result = result.replace(
    /([·×÷±∞αβγδεζηθικλμνξπρστυφχψω])\s*(?=[a-zA-Z0-9(^])/g,
    (_m, ch: string) => {
      // Don't wrap middle dot if it's between two already-wrapped blocks
      if (ch === '·') return ch;
      return `$${ch}$`;
    },
  );

  return result;
}

// ── Chained expression wrapper ─────────────────────────────────────

function wrapChainedExpressions(text: string): string {
  // Match: (number/number | letter/number) followed by 1+ (operator + fraction/term)
  // This catches: 1/4·1/2kA^2=1/4E, 1/2+1/3=5/6, A/2=B/4
  const fraction = String.raw`(?:\d+(?:\.\d+)?|[a-zA-Z](?:[a-zA-Z0-9])*)\/(?:\d+(?:\.\d+)?|[a-zA-Z](?:[a-zA-Z0-9])*)`;
  const operator = String.raw`[·×÷+\-=*/<>]`;
  const chainedPattern = new RegExp(
    `(${fraction}(?:\\s*${operator}\\s*(?:${fraction}|[a-zA-Z0-9^{}()]+))+)(?![^$]*\\$)`,
    'g',
  );

  return text.replace(chainedPattern, (match) => {
    let latex = match;

    // Convert fractions to \frac
    latex = latex.replace(
      /(\d+(?:\.\d+)?|[a-zA-Z](?:[a-zA-Z0-9])*)\/(\d+(?:\.\d+)?|[a-zA-Z](?:[a-zA-Z0-9])*)/g,
      '\\frac{$1}{$2}',
    );

    // Convert operators to LaTeX
    latex = latex.replace(/·/g, ' \\cdot ');
    latex = latex.replace(/\*/g, ' \\cdot ');
    latex = latex.replace(/×/g, ' \\times ');
    latex = latex.replace(/÷/g, ' \\div ');

    // Normalize superscripts: ^2 → ^{2}
    latex = latex.replace(/\^(\d)(?!\})/g, '^{$1}');

    return `$${latex}$`;
  });
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Post-process math content to ensure all mathematical expressions
 * are properly wrapped in $...$ delimiters.
 */
export function postProcessMathContent(text: string): string {
  if (!text) return text;

  const { parts, isMath } = splitByMathBlocks(text);

  const processed = parts.map((part, i) => {
    if (isMath[i]) return part;
    // For math blocks, also normalize Unicode superscripts inside
    const mathInner = part.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) => {
      return '$$' + normalizeUnicodeSuperscripts(inner) + '$$';
    }).replace(/\$([^$\n]+?)\$/g, (_m, inner: string) => {
      return '$' + normalizeUnicodeSuperscripts(inner) + '$';
    });
    if (isMath[i]) return mathInner;
    return processTextSegment(part);
  });

  return processed.join('');
}

/**
 * Apply postProcessMathContent to all math-bearing fields in FourPartOutput.
 */
export function postProcessFourPartOutput(output: FourPartOutput): FourPartOutput {
  return {
    ...output,
    answer: postProcessMathContent(output.answer),
    steps: output.steps.map((step) => ({
      ...step,
      content: postProcessMathContent(step.content),
      keyPoints: (step.keyPoints ?? []).map(postProcessMathContent),
    })),
    knowledgePoints: output.knowledgePoints.map((kp) => ({
      ...kp,
      name: postProcessMathContent(kp.name),
      description: postProcessMathContent(kp.description),
    })),
    similarQuestions: output.similarQuestions.map((sq) => ({
      ...sq,
      problem: postProcessMathContent(sq.problem),
    })),
  };
}
