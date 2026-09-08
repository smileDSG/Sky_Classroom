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
import { latexToOmml } from '@/lib/export/latex-to-omml';
import { convertInlineLatexToUnicode } from './content-schemas';

const log = createLogger('InstructionExecutor');
type PptxSlide = ReturnType<pptxgen['addSlide']>;

// ── Instruction Schemas ────────────────────────────────────────────

const setBackgroundSchema = z.object({
  op: z.literal('setBackground'),
  params: z.object({
    color: z
      .string()
      .regex(/^#?[0-9A-Fa-f]{6}$/)
      .optional(),
    path: z.string().optional(),
  }),
});

const addTextSchema = z.object({
  op: z.literal('addText'),
  params: z.object({
    text: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    fontSize: z.number().optional(),
    fontFace: z.string().optional(),
    color: z
      .string()
      .regex(/^#?[0-9A-Fa-f]{6}$/)
      .optional(),
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
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    fillColor: z
      .string()
      .regex(/^#?[0-9A-Fa-f]{6}$/)
      .optional(),
    fillTransparency: z.number().min(0).max(100).optional(),
    lineColor: z
      .string()
      .regex(/^#?[0-9A-Fa-f]{6}$/)
      .optional(),
    lineWidth: z.number().optional(),
    rotate: z.number().optional(),
    rectRadius: z.number().optional(),
    shadow: z
      .object({
        type: z.enum(['outer', 'inner']),
        color: z.string().regex(/^#?[0-9A-Fa-f]{6}$/),
        blur: z.number(),
        offset: z.number(),
        angle: z.number(),
        opacity: z.number(),
      })
      .optional(),
  }),
});

const addImageSchema = z.object({
  op: z.literal('addImage'),
  params: z.object({
    data: z.string().optional(),
    path: z.string().optional(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    transparency: z.number().min(0).max(100).optional(),
    rounding: z.boolean().optional(),
  }),
});

const addTableSchema = z.object({
  op: z.literal('addTable'),
  params: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    headerColor: z
      .string()
      .regex(/^#?[0-9A-Fa-f]{6}$/)
      .optional(),
    headerBgColor: z
      .string()
      .regex(/^#?[0-9A-Fa-f]{6}$/)
      .optional(),
    borderColor: z
      .string()
      .regex(/^#?[0-9A-Fa-f]{6}$/)
      .optional(),
    altRowBgColor: z
      .string()
      .regex(/^#?[0-9A-Fa-f]{6}$/)
      .optional(),
    fontSize: z.number().optional(),
    fontFace: z.string().optional(),
    textColor: z
      .string()
      .regex(/^#?[0-9A-Fa-f]{6}$/)
      .optional(),
  }),
});

const addFormulaSchema = z.object({
  op: z.literal('addFormula'),
  params: z.object({
    latex: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    fontSize: z.number().optional(),
    color: z
      .string()
      .regex(/^#?[0-9A-Fa-f]{6}$/)
      .optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
  }),
});

const addChartSchema = z.object({
  op: z.literal('addChart'),
  params: z.object({
    chartType: z.enum(['BAR', 'LINE', 'PIE']),
    data: z.array(
      z.object({
        name: z.string(),
        labels: z.array(z.string()),
        values: z.array(z.number()),
      }),
    ),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
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
    '\\Delta': 'Δ',
    '\\delta': 'δ',
    '\\alpha': 'α',
    '\\beta': 'β',
    '\\gamma': 'γ',
    '\\Gamma': 'Γ',
    '\\pi': 'π',
    '\\theta': 'θ',
    '\\lambda': 'λ',
    '\\mu': 'μ',
    '\\sigma': 'σ',
    '\\Sigma': 'Σ',
    '\\omega': 'ω',
    '\\Omega': 'Ω',
    '\\phi': 'φ',
    '\\Phi': 'Φ',
    '\\psi': 'ψ',
    '\\Psi': 'Ψ',
    '\\rho': 'ρ',
    '\\tau': 'τ',
    '\\eta': 'η',
    '\\epsilon': 'ε',
    '\\varepsilon': 'ε',
    '\\kappa': 'κ',
    '\\chi': 'χ',
    '\\nu': 'ν',
    '\\xi': 'ξ',
    '\\zeta': 'ζ',
    '\\approx': '≈',
    '\\rightarrow': '→',
    '\\to': '→',
    '\\leftarrow': '←',
    '\\leftrightarrow': '↔',
    '\\leq': '≤',
    '\\geq': '≥',
    '\\pm': '±',
    '\\times': '×',
    '\\div': '÷',
    '\\cdot': '·',
    '\\infty': '∞',
    '\\partial': '∂',
    '\\nabla': '∇',
    '\\sqrt': '√',
    '\\int': '∫',
    '\\sum': '∑',
    '\\prod': '∏',
    '\\ln': 'ln',
    '\\log': 'log',
    '\\sin': 'sin',
    '\\cos': 'cos',
    '\\tan': 'tan',
    '\\circ': '°',
    '\\degree': '°',
  };

  let result = text;
  // Sort by length desc to avoid partial matches (e.g. \delta before \Delta)
  const cmds = Object.keys(latexCmdMap).sort((a, b) => b.length - a.length);
  for (const cmd of cmds) {
    // Use split/join to avoid RegExp escaping issues with backslashes
    result = result.split(cmd).join(latexCmdMap[cmd]);
  }

  // Strip remaining orphaned backslashes (\word → word, \\ → \, \! → !)
  result = result.replace(/\\([a-zA-Z]+)/g, '$1');
  result = result.replace(/\\([^a-zA-Z])/g, '$1');

  return result;
}

function isSafePath(p: string): boolean {
  if (p.startsWith('http://') || p.startsWith('https://')) return true;
  if (p.includes('..')) return false;
  if (!p.startsWith('/')) return false;
  return true;
}

export class InstructionExecutor {
  execute(
    slide: PptxSlide,
    pres: pptxgen,
    instructions: Instruction[],
    pageNum: number,
  ): ExecutionResult {
    const errors: ExecutionResult['errors'] = [];

    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i];
      try {
        // Validate
        const parsed = instructionSchema.safeParse(inst);
        if (!parsed.success) {
          errors.push({
            opIndex: i,
            op: String(inst.op || 'unknown'),
            error: `Schema: ${parsed.error.message.slice(0, 100)}`,
          });
          continue;
        }

        const { op, params } = parsed.data;

        switch (op) {
          case 'setBackground': {
            if (params.color) slide.background = { color: hex(params.color) };
            else if (params.path) {
              if (!isSafePath(params.path)) {
                errors.push({
                  opIndex: i,
                  op: 'setBackground',
                  error: 'Invalid path (traversal or unsafe protocol)',
                });
                break;
              }
              slide.background = { path: params.path };
            }
            break;
          }
          case 'addText': {
            const trimmed = params.text.trim();
            // Filter out orphaned arrow symbols (process step connectors without labels)
            if (
              trimmed === '→' ||
              trimmed === '->' ||
              trimmed === '←' ||
              trimmed === '<-' ||
              trimmed === '↔'
            ) {
              log.warn(`Filtered orphaned arrow at instruction ${i} (page ${pageNum})`);
              break;
            }
            // Filter out placeholder text that should have been addFormula
            if (trimmed === '[Formula]' || trimmed === '[formula]' || trimmed === '【公式】') {
              log.warn(`Filtered [Formula] placeholder at instruction ${i} (page ${pageNum})`);
              break;
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
                log.warn(
                  `Filtered design hint text at instruction ${i} (page ${pageNum}): ${trimmed.slice(0, 50)}...`,
                );
                isDesignHint = true;
                break;
              }
            }
            if (isDesignHint) break;
            // Sanitize LaTeX that leaked into plain text (e.g. \Delta G, \ln K)
            let displayText = convertInlineLatexToUnicode(params.text);
            displayText = sanitizePlainTextLatex(displayText);
            slide.addText(displayText, {
              x: params.x,
              y: params.y,
              w: params.w,
              h: params.h,
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
              x: params.x,
              y: params.y,
              w: params.w,
              h: params.h,
            };
            if (params.fillColor) {
              shapeOpts.fill = {
                color: hex(params.fillColor),
                transparency: params.fillTransparency ?? 0,
              };
            }
            if (params.lineColor) {
              shapeOpts.line = { color: hex(params.lineColor), width: params.lineWidth ?? 1 };
            }
            if (params.rotate !== undefined) shapeOpts.rotate = params.rotate;
            if (params.type === 'ROUNDED_RECTANGLE')
              shapeOpts.rectRadius = params.rectRadius ?? 0.1;
            if (params.shadow) shapeOpts.shadow = params.shadow;

            slide.addShape(
              (pres as unknown as { shapes: Record<string, unknown> }).shapes[params.type] as never,
              shapeOpts as never,
            );
            break;
          }
          case 'addImage': {
            const imgOpts: Record<string, unknown> = {
              x: params.x,
              y: params.y,
              w: params.w,
              h: params.h,
              transparency: params.transparency,
              rounding: params.rounding,
            };
            if (params.data) imgOpts.data = params.data;
            else if (params.path) {
              if (!isSafePath(params.path)) {
                errors.push({
                  opIndex: i,
                  op: 'addImage',
                  error: 'Invalid path (traversal or unsafe protocol)',
                });
                break;
              }
              imgOpts.path = params.path;
            } else break;
            slide.addImage(imgOpts as never);
            break;
          }
          case 'addTable': {
            const {
              headers,
              rows,
              x,
              y,
              w,
              headerColor,
              headerBgColor,
              borderColor,
              altRowBgColor,
              fontSize,
              fontFace,
              textColor,
            } = params;
            const headerBg = headerBgColor ?? '1E293B';
            const headerTxt = headerColor ?? 'FFFFFF';
            const borderC = borderColor ?? 'E2E8F0';
            const altBg = altRowBgColor ?? 'F8FAFC';
            const txtC = textColor ?? '1E293B';

            const headerRow = headers.map((h) => ({
              text: h,
              options: {
                fill: { color: hex(headerBg) },
                color: hex(headerTxt),
                bold: true,
                fontSize: fontSize ?? 12,
                fontFace: fontFace ?? 'Microsoft YaHei',
                align: 'center' as const,
                valign: 'middle' as const,
              },
            }));

            const dataRows = rows.map((row, ri) =>
              row.map((cell) => ({
                text: cell,
                options: {
                  fill: ri % 2 === 1 ? { color: hex(altBg) } : undefined,
                  color: hex(txtC),
                  fontSize: fontSize ?? 11,
                  fontFace: fontFace ?? 'Microsoft YaHei',
                  align: 'center' as const,
                  valign: 'middle' as const,
                },
              })),
            );

            const colCount = Math.max(headers.length, ...rows.map((r) => r.length));
            const colW = w / colCount;
            const rowH = 0.4;

            slide.addTable(
              [headerRow, ...dataRows] as never,
              {
                x,
                y,
                w,
                colW: Array.from({ length: colCount }, () => colW),
                rowH: Array.from({ length: rows.length + 1 }, () => rowH),
                border: { pt: 0.5, color: hex(borderC) },
                autoPage: false,
              } as never,
            );
            break;
          }
          case 'addChart': {
            const chartData = params.data.map((d) => ({
              name: d.name,
              labels: d.labels,
              values: d.values,
            }));

            slide.addChart(
              (pres as unknown as { charts: Record<string, unknown> }).charts[
                params.chartType
              ] as never,
              chartData as never,
              {
                x: params.x,
                y: params.y,
                w: params.w,
                h: params.h,
                barDir: params.barDir ?? 'col',
                showTitle: params.showTitle,
                title: params.title,
                showLegend: params.showLegend,
                chartColors: params.chartColors,
              } as never,
            );
            break;
          }
          case 'addFormula': {
            try {
              const omml = latexToOmml(params.latex, params.fontSize ?? 14);
              if (omml) {
                (
                  slide as unknown as { addFormula: (opts: Record<string, unknown>) => void }
                ).addFormula({
                  x: params.x,
                  y: params.y,
                  w: params.w,
                  h: params.h,
                  omml,
                  fontSize: params.fontSize ?? 14,
                  color: params.color ? hex(params.color) : '1E293B',
                  align: params.align ?? 'center',
                });
              } else {
                // Fallback: convert LaTeX to Unicode plain text
                const fallbackText = sanitizePlainTextLatex(
                  convertInlineLatexToUnicode(params.latex),
                );
                slide.addText(fallbackText, {
                  x: params.x,
                  y: params.y,
                  w: params.w,
                  h: params.h,
                  fontSize: params.fontSize ?? 14,
                  fontFace: 'KaTeX_Main, Times New Roman, serif',
                  color: params.color ? hex(params.color) : '1E293B',
                  align: params.align ?? 'center',
                });
              }
            } catch (err) {
              log.warn(
                `Formula render failed on page ${pageNum}: ${err instanceof Error ? err.message : String(err)}`,
              );
              const fallbackText = sanitizePlainTextLatex(
                convertInlineLatexToUnicode(params.latex),
              );
              slide.addText(fallbackText, {
                x: params.x,
                y: params.y,
                w: params.w,
                h: params.h,
                fontSize: params.fontSize ?? 14,
                color: '1E293B',
                align: 'center',
              });
            }
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

    return { success: errors.length === 0, errors, slideIndex: pageNum };
  }
}

// Singleton for reuse
export const instructionExecutor = new InstructionExecutor();
