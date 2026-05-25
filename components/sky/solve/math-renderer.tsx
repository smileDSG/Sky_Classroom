'use client';

import { Fragment, useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
}

// ── Bare LaTeX patterns (same as formula-extractor.ts) ───────────────
// These detect LaTeX commands/subscripts/superscripts that are NOT
// already inside $...$ delimiters, and wrap them so KaTeX can render.

const BARE_LATEX_PATTERNS: Array<{ pattern: RegExp; wrapper: (m: string) => string }> = [
  // Block-level environments — wrap with $$
  { pattern: /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, wrapper: (m) => `$$${m}$$` },
  // LaTeX commands with braces
  { pattern: /\\frac\{[^}]*\}\{[^}]*\}/g, wrapper: (m) => `$${m}$` },
  { pattern: /\\sqrt(?:\[.*?\])?\{[^}]*\}/g, wrapper: (m) => `$${m}$` },
  { pattern: /\\int(?:_[^{}]*\{[^}]*\})?(?:\^[^{}]*\{[^}]*\})?/g, wrapper: (m) => `$${m}$` },
  { pattern: /\\sum(?:_[^{}]*\{[^}]*\})?(?:\^[^{}]*\{[^}]*\})?/g, wrapper: (m) => `$${m}$` },
  { pattern: /\\prod(?:_[^{}]*\{[^}]*\})?(?:\^[^{}]*\{[^}]*\})?/g, wrapper: (m) => `$${m}$` },
  { pattern: /\\lim(?:_\{[^}]*\})?/g, wrapper: (m) => `$${m}$` },
  { pattern: /\\infty/g, wrapper: (m) => `$${m}$` },
  { pattern: /\\left[()[\]|]/g, wrapper: (m) => `$${m}$` },
  { pattern: /\\right[()[\]|]/g, wrapper: (m) => `$${m}$` },
  { pattern: /\\times|\\div|\\pm|\\leq|\\geq|\\neq|\\approx|\\cdot|\\cdots|\\pi|\\alpha|\\beta|\\theta|\\lambda|\\sigma|\\gamma|\\Delta|\\omega/g, wrapper: (m) => `$${m}$` },
  // Braced subscripts and superscripts
  { pattern: /[a-zA-Z0-9]_\{[^}]+\}(?:\^\{[^}]+\})?/g, wrapper: (m) => `$${m}$` },
  { pattern: /[a-zA-Z0-9]\^\{[^}]+\}/g, wrapper: (m) => `$${m}$` },
  // Simple subscripts: u_n, x_1 (single char + underscore + alphanumeric)
  { pattern: /[a-zA-Z]_[a-zA-Z0-9]+/g, wrapper: (m) => `$${m}$` },
  // Simple superscripts: x^2, (-1)^n
  { pattern: /[a-zA-Z0-9)]\^[a-zA-Z0-9]+/g, wrapper: (m) => `$${m}$` },
  // Combined sub + sup: u_n^2
  { pattern: /[a-zA-Z]_[a-zA-Z0-9]+\^[a-zA-Z0-9]+/g, wrapper: (m) => `$${m}$` },
  // Parenthesized expression with superscript: (-1)^n, (x+1)^2
  { pattern: /\([^)]+\)\^[a-zA-Z0-9]+/g, wrapper: (m) => `$${m}$` },
];

// ── Unicode math → LaTeX conversion ─────────────────────────────────
// Comprehensive coverage at 高等数学 (advanced calculus) level.
// Organized by category for maintainability.

const UNICODE_TO_LATEX: Array<[RegExp, string]> = [
  // ── Greek lowercase ──────────────────────────────────────────
  [/α/g, '\\alpha'], [/β/g, '\\beta'], [/γ/g, '\\gamma'], [/δ/g, '\\delta'],
  [/ε/g, '\\epsilon'], [/ζ/g, '\\zeta'], [/η/g, '\\eta'], [/θ/g, '\\theta'],
  [/ι/g, '\\iota'], [/κ/g, '\\kappa'], [/λ/g, '\\lambda'], [/μ/g, '\\mu'],
  [/ν/g, '\\nu'], [/ξ/g, '\\xi'], [/π/g, '\\pi'], [/ρ/g, '\\rho'],
  [/σ/g, '\\sigma'], [/τ/g, '\\tau'], [/υ/g, '\\upsilon'], [/φ/g, '\\phi'],
  [/χ/g, '\\chi'], [/ψ/g, '\\psi'], [/ω/g, '\\omega'],
  // Variant forms
  [/ϕ/g, '\\varphi'], [/ϵ/g, '\\varepsilon'], [/ϑ/g, '\\vartheta'],
  [/ϰ/g, '\\varkappa'], [/ϱ/g, '\\varrho'], [/ς/g, '\\varsigma'],
  [/ϝ/g, '\\digamma'],

  // ── Greek uppercase ──────────────────────────────────────────
  [/Γ/g, '\\Gamma'], [/Δ/g, '\\Delta'], [/Θ/g, '\\Theta'],
  [/Λ/g, '\\Lambda'], [/Ξ/g, '\\Xi'], [/Π/g, '\\Pi'],
  [/Σ/g, '\\Sigma'], [/Υ/g, '\\Upsilon'], [/Φ/g, '\\Phi'],
  [/Ψ/g, '\\Psi'], [/Ω/g, '\\Omega'],

  // ── Number sets (double-struck) ──────────────────────────────
  [/ℕ/g, '\\mathbb{N}'], [/ℤ/g, '\\mathbb{Z}'], [/ℚ/g, '\\mathbb{Q}'],
  [/ℝ/g, '\\mathbb{R}'], [/ℂ/g, '\\mathbb{C}'],

  // ── Big operators ────────────────────────────────────────────
  [/∑/g, '\\sum'], [/∏/g, '\\prod'], [/∐/g, '\\coprod'],
  [/∫/g, '\\int'], [/∬/g, '\\iint'], [/∭/g, '\\iiint'],
  [/∮/g, '\\oint'], [/∯/g, '\\oiint'], [/∰/g, '\\oiiint'],
  [/⋀/g, '\\bigwedge'], [/⋁/g, '\\bigvee'],
  [/⋂/g, '\\bigcap'], [/⋃/g, '\\bigcup'],
  [/⨄/g, '\\biguplus'], [/⨆/g, '\\bigsqcup'],
  [/⨁/g, '\\bigoplus'], [/⨂/g, '\\bigotimes'],
  [/⨀/g, '\\bigodot'],

  // ── Binary operators ─────────────────────────────────────────
  [/×/g, '\\times'], [/÷/g, '\\div'], [/±/g, '\\pm'], [/∓/g, '\\mp'],
  [/⋅/g, '\\cdot'], [/∗/g, '\\ast'], [/⋆/g, '\\star'],
  [/∘/g, '\\circ'], [/•/g, '\\bullet'],
  [/⊕/g, '\\oplus'], [/⊖/g, '\\ominus'], [/⊗/g, '\\otimes'],
  [/⊘/g, '\\oslash'], [/⊙/g, '\\odot'],
  [/†/g, '\\dagger'], [/‡/g, '\\ddagger'],
  [/∩/g, '\\cap'], [/∪/g, '\\cup'],
  [/⊎/g, '\\uplus'], [/⊓/g, '\\sqcap'], [/⊔/g, '\\sqcup'],
  [/∨/g, '\\vee'], [/∧/g, '\\wedge'],
  [/∖/g, '\\setminus'], [/≀/g, '\\wr'],
  [/⊼/g, '\\barwedge'], [/⊻/g, '\\veebar'],

  // ── Relations ────────────────────────────────────────────────
  [/≤/g, '\\leq'], [/≥/g, '\\geq'], [/≠/g, '\\neq'],
  [/≈/g, '\\approx'], [/∼/g, '\\sim'], [/≃/g, '\\simeq'],
  [/≅/g, '\\cong'], [/≡/g, '\\equiv'],
  [/≍/g, '\\asymp'], [/≐/g, '\\doteq'],
  [/≜/g, '\\triangleq'], [/∝/g, '\\propto'],
  [/≪/g, '\\ll'], [/≫/g, '\\gg'],
  [/≺/g, '\\prec'], [/≻/g, '\\succ'],
  [/≼/g, '\\preceq'], [/≽/g, '\\succeq'],
  [/≺≺/g, '\\precprec'], [/≻≻/g, '\\succsucc'],
  [/∥/g, '\\parallel'], [/∦/g, '\\nparallel'],
  [/⊥/g, '\\perp'], [/⊤/g, '\\top'],
  [/⊣/g, '\\dashv'], [/⊢/g, '\\vdash'],
  [/⊨/g, '\\models'], [/⊩/g, '\\Vdash'], [/⊪/g, '\\Vvdash'],
  [/∣/g, '\\mid'], [/∤/g, '\\nmid'],
  [/⌣/g, '\\smile'], [/⌢/g, '\\frown'],

  // ── Set relations ────────────────────────────────────────────
  [/∈/g, '\\in'], [/∉/g, '\\notin'], [/∋/g, '\\ni'],
  [/⊂/g, '\\subset'], [/⊃/g, '\\supset'],
  [/⊄/g, '\\not\\subset'], [/⊅/g, '\\not\\supset'],
  [/⊆/g, '\\subseteq'], [/⊇/g, '\\supseteq'],
  [/⊈/g, '\\nsubseteq'], [/⊉/g, '\\nsupseteq'],
  [/⊊/g, '\\subsetneq'], [/⊋/g, '\\supsetneq'],
  [/⊏/g, '\\sqsubset'], [/⊐/g, '\\sqsupset'],
  [/⊑/g, '\\sqsubseteq'], [/⊒/g, '\\sqsupseteq'],
  [/∅/g, '\\emptyset'],

  // ── Logic ────────────────────────────────────────────────────
  [/∀/g, '\\forall'], [/∃/g, '\\exists'], [/∄/g, '\\nexists'],
  [/¬/g, '\\neg'],
  [/∴/g, '\\therefore'], [/∵/g, '\\because'],

  // ── Arrows ───────────────────────────────────────────────────
  [/→/g, '\\rightarrow'], [/←/g, '\\leftarrow'],
  [/↑/g, '\\uparrow'], [/↓/g, '\\downarrow'],
  [/↔/g, '\\leftrightarrow'], [/↕/g, '\\updownarrow'],
  [/⇒/g, '\\Rightarrow'], [/⇐/g, '\\Leftarrow'],
  [/⇑/g, '\\Uparrow'], [/⇓/g, '\\Downarrow'],
  [/⇔/g, '\\Leftrightarrow'], [/⇕/g, '\\Updownarrow'],
  [/↦/g, '\\mapsto'], [/⟼/g, '\\longmapsto'],
  [/↪/g, '\\hookrightarrow'], [/↩/g, '\\hookleftarrow'],
  [/⇀/g, '\\rightharpoonup'], [/⇁/g, '\\rightharpoondown'],
  [/↼/g, '\\leftharpoonup'], [/↽/g, '\\leftharpoondown'],
  [/↗/g, '\\nearrow'], [/↘/g, '\\searrow'],
  [/↙/g, '\\swarrow'], [/↖/g, '\\nwarrow'],
  [/⇝/g, '\\rightsquigarrow'], [/⇜/g, '\\leftsquigarrow'],
  [/⟶/g, '\\longrightarrow'], [/⟵/g, '\\longleftarrow'],
  [/⟷/g, '\\longleftrightarrow'],
  [/⟹/g, '\\Longrightarrow'], [/⟸/g, '\\Longleftarrow'],
  [/⟺/g, '\\Longleftrightarrow'],

  // ── Calculus / Analysis ──────────────────────────────────────
  [/∂/g, '\\partial'], [/∇/g, '\\nabla'],
  [/∞/g, '\\infty'], [/√/g, '\\sqrt'],
  [/∛/g, '\\sqrt[3]'], [/∜/g, '\\sqrt[4]'],
  [/′/g, '\\prime'], [/″/g, '\\prime\\prime'], [/‴/g, '\\prime\\prime\\prime'],
  [/ℓ/g, '\\ell'], [/ℏ/g, '\\hbar'],
  [/ℱ/g, '\\mathcal{F}'], [/ℒ/g, '\\mathcal{L}'],
  [/ℳ/g, '\\mathcal{M}'], [/ℛ/g, '\\mathcal{R}'],
  [/ℜ/g, '\\Re'], [/ℑ/g, '\\Im'],
  [/∢/g, '\\sphericalangle'], [/∡/g, '\\measuredangle'],

  // ── Geometry ─────────────────────────────────────────────────
  [/∠/g, '\\angle'], [/∟/g, '\\rightangle'],
  [/⊿/g, '\\triangle'], [/△/g, '\\bigtriangleup'],
  [/▽/g, '\\bigtriangledown'],
  [/□/g, '\\square'], [/◇/g, '\\Diamond'],
  [/∎/g, '\\blacksquare'], [/◆/g, '\\blacklozenge'],
  [/▲/g, '\\blacktriangle'], [/▼/g, '\\blacktriangledown'],
  [/∘/g, '\\circ'],

  // ── Delimiters ───────────────────────────────────────────────
  [/⟨/g, '\\langle'], [/⟩/g, '\\rangle'],
  [/⌈/g, '\\lceil'], [/⌉/g, '\\rceil'],
  [/⌊/g, '\\lfloor'], [/⌋/g, '\\rfloor'],
  [/⟦/g, '\\llbracket'],  [/⟧/g, '\\rrbracket'],
  [/‖/g, '\\|'],

  // ── Dots / ellipsis ──────────────────────────────────────────
  [/…/g, '\\dots'], [/⋯/g, '\\cdots'],
  [/⋮/g, '\\vdots'], [/⋱/g, '\\ddots'],
  [/⋰/g, '\\adots'],

  // ── Superscript numbers ──────────────────────────────────────
  [/⁰/g, '^{0}'], [/¹/g, '^{1}'], [/²/g, '^{2}'],
  [/³/g, '^{3}'], [/⁴/g, '^{4}'], [/⁵/g, '^{5}'],
  [/⁶/g, '^{6}'], [/⁷/g, '^{7}'], [/⁸/g, '^{8}'], [/⁹/g, '^{9}'],

  // ── Subscript numbers ────────────────────────────────────────
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

// ── Fraction conversion ─────────────────────────────────────────────

/**
 * Convert inline fraction patterns (a/b) to \frac{a}{b} LaTeX.
 *
 * Detects math-atom / math-atom patterns where each atom is a number,
 * variable with optional scripts, or parenthesized expression with
 * optional scripts. Skips content inside $...$ delimiters.
 *
 * Examples:
 *   1/2    → $\frac{1}{2}$
 *   1/3^n  → $\frac{1}{3^n}$
 *   (-1)^n/2^n → $\frac{(-1)^n}{2^n}$
 */
function convertFractions(text: string): string {
  const parts = text.split(/(\$[\s\S]*?\$)/g);

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) continue; // skip $...$-delimited math
    let segment = parts[i];

    // Order matters — most specific first.

    // 1. Parenthesized numerator: (expr) or (expr)^n / denominator
    //    e.g. (-1)^n/2^n, (n+1)/n, (x+1)^2/3
    segment = segment.replace(
      /\(([^()]+)\)((?:\^[a-zA-Z0-9]+|\^\{[^}]+\}|_[a-zA-Z0-9]+|_{[^}]+)*)\/(\d+(?:\.[0-9]+)?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|\\[a-zA-Z]+(?:\{[^}]*\})?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|[a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)/g,
      (_m: string, inner: string, scripts: string, den: string) =>
        `$\\frac{(${inner})${scripts}}{${den}}$`,
    );

    // 2. Number / number_or_var_with_scripts: 1/3^n, 2/5, 3/π
    segment = segment.replace(
      /(\d+(?:\.[0-9]+)?)\/(\d+(?:\.[0-9]+)?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|\\[a-zA-Z]+(?:\{[^}]*\})?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|[a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)/g,
      (_m: string, num: string, den: string) => `$\\frac{${num}}{${den}}$`,
    );

    // 3. Variable / number_or_var: a/b (math variables only — single letter)
    segment = segment.replace(
      /([a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)\/(\d+(?:\.[0-9]+)?(?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*|\\[a-zA-Z]+(?:\{[^}]*\})?|[a-zA-Z](?:[\^_][a-zA-Z0-9]+|[\^_]\{[^}]*\})*)/g,
      (_m: string, num: string, den: string) => `$\\frac{${num}}{${den}}$`,
    );

    parts[i] = segment;
  }

  return parts.join('');
}

// ── Main preprocessing ──────────────────────────────────────────────

/**
 * Preprocess text before LaTeX parsing:
 * 1. Convert Unicode math symbols to LaTeX (∑ → \sum, ∞ → \infty, etc.)
 * 2. Convert inline fractions (1/3^n → \frac{1}{3^n})
 * 3. Wrap bare LaTeX commands and sub/superscripts in $...$
 *
 * Skips content already inside $...$ or $$...$$.
 */
function wrapBareLatex(text: string): string {
  // Step 1: Convert Unicode math symbols
  let result = convertUnicodeMath(text);

  // Step 2: Convert inline fractions (before bare LaTeX wrapping to avoid interference)
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
      if (dollarCount % 2 === 1) continue; // inside $...$, skip

      replacements.push({ index: start, length: match[0].length, wrapped: wrapper(match[0]) });
    }

    // Apply replacements from end to start to preserve indices
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { index, length, wrapped } = replacements[i];
      result = result.substring(0, index) + wrapped + result.substring(index + length);
    }
  }

  return result;
}

// ── Segment types ────────────────────────────────────────────────────

type Segment = { type: 'text'; value: string } | { type: 'inline-math' | 'block-math'; value: string };

/**
 * Split text into text and math segments.
 * Processes $$...$$ first, then $...$ within text segments.
 */
function parseMixedContent(text: string): Segment[] {
  const segments: Segment[] = [];

  const blockParts = text.split(/(\$\$[\s\S]*?\$\$)/g);

  for (const part of blockParts) {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2).trim();
      if (math) {
        segments.push({ type: 'block-math', value: math });
      }
    } else {
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

// ── Component ────────────────────────────────────────────────────────

/**
 * Parse text for $...$ (inline) and $$...$$ (block) LaTeX delimiters,
 * rendering math segments with KaTeX and plain text as-is.
 *
 * Also detects bare LaTeX commands (e.g. \frac, \sum, u_n, x^2)
 * and auto-wraps them in $...$ before rendering.
 */
export function MathRenderer({ content, className }: MathRendererProps) {
  if (!content) return null;

  const segments = useMemo(() => {
    // Step 0: wrap bare LaTeX in $...$
    const preprocessed = wrapBareLatex(content);
    // Step 1: parse into text/math segments
    return parseMixedContent(preprocessed);
  }, [content]);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <Fragment key={i}>{seg.value}</Fragment>;
        }
        const html = katex.renderToString(seg.value, {
          displayMode: seg.type === 'block-math',
          throwOnError: false,
          strict: false,
        });
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
