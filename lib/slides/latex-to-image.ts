/**
 * LaTeX → PNG Image Renderer
 *
 * Uses MathJax 4.x to generate SVG from LaTeX, then renders the SVG
 * to PNG via @napi-rs/canvas. This replaces the fragile OMML chain
 * (temml → MathML → mathml2omml → postProcess) with a robust
 * LaTeX → SVG → PNG pipeline.
 */
import { createCanvas, Image } from '@napi-rs/canvas';
import { createLogger } from '@/lib/logger';

const log = createLogger('LatexToImage');

// ── LaTeX normalization ────────────────────────────────────────────
// LLMs frequently emit math with Unicode superscripts/subscripts and
// linear fractions (e.g. "y=ax²+bx+c=a\\left(x+(b)/(2a)\\right)²"),
// which hard-fail MathJax's TeX input. Normalize them to real TeX first.

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
};

const SUBSCRIPTS: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
};

const UNICODE_TO_TEX: Record<string, string> = {
  '−': '-',
  '×': '\\times',
  '÷': '\\div',
  '±': '\\pm',
  '≈': '\\approx',
  '≠': '\\neq',
  '≤': '\\leq',
  '≥': '\\geq',
  '→': '\\rightarrow',
  '←': '\\leftarrow',
  '⇌': '\\rightleftharpoons',
  '⇔': '\\Leftrightarrow',
  '∞': '\\infty',
  '∂': '\\partial',
  '∇': '\\nabla',
  '√': '\\sqrt',
  '°': '^{\\circ}',
  '⋅': '\\cdot',
  '·': '\\cdot',
  '∈': '\\in',
  '∉': '\\notin',
  '∪': '\\cup',
  '∩': '\\cap',
  '⊂': '\\subset',
  '⊆': '\\subseteq',
  '⊇': '\\supseteq',
  '⊥': '\\perp',
  '∥': '\\parallel',
  '∠': '\\angle',
  '∑': '\\sum',
  '∏': '\\prod',
  '∫': '\\int',
  '∝': '\\propto',
  '…': '\\dots',
  '⋯': '\\cdots',
  Δ: '\\Delta',
  α: '\\alpha',
  β: '\\beta',
  γ: '\\gamma',
  δ: '\\delta',
  ε: '\\epsilon',
  ζ: '\\zeta',
  η: '\\eta',
  θ: '\\theta',
  ι: '\\iota',
  κ: '\\kappa',
  λ: '\\lambda',
  μ: '\\mu',
  ν: '\\nu',
  ξ: '\\xi',
  π: '\\pi',
  ρ: '\\rho',
  σ: '\\sigma',
  τ: '\\tau',
  φ: '\\phi',
  χ: '\\chi',
  ψ: '\\psi',
  ω: '\\omega',
  Ω: '\\Omega',
  Σ: '\\Sigma',
  Θ: '\\Theta',
  Λ: '\\Lambda',
  Π: '\\Pi',
  Φ: '\\Phi',
  Ψ: '\\Psi',
};

/**
 * Normalize LLM-style LaTeX (Unicode sup/sub, linear fractions) into
 * standard TeX that MathJax can parse.
 */
export function normalizeLatex(latex: string): string {
  let result = latex;

  // 1. Unicode superscripts → ^{...}  (e.g. x² → x^{2}, 10⁻⁹ → 10^{-9})
  result = result.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (m) => {
    const digits = m
      .split('')
      .map((c) => SUPERSCRIPTS[c])
      .join('');
    return `^{${digits}}`;
  });
  // 2. Unicode subscripts → _{...}   (e.g. CO₂ → CO_{2})
  result = result.replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, (m) => {
    const digits = m
      .split('')
      .map((c) => SUBSCRIPTS[c])
      .join('');
    return `_{${digits}}`;
  });

  // 3. Unicode math symbols → TeX commands.
  //    Commands ending in a letter get a separating space when the next
  //    char is a letter too, so "a×b" becomes "a\times b" — without it
  //    TeX parses "\timesb" as one undefined command. "Δ=b²" stays
  //    "\Delta=b^{2}" because the following "=" needs no separator.
  const symbolKeys = Object.keys(UNICODE_TO_TEX)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('');
  result = result.replace(new RegExp(`[${symbolKeys}]`, 'g'), (m, _offset, str) => {
    const tex = UNICODE_TO_TEX[m];
    const next = str[_offset + m.length] ?? '';
    const sep = /[a-zA-Z]$/.test(tex) && /[a-zA-Z]/.test(next) ? ' ' : '';
    return tex + sep;
  });

  // 4. Linear fractions → \frac
  //    LLMs write "(a+b)/(c+d)" (both sides parenthesized) or "(a)/b".
  //    Skip when preceded by a letter/digit/brace so "f(x)/(2)" is untouched.
  result = result.replace(/(?<![\w)}\^])\(([^()\s]+)\)\/\(([^()\s]+)\)/g, '\\frac{$1}{$2}');
  result = result.replace(/(?<![\w)}\^])\(([^()\s]+)\)\/([^()\s]+)/g, '\\frac{$1}{$2}');

  return result;
}

// ── MathJax singleton ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mathJaxInstance: any = null;

async function getMathJax() {
  if (mathJaxInstance) return mathJaxInstance;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — mathjax has no bundled types
  const mathjax: any = await import('mathjax');
  const mj = await mathjax.init({
    loader: { load: ['input/tex', 'output/svg'] },
    tex: {
      packages: ['base', 'ams'],
      // Treat unrecognized Unicode chars in math mode as text instead of
      // throwing — belt-and-braces for chars normalizeLatex may miss.
      unicodeTextInMathMode: true,
    },
  });

  mathJaxInstance = mj;
  log.info('MathJax initialized for SVG rendering');
  return mathJaxInstance;
}

// ── SVG → PNG ─────────────────────────────────────────────────────

const EX_TO_PX_SCALE = 14; // scale factor: 1ex ≈ 14px at default font size

export interface RenderedFormula {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Render a LaTeX string to a PNG buffer.
 *
 * @param latex   Raw LaTeX source (ASCII, not Unicode)
 * @param options scale: multiplier for default size (default 1.0)
 *                bgColor: background color hex (default 'FFFFFF')
 */
export async function renderLatexToPng(
  latex: string,
  options: { scale?: number; bgColor?: string } = {},
): Promise<RenderedFormula | null> {
  const { scale = 1.0, bgColor = 'FFFFFF' } = options;

  try {
    const MathJax = await getMathJax();
    // Normalize LLM-style math (Unicode sup/sub, linear fractions) before
    // handing to MathJax — raw Unicode superscripts hard-fail TeX input.
    const normalized = normalizeLatex(latex);
    const svgNode = MathJax.tex2svg(normalized, { display: true });
    const svgString = MathJax.startup.adaptor.innerHTML(svgNode);

    // Parse SVG dimensions (in ex units)
    const widthMatch = svgString.match(/width="([0-9.]+)ex"/);
    const heightMatch = svgString.match(/height="([0-9.]+)ex"/);

    if (!widthMatch || !heightMatch) {
      log.warn('MathJax SVG missing dimensions');
      return null;
    }

    const widthEx = parseFloat(widthMatch[1]);
    const heightEx = parseFloat(heightMatch[1]);

    const widthPx = Math.max(16, Math.ceil(widthEx * EX_TO_PX_SCALE * scale));
    const heightPx = Math.max(16, Math.ceil(heightEx * EX_TO_PX_SCALE * scale));

    // Replace ex dimensions with px for canvas rendering
    const resizedSvg = svgString
      .replace(/width="[0-9.]+ex"/, `width="${widthPx}px"`)
      .replace(/height="[0-9.]+ex"/, `height="${heightPx}px"`);

    const canvas = createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = `#${bgColor}`;
    ctx.fillRect(0, 0, widthPx, heightPx);

    // Draw SVG onto canvas
    const img = new Image();
    img.src = Buffer.from(resizedSvg);

    // Synchronous drawImage after brief delay to ensure Image is parsed
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        try {
          ctx.drawImage(img, 0, 0, widthPx, heightPx);
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 50);
      img.onerror = (err) => {
        clearTimeout(timeout);
        reject(new Error(String(err)));
      };
    });

    const pngBuffer = canvas.toBuffer('image/png');
    return { buffer: pngBuffer, width: widthPx, height: heightPx };
  } catch (err) {
    log.warn(`LaTeX to PNG failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
