/**
 * Template Deck — fixed-layout courseware generation.
 *
 * The LLM produces STRUCTURED CONTENT ONLY (titles, points, table data,
 * LaTeX formulas — no coordinates, no colors, no element soup). Every page
 * is then rendered deterministically into one of 8 fixed page layouts using
 * the DesignDNA template's palette/typography (ThemeToken). This guarantees
 * the deck always looks like the template the user picked — the model can
 * no longer produce broken layouts.
 */
import { z } from 'zod';
import pptxgen from 'pptxgenjs';
import type { ThemeToken } from './types';
import type { DesignDNA } from './agent/design-dna';
import { renderDesignCoverSlide } from './agent/cover-renderer';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { createLogger } from '@/lib/logger';
import { isDarkBg } from './color-utils';

const log = createLogger('TemplateDeck');

/** Optional LaTeX→PNG renderer (dependency-injected; the deck falls back to Unicode text). */
export interface RenderedFormulaPng {
  buffer: Buffer;
  width: number;
  height: number;
}
export type FormulaPngRenderer = (
  latex: string,
  bgColor: string,
) => Promise<RenderedFormulaPng | null>;

// ── Page schema (LLM output contract) ──────────────────────────────

const pointSchema = z.object({
  lead: z.string().min(1).max(40),
  detail: z.string().max(80).optional(),
});

export const templatePageSchema = z.discriminatedUnion('pageType', [
  z.object({
    pageType: z.literal('toc'),
    title: z.string().min(1).max(30),
    items: z
      .array(z.object({ title: z.string().min(1).max(20), desc: z.string().max(40).optional() }))
      .min(3)
      .max(10),
  }),
  z.object({
    pageType: z.literal('bullets'),
    title: z.string().min(1).max(30),
    points: z.array(pointSchema).min(2).max(5),
    keyTakeaway: z.string().max(50).optional(),
  }),
  z.object({
    pageType: z.literal('comparison'),
    title: z.string().min(1).max(30),
    leftLabel: z.string().min(1).max(16),
    leftPoints: z.array(z.string().min(1).max(40)).min(2).max(5),
    rightLabel: z.string().min(1).max(16),
    rightPoints: z.array(z.string().min(1).max(40)).min(2).max(5),
    note: z.string().max(90).optional(),
  }),
  z.object({
    pageType: z.literal('steps'),
    title: z.string().min(1).max(30),
    steps: z
      .array(z.object({ title: z.string().min(1).max(20), desc: z.string().max(90).optional() }))
      .min(3)
      .max(5),
  }),
  z.object({
    pageType: z.literal('formula'),
    title: z.string().min(1).max(30),
    latex: z.string().min(1).max(300),
    meaning: z.array(z.string().min(1).max(50)).max(4).optional(),
    example: z.string().max(90).optional(),
  }),
  z.object({
    pageType: z.literal('table'),
    title: z.string().min(1).max(30),
    headers: z.array(z.string().min(1).max(16)).min(2).max(5),
    rows: z
      .array(z.array(z.string().max(24)).min(2))
      .min(2)
      .max(7),
  }),
  z.object({
    pageType: z.literal('quiz'),
    title: z.string().min(1).max(30),
    question: z.string().min(1).max(90),
    options: z.array(z.string().min(1).max(40)).min(2).max(4),
    answer: z.string().min(1).max(40),
    analysis: z.string().max(90).optional(),
  }),
  z.object({
    pageType: z.literal('summary'),
    title: z.string().min(1).max(30),
    points: z.array(pointSchema).min(3).max(6),
  }),
]);

export type TemplatePage = z.infer<typeof templatePageSchema>;

export const templateDeckSchema = z.object({
  pages: z.array(templatePageSchema).min(1).max(30),
});

// ── Content generation (LLM fills the fixed layouts) ───────────────

const PAGE_TYPE_GUIDE = [
  'toc — 目录页：items 4-8 条，title ≤8字，desc ≤18字',
  'bullets — 概念/要点页：points 4-5 条，lead ≤14字，detail ≤28字，可选 keyTakeaway ≤30字',
  'comparison — 左右对比页：leftLabel/rightLabel ≤10字，每侧 3-5 条、每条 ≤20字',
  'steps — 流程/步骤页：steps 4-5 步，title ≤10字，desc ≤24字',
  'formula — 公式聚焦页：latex 必须是标准 TeX（只允许 ASCII，禁止 Unicode 上下标 ² ³ ⁴ / 下标 ₀ ₁ ₂ 和线性分数如 (a+b)/(c+d)）；分数用 \\frac{}{}，上下标用 ^ 和 _（如 a^{2}、x_{1}），根式用 \\sqrt{}，符号用 \\Delta、\\times、\\rightarrow、\\pm、\\approx、\\leq、\\geq、\\neq、\\left( \\right) 等标准命令；meaning 3-4 条各≤24字，可选 example ≤50字',
  'table — 数据/对比表页：headers 2-5 个各≤8字，rows 4-7 行、单元格 ≤16字，尽量填满',
  'quiz — 练习页：question ≤40字，options 2-4 个各≤20字，answer 必须是其中一个选项，可选 analysis ≤60字',
  'summary — 小结页：points 5-6 条，lead ≤12字，detail ≤30字',
].join('\n');

function buildContentSystemPrompt(stylePrompt?: string): string {
  return [
    'You are a senior curriculum designer. You produce STRUCTURED CONTENT for fixed slide layouts.',
    'You NEVER output coordinates, colors, fonts, or element positions — the rendering system owns all visual design.',
    'For every page you output exactly one of the pageType schemas below, as pure JSON.',
    '',
    '## Page types',
    PAGE_TYPE_GUIDE,
    '',
    '## Content rules (CRITICAL)',
    '- Content must be factually correct, curriculum-accurate, and specific to the topic. No filler, no placeholders.',
    '- VARIETY of page types: use at least 5 different pageType values; science/math topics MUST use formula, steps, table, quiz and summary pages where appropriate — do not make the deck all bullets.',
    '- DENSITY: fill each page to the upper end of its page type capacity (bullets 5 points, comparison 4-5 per side, steps 5, table 5-7 rows, formula with meaning+example, summary 6). Pages must look materially full — no sparse pages, no half-empty panels.',
    '- DEPTH: every point, step, comparison side and table cell should carry at least TWO of {exact number/datum, cause/principle, everyday or in-subject example} and explain the WHY — never a bare keyword, never a title phrase with nothing behind it. Prefer concrete values (n≈1.33, v≈3×10⁸ m/s, λ=600nm) over vague adjectives.',
    '- Text is the only thing you control — respect the length limits so text fits the fixed layout boxes.',
    '- Chinese content: use Simplified Chinese; math/chemistry symbols inside table cells or points use plain text (H₂O, CO₂, C₃ are fine).',
    '- LaTeX in formula pages: standard TeX only, ASCII only (e.g. 6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2, y=ax^2+bx+c). NO Unicode superscripts/subscripts (², ₃), NO linear fractions like (a+b)/(c+d) — write \\frac{a+b}{c+d}. No markdown, no $ wrapping.',
    stylePrompt ? `\n## Style context (affects content emphasis only)\n${stylePrompt}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildContentUserPrompt(
  topic: string,
  difficultyLabel: string,
  contentCount: number,
): string {
  return [
    `为以下主题制作课件的全部内容页。`,
    ``,
    `Topic: ${topic}`,
    `Difficulty: ${difficultyLabel}`,
    `内容页数量: ${contentCount}（封面和结尾页由系统生成，你不要输出）`,
    ``,
    `## 要求`,
    `- 按教学递进组织：导入/目录 → 核心概念 → 深入拆解 → 例题/公式 → 对比辨析 → 应用 → 易错点 → 小结`,
    `- 每页一个明确教学目标，内容必须尽量写满该页型允许的条目上限，不要留一半空白`,
    `- 页型多样化：整份课件至少用 5 种 pageType；理科/数学/化学类务必包含 table、formula、steps、quiz、summary，避免通篇都是 bullets`,
    `- 深度展开：每条要点/步骤/对比/表格单元格要至少给出【具体数据/数值】【成因或原理】【生活或学科实例】中的两项并解释原因，不要只写关键词或标题句。优先用确数（水的折射率≈1.33、光速 c≈3×10⁸ m/s、红光波长约700nm），少用"较大/明显/重要"等空泛形容词`,
    `- 容量参考：bullets 写满 5 条、comparison 每侧 4-5 条、steps 5 步、table 5-7 行真实数据、formula 尽量带 meaning + example、quiz 带 analysis、summary 写满 6 条；页面尽量填满，不留半空`,
    `- 必填字段（漏一个整份就会校验失败，务必全部给出）：comparison 必须有 leftLabel、leftPoints、rightLabel、rightPoints 四个字段（数组至少 2 条）；steps 必须有 steps 数组（每个 step 含 title 和 desc）；formula 必须有 latex；table 必须有 headers 和 rows；quiz 必须有 question、options、answer`,
    `- formula 页的 latex 字段必须是标准 TeX：只允许 ASCII 命令，分数写 \\frac{分子}{分母}（禁止 (a+b)/(c+d) 线性分数），上下标写 a^{2}、x_{1}（禁止 Unicode ² ³ ⁴ ₀ ₁ ₂），符号用 \\Delta、\\times、\\rightarrow、\\pm、\\approx、\\leq、\\geq、\\neq、\\left( \\right)；例：顶点式写 y=ax^{2}+bx+c=a\\left(x+\\frac{b}{2a}\\right)^{2}+\\frac{4ac-b^{2}}{4a}, \\Delta=b^{2}-4ac`,
    `- 字段契约（区分对象数组与字符串数组，混淆会导致整份校验失败）：
  · 对象数组（每项必须是 {…} 对象）：toc 的 items = [{title, desc}]；bullets 的 points = [{lead, detail}]；summary 的 points = [{lead, detail}]；steps = [{title, desc}]；
  · 字符串数组（每项必须是纯字符串，禁止 {text}/{title} 包裹）；comparison 的 leftPoints/rightPoints；formula 的 meaning；table 的 headers、rows（rows 是字符串二维数组）；quiz 的 options；
  · 正确示例：leftPoints: ["光从真空射入水中，入射角大于折射角", "折射率 n=c/v，数值由介质决定"]；toc.items: [{"title":"折射现象","desc":"光斜射入另一介质传播方向改变"}]`,
    `- 输出纯 JSON：{"pages": [ { "pageType": "...", "title": "...", ... }, ... ]}，共 ${contentCount} 个对象`,
    `- 页面顺序即页码顺序；不要输出封面页和结尾页`,
  ].join('\n');
}

/**
 * Generate structured content for all content pages of a deck.
 * Retries once on schema violation, then fails hard (no silent fallback).
 */
export async function generateTemplateDeckContent(
  topic: string,
  difficultyLabel: string,
  contentCount: number,
  stylePrompt: string | undefined,
  aiCall: AICallFn,
): Promise<TemplatePage[]> {
  const system = buildContentSystemPrompt(stylePrompt);
  const user = buildContentUserPrompt(topic, difficultyLabel, contentCount);

  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt =
      attempt === 1 ? user : `${user}\n\n## 上次输出未通过校验，请修正后重新输出\n${lastError}`;
    const raw = await aiCall(system, prompt);
    const parsed = parseJsonResponse<unknown>(raw);
    const result = templateDeckSchema.safeParse(parsed);
    if (result.success) {
      if (result.data.pages.length !== contentCount) {
        log.warn(
          `content pages mismatch: asked ${contentCount}, got ${result.data.pages.length} — keeping model output`,
        );
      }
      return result.data.pages;
    }
    lastError = result.error.issues
      .slice(0, 6)
      .map((i) => `- ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    log.warn(`template deck schema violation (attempt ${attempt}): ${lastError.slice(0, 300)}`);
  }
  throw new Error(`template deck content failed schema validation after retry: ${lastError}`);
}

// ── Rendering (deterministic fixed layouts) ────────────────────────

const PAGE_W = 13.33;
const PAGE_H = 7.5;
const MARGIN = 0.95;
const BODY_W = PAGE_W - MARGIN * 2;

interface PageChrome {
  slide: pptxgen.Slide;
  theme: ThemeToken;
  pageNum: number;
  total: number;
}

const KICKER_LABELS: Record<TemplatePage['pageType'], string> = {
  toc: 'CONTENTS',
  bullets: 'KEY POINTS',
  comparison: 'COMPARISON',
  steps: 'PROCESS',
  formula: 'FORMULA',
  table: 'DATA',
  quiz: 'PRACTICE',
  summary: 'SUMMARY',
};

function addContentChrome(
  { slide, theme, pageNum, total }: PageChrome,
  title: string,
  kicker: string,
): void {
  slide.background = { color: toHex(theme.contentBg) };
  // Corner motifs — echo the cover's decorative circles, fill the page edges
  slide.addShape(
    'ellipse' as never,
    {
      x: 11.7,
      y: -1.3,
      w: 3.1,
      h: 3.1,
      fill: { color: toHex(theme.accent), transparency: 92 },
    } as never,
  );
  slide.addShape(
    'ellipse' as never,
    {
      x: -1.6,
      y: 5.7,
      w: 3.3,
      h: 3.3,
      fill: { color: toHex(theme.accent), transparency: 94 },
    } as never,
  );
  // Accent block + kicker + title
  slide.addShape(
    'rect' as never,
    {
      x: 0.7,
      y: 0.74,
      w: 0.15,
      h: 0.72,
      fill: { color: toHex(theme.accent) },
    } as never,
  );
  slide.addText(kicker, {
    x: 1.02,
    y: 0.34,
    w: 8,
    h: 0.32,
    fontSize: 11,
    fontFace: theme.headingFont,
    color: toHex(theme.accent),
    bold: true,
    charSpacing: 3,
    margin: 0,
  });
  slide.addText(title, {
    x: 1.02,
    y: 0.64,
    w: 11.2,
    h: 0.86,
    fontSize: 31,
    fontFace: theme.headingFont,
    color: toHex(theme.bodyColor),
    bold: true,
    align: 'left',
    valign: 'middle',
    margin: 0,
  });
  slide.addText(`${pageNum} / ${total}`, {
    x: PAGE_W - 1.55,
    y: PAGE_H - 0.45,
    w: 1.2,
    h: 0.3,
    fontSize: 10,
    fontFace: theme.fontFamily,
    color: toHex(theme.bodyMutedColor),
    align: 'right',
    margin: 0,
  });
}

function toHex(c: string): string {
  return c.replace('#', '').toUpperCase();
}

/**
 * Mix two CSS colors by ratio t (0-1); returns lowercase 6-digit hex.
 * Falls back to 'FFFFFF' when either input isn't plain hex (e.g. rgba tokens).
 */
function mixHex(color: string, target: string, t: number): string {
  const parse = (c: string): number[] | null => {
    const h = c.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const a = parse(color);
  const b = parse(target);
  if (!a || !b) return 'FFFFFF';
  return a
    .map((v, i) =>
      Math.round(v + (b[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
}

/** Text color that contrasts with the theme cover background (light bg → dark text). */
function onCoverBg(theme: ThemeToken): string {
  return isDarkBg(theme.coverBg) ? theme.coverTitleColor : theme.bodyColor;
}

function renderTocPage(page: PageChrome, data: Extract<TemplatePage, { pageType: 'toc' }>): void {
  const { slide, theme } = page;
  const items = data.items;
  const twoCol = items.length > 4;
  const colW = twoCol ? (BODY_W - 0.7) / 2 : BODY_W * 0.85;
  const rowH = twoCol ? 1.32 : Math.min(1.32, 5.2 / items.length);

  items.forEach((item, i) => {
    const col = twoCol ? i % 2 : 0;
    const row = twoCol ? Math.floor(i / 2) : i;
    const x = MARGIN + col * (colW + 0.7);
    const y = 1.85 + row * rowH;

    slide.addShape(
      'ellipse' as never,
      {
        x,
        y: y + 0.02,
        w: 0.62,
        h: 0.62,
        fill: { color: toHex(theme.accent) },
      } as never,
    );
    slide.addText(String(i + 1), {
      x,
      y: y + 0.02,
      w: 0.62,
      h: 0.62,
      fontSize: 18,
      fontFace: theme.headingFont,
      color: toHex(theme.coverTitleColor),
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });
    slide.addText(item.title, {
      x: x + 0.88,
      y,
      w: colW - 0.88,
      h: 0.44,
      fontSize: 19,
      fontFace: theme.headingFont,
      color: toHex(theme.bodyColor),
      bold: true,
      margin: 0,
    });
    if (item.desc) {
      slide.addText(item.desc, {
        x: x + 0.88,
        y: y + 0.47,
        w: colW - 0.88,
        h: 0.32,
        fontSize: 13,
        fontFace: theme.fontFamily,
        color: toHex(theme.bodyMutedColor),
        margin: 0,
      });
    }
    // Row separator
    if (i < items.length - (twoCol && items.length % 2 === 1 ? 2 : 1)) {
      slide.addShape(
        'line' as never,
        {
          x: x + 0.88,
          y: y + rowH - 0.16,
          w: colW - 1.1,
          h: 0,
          line: { color: toHex(theme.dividerColor), width: 0.75 },
        } as never,
      );
    }
  });
}

function renderBulletsPage(
  page: PageChrome,
  data: Extract<TemplatePage, { pageType: 'bullets' }>,
): void {
  const { slide, theme } = page;
  const hasTakeaway = Boolean(data.keyTakeaway);
  const pointsW = hasTakeaway ? 6.6 : BODY_W;
  const rowH = Math.min(1.65, 5.2 / data.points.length);

  data.points.forEach((p, i) => {
    const y = 1.85 + i * rowH;
    slide.addShape(
      'ellipse' as never,
      {
        x: MARGIN,
        y: y + 0.15,
        w: 0.2,
        h: 0.2,
        fill: { color: toHex(theme.accent) },
      } as never,
    );
    slide.addText(p.lead, {
      x: MARGIN + 0.42,
      y,
      w: pointsW - 0.42,
      h: 0.48,
      fontSize: 18,
      fontFace: theme.headingFont,
      color: toHex(theme.bodyColor),
      bold: true,
      margin: 0,
    });
    if (p.detail) {
      slide.addText(p.detail, {
        x: MARGIN + 0.42,
        y: y + 0.54,
        w: pointsW - 0.42,
        h: 0.42,
        fontSize: 14,
        fontFace: theme.fontFamily,
        color: toHex(theme.bodyMutedColor),
        margin: 0,
      });
    }
    if (i < data.points.length - 1) {
      slide.addShape(
        'line' as never,
        {
          x: MARGIN + 0.42,
          y: y + rowH - 0.18,
          w: pointsW - 0.9,
          h: 0,
          line: { color: toHex(theme.dividerColor), width: 0.75 },
        } as never,
      );
    }
  });

  if (hasTakeaway && data.keyTakeaway) {
    // Dark anchor panel — the visual center of the page
    slide.addShape(
      'roundRect' as never,
      {
        x: 7.95,
        y: 1.85,
        w: 4.45,
        h: 4.15,
        fill: { color: toHex(theme.coverBg) },
        rectRadius: 0.16,
      } as never,
    );
    slide.addText('本页要点', {
      x: 8.35,
      y: 2.25,
      w: 3.7,
      h: 0.4,
      fontSize: 13,
      fontFace: theme.headingFont,
      color: toHex(theme.accent),
      bold: true,
      charSpacing: 2,
      margin: 0,
    });
    slide.addShape(
      'line' as never,
      {
        x: 8.35,
        y: 2.85,
        w: 0.6,
        h: 0,
        line: { color: toHex(theme.accent), width: 2.5 },
      } as never,
    );
    slide.addText(data.keyTakeaway, {
      x: 8.35,
      y: 3.1,
      w: 3.7,
      h: 2.7,
      fontSize: 17,
      fontFace: theme.fontFamily,
      color: toHex(onCoverBg(theme)),
      valign: 'top',
      margin: 0,
    });
  }
}

function renderComparisonPage(
  page: PageChrome,
  data: Extract<TemplatePage, { pageType: 'comparison' }>,
): void {
  const { slide, theme } = page;
  const panelY = 1.72;
  const panelH = data.note ? 4.85 : 5.25;
  const panelW = 5.6;

  const renderPanel = (x: number, label: string, points: string[], headerColor: string) => {
    slide.addShape(
      'roundRect' as never,
      {
        x,
        y: panelY,
        w: panelW,
        h: panelH,
        fill: { color: toHex(theme.accentLight) },
        line: { color: toHex(headerColor), width: 1, transparency: 55 },
        rectRadius: 0.1,
      } as never,
    );
    slide.addShape(
      'roundRect' as never,
      {
        x,
        y: panelY,
        w: panelW,
        h: 0.72,
        fill: { color: toHex(headerColor) },
        rectRadius: 0.1,
      } as never,
    );
    slide.addShape(
      'rect' as never,
      {
        x,
        y: panelY + 0.37,
        w: panelW,
        h: 0.35,
        fill: { color: toHex(headerColor) },
      } as never,
    );
    slide.addText(label, {
      x,
      y: panelY,
      w: panelW,
      h: 0.72,
      fontSize: 19,
      fontFace: theme.headingFont,
      color: toHex(theme.coverTitleColor),
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });
    const rowH = Math.min(1.15, (panelH - 1.1) / points.length);
    points.forEach((p, i) => {
      slide.addShape(
        'rect' as never,
        {
          x: x + 0.36,
          y: panelY + 1.24 + i * rowH,
          w: 0.18,
          h: 0.07,
          fill: { color: toHex(headerColor) },
        } as never,
      );
      slide.addText(p, {
        x: x + 0.68,
        y: panelY + 1.02 + i * rowH,
        w: panelW - 1.05,
        h: rowH - 0.08,
        fontSize: 15,
        fontFace: theme.fontFamily,
        color: toHex(theme.bodyColor),
        valign: 'top',
        margin: 0,
      });
    });
  };

  renderPanel(MARGIN - 0.05, data.leftLabel, data.leftPoints, theme.accent);
  renderPanel(
    PAGE_W - MARGIN - panelW + 0.05,
    data.rightLabel,
    data.rightPoints,
    theme.accentSecondary,
  );

  // VS badge at the center
  slide.addShape(
    'ellipse' as never,
    {
      x: PAGE_W / 2 - 0.48,
      y: panelY + panelH / 2 - 0.48,
      w: 0.96,
      h: 0.96,
      fill: { color: toHex(theme.contentBg) },
      line: { color: toHex(theme.accent), width: 2.25 },
    } as never,
  );
  slide.addText('VS', {
    x: PAGE_W / 2 - 0.48,
    y: panelY + panelH / 2 - 0.48,
    w: 0.96,
    h: 0.96,
    fontSize: 18,
    fontFace: theme.headingFont,
    color: toHex(theme.accent),
    bold: true,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });

  if (data.note) {
    slide.addText(data.note, {
      x: MARGIN,
      y: panelY + panelH + 0.16,
      w: BODY_W,
      h: 0.45,
      fontSize: 13,
      fontFace: theme.fontFamily,
      color: toHex(theme.bodyMutedColor),
      align: 'center',
      margin: 0,
    });
  }
}

function renderStepsPage(
  page: PageChrome,
  data: Extract<TemplatePage, { pageType: 'steps' }>,
): void {
  const { slide, theme } = page;
  const n = data.steps.length;
  const arrowW = 0.5;
  const boxW = Math.min(2.55, (BODY_W - (n - 1) * arrowW) / n);
  const totalW = n * boxW + (n - 1) * arrowW;
  const startX = (PAGE_W - totalW) / 2;
  const boxY = 2.55;
  const boxH = 2.85;

  data.steps.forEach((step, i) => {
    const x = startX + i * (boxW + arrowW);
    const isFinal = i === n - 1 && n > 2;
    const boxFill = isFinal ? theme.accent : theme.accentLight;
    const titleColor = isFinal ? theme.coverTitleColor : theme.bodyColor;
    const descColor = isFinal ? theme.coverTitleColor : theme.bodyMutedColor;
    slide.addShape(
      'roundRect' as never,
      {
        x,
        y: boxY,
        w: boxW,
        h: boxH,
        fill: { color: toHex(boxFill) },
        rectRadius: 0.12,
      } as never,
    );
    slide.addShape(
      'ellipse' as never,
      {
        x: x + boxW / 2 - 0.31,
        y: boxY - 0.36,
        w: 0.62,
        h: 0.62,
        fill: { color: toHex(theme.accent) },
      } as never,
    );
    slide.addText(String(i + 1), {
      x: x + boxW / 2 - 0.31,
      y: boxY - 0.36,
      w: 0.62,
      h: 0.62,
      fontSize: 18,
      fontFace: theme.headingFont,
      color: toHex(theme.coverTitleColor),
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });
    slide.addText(step.title, {
      x: x + 0.12,
      y: boxY + 0.48,
      w: boxW - 0.24,
      h: 0.55,
      fontSize: 16,
      fontFace: theme.headingFont,
      color: toHex(titleColor),
      bold: true,
      align: 'center',
      margin: 0,
    });
    if (step.desc) {
      slide.addText(step.desc, {
        x: x + 0.18,
        y: boxY + 1.1,
        w: boxW - 0.36,
        h: boxH - 1.3,
        fontSize: 12.5,
        fontFace: theme.fontFamily,
        color: toHex(descColor),
        align: 'center',
        valign: 'top',
        margin: 0,
      });
    }
    if (i < n - 1) {
      slide.addShape(
        'chevron' as never,
        {
          x: x + boxW + 0.06,
          y: boxY + boxH / 2 - 0.19,
          w: arrowW - 0.12,
          h: 0.38,
          fill: { color: toHex(theme.accent) },
        } as never,
      );
    }
  });
}

/**
 * LaTeX → readable Unicode for the text fallback (chemical/physics friendly):
 * subscripts/superscripts via Unicode digits where possible, arrows, common operators.
 */
const SUPER_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'] as const;
const SUB_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] as const;

export function latexToUnicode(latex: string): string {
  return (
    latex
      .replace(/\\xrightarrow\{([^}]*)\}/g, (_m, t) => ` —[${t}]→ `)
      .replace(/\\(rightarrow|to)\b/g, '→')
      .replace(/\\leftarrow\b/g, '←')
      .replace(/\\Rightarrow\b/g, '⇒')
      .replace(/\\Leftarrow\b/g, '⇐')
      .replace(/\\Leftrightarrow\b/g, '⇔')
      .replace(/\\leftrightarrow\b/g, '↔')
      .replace(/\\uparrow\b/g, '↑')
      .replace(/\\downarrow\b/g, '↓')
      .replace(/\\(times|cdot)\b/g, '·')
      .replace(/\\approx\b/g, '≈')
      .replace(/\\equiv\b/g, '≡')
      .replace(/\\sim\b/g, '∼')
      .replace(/\\propto\b/g, '∝')
      .replace(/\\leq\b/g, '≤')
      .replace(/\\geq\b/g, '≥')
      .replace(/\\neq?\b/g, '≠')
      .replace(/\\circ\b/g, '°')
      .replace(/\\Delta\b/g, 'Δ')
      .replace(/\\alpha\b/g, 'α')
      .replace(/\\beta\b/g, 'β')
      .replace(/\\gamma\b/g, 'γ')
      .replace(/\\delta\b/g, 'δ')
      .replace(/\\epsilon\b/g, 'ε')
      .replace(/\\varepsilon\b/g, 'ε')
      .replace(/\\zeta\b/g, 'ζ')
      .replace(/\\eta\b/g, 'η')
      .replace(/\\theta\b/g, 'θ')
      .replace(/\\vartheta\b/g, 'ϑ')
      .replace(/\\iota\b/g, 'ι')
      .replace(/\\kappa\b/g, 'κ')
      .replace(/\\lambda\b/g, 'λ')
      .replace(/\\mu\b/g, 'μ')
      .replace(/\\nu\b/g, 'ν')
      .replace(/\\xi\b/g, 'ξ')
      .replace(/\\pi\b/g, 'π')
      .replace(/\\rho\b/g, 'ρ')
      .replace(/\\sigma\b/g, 'σ')
      .replace(/\\tau\b/g, 'τ')
      .replace(/\\upsilon\b/g, 'υ')
      .replace(/\\phi\b/g, 'φ')
      .replace(/\\varphi\b/g, 'φ')
      .replace(/\\chi\b/g, 'χ')
      .replace(/\\psi\b/g, 'ψ')
      .replace(/\\omega\b/g, 'ω')
      .replace(/\\Gamma\b/g, 'Γ')
      .replace(/\\Theta\b/g, 'Θ')
      .replace(/\\Lambda\b/g, 'Λ')
      .replace(/\\Sigma\b/g, 'Σ')
      .replace(/\\Phi\b/g, 'Φ')
      .replace(/\\Psi\b/g, 'Ψ')
      .replace(/\\Omega\b/g, 'Ω')
      .replace(/\\infty\b/g, '∞')
      .replace(/\\partial\b/g, '∂')
      .replace(/\\nabla\b/g, '∇')
      .replace(/\\pm\b/g, '±')
      .replace(/\\sum\b/g, 'Σ')
      .replace(/\\prod\b/g, '∏')
      .replace(/\\int\b/g, '∫')
      .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
      .replace(/\\(dfrac|tfrac|frac)\{([^}]*)\}\{([^}]*)\}/g, '($2)/($3)')
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\(mathrm|mathbf|mathit|textbf|textrm|mbox)\{([^}]*)\}/g, '$2')
      .replace(/\\left\.|\\right\./g, '')
      .replace(/\\left/g, '')
      .replace(/\\right/g, '')
      .replace(/\\qquad|\\quad|\\;/g, '  ')
      .replace(/\\(,|:|\!| )/g, ' ')
      .replace(/\^\{?(?=°)/g, '')
      .replace(/\^\{?([-+]?[0-9]+)\}?/g, (_m, d) => {
        const digits = String(d).startsWith('-')
          ? '⁻' +
            String(d)
              .slice(1)
              .split('')
              .map((x) => SUPER_DIGITS[+x])
              .join('')
          : String(d)
              .split('')
              .map((x) => SUPER_DIGITS[+x])
              .join('');
        return digits;
      })
      .replace(/_\{?([-+]?[0-9]+)\}?/g, (_m, d) => {
        const digits = String(d).startsWith('-')
          ? '₋' +
            String(d)
              .slice(1)
              .split('')
              .map((x) => SUB_DIGITS[+x])
              .join('')
          : String(d)
              .split('')
              .map((x) => SUB_DIGITS[+x])
              .join('');
        return digits;
      })
      // Drop any remaining TeX commands (e.g. \left, \quad, unknown macros)
      .replace(/\\[a-zA-Z]+\*?/g, '')
      .replace(/[{}]/g, '')
      .replace(/\\\\/g, ' ')
      // \quad (and the space after it) can leave 3+ spaces; collapse to 2
      .replace(/ {3,}/g, '  ')
      .trim()
  );
}

async function renderFormulaPage(
  page: PageChrome,
  data: Extract<TemplatePage, { pageType: 'formula' }>,
  renderFormulaPng?: FormulaPngRenderer,
): Promise<void> {
  const { slide, theme } = page;
  // Formula panel: accent-tinted fill + visible border so it reads off the
  // white page background (accentLight alone is too close to contentBg).
  // Non-hex accentLight (e.g. tech-dark rgba) falls back to contentBg tint.
  const panelBg = /^[0-9a-fA-F]{6}$/.test(theme.accentLight.replace('#', '').trim())
    ? mixHex(theme.accentLight, theme.accent, 0.07)
    : mixHex(theme.contentBg, theme.accent, 0.12);
  slide.addShape(
    'roundRect' as never,
    {
      x: 1.4,
      y: 1.72,
      w: 10.53,
      h: 2.62,
      fill: { color: toHex(panelBg) },
      line: { color: toHex(theme.accent), width: 1, transparency: 40 },
      rectRadius: 0.12,
    } as never,
  );
  slide.addShape(
    'rect' as never,
    {
      x: 1.4,
      y: 1.88,
      w: 0.13,
      h: 2.3,
      fill: { color: toHex(theme.accent) },
    } as never,
  );

  let rendered: RenderedFormulaPng | null = null;
  if (renderFormulaPng) {
    try {
      rendered = await renderFormulaPng(data.latex, panelBg);
    } catch (err) {
      log.warn(`formula PNG render failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (rendered) {
    const maxW = 9.4;
    const maxH = 2.05;
    let w = rendered.width / 96;
    let h = rendered.height / 96;
    const scale = Math.min(maxW / w, maxH / h, 1.5);
    w *= scale;
    h *= scale;
    slide.addImage({
      data: `data:image/png;base64,${rendered.buffer.toString('base64')}`,
      x: (PAGE_W - w) / 2,
      y: 1.72 + (2.62 - h) / 2,
      w,
      h,
    });
  } else {
    // Fallback: Unicode formula text (auto-size so long formulas still fit)
    const fallback = latexToUnicode(data.latex);
    const fallbackSize = fallback.length > 90 ? 22 : fallback.length > 60 ? 26 : 30;
    slide.addText(fallback, {
      x: 1.85,
      y: 1.72,
      w: 9.63,
      h: 2.62,
      fontSize: fallbackSize,
      fontFace: theme.headingFont,
      color: toHex(theme.bodyColor),
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });
  }

  const meaning = data.meaning ?? [];
  meaning.forEach((m, i) => {
    slide.addText(`▸  ${m}`, {
      x: 1.85,
      y: 4.46 + i * 0.44,
      w: 9.63,
      h: 0.4,
      fontSize: 16.5,
      fontFace: theme.fontFamily,
      color: toHex(theme.bodyColor),
      margin: 0,
    });
  });

  if (data.example) {
    const exY = 6.3;
    slide.addShape(
      'roundRect' as never,
      {
        x: 1.4,
        y: exY,
        w: 10.53,
        h: 1.0,
        fill: { color: toHex(theme.contentBg) },
        line: { color: toHex(theme.accent), width: 1, transparency: 30 },
        rectRadius: 0.1,
      } as never,
    );
    slide.addShape(
      'roundRect' as never,
      {
        x: 1.72,
        y: exY + 0.26,
        w: 0.48,
        h: 0.48,
        fill: { color: toHex(theme.accent) },
        rectRadius: 0.08,
      } as never,
    );
    slide.addText('例', {
      x: 1.72,
      y: exY + 0.26,
      w: 0.48,
      h: 0.48,
      fontSize: 14,
      fontFace: theme.headingFont,
      color: toHex(theme.coverTitleColor),
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });
    slide.addText(data.example, {
      x: 2.38,
      y: exY,
      w: 9.3,
      h: 1.0,
      fontSize: 16.5,
      fontFace: theme.fontFamily,
      color: toHex(theme.bodyColor),
      valign: 'middle',
      margin: 0,
    });
  }
}

function renderTablePage(
  page: PageChrome,
  data: Extract<TemplatePage, { pageType: 'table' }>,
): void {
  const { slide, theme } = page;
  const headerRow = data.headers.map((h) => ({
    text: h,
    options: {
      fontSize: 15,
      fontFace: theme.headingFont,
      color: toHex(theme.coverTitleColor),
      bold: true,
      fill: { color: toHex(theme.accent) },
      align: 'center' as const,
      valign: 'middle' as const,
    },
  }));

  const bodyRows = data.rows.map((row, ri) =>
    data.headers.map((_, ci) => ({
      text: row[ci] ?? '',
      options: {
        fontSize: 14,
        fontFace: theme.fontFamily,
        color: toHex(theme.bodyColor),
        fill: { color: toHex(ri % 2 === 0 ? theme.contentBg : theme.accentLight) },
        align: 'center' as const,
        valign: 'middle' as const,
      },
    })),
  );

  const colCount = data.headers.length;
  const rowH = Math.min(0.95, 4.9 / Math.max(1, data.rows.length));
  slide.addTable([headerRow, ...bodyRows], {
    x: MARGIN,
    y: 1.85,
    w: BODY_W,
    rowH,
    colW: Array(colCount).fill(BODY_W / colCount),
    border: { type: 'solid', pt: 0.75, color: toHex(theme.dividerColor) },
    fontFace: theme.fontFamily,
  });
}

function renderQuizPage(page: PageChrome, data: Extract<TemplatePage, { pageType: 'quiz' }>): void {
  const { slide, theme } = page;
  const labels = ['A', 'B', 'C', 'D', 'E'];

  // Q chip + question
  slide.addShape(
    'roundRect' as never,
    {
      x: MARGIN,
      y: 1.58,
      w: 0.58,
      h: 0.58,
      fill: { color: toHex(theme.accent) },
      rectRadius: 0.1,
    } as never,
  );
  slide.addText('Q', {
    x: MARGIN,
    y: 1.58,
    w: 0.58,
    h: 0.58,
    fontSize: 18,
    fontFace: theme.headingFont,
    color: toHex(theme.coverTitleColor),
    bold: true,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });
  slide.addText(data.question, {
    x: MARGIN + 0.8,
    y: 1.55,
    w: BODY_W - 0.8,
    h: 1.0,
    fontSize: 19,
    fontFace: theme.headingFont,
    color: toHex(theme.bodyColor),
    bold: true,
    valign: 'top',
    margin: 0,
  });

  // Option cards
  const optH = Math.min(0.88, 3.35 / data.options.length);
  data.options.forEach((opt, i) => {
    const y = 2.75 + i * optH;
    slide.addShape(
      'roundRect' as never,
      {
        x: MARGIN,
        y,
        w: BODY_W,
        h: optH - 0.14,
        fill: { color: toHex(theme.accentLight) },
        rectRadius: 0.08,
      } as never,
    );
    slide.addShape(
      'ellipse' as never,
      {
        x: MARGIN + 0.26,
        y: y + (optH - 0.14 - 0.46) / 2,
        w: 0.46,
        h: 0.46,
        fill: { color: toHex(theme.contentBg) },
        line: { color: toHex(theme.accent), width: 1.25 },
      } as never,
    );
    slide.addText(labels[i], {
      x: MARGIN + 0.26,
      y: y + (optH - 0.14 - 0.46) / 2,
      w: 0.46,
      h: 0.46,
      fontSize: 15,
      fontFace: theme.headingFont,
      color: toHex(theme.accent),
      bold: true,
      align: 'center',
      valign: 'middle',
      margin: 0,
    });
    slide.addText(opt, {
      x: MARGIN + 0.94,
      y,
      w: BODY_W - 1.2,
      h: optH - 0.14,
      fontSize: 16,
      fontFace: theme.fontFamily,
      color: toHex(theme.bodyColor),
      valign: 'middle',
      margin: 0,
    });
  });

  // Dark answer strip
  const stripY = 6.0;
  slide.addShape(
    'roundRect' as never,
    {
      x: MARGIN,
      y: stripY,
      w: BODY_W,
      h: 0.95,
      fill: { color: toHex(theme.coverBg) },
      rectRadius: 0.1,
    } as never,
  );
  const answerIdx = data.options.findIndex((o) => o === data.answer || o.startsWith(data.answer));
  const answerLabel = answerIdx >= 0 ? labels[answerIdx] : data.answer;
  slide.addText(
    [
      { text: `答案：${answerLabel}`, options: { bold: true, color: toHex(theme.accent) } },
      ...(data.analysis
        ? [{ text: `　${data.analysis}`, options: { color: toHex(onCoverBg(theme)) } }]
        : []),
    ],
    {
      x: MARGIN + 0.32,
      y: stripY,
      w: BODY_W - 0.64,
      h: 0.95,
      fontSize: 15,
      fontFace: theme.fontFamily,
      valign: 'middle',
      margin: 0,
    },
  );
}

function renderSummaryPage(
  page: PageChrome,
  data: Extract<TemplatePage, { pageType: 'summary' }>,
): void {
  const { slide, theme } = page;
  const n = data.points.length;
  const threeCol = n > 4;
  const cols = threeCol ? 3 : 2;
  const rows = Math.ceil(n / cols);
  const gapX = 0.3;
  const gapY = 0.28;
  const cardW = (BODY_W - (cols - 1) * gapX) / cols;
  const cardH = threeCol ? 2.3 : 2.5;
  const startY = 1.8;

  const layout = (i: number) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    return { x, y };
  };

  data.points.forEach((p, i) => {
    const { x, y } = layout(i);

    slide.addShape(
      'roundRect' as never,
      {
        x,
        y,
        w: cardW,
        h: cardH,
        fill: { color: toHex(theme.accentLight) },
        rectRadius: 0.12,
      } as never,
    );
    // Accent strip along the card top
    slide.addShape(
      'rect' as never,
      {
        x: x + 0.2,
        y,
        w: cardW - 0.4,
        h: 0.1,
        fill: { color: toHex(theme.accent) },
      } as never,
    );
    slide.addText(String(i + 1).padStart(2, '0'), {
      x: x + 0.26,
      y: y + 0.24,
      w: 1.1,
      h: 0.5,
      fontSize: 22,
      fontFace: theme.headingFont,
      color: toHex(theme.accent),
      bold: true,
      margin: 0,
    });
    slide.addText(p.lead, {
      x: x + 0.26,
      y: y + 0.78,
      w: cardW - 0.52,
      h: 0.5,
      fontSize: 17,
      fontFace: theme.headingFont,
      color: toHex(theme.bodyColor),
      bold: true,
      margin: 0,
    });
    if (p.detail) {
      slide.addText(p.detail, {
        x: x + 0.26,
        y: y + 1.32,
        w: cardW - 0.52,
        h: 0.86,
        fontSize: 12.5,
        fontFace: theme.fontFamily,
        color: toHex(theme.bodyMutedColor),
        valign: 'top',
        margin: 0,
      });
    }
  });
}

async function renderContentPage(
  pres: pptxgen,
  pageData: TemplatePage,
  index: number,
  total: number,
  theme: ThemeToken,
  renderFormulaPng?: FormulaPngRenderer,
): Promise<void> {
  const chrome: PageChrome = { slide: pres.addSlide(), theme, pageNum: index + 2, total };
  addContentChrome(chrome, pageData.title, KICKER_LABELS[pageData.pageType]);
  switch (pageData.pageType) {
    case 'toc':
      renderTocPage(chrome, pageData);
      break;
    case 'bullets':
      renderBulletsPage(chrome, pageData);
      break;
    case 'comparison':
      renderComparisonPage(chrome, pageData);
      break;
    case 'steps':
      renderStepsPage(chrome, pageData);
      break;
    case 'formula':
      await renderFormulaPage(chrome, pageData, renderFormulaPng);
      break;
    case 'table':
      renderTablePage(chrome, pageData);
      break;
    case 'quiz':
      renderQuizPage(chrome, pageData);
      break;
    case 'summary':
      renderSummaryPage(chrome, pageData);
      break;
  }
}

function renderEndSlide(pres: pptxgen, dna: DesignDNA, theme: ThemeToken, topic: string): void {
  const slide = pres.addSlide();
  slide.background = { color: toHex(theme.coverBg) };
  // Soft decorative ellipses echoing the cover
  slide.addShape(
    'ellipse' as never,
    {
      x: 10.3,
      y: -1.2,
      w: 4.0,
      h: 4.0,
      fill: { color: toHex(theme.accent), transparency: 88 },
    } as never,
  );
  slide.addShape(
    'ellipse' as never,
    {
      x: -1.4,
      y: 5.2,
      w: 3.6,
      h: 3.6,
      fill: { color: toHex(theme.accent), transparency: 90 },
    } as never,
  );
  slide.addText('THANKS FOR WATCHING', {
    x: 1.5,
    y: 2.24,
    w: 10.33,
    h: 0.34,
    fontSize: 11,
    fontFace: theme.headingFont,
    color: toHex(theme.accent),
    bold: true,
    charSpacing: 4,
    align: 'center',
    margin: 0,
  });
  slide.addText('谢谢观看', {
    x: 1.5,
    y: 2.62,
    w: 10.33,
    h: 1.35,
    fontSize: 48,
    fontFace: dna.fonts.heading,
    color: toHex(onCoverBg(theme)),
    bold: true,
    align: 'center',
    margin: 0,
  });
  slide.addText(topic, {
    x: 1.5,
    y: 4.12,
    w: 10.33,
    h: 0.55,
    fontSize: 18,
    fontFace: theme.fontFamily,
    color: toHex(theme.accent),
    align: 'center',
    margin: 0,
  });
}

export interface TemplateDeckParams {
  topic: string;
  difficultyLabel: string;
  dna: DesignDNA;
  theme: ThemeToken;
  pages: TemplatePage[];
  /** Optional LaTeX→PNG renderer for formula pages; omitted = Unicode text fallback. */
  renderFormulaPng?: FormulaPngRenderer;
}

/**
 * Build the complete deck buffer: template cover → fixed-layout content
 * pages → styled end page. Layout is fully deterministic.
 */
export async function buildTemplateDeckBuffer(params: TemplateDeckParams): Promise<Buffer> {
  const { topic, difficultyLabel, dna, theme, pages, renderFormulaPng } = params;
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = '天空课堂';
  pres.title = topic;

  // Cover — the exact template layout the user previewed
  const coverSlide = pres.addSlide();
  renderDesignCoverSlide(coverSlide, pres, dna, topic, `${difficultyLabel}教学课件`);

  const total = pages.length + 2;
  for (let i = 0; i < pages.length; i++) {
    await renderContentPage(pres, pages[i], i, total, theme, renderFormulaPng);
  }

  renderEndSlide(pres, dna, theme, topic);

  return (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
}

/** Page summaries for job progress reporting. */
export function summarizeTemplatePages(
  pages: TemplatePage[],
): { pageNum: number; title: string; type: string }[] {
  return pages.map((p, i) => ({ pageNum: i + 2, title: p.title, type: p.pageType }));
}
