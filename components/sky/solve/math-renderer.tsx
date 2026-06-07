'use client';

import { Fragment, useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
}

// ── Known LaTeX commands ────────────────────────────────────────────────
// Used for accurate command matching instead of greedy [a-zA-Z]{2,}
// which incorrectly captures adjacent letters (e.g. \partialx → \partialx)

const KNOWN_LATEX_COMMANDS = new Set([
  // Greek lowercase
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa',
  'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
  // Greek variants
  'varepsilon', 'vartheta', 'varphi', 'varrho', 'varsigma', 'digamma',
  // Greek uppercase
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  // Fractions, roots, operators
  'frac', 'sqrt', 'binom', 'dfrac', 'tfrac', 'cfrac',
  'sum', 'prod', 'int', 'iint', 'iiint', 'oint', 'coprod',
  'bigcup', 'bigcap', 'bigvee', 'bigwedge', 'bigoplus', 'bigotimes', 'biguplus', 'bigsqcup',
  'bigodot', 'bigtriangleup', 'bigtriangledown',
  // Relations
  'leq', 'geq', 'neq', 'approx', 'equiv', 'sim', 'simeq', 'cong', 'propto',
  'll', 'gg', 'prec', 'succ', 'preceq', 'succeq',
  'subset', 'supset', 'subseteq', 'supseteq', 'subsetneq', 'supsetneq',
  'in', 'notin', 'ni', 'mid', 'nmid', 'parallel', 'nparallel', 'perp',
  'smile', 'frown', 'doteq', 'asymp', 'triangleq',
  // Arrows
  'to', 'gets', 'mapsto', 'implies', 'iff',
  'rightarrow', 'leftarrow', 'uparrow', 'downarrow', 'leftrightarrow', 'updownarrow',
  'Rightarrow', 'Leftarrow', 'Uparrow', 'Downarrow', 'Leftrightarrow', 'Updownarrow',
  'longrightarrow', 'longleftarrow', 'longleftrightarrow',
  'Longrightarrow', 'Longleftarrow', 'Longleftrightarrow',
  'hookrightarrow', 'hookleftarrow', 'rightharpoonup', 'leftharpoonup',
  'rightharpoondown', 'leftharpoondown', 'longmapsto',
  'nearrow', 'searrow', 'swarrow', 'nwarrow',
  'rightsquigarrow', 'leftsquigarrow',
  // Functions
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'coth',
  'ln', 'log', 'lg', 'exp', 'det', 'dim', 'gcd', 'hom', 'ker',
  'max', 'min', 'sup', 'inf', 'lim', 'limsup', 'liminf', 'Pr', 'deg',
  // Symbols
  'infty', 'partial', 'nabla', 'forall', 'exists', 'nexists',
  'emptyset', 'varnothing', 'times', 'cdot', 'div', 'pm', 'mp',
  'star', 'ast', 'circ', 'bullet', 'oplus', 'ominus', 'otimes', 'odot', 'oslash',
  'cup', 'cap', 'vee', 'wedge', 'setminus', 'wr',
  'barwedge', 'veebar', 'sqcap', 'sqcup', 'land', 'lor', 'lnot', 'neg',
  'angle', 'triangle', 'square', 'Diamond', 'Box', 'measuredangle', 'sphericalangle',
  'ell', 'hbar', 'Re', 'Im', 'aleph', 'wp', 'mho', 'imath', 'jmath',
  'dots', 'cdots', 'vdots', 'ddots', 'adots', 'ldots',
  'top', 'bot',
  'triangleleft', 'triangleright', 'bigtriangleup', 'bigtriangledown',
  'prime',
  // Delimiters
  'left', 'right', 'middle',
  'langle', 'rangle', 'lceil', 'rceil', 'lfloor', 'rfloor',
  'llbracket', 'rrbracket', 'lvert', 'rvert', 'lVert', 'rVert',
  // Accents
  'vec', 'hat', 'tilde', 'bar', 'dot', 'ddot', 'dddot', 'ddddot',
  'widehat', 'widetilde', 'overline', 'underline',
  'overrightarrow', 'overleftarrow', 'overbrace', 'underbrace',
  // Fonts / styling
  'mathbb', 'mathcal', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt',
  'text', 'textbf', 'textit', 'textrm', 'textsf', 'texttt',
  'displaystyle', 'textstyle', 'scriptstyle',
  // Sizing
  'big', 'Big', 'bigg', 'Bigg', 'bigl', 'Bigl', 'biggl', 'Biggl',
  'bigr', 'Bigr', 'biggr', 'Biggr',
  // Misc
  'limits', 'nolimits', 'stackrel', 'underset', 'overset',
  'dfrac', 'tfrac', 'dbinom', 'tbinom',
  'cases', 'substack',
  'not',
  'begin', 'end',
  'hline', 'hdashline',
]);

// ── Bare LaTeX patterns ────────────────────────────────────────────────
// CJK-safe character class: excludes CJK chars/punctuation so A^2，其中
// doesn't swallow the following Chinese text.
const M = String.raw`[^\s{}$一-鿿　-〿＀-￯]+`;

const BARE_LATEX_PATTERNS: Array<{ pattern: RegExp; wrapper: (m: string, ...groups: string[]) => string }> = [
  // Block-level environments
  { pattern: /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, wrapper: (m) => `$$${m}$$` },

  // Known LaTeX commands with optional args/sub/sup
  {
    pattern: new RegExp(String.raw`\\([a-zA-Z]{2,})(\s*(?:\[[^\]]*\]|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|_${M}|_[^{}]*\{[^{}]*\}|\^${M}|\^[^{}]*\{[^{}]*\}))*`, 'g'),
    wrapper: (m: string, cmd: string) => {
      let knownLen = 0;
      for (let len = Math.min(cmd.length, 12); len >= 2; len--) {
        if (KNOWN_LATEX_COMMANDS.has(cmd.slice(0, len))) {
          knownLen = len;
          break;
        }
      }
      if (knownLen > 0 && knownLen < cmd.length) {
        const known = cmd.slice(0, knownLen);
        const extra = cmd.slice(knownLen);
        const afterCmd = m.slice(1 + cmd.length);
        return `$\\${known}${afterCmd}$ ${extra}`;
      }
      return `$${m}$`;
    },
  },

  // left/right fences
  { pattern: /\\left[()[\]|.]|\\right[()[\]|.]/g, wrapper: (m) => `$${m}$` },

  // Variables with prime notation: A' E'' f''' → $A'$ $E''$ $f'''$
  // Must come BEFORE superscript patterns to capture primes as a unit
  { pattern: /\b([a-zA-Z])('(?:'')?)(?!\w)/g, wrapper: (m: string, v: string, p: string) => `$${v}${p}$` },

  // Braced sub/superscripts on identifiers
  { pattern: new RegExp(String.raw`[a-zA-Z\\][a-zA-Z]*(?:_(?:\{[^}]*\}|${M}))(?:\^(?:\{[^}]*\}|${M}))?`, 'g'), wrapper: (m) => `$${m}$` },
  { pattern: new RegExp(String.raw`[a-zA-Z\\][a-zA-Z]*(?:\^(?:\{[^}]*\}|${M}))`, 'g'), wrapper: (m) => `$${m}$` },

  // Simple subscripts
  { pattern: new RegExp(String.raw`[a-zA-Z]_${M}`, 'g'), wrapper: (m) => `$${m}$` },

  // Simple superscripts (no ) so (2A)^2 is handled by the parenthesized pattern)
  { pattern: new RegExp(String.raw`[a-zA-Z0-9]\^${M}`, 'g'), wrapper: (m) => `$${m}$` },

  // Parenthesized expression with superscript
  { pattern: new RegExp(String.raw`\([^)]+\)\^${M}`, 'g'), wrapper: (m) => `$${m}$` },
];

// ── Unicode math → LaTeX ───────────────────────────────────────────────

const UNICODE_TO_LATEX: Array<[RegExp, string]> = [
  // Greek lowercase
  [/α/g, '\\alpha'], [/β/g, '\\beta'], [/γ/g, '\\gamma'], [/δ/g, '\\delta'],
  [/ε/g, '\\epsilon'], [/ζ/g, '\\zeta'], [/η/g, '\\eta'], [/θ/g, '\\theta'],
  [/ι/g, '\\iota'], [/κ/g, '\\kappa'], [/λ/g, '\\lambda'], [/μ/g, '\\mu'],
  [/ν/g, '\\nu'], [/ξ/g, '\\xi'], [/π/g, '\\pi'], [/ρ/g, '\\rho'],
  [/σ/g, '\\sigma'], [/τ/g, '\\tau'], [/υ/g, '\\upsilon'], [/φ/g, '\\phi'],
  [/χ/g, '\\chi'], [/ψ/g, '\\psi'], [/ω/g, '\\omega'],
  [/ϕ/g, '\\varphi'], [/ϵ/g, '\\varepsilon'], [/ϑ/g, '\\vartheta'],
  [/ϰ/g, '\\varkappa'], [/ϱ/g, '\\varrho'], [/ς/g, '\\varsigma'],
  // Greek uppercase
  [/Γ/g, '\\Gamma'], [/Δ/g, '\\Delta'], [/Θ/g, '\\Theta'],
  [/Λ/g, '\\Lambda'], [/Ξ/g, '\\Xi'], [/Π/g, '\\Pi'],
  [/Σ/g, '\\Sigma'], [/Υ/g, '\\Upsilon'], [/Φ/g, '\\Phi'],
  [/Ψ/g, '\\Psi'], [/Ω/g, '\\Omega'],
  // Number sets
  [/ℕ/g, '\\mathbb{N}'], [/ℤ/g, '\\mathbb{Z}'], [/ℚ/g, '\\mathbb{Q}'],
  [/ℝ/g, '\\mathbb{R}'], [/ℂ/g, '\\mathbb{C}'],
  // Big operators
  [/∑/g, '\\sum'], [/∏/g, '\\prod'], [/∐/g, '\\coprod'],
  [/∫/g, '\\int'], [/∬/g, '\\iint'], [/∭/g, '\\iiint'],
  [/∮/g, '\\oint'], [/∯/g, '\\oiint'], [/∰/g, '\\oiiint'],
  // Binary operators
  [/×/g, '\\times'], [/÷/g, '\\div'], [/±/g, '\\pm'], [/∓/g, '\\mp'],
  [/⋅/g, '\\cdot'], [/∗/g, '\\ast'], [/⋆/g, '\\star'],
  [/∘/g, '\\circ'], [/•/g, '\\bullet'],
  [/⊕/g, '\\oplus'], [/⊖/g, '\\ominus'], [/⊗/g, '\\otimes'],
  [/⊘/g, '\\oslash'], [/⊙/g, '\\odot'],
  [/∩/g, '\\cap'], [/∪/g, '\\cup'], [/∨/g, '\\vee'], [/∧/g, '\\wedge'],
  [/∖/g, '\\setminus'],
  // Relations
  [/≤/g, '\\leq'], [/≥/g, '\\geq'], [/≠/g, '\\neq'],
  [/≈/g, '\\approx'], [/∼/g, '\\sim'], [/≃/g, '\\simeq'],
  [/≅/g, '\\cong'], [/≡/g, '\\equiv'],
  [/≍/g, '\\asymp'], [/≐/g, '\\doteq'],
  [/≜/g, '\\triangleq'], [/∝/g, '\\propto'],
  [/≪/g, '\\ll'], [/≫/g, '\\gg'],
  [/≺/g, '\\prec'], [/≻/g, '\\succ'],
  [/≼/g, '\\preceq'], [/≽/g, '\\succeq'],
  [/∥/g, '\\parallel'], [/⊥/g, '\\perp'],
  // Set relations
  [/∈/g, '\\in'], [/∉/g, '\\notin'], [/∋/g, '\\ni'],
  [/⊂/g, '\\subset'], [/⊃/g, '\\supset'],
  [/⊆/g, '\\subseteq'], [/⊇/g, '\\supseteq'],
  [/⊊/g, '\\subsetneq'], [/⊋/g, '\\supsetneq'],
  [/∅/g, '\\emptyset'],
  // Logic
  [/∀/g, '\\forall'], [/∃/g, '\\exists'], [/∄/g, '\\nexists'],
  [/¬/g, '\\neg'], [/∴/g, '\\therefore'], [/∵/g, '\\because'],
  // Arrows
  [/→/g, '\\rightarrow'], [/←/g, '\\leftarrow'],
  [/↑/g, '\\uparrow'], [/↓/g, '\\downarrow'],
  [/↔/g, '\\leftrightarrow'],
  [/⇒/g, '\\Rightarrow'], [/⇐/g, '\\Leftarrow'],
  [/⇔/g, '\\Leftrightarrow'],
  [/↦/g, '\\mapsto'], [/⟼/g, '\\longmapsto'],
  [/↗/g, '\\nearrow'], [/↘/g, '\\searrow'],
  [/↙/g, '\\swarrow'], [/↖/g, '\\nwarrow'],
  [/⟶/g, '\\longrightarrow'], [/⟵/g, '\\longleftarrow'],
  [/⟷/g, '\\longleftrightarrow'],
  [/⟹/g, '\\Longrightarrow'], [/⟸/g, '\\Longleftarrow'],
  [/⟺/g, '\\Longleftrightarrow'],
  // Calculus / Analysis
  [/∂/g, '\\partial'], [/∇/g, '\\nabla'],
  [/∞/g, '\\infty'], [/√/g, '\\sqrt'],
  [/∛/g, '\\sqrt[3]'], [/∜/g, '\\sqrt[4]'],
  [/′/g, '\\prime'], [/″/g, '\\prime\\prime'],
  [/ℓ/g, '\\ell'], [/ℏ/g, '\\hbar'],
  // Geometry
  [/∠/g, '\\angle'], [/⊿/g, '\\triangle'],
  [/△/g, '\\bigtriangleup'], [/▽/g, '\\bigtriangledown'],
  [/□/g, '\\square'], [/◇/g, '\\Diamond'],
  // Delimiters
  [/⟨/g, '\\langle'], [/⟩/g, '\\rangle'],
  [/⌈/g, '\\lceil'], [/⌉/g, '\\rceil'],
  [/⌊/g, '\\lfloor'], [/⌋/g, '\\rfloor'],
  // Dots
  [/…/g, '\\dots'], [/⋯/g, '\\cdots'],
  [/⋮/g, '\\vdots'], [/⋱/g, '\\ddots'],
  // Superscript numbers
  [/⁰/g, '^{0}'], [/¹/g, '^{1}'], [/²/g, '^{2}'],
  [/³/g, '^{3}'], [/⁴/g, '^{4}'], [/⁵/g, '^{5}'],
  [/⁶/g, '^{6}'], [/⁷/g, '^{7}'], [/⁸/g, '^{8}'], [/⁹/g, '^{9}'],
  // Subscript numbers
  [/₀/g, '_{0}'], [/₁/g, '_{1}'], [/₂/g, '_{2}'],
  [/₃/g, '_{3}'], [/₄/g, '_{4}'], [/₅/g, '_{5}'],
  [/₆/g, '_{6}'], [/₇/g, '_{7}'], [/₈/g, '_{8}'], [/₉/g, '_{9}'],
];

function convertUnicodeMath(text: string): string {
  let result = text;
  for (const [pattern, replacement] of UNICODE_TO_LATEX) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ── Fraction conversion ────────────────────────────────────────────────

function convertFractions(text: string): string {
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g);

  for (let i = 0; i < parts.length; i++) {
    // Skip anything already delimited as math ($...$ or $$...$$)
    if (parts[i].startsWith('$') || parts[i].startsWith('$$')) continue;
    let segment = parts[i];

    // Parenthesized numerator
    segment = segment.replace(
      /\(([^()]+)\)((?:\^[a-zA-Z0-9]+|\^\{[^}]+\}|_[a-zA-Z0-9]+|_{[^}]+)*)\/(\d+(?:\.[0-9]+)?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|\\[a-zA-Z]+(?:\{[^}]*\})?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|[a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)/g,
      (_m: string, inner: string, scripts: string, den: string) =>
        `$\\frac{(${inner})${scripts}}{${den}}$`,
    );

    // Number / number_or_var
    segment = segment.replace(
      /(\d+(?:\.[0-9]+)?)\/(\d+(?:\.[0-9]+)?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|\\[a-zA-Z]+(?:\{[^}]*\})?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|[a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)/g,
      (_m: string, num: string, den: string) => `$\\frac{${num}}{${den}}$`,
    );

    // Variable / number_or_var
    segment = segment.replace(
      /([a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)\/(\d+(?:\.[0-9]+)?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|\\[a-zA-Z]+(?:\{[^}]*\})?|[a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)/g,
      (_m: string, num: string, den: string) => `$\\frac{${num}}{${den}}$`,
    );

    parts[i] = segment;
  }

  return parts.join('');
}

// ── sqrt fix: convert \sqrt(...) → \sqrt{...} ─────────────────────────

function fixSqrtParens(text: string): string {
  // Fix both inside and outside $...$ delimiters
  return text.replace(
    /\\sqrt(\[[^\]]*\])?\(([^)]+)\)/g,
    (_m, opt: string, inner: string) => `\\sqrt${opt || ''}{${inner}}`,
  );
}

// ── Fix common LLM LaTeX mistakes ─────────────────────────────────────

function fixCommonLatexErrors(text: string): string {
  let result = text;
  // \sqrtn → \sqrt{n}, \sqrtabc → \sqrt{abc}
  // Matches \sqrt followed by letters (no brace/bracket), wraps in braces
  result = result.replace(
    /\\sqrt(?![\[{])([a-zA-Z]+)/g,
    (_m, letters: string) => `\\sqrt{${letters}}`,
  );
  // \fracabc → \frac{a}{bc} is too ambiguous, skip
  // Fix \cdotx → \cdot x (space before variable after operator commands)
  result = result.replace(
    /\\(cdot|times|div|pm|mp|star|circ|bullet)([a-zA-Z])/g,
    (_m, cmd: string, ch: string) => `\\${cmd} ${ch}`,
  );
  return result;
}

// ── Main preprocessing ─────────────────────────────────────────────────

function wrapBareLatex(text: string): string {
  // Step 0: Normalize \(...\) → $...$ and \[...\] → $$...$$
  let result = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$');
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  // Step 1: Fix sqrt parentheses (LLMs sometimes use \sqrt(...) instead of \sqrt{...})
  result = fixSqrtParens(result);

  // Step 0.5: Fix common LLM LaTeX errors
  result = fixCommonLatexErrors(result);

  // Step 1: Convert Unicode math symbols
  result = convertUnicodeMath(result);

  // Step 2: Convert inline fractions
  result = convertFractions(result);

  // Step 3: Wrap bare LaTeX commands and sub/superscripts
  for (const { pattern, wrapper } of BARE_LATEX_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    const replacements: Array<{ index: number; length: number; wrapped: string }> = [];

    while ((match = pattern.exec(result)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check if already inside $ delimiters
      const before = result.substring(0, start);
      const dollarCount = (before.match(/\$/g) || []).length;
      if (dollarCount % 2 === 1) continue;

      replacements.push({ index: start, length: match[0].length, wrapped: wrapper(match[0], ...match.slice(1)) });
    }

    // Apply replacements from end to start to preserve indices
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { index, length, wrapped } = replacements[i];
      result = result.substring(0, index) + wrapped + result.substring(index + length);
    }
  }

  // Step 4: Merge adjacent $...$ blocks separated by operators
  // e.g. $\frac{1}{4}$·$\frac{1}{2}$ → $\frac{1}{4} \cdot \frac{1}{2}$
  result = mergeAdjacentMathBlocks(result);

  return result;
}

// ── Merge adjacent math blocks ──────────────────────────────────────

const OPERATOR_TO_LATEX: Record<string, string> = {
  '·': '\\cdot', '*': '\\cdot',
  '×': '\\times', '÷': '\\div',
  '=': '=', '+': '+', '-': '-',
  '<': '<', '>': '>',
  '≠': '\\neq', '≤': '\\leq', '≥': '\\geq',
  '≈': '\\approx', '≡': '\\equiv',
};

function mergeAdjacentMathBlocks(text: string): string {
  // Repeatedly merge until no more changes (handles 3+ adjacent blocks)
  let prev = text;
  while (true) {
    const next = prev.replace(
      /\$([^$]+)\$\s*([·×÷+\-=*/<>≠≤≥≈≡])\s*\$([^$]+)\$/g,
      (_m, left: string, op: string, right: string) => {
        const latexOp = OPERATOR_TO_LATEX[op] ?? op;
        return `$${left} ${latexOp} ${right}$`;
      },
    );
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

// ── Segment types ───────────────────────────────────────────────────────

type Segment = { type: 'text'; value: string } | { type: 'inline-math' | 'block-math'; value: string };

function parseMixedContent(text: string): Segment[] {
  const segments: Segment[] = [];

  // Step 1: Extract $$...$$ blocks character-by-character (handles $ inside LaTeX like \text{$100$})
  const blockParts: string[] = [];
  let idx = 0;

  while (idx < text.length) {
    if (text.startsWith('$$', idx)) {
      const endIdx = text.indexOf('$$', idx + 2);
      if (endIdx !== -1) {
        blockParts.push(text.slice(idx, endIdx + 2));
        idx = endIdx + 2;
      } else {
        blockParts.push(text.slice(idx));
        idx = text.length;
      }
    } else {
      blockParts.push(text[idx]);
      idx++;
    }
  }

  // Step 2: Process each part for inline math or block math
  for (const part of blockParts) {
    if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
      const math = part.slice(2, -2).trim();
      if (math) {
        segments.push({ type: 'block-math', value: math });
      }
    } else {
      // Split by $...$ but skip $$ delimiters
      const inlineParts = part.split(/(\$[^$\n]+?\$)/g);
      for (const inline of inlineParts) {
        if (inline.startsWith('$') && inline.endsWith('$') && inline.length > 2) {
          const math = inline.slice(1, -1).trim();
          if (math) {
            segments.push({ type: 'inline-math', value: math });
          }
        } else if (inline) {
          segments.push({ type: 'text', value: inline });
        }
      }
    }
  }

  return segments;
}

// ── Component ───────────────────────────────────────────────────────────

function renderKatex(math: string, displayMode: boolean): string {
  try {
    return katex.renderToString(math, {
      displayMode,
      throwOnError: true,
      strict: false,
    });
  } catch {
    // First attempt failed — try common fixes
    let fixed = math
      // Remove stray backslashes before spaces
      .replace(/\\(?=\s)/g, '')
      // Remove stray $ inside math content (from nested delimiters)
      .replace(/\$/g, '')
      // Fix unbalanced braces: append missing closing braces
      .replace(/\{([^{}]*)$/, '{$1}')
      // Fix missing \right for \left (KaTeX requires pairs)
      .replace(/\\left(?![a-zA-Z\[\]()|])/g, '')
      .replace(/\\right(?![a-zA-Z\[\]()|])/g, '');

    try {
      return katex.renderToString(fixed, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      // Second fallback — strip all LaTeX commands, keep plain text
      const minimal = math
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}_$^]/g, ' ');
      try {
        return katex.renderToString(minimal, {
          displayMode,
          throwOnError: false,
          strict: false,
        });
      } catch {
        // Last resort: render as styled text
        return `<span style="font-family: 'Times New Roman', serif; font-style: italic;">${minimal.trim()}</span>`;
      }
    }
  }
}

export function MathRenderer({ content, className }: MathRendererProps) {
  if (!content) return null;

  const segments = useMemo(() => {
    const preprocessed = wrapBareLatex(content);
    return parseMixedContent(preprocessed);
  }, [content]);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <Fragment key={i}>{seg.value}</Fragment>;
        }
        const html = renderKatex(seg.value, seg.type === 'block-math');
        const Tag = seg.type === 'block-math' ? 'div' : 'span';
        return (
          <Tag
            key={i}
            className={seg.type === 'block-math' ? 'my-3 overflow-x-auto' : undefined}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}
