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
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'zeta',
  'eta',
  'theta',
  'iota',
  'kappa',
  'lambda',
  'mu',
  'nu',
  'xi',
  'pi',
  'rho',
  'sigma',
  'tau',
  'upsilon',
  'phi',
  'chi',
  'psi',
  'omega',
  // Greek variants
  'varepsilon',
  'vartheta',
  'varphi',
  'varrho',
  'varsigma',
  'digamma',
  // Greek uppercase
  'Gamma',
  'Delta',
  'Theta',
  'Lambda',
  'Xi',
  'Pi',
  'Sigma',
  'Upsilon',
  'Phi',
  'Psi',
  'Omega',
  // Fractions, roots, operators
  'frac',
  'sqrt',
  'binom',
  'dfrac',
  'tfrac',
  'cfrac',
  'sum',
  'prod',
  'int',
  'iint',
  'iiint',
  'oint',
  'coprod',
  'bigcup',
  'bigcap',
  'bigvee',
  'bigwedge',
  'bigoplus',
  'bigotimes',
  'biguplus',
  'bigsqcup',
  'bigodot',
  'bigtriangleup',
  'bigtriangledown',
  // Relations
  'leq',
  'geq',
  'neq',
  'approx',
  'equiv',
  'sim',
  'simeq',
  'cong',
  'propto',
  'll',
  'gg',
  'prec',
  'succ',
  'preceq',
  'succeq',
  'subset',
  'supset',
  'subseteq',
  'supseteq',
  'subsetneq',
  'supsetneq',
  'in',
  'notin',
  'ni',
  'mid',
  'nmid',
  'parallel',
  'nparallel',
  'perp',
  'smile',
  'frown',
  'doteq',
  'asymp',
  'triangleq',
  // Arrows
  'to',
  'gets',
  'mapsto',
  'implies',
  'iff',
  'rightarrow',
  'leftarrow',
  'uparrow',
  'downarrow',
  'leftrightarrow',
  'updownarrow',
  'Rightarrow',
  'Leftarrow',
  'Uparrow',
  'Downarrow',
  'Leftrightarrow',
  'Updownarrow',
  'longrightarrow',
  'longleftarrow',
  'longleftrightarrow',
  'Longrightarrow',
  'Longleftarrow',
  'Longleftrightarrow',
  'hookrightarrow',
  'hookleftarrow',
  'rightharpoonup',
  'leftharpoonup',
  'rightharpoondown',
  'leftharpoondown',
  'longmapsto',
  'nearrow',
  'searrow',
  'swarrow',
  'nwarrow',
  'rightsquigarrow',
  'leftsquigarrow',
  // Functions
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'coth',
  'ln',
  'log',
  'lg',
  'exp',
  'det',
  'dim',
  'gcd',
  'hom',
  'ker',
  'max',
  'min',
  'sup',
  'inf',
  'lim',
  'limsup',
  'liminf',
  'Pr',
  'deg',
  // Symbols
  'infty',
  'partial',
  'nabla',
  'forall',
  'exists',
  'nexists',
  'emptyset',
  'varnothing',
  'times',
  'cdot',
  'div',
  'pm',
  'mp',
  'star',
  'ast',
  'circ',
  'bullet',
  'oplus',
  'ominus',
  'otimes',
  'odot',
  'oslash',
  'cup',
  'cap',
  'vee',
  'wedge',
  'setminus',
  'wr',
  'barwedge',
  'veebar',
  'sqcap',
  'sqcup',
  'land',
  'lor',
  'lnot',
  'neg',
  'angle',
  'triangle',
  'square',
  'Diamond',
  'Box',
  'measuredangle',
  'sphericalangle',
  'ell',
  'hbar',
  'Re',
  'Im',
  'aleph',
  'wp',
  'mho',
  'imath',
  'jmath',
  'dots',
  'cdots',
  'vdots',
  'ddots',
  'adots',
  'ldots',
  'top',
  'bot',
  'triangleleft',
  'triangleright',
  'prime',
  // Delimiters
  'left',
  'right',
  'middle',
  'langle',
  'rangle',
  'lceil',
  'rceil',
  'lfloor',
  'rfloor',
  'llbracket',
  'rrbracket',
  'lvert',
  'rvert',
  'lVert',
  'rVert',
  // Accents
  'vec',
  'hat',
  'tilde',
  'bar',
  'dot',
  'ddot',
  'dddot',
  'ddddot',
  'widehat',
  'widetilde',
  'overline',
  'underline',
  'overrightarrow',
  'overleftarrow',
  'Overrightarrow',
  'overbrace',
  'underbrace',
  'underrightarrow',
  'underleftarrow',
  'xrightarrow',
  'xleftarrow',
  'xlongrightarrow',
  'xlongequal',
  // Fonts / styling
  'mathbb',
  'mathcal',
  'mathrm',
  'mathbf',
  'mathit',
  'mathsf',
  'mathtt',
  'text',
  'textbf',
  'textit',
  'textrm',
  'textsf',
  'texttt',
  'displaystyle',
  'textstyle',
  'scriptstyle',
  // Sizing
  'big',
  'Big',
  'bigg',
  'Bigg',
  'bigl',
  'Bigl',
  'biggl',
  'Biggl',
  'bigr',
  'Bigr',
  'biggr',
  'Biggr',
  // Misc
  'limits',
  'nolimits',
  'stackrel',
  'underset',
  'overset',
  'dbinom',
  'tbinom',
  'cases',
  'substack',
  'not',
  'begin',
  'end',
  'hline',
  'hdashline',
  // Conic sections & geometry
  'overleftrightarrow',
  'boxed',
  'tag',
  'label',
  'nonumber',
  // Calculus
  'oiint',
  'oiiint',
  'varoint',
  'varoiint',
  'varointclockwise',
  'varointctrclockwise',
  'bmod',
  'pmod',
  'pod',
  // Series & limits
  'varinjlim',
  'varprojlim',
  'varlimsup',
  'varliminf',
  'sumlimits',
  'prodlimits',
  // Matrix environments
  'matrix',
  'pmatrix',
  'bmatrix',
  'Bmatrix',
  'vmatrix',
  'Vmatrix',
  'smallmatrix',
  'nicefrac',
  // Alignment
  'quad',
  'qquad',
  'enspace',
  'thinspace',
  'negthinspace',
  '!',
  ':',
  ';',
  'space',
  'enskip',
  'mspace',
  'phantom',
  'hphantom',
  'vphantom',
  // Logic & proof
  'qed',
  'blacksquare',
  // Misc
  'tag*',
  'displaylimits',
  'sideset',
  'prescript',
]);

// ── Bare LaTeX patterns ────────────────────────────────────────────────
// CJK-safe character class: excludes CJK chars/punctuation so A^2，其中
// doesn't swallow the following Chinese text.
const M = String.raw`[^\s{}$一-鿿　-〿＀-￯]+`;

const BARE_LATEX_PATTERNS: Array<{
  pattern: RegExp;
  wrapper: (m: string, ...groups: string[]) => string;
}> = [
  // Block-level environments → wrap as display math
  { pattern: /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, wrapper: (m) => `$$${m}$$` },

  // Bare \frac{num}{den}
  {
    pattern: /\\frac\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
    wrapper: (m) => `$${m}$`,
  },

  // Bare \dfrac, \tfrac, \cfrac, \binom, \dbinom, \tbinom
  {
    pattern: /\\(?:d|t|c)?frac\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
    wrapper: (m) => `$${m}$`,
  },
  {
    pattern: /\\(?:d|t)?binom\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
    wrapper: (m) => `$${m}$`,
  },

  // Bare \sqrt with braced content
  {
    pattern: /\\sqrt(?:\[[^\]]*\])?\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
    wrapper: (m) => `$${m}$`,
  },

  // Bare \overrightarrow{...}, etc.
  {
    pattern:
      /\\(?:overrightarrow|overleftarrow|Overrightarrow|overleftrightarrow|overbrace|underbrace|widehat|widetilde|overline|underline|xrightarrow|xleftarrow|xlongrightarrow)\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
    wrapper: (m) => `$${m}$`,
  },

  // Known LaTeX commands with optional args/sub/sup
  {
    pattern: new RegExp(
      String.raw`\\([a-zA-Z]{2,})(\s*(?:\[[^\]]*\]|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|_${M}|_[^{}]*\{[^{}]*\}|\^${M}|\^[^{}]*\{[^{}]*\}))*`,
      'g',
    ),
    wrapper: (m: string, cmd: string) => {
      if (cmd === 'left' || cmd === 'right') return m;
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

  // Bare \command(...) — e.g. \lim(x→0), \sin(2x), \log(1+x)
  // Must come before the catch-all so the parenthesized arg is included.
  {
    pattern: /\\([a-zA-Z]{2,})\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g,
    wrapper: (m: string, cmd: string, _inner: string) => {
      if (KNOWN_LATEX_COMMANDS.has(cmd)) return `$${m}$`;
      return m;
    },
  },

  // Variables with prime notation: A' E'' f''' → $A'$ $E''$ $f'''$
  {
    pattern: /\b([a-zA-Z])('(?:'')?)(?!\w)/g,
    wrapper: (m: string, v: string, p: string) => `$${v}${p}$`,
  },

  // Braced sub/superscripts on identifiers
  {
    pattern: new RegExp(
      String.raw`[a-zA-Z\\][a-zA-Z]*(?:_(?:\{[^}]*\}|${M}))(?:\^(?:\{[^}]*\}|${M}))?`,
      'g',
    ),
    wrapper: (m) => `$${m}$`,
  },
  {
    pattern: new RegExp(String.raw`[a-zA-Z\\][a-zA-Z]*(?:\^(?:\{[^}]*\}|${M}))`, 'g'),
    wrapper: (m) => `$${m}$`,
  },

  // Simple subscripts
  { pattern: new RegExp(String.raw`[a-zA-Z]_${M}`, 'g'), wrapper: (m) => `$${m}$` },

  // Simple superscripts
  { pattern: new RegExp(String.raw`[a-zA-Z0-9]\^${M}`, 'g'), wrapper: (m) => `$${m}$` },

  // Parenthesized expression with superscript
  { pattern: new RegExp(String.raw`\([^)]+\)\^${M}`, 'g'), wrapper: (m) => `$${m}$` },

  // Consecutive bare commands: \cos\phi, \sin\theta, \tan\alpha, etc.
  // The catch-all below fails for these because \cos is followed by \ (which
  // triggers the lookahead rejection). We match sequences of bare commands
  // (cmd + optional-whitespace + cmd + ...) and wrap as a single math block.
  {
    pattern: new RegExp(String.raw`\\([a-zA-Z]{2,})(?:\s*\\[a-zA-Z]+)*(?!\s*[\\[{}_])`, 'g'),
    wrapper: (m: string, firstCmd: string) => {
      if (KNOWN_LATEX_COMMANDS.has(firstCmd)) return `$${m}$`;
      return m;
    },
  },

  // Catch-all: bare \command without any args
  {
    pattern: new RegExp(String.raw`\\([a-zA-Z]{2,})(?!\s*[\\[{}_])`, 'g'),
    wrapper: (m: string) => {
      const cmd = m.slice(1);
      if (KNOWN_LATEX_COMMANDS.has(cmd)) return `$${m}$`;
      return m;
    },
  },
];

// ── Unicode math → LaTeX ───────────────────────────────────────────────

const UNICODE_TO_LATEX: Array<[RegExp, string]> = [
  [/α/g, '\\alpha'],
  [/β/g, '\\beta'],
  [/γ/g, '\\gamma'],
  [/δ/g, '\\delta'],
  [/ε/g, '\\epsilon'],
  [/ζ/g, '\\zeta'],
  [/η/g, '\\eta'],
  [/θ/g, '\\theta'],
  [/ι/g, '\\iota'],
  [/κ/g, '\\kappa'],
  [/λ/g, '\\lambda'],
  [/μ/g, '\\mu'],
  [/ν/g, '\\nu'],
  [/ξ/g, '\\xi'],
  [/π/g, '\\pi'],
  [/ρ/g, '\\rho'],
  [/σ/g, '\\sigma'],
  [/τ/g, '\\tau'],
  [/υ/g, '\\upsilon'],
  [/φ/g, '\\phi'],
  [/χ/g, '\\chi'],
  [/ψ/g, '\\psi'],
  [/ω/g, '\\omega'],
  [/ϕ/g, '\\varphi'],
  [/ϵ/g, '\\varepsilon'],
  [/ϑ/g, '\\vartheta'],
  [/ϰ/g, '\\varkappa'],
  [/ϱ/g, '\\varrho'],
  [/ς/g, '\\varsigma'],
  [/Γ/g, '\\Gamma'],
  [/Δ/g, '\\Delta'],
  [/Θ/g, '\\Theta'],
  [/Λ/g, '\\Lambda'],
  [/Ξ/g, '\\Xi'],
  [/Π/g, '\\Pi'],
  [/Σ/g, '\\Sigma'],
  [/Υ/g, '\\Upsilon'],
  [/Φ/g, '\\Phi'],
  [/Ψ/g, '\\Psi'],
  [/Ω/g, '\\Omega'],
  [/ℕ/g, '\\mathbb{N}'],
  [/ℤ/g, '\\mathbb{Z}'],
  [/ℚ/g, '\\mathbb{Q}'],
  [/ℝ/g, '\\mathbb{R}'],
  [/ℂ/g, '\\mathbb{C}'],
  [/∑/g, '\\sum'],
  [/∏/g, '\\prod'],
  [/∐/g, '\\coprod'],
  [/∫/g, '\\int'],
  [/∬/g, '\\iint'],
  [/∭/g, '\\iiint'],
  [/∮/g, '\\oint'],
  [/∯/g, '\\oiint'],
  [/∰/g, '\\oiiint'],
  [/×/g, '\\times'],
  [/÷/g, '\\div'],
  [/±/g, '\\pm'],
  [/∓/g, '\\mp'],
  [/⋅/g, '\\cdot'],
  [/∗/g, '\\ast'],
  [/⋆/g, '\\star'],
  [/∘/g, '\\circ'],
  [/•/g, '\\bullet'],
  [/⊕/g, '\\oplus'],
  [/⊖/g, '\\ominus'],
  [/⊗/g, '\\otimes'],
  [/⊘/g, '\\oslash'],
  [/⊙/g, '\\odot'],
  [/∩/g, '\\cap'],
  [/∪/g, '\\cup'],
  [/∨/g, '\\vee'],
  [/∧/g, '\\wedge'],
  [/∖/g, '\\setminus'],
  [/≤/g, '\\leq'],
  [/≥/g, '\\geq'],
  [/≠/g, '\\neq'],
  [/≈/g, '\\approx'],
  [/∼/g, '\\sim'],
  [/≃/g, '\\simeq'],
  [/≅/g, '\\cong'],
  [/≡/g, '\\equiv'],
  [/≍/g, '\\asymp'],
  [/≐/g, '\\doteq'],
  [/≜/g, '\\triangleq'],
  [/∝/g, '\\propto'],
  [/≪/g, '\\ll'],
  [/≫/g, '\\gg'],
  [/≺/g, '\\prec'],
  [/≻/g, '\\succ'],
  [/≼/g, '\\preceq'],
  [/≽/g, '\\succeq'],
  [/∥/g, '\\parallel'],
  [/⊥/g, '\\perp'],
  [/∈/g, '\\in'],
  [/∉/g, '\\notin'],
  [/∋/g, '\\ni'],
  [/⊂/g, '\\subset'],
  [/⊃/g, '\\supset'],
  [/⊆/g, '\\subseteq'],
  [/⊇/g, '\\supseteq'],
  [/⊊/g, '\\subsetneq'],
  [/⊋/g, '\\supsetneq'],
  [/∅/g, '\\emptyset'],
  [/∀/g, '\\forall'],
  [/∃/g, '\\exists'],
  [/∄/g, '\\nexists'],
  [/¬/g, '\\neg'],
  [/∴/g, '\\therefore'],
  [/∵/g, '\\because'],
  [/→/g, '\\rightarrow'],
  [/←/g, '\\leftarrow'],
  [/↑/g, '\\uparrow'],
  [/↓/g, '\\downarrow'],
  [/↔/g, '\\leftrightarrow'],
  [/⇒/g, '\\Rightarrow'],
  [/⇐/g, '\\Leftarrow'],
  [/⇔/g, '\\Leftrightarrow'],
  [/↦/g, '\\mapsto'],
  [/⟼/g, '\\longmapsto'],
  [/↗/g, '\\nearrow'],
  [/↘/g, '\\searrow'],
  [/↙/g, '\\swarrow'],
  [/↖/g, '\\nwarrow'],
  [/⟶/g, '\\longrightarrow'],
  [/⟵/g, '\\longleftarrow'],
  [/⟷/g, '\\longleftrightarrow'],
  [/⟹/g, '\\Longrightarrow'],
  [/⟸/g, '\\Longleftarrow'],
  [/⟺/g, '\\Longleftrightarrow'],
  [/∂/g, '\\partial'],
  [/∇/g, '\\nabla'],
  [/∞/g, '\\infty'],
  [/√/g, '\\sqrt'],
  [/∛/g, '\\sqrt[3]'],
  [/∜/g, '\\sqrt[4]'],
  [/′/g, '\\prime'],
  [/″/g, '\\prime\\prime'],
  [/ℓ/g, '\\ell'],
  [/ℏ/g, '\\hbar'],
  [/∠/g, '\\angle'],
  [/⊿/g, '\\triangle'],
  [/△/g, '\\bigtriangleup'],
  [/▽/g, '\\bigtriangledown'],
  [/□/g, '\\square'],
  [/◇/g, '\\Diamond'],
  [/⟨/g, '\\langle'],
  [/⟩/g, '\\rangle'],
  [/⌈/g, '\\lceil'],
  [/⌉/g, '\\rceil'],
  [/⌊/g, '\\lfloor'],
  [/⌋/g, '\\rfloor'],
  [/…/g, '\\dots'],
  [/⋯/g, '\\cdots'],
  [/⋮/g, '\\vdots'],
  [/⋱/g, '\\ddots'],
  [/⁰/g, '^{0}'],
  [/¹/g, '^{1}'],
  [/²/g, '^{2}'],
  [/³/g, '^{3}'],
  [/⁴/g, '^{4}'],
  [/⁵/g, '^{5}'],
  [/⁶/g, '^{6}'],
  [/⁷/g, '^{7}'],
  [/⁸/g, '^{8}'],
  [/⁹/g, '^{9}'],
  [/₀/g, '_{0}'],
  [/₁/g, '_{1}'],
  [/₂/g, '_{2}'],
  [/₃/g, '_{3}'],
  [/₄/g, '_{4}'],
  [/₅/g, '_{5}'],
  [/₆/g, '_{6}'],
  [/₇/g, '_{7}'],
  [/₈/g, '_{8}'],
  [/₉/g, '_{9}'],
  // Additional arrows & relations
  [/⇀/g, '\\rightharpoonup'],
  [/↼/g, '\\leftharpoonup'],
  [/⇁/g, '\\rightharpoondown'],
  [/↽/g, '\\leftharpoondown'],
  [/⩽/g, '\\leq'],
  [/⩾/g, '\\geq'],
  // Spacing
  [/ /g, '\\enspace '],
  [/ /g, '\\quad '],
  [/ /g, '\\thinspace '],
  [/‌/g, '\\!'],
  [/ /g, '\\,'],
  // Fraction slash
  [/⁄/g, '/'],
  [/∕/g, '/'],
];

function convertUnicodeMath(text: string): string {
  let result = text;
  for (const [pattern, replacement] of UNICODE_TO_LATEX) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ── Fraction conversion (raw LaTeX, no $ delimiters) ────────────────────
// Output is plain LaTeX — BARE_LATEX_PATTERNS will wrap as needed.

function convertFractionsRaw(text: string): string {
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g);

  for (let i = 0; i < parts.length; i++) {
    // Skip anything already delimited as math ($...$ or $$...$$)
    if (parts[i].startsWith('$') || parts[i].startsWith('$$')) continue;
    let segment = parts[i];

    // Parenthesized numerator
    segment = segment.replace(
      /\(([^()]+)\)((?:\^[a-zA-Z0-9]+|\^\{[^}]+\}|_[a-zA-Z0-9]+|_{[^}]+)*)\/(\d+(?:\.[0-9]+)?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|\\[a-zA-Z]+(?:\{[^}]*\})?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|[a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)/g,
      (_m: string, inner: string, scripts: string, den: string) =>
        `\\frac{(${inner})${scripts}}{${den}}`,
    );

    // Number / number_or_var
    segment = segment.replace(
      /(\d+(?:\.[0-9]+)?)\/(\d+(?:\.[0-9]+)?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|\\[a-zA-Z]+(?:\{[^}]*\})?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|[a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)/g,
      (_m: string, num: string, den: string) => `\\frac{${num}}{${den}}`,
    );

    // Variable / number_or_var
    segment = segment.replace(
      /([a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)\/(\d+(?:\.[0-9]+)?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|\\[a-zA-Z]+(?:\{[^}]*\})?|[a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)/g,
      (_m: string, num: string, den: string) => `\\frac{${num}}{${den}}`,
    );

    parts[i] = segment;
  }

  return parts.join('');
}

// ── sqrt fix: convert \sqrt(...) → \sqrt{...} ─────────────────────────

function fixSqrtParens(text: string): string {
  return text.replace(
    /\\sqrt(\[[^\]]*\])?\(([^()]*(?:\([^()]*\)[^()]*)*)\)?/g,
    (_m, opt: string | undefined, inner: string) => `\\sqrt${opt || ''}{${inner}}`,
  );
}

// ── Fix common LLM LaTeX mistakes ─────────────────────────────────────

const ENVIRONMENT_ALIAS_MAP: Record<string, string> = {
  align: 'aligned',
  alignat: 'aligned',
  gather: 'gathered',
  multline: 'gathered',
  flalign: 'aligned',
  eqnarray: 'aligned',
  split: 'aligned',
  array: 'aligned',
  tabular: 'aligned',
  // Note: \begin{equation} is valid in KaTeX — do NOT convert to aligned.
  // Note: \begin{cases} is valid in KaTeX — do NOT convert.
  // displaymath is not supported by KaTeX, convert to equation*.
  displaymath: 'equation*',
};

function normalizeEnvironments(text: string): string {
  let result = text;
  for (const [bad, good] of Object.entries(ENVIRONMENT_ALIAS_MAP)) {
    result = result.replace(new RegExp(String.raw`\\begin\{${bad}\*?\}`, 'g'), `\\begin{${good}}`);
    result = result.replace(new RegExp(String.raw`\\end\{${bad}\*?\}`, 'g'), `\\end{${good}}`);
  }
  return result;
}

function fixCommonLatexErrors(text: string): string {
  let result = text;
  result = normalizeEnvironments(result);
  // Fix \sqrt followed by letters: \sqrt14x → \sqrt{14x}
  result = result.replace(
    /\\sqrt(?![\[{])([a-zA-Z]+)/g,
    (_m, letters: string) => `\\sqrt{${letters}}`,
  );
  // Fix \sqrt followed by digits: \sqrt14 → \sqrt{14}
  result = result.replace(
    /\\sqrt(?![\[{])(\d+(?:\.\d+)?)/g,
    (_m, digits: string) => `\\sqrt{${digits}}`,
  );
  // Fix \sqrt}... (misplaced brace from enclosing \frac etc.): \sqrt}14 → \sqrt{14}
  result = result.replace(
    /\\sqrt\}([a-zA-Z0-9]+)/g,
    (_m, content: string) => `\\sqrt{${content}}`,
  );
  result = result.replace(
    /\\(cdot|times|div|pm|mp|star|circ|bullet)([a-zA-Z])/g,
    (_m, cmd: string, ch: string) => `\\${cmd} ${ch}`,
  );
  return result;
}

// ─ Fix broken math delimiters ───────────────────────────────────
// LLMs often output malformed $...$ delimiters:
// - Unpaired $ inside formulas: $\frac{2^n$ - 1}{$5^n$}
// - Stray $ inside braces: {$5^n$}
// We fix specific broken patterns rather than stripping ALL $ signs,
// which would destroy correctly-delimited math and break the placeholder
// extraction system.

function fixBrokenMathDelimiters(text: string): string {
  let result = text;
  // Remove $ inside braces: {$5^n$} → {5^n}
  result = result.replace(/\{(\$)([^{}]*?)(\$)\}/g, (_m, _open, inner: string, _close) => {
    return `{${inner.replace(/\$/g, '')}}`;
  });
  // Remove $ immediately before/after braces: $\frac{a}{b}$ is fine,
  // but $a}$ or ${a$ are broken — strip the orphan $
  result = result.replace(/\$(?=\})/g, '');
  result = result.replace(/(?<=\{)\$/g, '');
  // Remove $ immediately adjacent to operators that break LaTeX: $=, $+, $-
  result = result.replace(/\$(?=[=+\-*/])(?![^$]*\$)/g, '');
  return result;
}

// ─ Markdown cleanup ──────────────────────────────────────────────
// Strip common LLM markdown formatting that leaks into rendered output.
// The LLM often wraps step labels in **bold**, uses --- as separators, etc.
// IMPORTANT: Do NOT strip underscores (_) — they are critical for LaTeX
// subscripts like \frac{1}{2}, \sum_{n=1}, a_n, x_{max}, etc.
// Only strip markdown bold, headings, horizontal rules, code spans.

function stripMarkdown(text: string): string {
  let result = text;
  // Remove heading markers: ### text → text, #### text → text, etc.
  result = result.replace(/^#{1,6}\s*/gm, '');
  // Remove horizontal rules: ---, *** (but NOT ___ which could be LaTeX)
  result = result.replace(/\n?[-]{3,}\n?/g, '\n');
  result = result.replace(/\n?\*{3,}\n?/g, '\n');
  // Remove bold: **text** (multiline safe) → text
  result = result.replace(/\*\*([\s\S]*?)\*\*/g, '$1');
  // Remove italic: *text* → text (multiline safe, but NOT _text_ — those are LaTeX subscripts)
  result = result.replace(/(?<!\w)\*([\s\S]*?)\*(?!\w)/g, '$1');
  // Remove strikethrough: ~~text~~ → text
  result = result.replace(/~~([\s\S]*?)~~/g, '$1');
  // Remove code spans: `text` → text
  result = result.replace(/`([^`]+)`/g, '$1');
  // Remove escaped characters: \* → *  (but NOT \_ — that's LaTeX)
  result = result.replace(/\\([*`~#])/g, '$1');
  // Normalize whitespace: collapse tabs/multiple spaces
  result = result.replace(/[ \t]{2,}/g, ' ');
  // Preserve paragraph breaks (double newline = paragraph)
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

// ── Fast path check ──────────────────────────────────────────────────
// If content only contains $...$ and $$...$$ delimited math with no bare
// \command outside delimiters, skip the full BARE_LATEX_PATTERNS processing.
// This reduces rendering time for well-formed LLM output by ~70%.

function isWellFormedMath(text: string): boolean {
  // Remove all $...$ and $$...$$ blocks
  let remaining = text;
  // Remove $$...$$ first (longer delimiter)
  remaining = remaining.replace(/\$\$[\s\S]*?\$\$/g, '');
  // Remove $...$
  remaining = remaining.replace(/\$[^$\n]+?\$/g, '');

  // Check if any bare \command remains outside math delimiters
  // Match \command sequences that are likely LaTeX (2+ letter commands)
  const bareCommandPattern = /\\[a-zA-Z]{2,}/;
  return !bareCommandPattern.test(remaining);
}

// ── Main preprocessing ──────────────────────────────────────────────────

function wrapBareLatex(text: string): string {
  // Step 0: Normalize \(...\) → $...$ and \[...\] → $$...$$
  let result = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$');
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  // Note: Double-backslash normalization (\\\\frac → \frac) is already handled
  // by the server-side math-postprocessor and streaming-solver. No need to repeat here.

  // Step 0.1: Fix broken $...$ delimiters from LLM output
  // LLMs often output malformed: $\frac{2^n$ - 1}{$5^n$}
  result = fixBrokenMathDelimiters(result);

  // Step 0.2: Extract ALL $...$ and $$...$$ blocks as placeholders.
  // Keep them through ALL processing — only restore at the end.
  // This prevents BARE_LATEX_PATTERNS from double-wrapping already-delimited math.
  const blocks: string[] = [];
  // Extract $$...$$ first (longer delimiter)
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) => {
    blocks.push(inner);
    return '\x00M\x00' + (blocks.length - 1) + '\x00';
  });
  // Then extract remaining $...$ (allow multiline content for LLM output)
  result = result.replace(/\$([\s\S]*?)\$/g, (_m, inner: string) => {
    blocks.push(inner);
    return '\x00M\x00' + (blocks.length - 1) + '\x00';
  });

  // Now there are NO $ delimiters in the text — all patterns are safe to run.

  // Step 0.5: Strip markdown formatting (LLM often outputs **bold**, --- separators, etc.)
  result = stripMarkdown(result);

  // Step 1: Fix sqrt parentheses
  result = fixSqrtParens(result);

  // Step 2: Fix common LLM LaTeX errors (e.g. \cdotx → \cdot x)
  result = fixCommonLatexErrors(result);

  // Step 3: Convert Unicode math symbols (e.g. × → \times, ² → ^{2})
  result = convertUnicodeMath(result);

  // Step 3.5: Fix LaTeX errors from Unicode conversion
  // e.g. ×→\times followed by variable: \timesc → \times c
  result = fixCommonLatexErrors(result);

  // Step 4: Convert inline fractions — produce raw LaTeX without $ delimiters
  result = convertFractionsRaw(result);

  // Step 5: Wrap bare LaTeX commands and sub/superscripts
  for (const { pattern, wrapper } of BARE_LATEX_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    const replacements: Array<{ index: number; length: number; wrapped: string }> = [];

    while ((match = pattern.exec(result)) !== null) {
      // Skip inside placeholder markers
      const before = result.substring(0, match.index);
      if (/\x00M\x00/.test(before)) continue;
      // Skip if already inside $...$ (preceded by $ that hasn't been closed)
      // Count $ signs before this match — odd count means we're inside a math block
      const dollarCount = (before.match(/\$/g) || []).length;
      if (dollarCount % 2 !== 0) continue;

      replacements.push({
        index: match.index,
        length: match[0].length,
        wrapped: wrapper(match[0], ...match.slice(1)),
      });
    }

    for (let i = replacements.length - 1; i >= 0; i--) {
      const { index, length, wrapped } = replacements[i];
      result = result.substring(0, index) + wrapped + result.substring(index + length);
    }
  }

  // Step 6: Merge adjacent $...$ blocks separated by operators
  result = mergeAdjacentMathBlocks(result);

  // Step 7: Restore placeholders as $...$
  result = result.replace(/\x00M\x00(\d+)\x00/g, (_m, i: string) => `$${blocks[parseInt(i)]}$`);

  return result;
}

// ── Merge adjacent math blocks ──────────────────────────────────────

const OPERATOR_TO_LATEX: Record<string, string> = {
  '·': '\\cdot',
  '*': '\\cdot',
  '×': '\\times',
  '÷': '\\div',
  '=': '=',
  '+': '+',
  '-': '-',
  '<': '<',
  '>': '>',
  '≠': '\\neq',
  '≤': '\\leq',
  '≥': '\\geq',
  '≈': '\\approx',
  '≡': '\\equiv',
};

function mergeAdjacentMathBlocks(text: string): string {
  let prev = text;
  while (true) {
    let next = prev;
    // Pass 1: Merge $A$$B$ — directly adjacent blocks
    // Only merge when both sides look like LaTeX (contain \, ^, _, or operators)
    next = next.replace(/\$([^$]+)\$\$([^$]+)\$/g, (_m, left: string, right: string) => {
      if (left.length + right.length > 500) return _m;
      const looksLikeMath = (s: string) => /\\[^\\]/.test(s) || /[_^]/.test(s);
      if (!looksLikeMath(left) && !looksLikeMath(right)) return _m;
      return `$${left} ${right}$`;
    });
    // Pass 2: Merge $A$ [op] $B$ — blocks separated by operators
    next = next.replace(
      /\$([^$]+)\$\s*([·×÷+\-=*/<>≠≤≥≈≡])\s*\$([^$]+)\$/g,
      (_m, left: string, op: string, right: string) => {
        const latexOp = OPERATOR_TO_LATEX[op] ?? op;
        return `$${left} ${latexOp} ${right}$`;
      },
    );
    // Pass 3: Merge $A$ $\command...$ — blocks separated by space only
    next = next.replace(
      /\$([^$]+)\$\s+\$\\([a-zA-Z]+)([^$]*)\$/g,
      (_m, left: string, cmd: string, rest: string) => {
        return `$${left} \\${cmd}${rest}$`;
      },
    );
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

// ── Segment types ───────────────────────────────────────────────────────

type Segment =
  | { type: 'text'; value: string }
  | { type: 'inline-math'; value: string }
  | { type: 'block-math'; value: string };

/**
 * Parse preprocessed text into inline/block math + text segments.
 * $$...$$ renders as display-mode block math (centered, larger).
 * $...$ renders as inline math (flows with text).
 */
function parseMixedContent(text: string): Segment[] {
  const segments: Segment[] = [];
  let current = '';
  let idx = 0;

  while (idx < text.length) {
    if (text.startsWith('$$', idx)) {
      // Found $$ block → extract content, treat as block math
      const endIdx = text.indexOf('$$', idx + 2);
      if (endIdx !== -1) {
        const math = text.slice(idx + 2, endIdx).trim();
        if (current) segments.push({ type: 'text', value: current });
        if (math) segments.push({ type: 'block-math', value: math });
        idx = endIdx + 2;
        current = '';
        continue;
      }
    }
    if (text.startsWith('$', idx)) {
      // Found $ block → extract content, treat as inline math
      const endIdx = text.indexOf('$', idx + 1);
      if (endIdx !== -1) {
        const math = text.slice(idx + 1, endIdx).trim();
        if (current) segments.push({ type: 'text', value: current });
        if (math) segments.push({ type: 'inline-math', value: math });
        idx = endIdx + 1;
        current = '';
        continue;
      }
    }
    current += text[idx];
    idx++;
  }

  if (current) segments.push({ type: 'text', value: current });

  return segments;
}

// ── KaTeX output cache ────────────────────────────────────────────────
// Module-level LRU cache for rendered KaTeX HTML.
// Key = `${displayMode ? 'D' : 'I'}:${math}`, Value = rendered HTML.
// Capped at 2000 entries with LRU eviction (move-to-end on access).

const KATEX_CACHE_MAX = 2000;
const katexCache = new Map<string, string>();

function getCachedKatex(math: string, displayMode: boolean): string | undefined {
  const key = `${displayMode ? 'D' : 'I'}:${math}`;
  const cached = katexCache.get(key);
  if (cached !== undefined) {
    // Move to end (most recently used)
    katexCache.delete(key);
    katexCache.set(key, cached);
  }
  return cached;
}

function setCachedKatex(math: string, displayMode: boolean, html: string): void {
  const key = `${displayMode ? 'D' : 'I'}:${math}`;
  // Evict oldest if at capacity
  if (katexCache.size >= KATEX_CACHE_MAX) {
    const firstKey = katexCache.keys().next().value;
    if (firstKey !== undefined) {
      katexCache.delete(firstKey);
    }
  }
  katexCache.set(key, html);
}

// ── KaTeX renderer ─────────────────────────────────────────────────────

function renderKatex(math: string, displayMode = false): string {
  // Check cache first
  const cached = getCachedKatex(math, displayMode);
  if (cached !== undefined) return cached;

  let result: string;
  try {
    // For display mode: just strip \displaystyle (KaTeX handles the rest)
    // For inline mode: add \nolimits to compact large operators
    let processedMath = math;
    if (displayMode) {
      processedMath = math.replace(/\\displaystyle\s*/g, '');
    } else {
      processedMath = math
        .replace(/\\sum\b(?!\\nolimits|\\limits|\\displaylimits)/g, '\\sum\\nolimits')
        .replace(/\\prod\b(?!\\nolimits|\\limits|\\displaylimits)/g, '\\prod\\nolimits')
        .replace(/\\coprod\b(?!\\nolimits|\\limits|\\displaylimits)/g, '\\coprod\\nolimits')
        .replace(/\\bigcup\b(?!\\nolimits|\\limits|\\displaylimits)/g, '\\bigcup\\nolimits')
        .replace(/\\bigcap\b(?!\\nolimits|\\limits|\\displaylimits)/g, '\\bigcap\\nolimits')
        .replace(/\\bigvee\b(?!\\nolimits|\\limits|\\displaylimits)/g, '\\bigvee\\nolimits')
        .replace(/\\bigwedge\b(?!\\nolimits|\\limits|\\displaylimits)/g, '\\bigwedge\\nolimits')
        .replace(/\\int(?![\\a-zA-Z])(?!.*?\\limits)/g, '\\int\\nolimits')
        .replace(/\\displaystyle\s*/g, '');
    }

    result = katex.renderToString(processedMath, {
      displayMode,
      throwOnError: true,
      strict: false,

      trust: (context) => context.command === '\\htmlClass',
    });
    setCachedKatex(math, displayMode, result);
    return result;
  } catch {
    // First attempt failed — try common fixes
    let fixed = math
      .replace(/\\int\s*_\{([^{}]*)\}\s*\^\{([^{}]*)\}/g, '\\int\\limits_{$1}^{$2}')
      .replace(/\\int\s*_\{([^{}]*)\}/g, '\\int\\limits_{$1}')
      .replace(/\\int\s*\^\{([^{}]*)\}/g, '\\int\\limits^{$1}')
      .replace(/\\(?=\s)/g, '')
      .replace(/\$/g, '');

    // Balance braces
    let openCount = 0;
    let balanced = '';
    for (const ch of fixed) {
      if (ch === '{') openCount++;
      else if (ch === '}') openCount--;
      balanced += ch;
    }
    while (openCount > 0) {
      balanced += '}';
      openCount--;
    }
    fixed = balanced;

    // Fix \left/\right pairing
    const leftCount = (fixed.match(/\\left(?![a-zA-Z])/g) || []).length;
    const rightCount = (fixed.match(/\\right(?![a-zA-Z])/g) || []).length;
    if (leftCount > rightCount) {
      fixed = fixed + '\\right.'.repeat(leftCount - rightCount);
    } else if (rightCount > leftCount) {
      fixed = '\\left.'.repeat(rightCount - leftCount) + fixed;
    }

    fixed = fixed
      .replace(/\\left(?![a-zA-Z\[\]()|.\s])/g, '')
      .replace(/\\right(?![a-zA-Z\[\]()|.\s])/g, '');

    try {
      result = katex.renderToString(fixed, {
        displayMode,
        throwOnError: false,
        strict: false,

      });
      setCachedKatex(math, displayMode, result);
      return result;
    } catch {
      const minimal = math.replace(/\\[a-zA-Z]+/g, '').replace(/[{}_$^]/g, ' ');
      try {
        result = katex.renderToString(minimal, {
          displayMode,
          throwOnError: false,
          strict: false,

        });
        setCachedKatex(math, displayMode, result);
        return result;
      } catch {
        result = `<span style="font-family: 'Times New Roman', serif; font-style: italic;">${minimal.trim()}</span>`;
        setCachedKatex(math, displayMode, result);
        return result;
      }
    }
  }
}

// ── Component ───────────────────────────────────────────────────────────

export function MathRenderer({ content, className }: MathRendererProps) {
  if (!content) return null;

  const segments = useMemo(() => {
    // Fast path: if content is already well-formed (only $...$ delimited math,
    // no bare \command outside), skip the full wrapBareLatex processing.
    const preprocessed = isWellFormedMath(content) ? content : wrapBareLatex(content);
    return parseMixedContent(preprocessed);
  }, [content]);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <Fragment key={i}>{seg.value}</Fragment>;
        }
        if (seg.type === 'block-math') {
          // Display-mode math: centered block, larger rendering
          const html = renderKatex(seg.value, true);
          return (
            <div
              key={i}
              className="my-2 overflow-x-auto text-center"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        // Inline math: flows with text
        const html = renderKatex(seg.value, false);
        return (
          <span
            key={i}
            className="inline-block mx-0.5 align-baseline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}
