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
  ['²', '^2'],
  ['³', '^3'],
  ['⁰', '^0'],
  ['¹', '^1'],
  ['⁴', '^4'],
  ['⁵', '^5'],
  ['⁶', '^6'],
  ['⁷', '^7'],
  ['⁸', '^8'],
  ['⁹', '^9'],
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

// ── Unicode math → LaTeX ──────────────────────────────────────────
// Common Unicode symbols that LLMs output directly.
// Only the most frequent ones — the client-side renderer handles the rest.

const UNICODE_TO_LATEX: Array<[RegExp, string]> = [
  // Greek lowercase
  [/α/g, '\\alpha'], [/β/g, '\\beta'], [/γ/g, '\\gamma'], [/δ/g, '\\delta'],
  [/ε/g, '\\epsilon'], [/ζ/g, '\\zeta'], [/η/g, '\\eta'], [/θ/g, '\\theta'],
  [/ι/g, '\\iota'], [/κ/g, '\\kappa'], [/λ/g, '\\lambda'], [/μ/g, '\\mu'],
  [/ν/g, '\\nu'], [/ξ/g, '\\xi'], [/π/g, '\\pi'], [/ρ/g, '\\rho'],
  [/σ/g, '\\sigma'], [/τ/g, '\\tau'], [/υ/g, '\\upsilon'], [/φ/g, '\\phi'],
  [/χ/g, '\\chi'], [/ψ/g, '\\psi'], [/ω/g, '\\omega'],
  // Greek uppercase
  [/Γ/g, '\\Gamma'], [/Δ/g, '\\Delta'], [/Θ/g, '\\Theta'], [/Λ/g, '\\Lambda'],
  [/Σ/g, '\\Sigma'], [/Φ/g, '\\Phi'], [/Ψ/g, '\\Psi'], [/Ω/g, '\\Omega'],
  // Operators
  [/×/g, '\\times'], [/÷/g, '\\div'], [/±/g, '\\pm'], [/∓/g, '\\mp'],
  [/⋅/g, '\\cdot'], [/∗/g, '\\ast'], [/∘/g, '\\circ'],
  // Relations
  [/≤/g, '\\leq'], [/≥/g, '\\geq'], [/≠/g, '\\neq'], [/≈/g, '\\approx'],
  [/≡/g, '\\equiv'], [/∼/g, '\\sim'], [/∝/g, '\\propto'],
  // Set theory
  [/∈/g, '\\in'], [/∉/g, '\\notin'], [/⊂/g, '\\subset'], [/⊃/g, '\\supset'],
  [/⊆/g, '\\subseteq'], [/⊇/g, '\\supseteq'], [/∪/g, '\\cup'], [/∩/g, '\\cap'],
  [/∅/g, '\\emptyset'], [/∀/g, '\\forall'], [/∃/g, '\\exists'], [/¬/g, '\\neg'],
  // Arrows
  [/→/g, '\\rightarrow'], [/←/g, '\\leftarrow'], [/⇒/g, '\\Rightarrow'],
  [/⇐/g, '\\Leftarrow'], [/⇔/g, '\\Leftrightarrow'], [/↔/g, '\\leftrightarrow'],
  // Calculus
  [/∂/g, '\\partial'], [/∇/g, '\\nabla'], [/∞/g, '\\infty'],
  [/∫/g, '\\int'], [/∬/g, '\\iint'], [/∭/g, '\\iiint'], [/∮/g, '\\oint'],
  // Big operators
  [/∑/g, '\\sum'], [/∏/g, '\\prod'],
  // Geometry
  [/∠/g, '\\angle'], [/⊥/g, '\\perp'], [/∥/g, '\\parallel'],
  // Other
  [/√/g, '\\sqrt'], [/′/g, "'"], [/″/g, "''"], [/…/g, '\\cdots'],
  [/ℓ/g, '\\ell'], [/ℏ/g, '\\hbar'],
];

function convertUnicodeMath(text: string): string {
  let result = text;
  for (const [pattern, replacement] of UNICODE_TO_LATEX) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ── Core text processing (applied to non-math segments only) ────────

function processTextSegment(text: string): string {
  let result = text;

  // Step 0.5: Handle consecutive bare commands like \cos\phi, \sin\theta
  // These slip through the individual command catch-all because the lookahead
  // rejects \cos when followed by another \command.
  // IMPORTANT: This must run on non-math segments only (after splitByMathBlocks)
  // to avoid corrupting $...$ delimiters around already-formatted math.
  result = result.replace(/\\([a-zA-Z]{2,})(\s*\\[a-zA-Z]+)+/g, (_m: string, firstCmd: string) => {
    const knownCommands = new Set([
      'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
      'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'coth',
      'ln', 'log', 'exp', 'lim', 'int', 'oint', 'sum', 'prod', 'sqrt',
      'frac', 'dfrac', 'tfrac', 'binom',
      'partial', 'nabla', 'infty',
      'Sigma', 'Pi', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Phi', 'Psi', 'Omega',
      'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
      'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma',
      'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
      'varphi', 'vartheta', 'varepsilon', 'varrho', 'varsigma', 'digamma',
      'Rightarrow', 'Leftarrow', 'Longrightarrow', 'Longleftarrow', 'longmapsto',
      'longrightarrow', 'longleftarrow', 'longleftrightarrow',
      'leftarrow', 'rightarrow', 'uparrow', 'downarrow', 'leftrightarrow',
      'hookrightarrow', 'hookleftarrow', 'nearrow', 'searrow', 'swarrow', 'nwarrow',
    ]);
    if (knownCommands.has(firstCmd)) return `$${_m}$`;
    return _m;
  });

  // Step 1: Normalize Unicode superscripts
  result = normalizeUnicodeSuperscripts(result);

  // Step 1.5: First fraction pass — catch bare fractions BEFORE Unicode conversion
  // e.g. sinα/cosα → $\frac{sinα}{cosα}$ (while α is still Unicode, not \alpha)
  // Without this, convertUnicodeMath would turn α → \alpha, breaking the [a-zA-Z] match.

  // 1.5a: Parenthesized fractions: (expr)/(expr)
  result = result.replace(
    /\(([^()]+)\)\/\(([^()]+)\)/g,
    (_m, num: string, den: string) => `$\\frac{${num}}{${den}}$`,
  );

  // 1.5b: Simple numeric fractions: 3/5, 1/2
  result = result.replace(
    /(?<![一-鿿a-zA-Z])(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)(?![一-鿆a-zA-Z])/g,
    (_m, num: string, den: string) => `$\\frac{${num}}{${den}}$`,
  );

  // 1.5c: Variable fractions: a/b, sinα/cosα, x^2/y
  result = result.replace(
    /(?<![一-鿿])([a-zA-Z][a-zA-Z0-9]*)\/(\d+(?:\.\d+)?|[a-zA-Z][a-zA-Z0-9]*)(?![一-鿆])/g,
    (_m, num: string, den: string) => `$\\frac{${num}}{${den}}$`,
  );

  // Step 1.6: Convert Unicode math symbols to LaTeX
  // e.g. α → \alpha, → → \rightarrow, √ → \sqrt, ∫ → \int
  result = convertUnicodeMath(result);

  // Step 1.7: Second fraction pass — catch \command/... patterns AFTER Unicode conversion
  // e.g. \sin\alpha/\cos\alpha → $\frac{\sin\alpha}{\cos\alpha}$
  // Uses alternation (\\cmd|[a-zA-Z]) to match \command sequences atomically.
  // Negative lookbehind (?<![\\]) prevents matching \frac from \frac{3}{5}.
  const CMD_OR_LETTER = String.raw`(?:\\[a-zA-Z]+|[a-zA-Z])`;
  const CMD_OR_LETTER_DEN = String.raw`(?:\\[a-zA-Z]+(?:\{[^}]*\})?|[a-zA-Z](?:[a-zA-Z0-9]*|\\[a-zA-Z]+)*)`;
  result = result.replace(
    new RegExp(
      String.raw`(?<![一-鿿\\])` +
      String.raw`(${CMD_OR_LETTER}(?:[a-zA-Z0-9]*|\\[a-zA-Z]+)*(?:\^[a-zA-Z0-9]+|\^\{[^}]*\}|_[a-zA-Z0-9]+|_\{[^}]*\})*)` +
      String.raw`\/` +
      String.raw`(\d+(?:\.\d+)?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|${CMD_OR_LETTER_DEN}(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)` +
      String.raw`(?![一-鿆])`,
      'g',
    ),
    (_m, num: string, den: string) => `$\\frac{${num}}{${den}}$`,
  );

  // Step 2: Wrap chained math expressions
  // Matches patterns like: 1/4·1/2kA^2=1/4E  or  A/2=B/4  or  3/4×2/3=1/2
  result = wrapChainedExpressions(result);

  // Step 3.5: Wrap bare trig/log functions that aren't backslashed
  // LLMs often output: sin3x, cosθ, lnx, log2, lim(x→0)
  // These need \sin, \cos, \ln, \log, \lim for KaTeX to render correctly.
  // Must come AFTER fraction conversion so sin3x/tan5x → \frac{sin3x}{tan5x} first,
  // then sin → \sin inside the fraction.
  const BARE_FUNCTIONS = /(?<![a-zA-Z\\])(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|lim|exp|det|gcd)(?=[^a-zA-Z]|$)/g;
  result = result.replace(BARE_FUNCTIONS, (_m, fn: string) => `\\${fn}`);

  // Step 4: Wrap variables with primes: A', E'', f''', y'
  // Match 1+ consecutive apostrophes after a letter (upper or lowercase)
  result = result.replace(/([a-zA-Z])('+)(?!\w)/g, (_m, v: string, p: string) => `$${v}${p}$`);

  // Step 5: Wrap bare equations: variable = value
  // Conservative: only match simple assignments, not long expressions.
  // e.g. y = x, E = 4E, x = 5, N = mg, 4y = 2x
  // Avoid matching inside longer expressions like "y = \sin2x".
  result = result.replace(
    /(?<![a-zA-Z一-鿿])(\d*[a-zA-Z]\s*[=<>≤≥≠]\s*[a-zA-Z0-9]+(?:\s*[+\-*/]\s*[a-zA-Z0-9]+)*)(?![a-zA-Z一-鿿(])/g,
    (m) => `$${m}$`,
  );

  // Step 6: Wrap Unicode math operators that slipped through
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
 * Post-process math content — minimal server-side processing only.
 *
 * Performs:
 * 1. Double-backslash normalization (JSON escape fix)
 * 2. Unicode superscript normalization (² → ^2, etc.)
 * 3. Unicode math symbol → LaTeX conversion (α → \alpha, × → \times, etc.)
 *
 * Does NOT wrap bare LaTeX in $...$ — that is handled client-side by
 * MathRenderer.wrapBareLatex (single source of truth for wrapping).
 */
export function postProcessMathContent(text: string): string {
  if (!text) return text;

  // Step 1: Normalize double backslashes from JSON escaping.
  // The streaming parser extracts raw string content between JSON quotes
  // without JSON.parse, so double backslashes (\\frac) remain as literal
  // characters. We normalize them to single backslash here.
  let result = text.replace(/\\\\([a-zA-Z]+)/g, (_m: string, cmd: string) => `\\${cmd}`);

  // Step 2: Normalize Unicode superscripts (² → ^2, ³ → ^3, etc.)
  result = normalizeUnicodeSuperscripts(result);

  // Step 3: Convert Unicode math symbols to LaTeX (α → \alpha, × → \times, etc.)
  result = convertUnicodeMath(result);

  return result;
}

/**
 * Apply postProcessMathContent to all math-bearing fields in FourPartOutput.
 */
export function postProcessFourPartOutput(output: FourPartOutput): FourPartOutput {
  return {
    ...output,
    solution: output.solution ? postProcessMathContent(output.solution) : '',
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
