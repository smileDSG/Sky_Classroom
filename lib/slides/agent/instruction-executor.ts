/**
 * InstructionExecutor — executes JSON instruction sequences against pptxgenjs.
 *
 * Each page's renderCode is a sequence of { op, params } objects.
 * This executor validates params, translates ops to pptxgenjs calls,
 * and handles errors gracefully (single instruction failure does not crash the page).
 */
import pptxgen from 'pptxgenjs';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { convertInlineLatexToUnicode } from './content-schemas';
import { renderLatexToPng } from '../latex-to-image';

const log = createLogger('InstructionExecutor');
type PptxSlide = ReturnType<pptxgen['addSlide']>;

// ── Instruction Schemas ────────────────────────────────────────────

const setBackgroundSchema = z.object({
  op: z.literal('setBackground'),
  params: z.object({
    color: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
    path: z.string().optional(),
  }),
});

const addTextSchema = z.object({
  op: z.literal('addText'),
  params: z.object({
    text: z.string(),
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    fontSize: z.number().optional(),
    fontFace: z.string().optional(),
    color: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    valign: z.enum(['top', 'middle', 'bottom']).optional(),
    charSpacing: z.number().optional(),
    margin: z.number().optional(),
  }),
});

const addShapeSchema = z.object({
  op: z.literal('addShape'),
  params: z.object({
    type: z.enum(['RECTANGLE', 'OVAL', 'LINE', 'ROUNDED_RECTANGLE']),
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    fillColor: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
    fillTransparency: z.number().min(0).max(100).optional(),
    lineColor: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
    lineWidth: z.number().optional(),
    rotate: z.number().optional(),
    rectRadius: z.number().optional(),
    shadow: z.union([
      z.boolean(),
      z.object({
        type: z.enum(['outer', 'inner']),
        color: z.string().regex(/^#?[0-9A-Fa-f]{6}$/),
        blur: z.number(), offset: z.number(), angle: z.number(), opacity: z.number(),
      }),
    ]).optional(),
  }),
});

const addImageSchema = z.object({
  op: z.literal('addImage'),
  params: z.object({
    data: z.string().optional(),
    path: z.string().optional(),
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    transparency: z.number().min(0).max(100).optional(),
    rounding: z.boolean().optional(),
  }),
});

const addTableSchema = z.object({
  op: z.literal('addTable'),
  params: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
    x: z.number(), y: z.number(), w: z.number(),
    headerColor: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
    headerBgColor: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
    borderColor: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
    altRowBgColor: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
    fontSize: z.number().optional(),
    fontFace: z.string().optional(),
    textColor: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
  }),
});

const addFormulaSchema = z.object({
  op: z.literal('addFormula'),
  params: z.object({
    latex: z.string(),
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    fontSize: z.number().optional(),
    color: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
  }),
});

const addChartSchema = z.object({
  op: z.literal('addChart'),
  params: z.object({
    chartType: z.enum(['BAR', 'LINE', 'PIE']),
    data: z.array(z.object({
      name: z.string(),
      labels: z.array(z.string()),
      values: z.array(z.number()),
    })),
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    barDir: z.enum(['col', 'bar']).optional(),
    showTitle: z.boolean().optional(),
    title: z.string().optional(),
    showLegend: z.boolean().optional(),
    chartColors: z.array(z.string()).optional(),
  }),
});

const instructionSchema = z.discriminatedUnion('op', [
  setBackgroundSchema,
  addTextSchema,
  addShapeSchema,
  addImageSchema,
  addTableSchema,
  addChartSchema,
  addFormulaSchema,
]);

export type Instruction = z.infer<typeof instructionSchema>;

export const pageInstructionsSchema = z.object({
  pageNum: z.number(),
  instructions: z.array(instructionSchema),
});

export type PageInstructions = z.infer<typeof pageInstructionsSchema>;

// ── Executor ────────────────────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean;
  errors: Array<{ opIndex: number; op: string; error: string }>;
  slideIndex: number;
  /** Formula registry for preview synthesis (OMML in PPTX, vector overlay in preview) */
  formulas?: Array<{
    pageNum: number;
    latex: string;
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize?: number;
    color?: string;
  }>;
}

function hex(c: string): string {
  return c.startsWith('#') ? c.slice(1) : c;
}

/**
 * Sanitize LaTeX commands that leaked into plain text (not wrapped in $...$).
 * Converts common commands to Unicode and strips orphaned backslashes.
 */
function sanitizePlainTextLatex(text: string): string {
  const latexCmdMap: Record<string, string> = {
    '\\Delta': 'Δ', '\\delta': 'δ', '\\alpha': 'α', '\\beta': 'β',
    '\\gamma': 'γ', '\\Gamma': 'Γ', '\\pi': 'π', '\\theta': 'θ',
    '\\lambda': 'λ', '\\mu': 'μ', '\\sigma': 'σ', '\\Sigma': 'Σ',
    '\\omega': 'ω', '\\Omega': 'Ω', '\\phi': 'φ', '\\Phi': 'Φ',
    '\\psi': 'ψ', '\\Psi': 'Ψ', '\\rho': 'ρ', '\\tau': 'τ',
    '\\eta': 'η', '\\epsilon': 'ε', '\\varepsilon': 'ε',
    '\\kappa': 'κ', '\\chi': 'χ', '\\nu': 'ν', '\\xi': 'ξ', '\\zeta': 'ζ',
    '\\approx': '≈', '\\rightarrow': '→', '\\to': '→',
    '\\leftarrow': '←', '\\leftrightarrow': '↔',
    '\\leq': '≤', '\\geq': '≥', '\\pm': '±', '\\mp': '∓',
    '\\times': '×', '\\div': '÷', '\\cdot': '·',
    '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
    '\\sqrt': '√', '\\int': '∫', '\\sum': '∑', '\\prod': '∏',
    '\\ln': 'ln', '\\log': 'log', '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan',
    '\\circ': '°', '\\degree': '°',
    '\\neq': '≠', '\\equiv': '≡', '\\sim': '∼', '\\propto': '∝',
    '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\subseteq': '⊆',
    '\\cup': '∪', '\\cap': '∩', '\\emptyset': '∅',
    '\\forall': '∀', '\\exists': '∃', '\\neg': '¬',
    '\\wedge': '∧', '\\vee': '∨', '\\Rightarrow': '⇒', '\\Leftrightarrow': '⇔',
    '\\rightleftharpoons': '⇌', '\\longrightarrow': '→',
    '\\perp': '⊥', '\\parallel': '∥', '\\angle': '∠',
    '\\pmatrix': '', '\\matrix': '', '\\bmatrix': '', '\\vmatrix': '',
    '\\begin': '', '\\end': '',
  };

  let result = text;
  // Sort by length desc to avoid partial matches (e.g. \delta before \Delta)
  const cmds = Object.keys(latexCmdMap).sort((a, b) => b.length - a.length);
  for (const cmd of cmds) {
    // Use split/join to avoid RegExp escaping issues with backslashes
    result = result.split(cmd).join(latexCmdMap[cmd]);
  }

  // Convert \frac{a}{b} → a/b  (preserving nested braces roughly)
  result = result.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2');
  // Convert \sqrt{x} → √x, \sqrt[n]{x} → ⁿ√x
  result = result.replace(/\\sqrt\[(\d+)\]\{([^{}]*)\}/g, '$1√$2');
  result = result.replace(/\\sqrt\{([^{}]*)\}/g, '√$1');
  // Convert simple subscripts a_b → aᵥ (if b is single digit/letter)
  result = result.replace(/_([0-9a-zA-Z])/g, (_, ch) => {
    const subMap: Record<string, string> = {
      '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
      'a':'ₐ','e':'ₑ','h':'ₕ','i':'ᵢ','j':'ⱼ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ','o':'ₒ','p':'ₚ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ','x':'ₓ',
    };
    return subMap[ch] || '_' + ch;
  });
  // Convert simple superscripts a^b → aᵇ (if b is single digit/letter)
  result = result.replace(/\^([0-9a-zA-Z+-])/g, (_, ch) => {
    const supMap: Record<string, string> = {
      '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
      'a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','i':'ⁱ','j':'ʲ','k':'ᵏ','l':'ˡ','m':'ᵐ','n':'ⁿ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ','t':'ᵗ','u':'ᵘ','v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ',
      '+':'⁺','-':'⁻',
    };
    return supMap[ch] || '^' + ch;
  });
  // Convert _{...} and ^{...} with braces (simple cases)
  result = result.replace(/_\{([0-9]+)\}/g, (_, num) => num.split('').map((d: string) => {
    const subDigits: Record<string, string> = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };
    return subDigits[d] || d;
  }).join(''));
  result = result.replace(/\^\{([0-9+-]+)\}/g, (_, num) => num.split('').map((d: string) => {
    const supDigits: Record<string, string> = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻' };
    return supDigits[d] || d;
  }).join(''));

  // Strip remaining orphaned backslashes (\word → word, \\ → \, \! → !)
  result = result.replace(/\\([a-zA-Z]+)/g, '$1');
  result = result.replace(/\\([^a-zA-Z])/g, '$1');

  // Clean up extra braces left behind
  result = result.replace(/\{\}/g, '');
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

function isSafePath(p: string): boolean {
  if (p.startsWith('http://') || p.startsWith('https://')) return true;
  if (p.includes('..')) return false;
  if (!p.startsWith('/')) return false;
  return true;
}

/** Clamp instructions so no element overflows the 13.33" × 7.5" slide bounds. */
function clampInstructionsToSlide(instructions: Instruction[]): Instruction[] {
  const SLIDE_W = 13.33;
  const SLIDE_H = 7.5;
  const MIN_MARGIN = 0.3;
  const clamped: Instruction[] = [];
  let maxBottom = 0;
  for (const inst of instructions) {
    if (!inst || !inst.params) { clamped.push(inst); continue; }
    const p = inst.params as Record<string, unknown>;
    if (typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.w !== 'number' || typeof p.h !== 'number') {
      clamped.push(inst);
      continue;
    }
    const x = p.x as number;
    const y = p.y as number;
    const w = p.w as number;
    const h = p.h as number;
    const bottom = y + h;
    const right = x + w;
    if (bottom > maxBottom) maxBottom = bottom;
    // If element is completely off-slide, skip it
    if (y >= SLIDE_H || x >= SLIDE_W) {
      log.warn(`Skipped off-slide element: op=${inst.op} y=${y.toFixed(2)} h=${h.toFixed(2)} (slide H=${SLIDE_H})`);
      continue;
    }
    // Clamp width/height so they don't overflow
    const newW = Math.min(w, Math.max(0.5, SLIDE_W - x - MIN_MARGIN));
    const newH = Math.min(h, Math.max(0.3, SLIDE_H - y - MIN_MARGIN));
    if (newW !== w || newH !== h) {
      clamped.push({ ...inst, params: { ...p, w: newW, h: newH } } as Instruction);
    } else {
      clamped.push(inst);
    }
  }
  if (maxBottom > SLIDE_H) {
    log.warn(`Page has content overflowing bottom: maxBottom=${maxBottom.toFixed(2)} > slideH=${SLIDE_H}`);
  }
  return clamped;
}

export class InstructionExecutor {
  execute(
    slide: PptxSlide,
    pres: pptxgen,
    instructions: Instruction[],
    pageNum: number,
  ): Promise<ExecutionResult> {
    const errors: ExecutionResult['errors'] = [];
    const formulas: NonNullable<ExecutionResult['formulas']> = [];

    // Pre-flight: clamp all elements to slide bounds to prevent off-slide rendering
    const safeInstructions = clampInstructionsToSlide(instructions);

    for (let i = 0; i < safeInstructions.length; i++) {
      const inst = safeInstructions[i];
      try {
        // Validate
        const parsed = instructionSchema.safeParse(inst);
        if (!parsed.success) {
          errors.push({ opIndex: i, op: String(inst.op || 'unknown'), error: `Schema: ${parsed.error.message.slice(0, 100)}` });
          continue;
        }

        const { op, params } = parsed.data;

        switch (op) {
          case 'setBackground': {
            if (params.color) slide.background = { color: hex(params.color) };
            else if (params.path) {
              if (!isSafePath(params.path)) {
                errors.push({ opIndex: i, op: 'setBackground', error: 'Invalid path (traversal or unsafe protocol)' });
                break;
              }
              slide.background = { path: params.path };
            }
            break;
          }
          case 'addText': {
            const trimmed = params.text.trim();
            // Filter out orphaned arrow symbols (process step connectors without labels)
            if (trimmed === '→' || trimmed === '->' || trimmed === '←' || trimmed === '<-' || trimmed === '↔') {
              log.warn(`Filtered orphaned arrow at instruction ${i} (page ${pageNum})`);
              break;
            }
            // Filter out placeholder text that should have been addFormula
            // Match [Formula], [formula], 【公式】 and variants with whitespace/newlines
            if (/^\s*[\[(【]\s*[Ff]ormula\s*[\])】]\s*$/.test(trimmed) || /^\s*【\s*公式\s*】\s*$/.test(trimmed)) {
              log.warn(`Filtered [Formula] placeholder at instruction ${i} (page ${pageNum})`);
              break;
            }
            // Replace placeholder in mixed text and record warning
            const placeholderPattern = /[\[(【]\s*[Ff]ormula\s*[\])】]/g;
            const cnPlaceholderPattern = /【\s*公式\s*】/g;
            let displayText = params.text;
            let hadPlaceholder = false;
            if (placeholderPattern.test(displayText) || cnPlaceholderPattern.test(displayText)) {
              hadPlaceholder = true;
              displayText = displayText.replace(placeholderPattern, '（公式）').replace(cnPlaceholderPattern, '（公式）');
              log.warn(`Replaced placeholder in mixed text at instruction ${i} (page ${pageNum}): "${params.text.slice(0, 60)}..." → "${displayText.slice(0, 60)}..."`);
            }
            // Filter out design hints that leaked from LLM prompts
            const designHintPatterns = [
              /^章节封面页[。，.]/,
              /^使用一个.*示意图/,
              /^激发学习者.*好奇心/,
              /^标题醒目/,
              /^副标题可点明/,
            ];
            let isDesignHint = false;
            for (const pattern of designHintPatterns) {
              if (pattern.test(trimmed)) {
                log.warn(`Filtered design hint text at instruction ${i} (page ${pageNum}): ${trimmed.slice(0, 50)}...`);
                isDesignHint = true;
                break;
              }
            }
            if (isDesignHint) break;
            // Sanitize LaTeX that leaked into plain text (e.g. \Delta G, \ln K)
            displayText = convertInlineLatexToUnicode(displayText);
            displayText = sanitizePlainTextLatex(displayText);

            // Auto-detect bullet lists: split lines starting with • or - into separate paragraphs
            const bulletMatch = displayText.match(/^[\s]*[•\-][\s]/m);
            if (bulletMatch) {
              const lines = displayText.split(/\n|(?:[•\-][\s])/g).filter((s) => s.trim().length > 0);
              const bulletItems = lines.map((line) => {
                const clean = line.replace(/^[\s•\-]+/, '').trim();
                return { text: clean, options: { bullet: true } };
              }).filter((item) => item.text.length > 0);
              if (bulletItems.length > 1) {
                slide.addText(bulletItems, {
                  x: params.x, y: params.y, w: params.w, h: params.h,
                  fontSize: params.fontSize ?? 14,
                  fontFace: params.fontFace ?? 'Microsoft YaHei',
                  color: params.color ? hex(params.color) : '475569',
                  bold: params.bold,
                  italic: params.italic,
                  align: params.align ?? 'left',
                  valign: params.valign,
                  charSpacing: params.charSpacing,
                  margin: params.margin,
                });
                break;
              }
            }

            slide.addText(displayText, {
              x: params.x, y: params.y, w: params.w, h: params.h,
              fontSize: params.fontSize ?? 14,
              fontFace: params.fontFace ?? 'Microsoft YaHei',
              color: params.color ? hex(params.color) : '475569',
              bold: params.bold,
              italic: params.italic,
              align: params.align ?? 'left',
              valign: params.valign,
              charSpacing: params.charSpacing,
              margin: params.margin,
            });
            break;
          }
          case 'addShape': {
            const shapeOpts: Record<string, unknown> = {
              x: params.x, y: params.y, w: params.w, h: params.h,
            };
            if (params.fillColor) {
              shapeOpts.fill = { color: hex(params.fillColor), transparency: params.fillTransparency ?? 0 };
            }
            if (params.lineColor) {
              shapeOpts.line = { color: hex(params.lineColor), width: params.lineWidth ?? 1 };
            }
            // If the shape has neither fill nor line, it would be invisible
            // and only pollute the slide object model. Skip it.
            if (!params.fillColor && !params.lineColor) {
              break;
            }
            if (params.rotate !== undefined) shapeOpts.rotate = params.rotate;
            if (params.type === 'ROUNDED_RECTANGLE') shapeOpts.rectRadius = params.rectRadius ?? 0.1;
            if (params.shadow) {
              if (params.shadow === true) {
                shapeOpts.shadow = { type: 'outer', color: '808080', blur: 3, offset: 2, angle: 45, opacity: 0.3 };
              } else {
                shapeOpts.shadow = params.shadow;
              }
            }

            slide.addShape((pres as unknown as { shapes: Record<string, unknown> }).shapes[params.type] as never, shapeOpts as never);
            break;
          }
          case 'addImage': {
            const imgOpts: Record<string, unknown> = {
              x: params.x, y: params.y, w: params.w, h: params.h,
              transparency: params.transparency,
              rounding: params.rounding,
            };
            if (params.data) imgOpts.data = params.data;
            else if (params.path) {
              if (!isSafePath(params.path)) {
                errors.push({ opIndex: i, op: 'addImage', error: 'Invalid path (traversal or unsafe protocol)' });
                break;
              }
              imgOpts.path = params.path;
            }
            else break;
            slide.addImage(imgOpts as never);
            break;
          }
          case 'addTable': {
            const { headers, rows, x, y, w, headerColor, headerBgColor, borderColor, altRowBgColor, fontSize: requestedFontSize, fontFace, textColor } = params;
            const headerBg = headerBgColor ?? '1E293B';
            const headerTxt = headerColor ?? 'FFFFFF';
            const borderC = borderColor ?? 'E2E8F0';
            const altBg = altRowBgColor ?? 'F8FAFC';
            const txtC = textColor ?? '1E293B';

            const colCount = Math.max(headers.length, ...rows.map((r) => r.length));

            // ── Smart table layout: dynamic font, column width, row height ──
            function calculateLayout(baseFontSize?: number): { fontSize: number; colW: number[]; rowH: number[] } {
              const fontSize = baseFontSize ?? Math.max(8, 14 - colCount);

              // 1. Column widths: proportional to max content length, with minimum width
              const colMaxChars: number[] = Array(colCount).fill(0);
              for (let ci = 0; ci < colCount; ci++) {
                colMaxChars[ci] = Math.max(colMaxChars[ci], (headers[ci] || '').length);
                for (const row of rows) {
                  colMaxChars[ci] = Math.max(colMaxChars[ci], (row[ci] || '').length);
                }
              }
              const totalChars = colMaxChars.reduce((a, b) => a + b, 0) || colCount;
              const minColW = 0.7;
              let colW = colMaxChars.map(c => {
                const ratio = c / totalChars;
                return Math.max(ratio * w, minColW);
              });
              const actualTotal = colW.reduce((a, b) => a + b, 0);
              colW = colW.map(cw => (cw / actualTotal) * w);

              // 2. Row heights: estimate lines needed per cell
              const charsPerInch = 58 / fontSize; // rough estimate for Chinese chars
              const lineH = 0.016 * fontSize + 0.05;
              const padding = 0.08;
              const rowH: number[] = [];

              // Header row
              let headerMaxLines = 1;
              for (let ci = 0; ci < colCount; ci++) {
                const lines = Math.ceil((headers[ci] || '').length / Math.max(1, colW[ci] * charsPerInch));
                headerMaxLines = Math.max(headerMaxLines, lines);
              }
              rowH.push(Math.max(0.35, padding + headerMaxLines * lineH));

              // Data rows
              for (const row of rows) {
                let maxLines = 1;
                for (let ci = 0; ci < colCount; ci++) {
                  const lines = Math.ceil((row[ci] || '').length / Math.max(1, colW[ci] * charsPerInch));
                  maxLines = Math.max(maxLines, lines);
                }
                rowH.push(Math.max(0.3, padding + maxLines * lineH));
              }

              // 3. If total height exceeds slide, shrink font and recalculate
              const totalHeight = rowH.reduce((a, b) => a + b, 0);
              const maxBottom = 6.8;
              if (y + totalHeight > maxBottom && fontSize > 8) {
                return calculateLayout(fontSize - 1);
              }

              return { fontSize, colW, rowH };
            }

            const { fontSize, colW, rowH } = calculateLayout(requestedFontSize);

            const headerRow = headers.map((h) => ({
              text: h,
              options: {
                fill: { color: hex(headerBg) },
                color: hex(headerTxt),
                bold: true,
                fontSize,
                fontFace: fontFace ?? 'Microsoft YaHei',
                align: 'center' as const,
                valign: 'middle' as const,
              },
            }));

            const dataRows = rows.map((row, ri) =>
              row.map((cell) => ({
                text: cell || '—',
                options: {
                  fill: { color: ri % 2 === 1 ? hex(altBg) : 'FFFFFF' },
                  color: hex(txtC),
                  fontSize,
                  fontFace: fontFace ?? 'Microsoft YaHei',
                  align: 'center' as const,
                  valign: 'middle' as const,
                  wrap: true,
                },
              }))
            );

            slide.addTable([headerRow, ...dataRows] as never, {
              x, y, w,
              colW,
              rowH,
              border: { pt: 0.5, color: hex(borderC) },
              autoPage: false,
            } as never);
            break;
          }
          case 'addChart': {
            const chartData = params.data.map((d) => ({
              name: d.name,
              labels: d.labels,
              values: d.values,
            }));

            slide.addChart((pres as unknown as { charts: Record<string, unknown> }).charts[params.chartType] as never, chartData as never, {
              x: params.x, y: params.y, w: params.w, h: params.h,
              barDir: params.barDir ?? 'col',
              showTitle: params.showTitle,
              title: params.title,
              showLegend: params.showLegend,
              chartColors: params.chartColors,
            } as never);
            break;
          }
          case 'addFormula': {
            // Register formula for preview synthesis (regardless of render method)
            formulas.push({
              pageNum,
              latex: params.latex,
              x: params.x,
              y: params.y,
              w: params.w,
              h: params.h,
              fontSize: params.fontSize,
              color: params.color,
            });

            // 1st try: OMML (native PowerPoint formula, editable, scales, Chinese OK)
            try {
              const { latexToOmml } = await import('@/lib/export/latex-to-omml');
              const omml = latexToOmml(params.latex, params.fontSize);
              if (omml) {
                (slide as unknown as { addFormula: (opts: Record<string, unknown>) => void }).addFormula({
                  x: params.x, y: params.y, w: params.w, h: params.h,
                  omml,
                  color: params.color ? hex(params.color) : '1E293B',
                  align: params.align ?? 'center',
                });
                break; // OMML success
              }
            } catch (ommlErr) {
              log.warn(`OMML formula failed on page ${pageNum}, falling back to PNG: ${ommlErr instanceof Error ? ommlErr.message : String(ommlErr)}`);
            }

            // 2nd try: PNG image (for formulas OMML cannot handle)
            try {
              const rendered = await renderLatexToPng(params.latex, {
                scale: (params.fontSize ?? 14) / 14,
              });
              if (rendered) {
                const base64 = `data:image/png;base64,${rendered.buffer.toString('base64')}`;
                slide.addImage({
                  data: base64,
                  x: params.x, y: params.y, w: params.w, h: params.h,
                });
                break; // PNG success
              }
            } catch (pngErr) {
              log.warn(`PNG formula fallback failed on page ${pageNum}: ${pngErr instanceof Error ? pngErr.message : String(pngErr)}`);
            }

            // 3rd try: Unicode plain text (last resort)
            const fallbackText = sanitizePlainTextLatex(convertInlineLatexToUnicode(params.latex));
            slide.addText(fallbackText, {
              x: params.x, y: params.y, w: params.w, h: params.h,
              fontSize: params.fontSize ?? 14,
              fontFace: 'KaTeX_Main, Times New Roman, serif',
              color: params.color ? hex(params.color) : '1E293B',
              align: params.align ?? 'center',
            });
            break;
          }
          default:
            errors.push({ opIndex: i, op: String(op), error: `Unknown op: ${op}` });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ opIndex: i, op: String(inst.op || 'unknown'), error: msg });
        log.warn(`[Page ${pageNum}] Instruction ${i} (${inst.op}) failed: ${msg}`);
      }
    }

    return { success: errors.length === 0, errors, slideIndex: pageNum, formulas };
  }
}

// Singleton for reuse
export const instructionExecutor = new InstructionExecutor();
