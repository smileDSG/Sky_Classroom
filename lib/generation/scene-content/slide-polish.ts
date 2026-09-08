import type { GeneratedSlideData } from '@/lib/generation/pipeline-types';
import type { PPTElement, PPTTextElement, Slide } from '@/lib/types/slides';
import {
  auditSlideLayout,
  repairSlideLayout,
  type LayoutGuardIssue,
} from '@/lib/slides/agent/layout-guard-agent';
import type { ClassroomThemeSelection } from '@/lib/generation/classroom-design-dna';

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 562.5;
const MARGIN = 48;
const FONT_STACK =
  'Noto Sans SC, Microsoft YaHei, PingFang SC, Source Han Sans SC, Arial, sans-serif';

type SlideLikeElement = {
  id?: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height?: number;
};

export interface SlidePolishContext {
  title?: string;
  keyPoints?: string[];
  order?: number;
  decorate?: boolean;
  themeSelection?: ClassroomThemeSelection;
}

interface SlidePolishTheme {
  background: string;
  panel: string;
  accent: string;
  accentSecondary: string;
  textPrimary: string;
  textBody: string;
}

function withHash(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  return color.startsWith('#') ? color : `#${color}`;
}

function avoidWarmAccent(color: string): string {
  const normalized = color.toLowerCase();
  if (
    ['#f97316', '#f59e0b', '#ed7d31', '#ffc000', '#fef3e2', '#fff7ed', '#7c3f00'].includes(
      normalized,
    )
  ) {
    return '#38bdf8';
  }
  return color;
}

function getPolishTheme(context?: SlidePolishContext): SlidePolishTheme {
  const palette = context?.themeSelection?.palette;
  return {
    background: withHash(palette?.contentBg, '#ffffff'),
    panel: withHash(palette?.accentLight, '#f5f9ff'),
    accent: withHash(palette?.accent, '#2f80d1'),
    accentSecondary: avoidWarmAccent(withHash(palette?.accentSecondary, '#38bdf8')),
    textPrimary: withHash(palette?.textPrimary, '#17233c'),
    textBody: withHash(palette?.textBody, '#263244'),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type ElementBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

function toBox(left: number, top: number, width: number, height: number): ElementBox {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function getElementBox(element: SlideLikeElement): ElementBox {
  if (element.type === 'line') {
    const line = element as SlideLikeElement & {
      start?: [number, number];
      end?: [number, number];
    };
    const start = line.start ?? [0, 0];
    const end = line.end ?? [0, 0];
    const strokePad = Math.max(6, element.width * 2);
    const minX = Math.min(start[0], end[0]) - strokePad;
    const minY = Math.min(start[1], end[1]) - strokePad;
    const maxX = Math.max(start[0], end[0]) + strokePad;
    const maxY = Math.max(start[1], end[1]) + strokePad;
    return toBox(element.left + minX, element.top + minY, maxX - minX, maxY - minY);
  }

  return toBox(element.left, element.top, element.width, Number(element.height ?? 24));
}

function intersectionArea(a: ElementBox, b: ElementBox): number {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

function expandBox(box: ElementBox, padding: number): ElementBox {
  return toBox(
    box.left - padding,
    box.top - padding,
    box.width + padding * 2,
    box.height + padding * 2,
  );
}

function hasShapeText(element: SlideLikeElement): boolean {
  const text = (element as Record<string, unknown>).text as { content?: string } | undefined;
  return !!stripHtml(String(text?.content ?? ''));
}

function isReadableElement(element: SlideLikeElement): boolean {
  return ['text', 'latex', 'table', 'code'].includes(element.type) || hasShapeText(element);
}

function isThinDecorativeElement(element: SlideLikeElement): boolean {
  const box = getElementBox(element);
  return (
    element.type === 'line' ||
    (element.type === 'shape' && !hasShapeText(element) && (box.height <= 14 || box.width <= 18))
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&bull;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function textElement(
  id: string,
  content: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fontSize: number,
  color = '#263244',
  fill?: string,
  lineHeight = 1.35,
): SlideLikeElement & Record<string, unknown> {
  return {
    id,
    type: 'text',
    left,
    top,
    width,
    height,
    rotate: 0,
    content: `<p style="font-size:${fontSize}px;font-family:${FONT_STACK};line-height:${lineHeight};">${content}</p>`,
    defaultFontName: FONT_STACK,
    defaultColor: color,
    fill,
    lineHeight,
    paragraphSpace: 0,
  };
}

function shapeElement(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fill: string,
  opacity = 1,
): SlideLikeElement & Record<string, unknown> {
  return {
    id,
    type: 'shape',
    left,
    top,
    width,
    height,
    rotate: 0,
    path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
    viewBox: [1, 1],
    fill,
    fixedRatio: false,
    opacity,
  };
}

function circleElement(
  id: string,
  left: number,
  top: number,
  size: number,
  fill: string,
  opacity = 1,
): SlideLikeElement & Record<string, unknown> {
  return {
    id,
    type: 'shape',
    left,
    top,
    width: size,
    height: size,
    rotate: 0,
    path: 'M 1 0.5 A 0.5 0.5 0 1 1 0 0.5 A 0.5 0.5 0 1 1 1 0.5 Z',
    viewBox: [1, 1],
    fill,
    fixedRatio: false,
    opacity,
  };
}

function lineElement(
  id: string,
  left: number,
  top: number,
  start: [number, number],
  end: [number, number],
  width: number,
  color: string,
  extra: Record<string, unknown> = {},
): SlideLikeElement & Record<string, unknown> {
  return {
    id,
    type: 'line',
    left,
    top,
    width,
    start,
    end,
    style: 'solid',
    color,
    points: ['', ''],
    ...extra,
  };
}

function tableElement(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  rows: string[][],
  colWidths: number[],
  themeColor = '#2f80d1',
): SlideLikeElement & Record<string, unknown> {
  return {
    id,
    type: 'table',
    left,
    top,
    width,
    height,
    rotate: 0,
    outline: { color: '#dbe3ef', width: 1, style: 'solid' },
    theme: {
      color: themeColor,
      rowHeader: true,
      rowFooter: false,
      colHeader: false,
      colFooter: false,
    },
    colWidths,
    cellMinHeight: Math.max(34, Math.floor(height / Math.max(1, rows.length))),
    data: rows.map((row, rowIndex) =>
      row.map((text, cellIndex) => ({
        id: `${id}_r${rowIndex}_c${cellIndex}`,
        colspan: 1,
        rowspan: 1,
        text,
        style: {
          bold: rowIndex === 0 || cellIndex === 0,
          color: rowIndex === 0 || cellIndex === 0 ? '#17233c' : '#263244',
          backcolor: rowIndex === 0 ? '#eff6ff' : '#ffffff',
          fontsize: rowIndex === 0 ? '17' : '16',
          fontname: FONT_STACK,
          align: 'left',
        },
      })),
    ),
  };
}

function getFontSize(content: string, fallback: number): number {
  const match = content.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i);
  return match ? Number(match[1]) : fallback;
}

function setFontSize(content: string, size: number): string {
  if (/font-size\s*:/i.test(content)) {
    return content.replace(/font-size\s*:\s*\d+(?:\.\d+)?px/gi, `font-size:${size}px`);
  }
  return content.replace(/<(p|span|strong|b)(\s[^>]*)?>/i, (match) => {
    if (/style\s*=/.test(match)) {
      return match.replace(
        /style="([^"]*)"/i,
        (_all, style) => `style="font-size:${size}px;${style}"`,
      );
    }
    return match.replace('>', ` style="font-size:${size}px;">`);
  });
}

function normalizeFontFamily(content: string): string {
  const withFamily = /font-family\s*:/i.test(content)
    ? content.replace(/font-family\s*:\s*[^;"]+/gi, `font-family:${FONT_STACK}`)
    : content;

  return withFamily.replace(/<(p|span|strong|b)(\s[^>]*)?>/gi, (match) => {
    if (/style\s*=/.test(match)) return match;
    return match.replace('>', ` style="font-family:${FONT_STACK};">`);
  });
}

function remapThemeColor(color: string | undefined, theme: SlidePolishTheme): string | undefined {
  if (!color) return color;
  const normalized = color.trim().toLowerCase();
  if (['#2f80d1', '#3b82f6', '#5b9bd5'].includes(normalized)) return theme.accent;
  if (['#f5f9ff', '#dbeafe', '#eaf4ff', '#e8f4ff', '#f8fbff'].includes(normalized)) {
    return theme.panel;
  }
  if (['#17233c', '#1e293b', '#263244', '#333333'].includes(normalized)) {
    return theme.textPrimary;
  }
  if (['#38506b', '#3c4858', '#475569', '#64748b'].includes(normalized)) {
    return theme.textBody;
  }
  return color;
}

function remapInlineThemeColors(content: string, theme: SlidePolishTheme): string {
  return content.replace(/#[0-9a-fA-F]{6}/g, (color) => remapThemeColor(color, theme) ?? color);
}

function applyThemeToElement<T extends SlideLikeElement>(
  element: T,
  context?: SlidePolishContext,
): T {
  if (!context?.themeSelection) return element;

  const theme = getPolishTheme(context);
  const themed = { ...element } as Record<string, unknown>;

  if (typeof themed['fill'] === 'string') {
    themed['fill'] = remapThemeColor(themed['fill'], theme);
  }
  if (typeof themed['color'] === 'string') {
    themed['color'] = remapThemeColor(themed['color'], theme);
  }
  if (typeof themed['defaultColor'] === 'string') {
    themed['defaultColor'] = remapThemeColor(themed['defaultColor'], theme);
  }
  if (typeof themed['content'] === 'string') {
    themed['content'] = remapInlineThemeColors(themed['content'], theme);
  }

  return themed as T;
}

function estimateTextHeight(
  content: string,
  width: number,
  fontSize: number,
  lineHeight: number,
): number {
  const plain = stripHtml(content);
  const paragraphCount = Math.max(1, (content.match(/<p\b|<br\s*\/?>/gi) ?? []).length);
  const cjkCount = (plain.match(/[\u2e80-\u9fff]/g) ?? []).length;
  const weightedChars = cjkCount + (plain.length - cjkCount) * 0.58;
  const charsPerLine = Math.max(8, (width - 24) / Math.max(fontSize, 1));
  const wrappedLines = Math.ceil(weightedChars / charsPerLine);
  const lines = Math.max(paragraphCount, wrappedLines);
  return Math.ceil(lines * fontSize * lineHeight + 28);
}

/**
 * Estimate the natural single-line width of text at a font size.
 * CJK glyphs are ~1em, latin/digits ~0.58em, plus small padding.
 * Used to widen a title box so its content is not clipped/truncated.
 */
function estimateTextWidth(content: string, fontSize: number): number {
  const plain = stripHtml(content);
  const cjkCount = (plain.match(/[\u2e80-\u9fff]/g) ?? []).length;
  const latinCount = plain.length - cjkCount;
  return Math.ceil((cjkCount * 1.02 + latinCount * 0.58) * fontSize) + 16;
}

function polishTextElement<T extends SlideLikeElement>(element: T): T {
  const text = { ...element } as T & PPTTextElement;
  const plainText = stripHtml(String(text.content ?? ''));
  const isTitle =
    text.textType === 'title' ||
    (text.top < 118 &&
      Number(text.height ?? 0) >= 44 &&
      text.width >= 420 &&
      plainText.length <= 42);
  let content = normalizeFontFamily(String(text.content ?? ''));
  let fontSize = getFontSize(content, isTitle ? 34 : 18);
  fontSize = clamp(fontSize, isTitle ? 30 : 18, isTitle ? 38 : 24);
  content = setFontSize(content, fontSize);

  const lineHeight = Number(text.lineHeight ?? (isTitle ? 1.18 : 1.36));
  let top = clamp(text.top, MARGIN, CANVAS_HEIGHT - MARGIN - 32);
  let width = clamp(text.width, 80, CANVAS_WIDTH - MARGIN * 2);
  let left = clamp(text.left, MARGIN, CANVAS_WIDTH - MARGIN - width);

  // Widen a title box to its natural single-line width so the heading text is never
  // clipped/truncated (the previous clamp-only logic kept a too-narrow box, which
  // the renderer could shrink only down to minScale and then cut off).
  if (isTitle) {
    const naturalWidth = estimateTextWidth(content, fontSize);
    const maxAllowed = Math.min(CANVAS_WIDTH - MARGIN - left, 880);
    if (naturalWidth > width && maxAllowed > width) {
      width = Math.min(naturalWidth, maxAllowed);
    }
  }

  let height = Math.max(
    Number(text.height ?? 0),
    estimateTextHeight(content, width, fontSize, lineHeight),
  );

  const maxHeight = Math.max(42, CANVAS_HEIGHT - MARGIN - top);
  while (height > maxHeight && fontSize > (isTitle ? 28 : 18)) {
    fontSize -= 1;
    content = setFontSize(content, fontSize);
    height = estimateTextHeight(content, width, fontSize, lineHeight);
  }

  if (height > maxHeight) height = maxHeight;
  if (top + height > CANVAS_HEIGHT - MARGIN) top = CANVAS_HEIGHT - MARGIN - height;
  if (left + width > CANVAS_WIDTH - MARGIN) left = CANVAS_WIDTH - MARGIN - width;

  return {
    ...text,
    left,
    top,
    width,
    height,
    content,
    defaultFontName: FONT_STACK,
    defaultColor: text.defaultColor || (isTitle ? '#17233c' : '#263244'),
    lineHeight,
    paragraphSpace: isTitle ? 0 : Number(text.paragraphSpace ?? 4),
  } as T;
}

function polishLatexElement<T extends SlideLikeElement>(element: T): T {
  const latexElement = element as T & Record<string, unknown>;
  const latex = String(latexElement.latex ?? '');
  const complex = latex.length > 42 || /\\(frac|sum|int|lim|begin|sqrt)/.test(latex);
  if (latexElement['preserveBox']) {
    return {
      ...element,
      left: clamp(element.left, MARGIN, CANVAS_WIDTH - MARGIN - element.width),
      top: clamp(element.top, MARGIN + 96, CANVAS_HEIGHT - MARGIN - Number(element.height ?? 76)),
      width: clamp(element.width, complex ? 360 : 220, CANVAS_WIDTH - MARGIN * 2),
      height: clamp(Number(element.height ?? 0), complex ? 92 : 64, 156),
      color: latexElement.color || '#1f2937',
      align: 'center',
    };
  }
  const width = clamp(Math.max(element.width, complex ? 760 : 420), 240, CANVAS_WIDTH - MARGIN * 2);
  const height = clamp(Math.max(Number(element.height ?? 0), complex ? 118 : 76), 60, 156);
  const left = clamp((CANVAS_WIDTH - width) / 2, MARGIN, CANVAS_WIDTH - MARGIN - width);
  const top = clamp(element.top, MARGIN + 96, CANVAS_HEIGHT - MARGIN - height);

  return {
    ...element,
    left,
    top,
    width,
    height,
    color: latexElement.color || '#1f2937',
    align: 'center',
  };
}

function polishLineElement<T extends SlideLikeElement>(element: T): T {
  return {
    ...element,
    width: clamp(element.width, 1, 5),
  };
}

function polishBoxElement<T extends SlideLikeElement>(element: T): T {
  const width = clamp(element.width, 16, CANVAS_WIDTH - MARGIN * 2);
  const minHeight = isThinDecorativeElement(element) ? 1 : 8;
  const rawHeight = Number(element.height ?? 16);
  const elementId = String(element.id ?? '');
  const isFormulaPanel = /formula_panel/i.test(elementId);
  const isWideBottomBand =
    element.type === 'shape' &&
    !hasShapeText(element) &&
    element.top > 400 &&
    width >= 700 &&
    rawHeight >= 24;
  const maxWideBottomBandHeight = isFormulaPanel ? 96 : 56;
  const height = isWideBottomBand
    ? clamp(rawHeight, minHeight, maxWideBottomBandHeight)
    : clamp(rawHeight, minHeight, CANVAS_HEIGHT - MARGIN * 2);
  return {
    ...element,
    left: clamp(element.left, MARGIN, CANVAS_WIDTH - MARGIN - width),
    top: clamp(element.top, MARGIN, CANVAS_HEIGHT - MARGIN - height),
    width,
    height,
  };
}

function visualAnchorElements(
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const sourceText = [context?.title, ...(context?.keyPoints ?? [])].filter(Boolean).join(' ');
  if (isQuadraticTopicText(sourceText)) return quadraticVisualAnchorElements(theme);

  return conceptVisualAnchorElements(theme, extractContextKeywords(context));
}

function isQuadraticTopic(text: string): boolean {
  return /(二次函数|抛物线|quadratic|parabola|ax\^2|x\^2|x²)/i.test(text);
}

function isQuadraticTopicText(text: string): boolean {
  return (
    isQuadraticTopic(text) ||
    /(\u4e8c\u6b21\u51fd\u6570|\u629b\u7269\u7ebf|quadratic|parabola|ax\^2|x\^2|x²)/i.test(text)
  );
}

function getContextSourceText(elements: SlideLikeElement[], context?: SlidePolishContext): string {
  return [
    context?.title,
    ...(context?.keyPoints ?? []),
    ...elements.map((element) => getTextContent(element)),
  ]
    .filter(Boolean)
    .join(' ');
}

function getSlideTitle(elements: SlideLikeElement[], context?: SlidePolishContext): string {
  if (context?.title) return escapeHtmlShort(stripHtml(context.title), 42);

  const title = elements
    .filter((element) => element.type === 'text')
    .sort((a, b) => a.top - b.top)[0];
  const titleText = title ? getTextContent(title) : '';
  return escapeHtmlShort(titleText || 'Quadratic function graph', 42);
}

function getLayoutSignalText(elements: SlideLikeElement[], context?: SlidePolishContext): string {
  return [
    context?.title,
    ...(context?.keyPoints ?? []),
    ...elements.map((element) => {
      const record = element as Record<string, unknown>;
      return [getTextContent(element), record['latex']].filter(Boolean).join(' ');
    }),
  ]
    .filter(Boolean)
    .join(' ');
}

function hasAnySignal(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function countSignals(text: string, patterns: RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function shouldUseEquationRelationLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  const source = getLayoutSignalText(elements, context);
  if (!isQuadraticTopicText(source)) return false;

  const hasEquation = /一元二次方程|\u4e00\u5143\u4e8c\u6b21\u65b9\u7a0b/i.test(source);
  const relationSignalCount = countSignals(source, [
    /一元二次方程|\u4e00\u5143\u4e8c\u6b21\u65b9\u7a0b/i,
    /实数根|\u5b9e\u6570\u6839/i,
    /判别式|\u5224\u522b\u5f0f|Delta|Δ|\\Delta/i,
    /x\s*轴|\u0078\s*\u8f74/i,
    /交点|\u4ea4\u70b9/i,
  ]);

  return hasEquation || relationSignalCount >= 2;
}

function shouldUseVertexFormLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  const source = getLayoutSignalText(elements, context);
  const title = getSlideTitle(elements, context);
  if (!isQuadraticTopicText(source)) return false;
  if (isQuadraticParameterTitle(title) || isQuadraticApplicationTitle(title)) return false;

  return hasAnySignal(source, [
    /顶点式|\u9876\u70b9\u5f0f/i,
    /顶点.*对称轴|\u9876\u70b9.*\u5bf9\u79f0\u8f74/i,
    /a\s*\(\s*x\s*[-−]\s*h\s*\)\s*\^?\s*2/i,
    /a\s*\(\s*x\s*[-−]\s*3\s*\)\s*\^?\s*2/i,
  ]);
}

function isQuadraticParameterTitle(text: string): boolean {
  return /(参数\s*c.*b|参数\s*b.*c|系数\s*c.*b|系数\s*b.*c|探索参数|探索系数)/i.test(text);
}

function isQuadraticApplicationTitle(text: string): boolean {
  return /(综合应用|实际问题|二次函数建模|应用题|变式训练)/i.test(text);
}

function shouldUsePythonVariablesLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  const source = getLayoutSignalText(elements, context);
  const title = getSlideTitle(elements, context);
  const combined = `${title} ${source}`;
  const hasVariableSignal = /(变量|variable)/i.test(combined);
  const hasDataTypeSignal = /(数据类型|常见数据类型|int|float|str|bool|type\(\)|data type)/i.test(
    combined,
  );
  const hasNamingSignal = /(命名规则|不能以数字开头|下划线|区分大小写|naming)/i.test(combined);

  return hasVariableSignal && hasDataTypeSignal && hasNamingSignal;
}

function referenceHeaderElements(
  prefix: string,
  title: string,
  subtitle: string,
  theme: SlidePolishTheme,
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const visualVariant = referenceVisualVariant(prefix, context);
  const headerElements = [
    textElement(
      `${prefix}_title`,
      `<strong>${title}</strong>`,
      82,
      42,
      836,
      58,
      34,
      theme.textPrimary,
      undefined,
      1.12,
    ),
    textElement(
      prefix + '_subtitle',
      subtitle,
      82,
      122,
      836,
      38,
      22,
      theme.textBody,
      undefined,
      1.15,
    ),
    shapeElement(`${prefix}_rule`, 82, 188, 836, 3, theme.accent, 0.95),
  ];

  return [...headerElements, ...referenceHeaderVisualSignature(prefix, theme, visualVariant)];
}

function referenceVisualVariant(prefix: string, context?: SlidePolishContext): number {
  if (typeof context?.order === 'number' && Number.isFinite(context.order) && context.order > 0) {
    return (Math.floor(context.order) - 1) % 6;
  }
  return stableHashNumber(`${prefix}|${context?.title ?? ''}`) % 6;
}

function referenceHeaderVisualSignature(
  prefix: string,
  theme: SlidePolishTheme,
  variant: number,
): Array<SlideLikeElement & Record<string, unknown>> {
  if (variant === 1) {
    return [
      circleElement(`${prefix}_visual_dot_0`, 50, 52, 12, theme.accent, 0.95),
      circleElement(`${prefix}_visual_dot_1`, 50, 78, 12, theme.accentSecondary, 0.85),
      circleElement(`${prefix}_visual_dot_2`, 50, 104, 12, theme.accent, 0.7),
    ];
  }

  if (variant === 2) {
    return [
      shapeElement(`${prefix}_visual_top_rail`, 82, 28, 278, 4, theme.accentSecondary, 0.9),
      shapeElement(`${prefix}_visual_top_tick`, 378, 28, 46, 4, theme.accent, 0.8),
    ];
  }

  if (variant === 3) {
    return [
      shapeElement(`${prefix}_visual_corner_a`, 874, 28, 44, 4, theme.accent, 0.9),
      shapeElement(`${prefix}_visual_corner_b`, 914, 32, 4, 46, theme.accentSecondary, 0.85),
    ];
  }

  if (variant === 4) {
    return [
      shapeElement(`${prefix}_visual_subtitle_bar`, 82, 170, 226, 4, theme.accentSecondary, 0.85),
      shapeElement(`${prefix}_visual_subtitle_tail`, 324, 170, 58, 4, theme.accent, 0.75),
    ];
  }

  if (variant === 5) {
    return [
      shapeElement(`${prefix}_visual_bottom_mark`, 782, 508, 136, 4, theme.accentSecondary, 0.85),
      circleElement(`${prefix}_visual_bottom_dot`, 752, 504, 12, theme.accent, 0.9),
    ];
  }

  return [shapeElement(`${prefix}_visual_side_rule`, 944, 54, 6, 96, theme.accentSecondary, 0.9)];
}

function deckDiversitySignatureVariant(context?: SlidePolishContext): number | null {
  const order = context?.order;
  if (typeof order !== 'number' || !Number.isFinite(order) || order <= 0) return null;
  return ((Math.floor(order) - 1) % 18) + 1;
}

function deckDiversitySignatureElements(
  theme: SlidePolishTheme,
  variant: number,
): Array<SlideLikeElement & Record<string, unknown>> {
  const prefix = `polish_deck_signature_v${variant}`;

  if (variant === 1) {
    return [
      shapeElement(`${prefix}_rail`, 50, 214, 8, 232, theme.accent, 0.55),
      shapeElement(`${prefix}_cap`, 50, 190, 58, 8, theme.accentSecondary, 0.45),
    ];
  }

  if (variant === 2) {
    return [
      shapeElement(`${prefix}_top`, 620, 30, 236, 8, theme.accentSecondary, 0.5),
      circleElement(`${prefix}_dot`, 874, 26, 14, theme.accent, 0.6),
    ];
  }

  if (variant === 3) {
    return [
      shapeElement(`${prefix}_corner_x`, 894, 206, 8, 156, theme.accent, 0.45),
      shapeElement(`${prefix}_corner_y`, 828, 206, 74, 8, theme.accentSecondary, 0.42),
    ];
  }

  if (variant === 4) {
    return [
      shapeElement(`${prefix}_bottom`, 142, 506, 268, 7, theme.accentSecondary, 0.5),
      shapeElement(`${prefix}_bottom_tail`, 430, 506, 66, 7, theme.accent, 0.42),
    ];
  }

  if (variant === 5) {
    return [
      circleElement(`${prefix}_node_a`, 48, 56, 14, theme.accent, 0.6),
      circleElement(`${prefix}_node_b`, 72, 56, 14, theme.accentSecondary, 0.52),
      shapeElement(`${prefix}_node_line`, 96, 61, 96, 4, theme.accent, 0.35),
    ];
  }

  if (variant === 6) {
    return [
      shapeElement(`${prefix}_side_block`, 928, 382, 18, 86, theme.accentSecondary, 0.42),
      shapeElement(`${prefix}_side_rule`, 894, 464, 52, 6, theme.accent, 0.5),
    ];
  }

  if (variant === 7) {
    return [
      shapeElement(`${prefix}_left_step_a`, 48, 248, 44, 6, theme.accentSecondary, 0.42),
      shapeElement(`${prefix}_left_step_b`, 48, 276, 76, 6, theme.accent, 0.34),
      shapeElement(`${prefix}_left_step_c`, 48, 304, 106, 6, theme.accentSecondary, 0.28),
    ];
  }

  if (variant === 8) {
    return [
      shapeElement(`${prefix}_top_dash_a`, 694, 48, 88, 5, theme.accent, 0.36),
      shapeElement(`${prefix}_top_dash_b`, 802, 48, 116, 5, theme.accentSecondary, 0.36),
      circleElement(`${prefix}_top_dot`, 646, 42, 16, theme.accentSecondary, 0.4),
    ];
  }

  if (variant === 9) {
    return [
      shapeElement(`${prefix}_right_ladder_a`, 918, 224, 6, 68, theme.accent, 0.32),
      shapeElement(`${prefix}_right_ladder_b`, 886, 290, 38, 6, theme.accentSecondary, 0.38),
      shapeElement(`${prefix}_right_ladder_c`, 858, 318, 66, 6, theme.accent, 0.28),
    ];
  }

  if (variant === 10) {
    return [
      shapeElement(`${prefix}_baseline_a`, 78, 488, 156, 5, theme.accentSecondary, 0.34),
      shapeElement(`${prefix}_baseline_b`, 252, 488, 84, 5, theme.accent, 0.32),
      circleElement(`${prefix}_baseline_dot`, 354, 482, 16, theme.accentSecondary, 0.4),
    ];
  }

  if (variant === 11) {
    return [
      circleElement(`${prefix}_halo_a`, 870, 86, 18, theme.accent, 0.34),
      circleElement(`${prefix}_halo_b`, 898, 86, 18, theme.accentSecondary, 0.34),
      shapeElement(`${prefix}_halo_rule`, 766, 95, 84, 4, theme.accent, 0.28),
    ];
  }

  if (variant === 12) {
    return [
      shapeElement(`${prefix}_side_block`, 928, 382, 18, 86, theme.accentSecondary, 0.42),
      shapeElement(`${prefix}_side_rule`, 872, 382, 56, 6, theme.accent, 0.34),
      shapeElement(`${prefix}_side_rule_low`, 850, 468, 96, 6, theme.accentSecondary, 0.3),
    ];
  }

  if (variant === 13) {
    return [
      shapeElement(`${prefix}_top_left_a`, 82, 34, 142, 5, theme.accentSecondary, 0.36),
      shapeElement(`${prefix}_top_left_b`, 242, 34, 64, 5, theme.accent, 0.3),
      circleElement(`${prefix}_top_left_dot`, 322, 28, 16, theme.accentSecondary, 0.34),
    ];
  }

  if (variant === 14) {
    return [
      circleElement(`${prefix}_right_dot_a`, 918, 212, 14, theme.accent, 0.32),
      circleElement(`${prefix}_right_dot_b`, 918, 246, 14, theme.accentSecondary, 0.34),
      circleElement(`${prefix}_right_dot_c`, 918, 280, 14, theme.accent, 0.24),
    ];
  }

  if (variant === 15) {
    return [
      shapeElement(`${prefix}_corner_low_x`, 776, 504, 140, 5, theme.accentSecondary, 0.34),
      shapeElement(`${prefix}_corner_low_y`, 916, 446, 5, 63, theme.accent, 0.3),
    ];
  }

  if (variant === 16) {
    return [
      circleElement(`${prefix}_left_dot_a`, 54, 382, 14, theme.accentSecondary, 0.34),
      circleElement(`${prefix}_left_dot_b`, 54, 414, 14, theme.accent, 0.28),
      shapeElement(`${prefix}_left_dot_rule`, 76, 420, 86, 4, theme.accentSecondary, 0.26),
    ];
  }

  if (variant === 17) {
    return [
      shapeElement(`${prefix}_top_center_a`, 402, 28, 96, 4, theme.accent, 0.28),
      shapeElement(`${prefix}_top_center_b`, 518, 28, 128, 4, theme.accentSecondary, 0.34),
      circleElement(`${prefix}_top_center_dot`, 666, 22, 16, theme.accent, 0.3),
    ];
  }

  return [
    shapeElement(`${prefix}_bottom_center_a`, 408, 506, 124, 5, theme.accentSecondary, 0.34),
    shapeElement(`${prefix}_bottom_center_b`, 552, 506, 72, 5, theme.accent, 0.28),
    circleElement(`${prefix}_bottom_center_dot`, 636, 500, 16, theme.accentSecondary, 0.3),
  ];
}

function addDeckDiversitySignature<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] {
  if (elements.some((element) => element.id?.startsWith('polish_deck_signature_'))) {
    return elements;
  }
  if (elements.some((element) => element.id?.startsWith('polish_ref_redis_internal_'))) {
    return elements;
  }

  const variant = deckDiversitySignatureVariant(context);
  if (variant === null) return elements;

  const theme = getPolishTheme(context);
  return [...deckDiversitySignatureElements(theme, variant), ...elements] as T[];
}

function sanitizeDecorativeChrome<T extends SlideLikeElement>(elements: T[]): T[] {
  if (elements.some((element) => element.id?.startsWith('polish_ref_redis_internal_'))) {
    return elements;
  }

  const stripped = elements.filter(
    (element) =>
      !isOrnamentalSignatureElement(element) &&
      !isShortHeaderOrnament(element) &&
      !isTinyHeaderOrnament(element),
  );
  const docked = dockCardAccentRules(stripped);
  const withoutFloatingRules = removeFreestandingHorizontalAccentRules(docked);
  return limitVerticalChrome(withoutFloatingRules);
}

function isOrnamentalSignatureElement(element: SlideLikeElement): boolean {
  const id = element.id ?? '';
  return (
    id.startsWith('polish_deck_signature_') ||
    (id.startsWith('polish_ref_') && id.includes('_visual_'))
  );
}

function isShortHeaderOrnament(element: SlideLikeElement): boolean {
  if (element.id === 'polish_plain_title_rule') return false;
  if (element.type !== 'shape' || hasShapeText(element)) return false;
  const box = getElementBox(element);
  return box.top < 130 && box.width < 320 && box.height <= 12;
}

function isTinyHeaderOrnament(element: SlideLikeElement): boolean {
  if (element.type !== 'shape' || hasShapeText(element)) return false;
  const box = getElementBox(element);
  return box.top < 130 && box.width <= 24 && box.height <= 24;
}

function isDecorativeVerticalChrome(element: SlideLikeElement): boolean {
  if (element.type !== 'shape' || hasShapeText(element)) return false;
  const box = getElementBox(element);
  if (box.width > 20 || box.height < 40) return false;
  if (box.width * box.height > 6000) return false;
  return true;
}

function limitVerticalChrome<T extends SlideLikeElement>(elements: T[]): T[] {
  const candidates = elements.filter(isDecorativeVerticalChrome);
  if (candidates.length <= 1) return elements;

  const keep = [...candidates].sort((a, b) => {
    const aBox = getElementBox(a);
    const bBox = getElementBox(b);
    return bBox.height - aBox.height || aBox.left - bBox.left;
  })[0];

  return elements.filter((element) => element === keep || !isDecorativeVerticalChrome(element));
}

function isCardPanelForAccent(element: SlideLikeElement): boolean {
  if (!isBackgroundShapeLike(element)) return false;
  const box = getElementBox(element);
  if (box.top < 160 || box.top > 460) return false;
  if (box.width < 160 || box.width > 360) return false;
  return box.height >= 96 && box.height <= 300;
}

function isSmallCardAccentRule(element: SlideLikeElement): boolean {
  if (element.type !== 'shape' || hasShapeText(element)) return false;
  const box = getElementBox(element);
  return box.top >= 160 && box.width >= 36 && box.width <= 140 && box.height <= 8;
}

function dockCardAccentRules<T extends SlideLikeElement>(elements: T[]): T[] {
  const cards = elements.filter(isCardPanelForAccent);
  if (cards.length === 0) return elements;

  return elements.map((element) => {
    if (!isSmallCardAccentRule(element)) return element;
    const box = getElementBox(element);
    const owner = cards.find((card) => {
      const cardBox = getElementBox(card);
      return (
        box.left >= cardBox.left &&
        box.right <= cardBox.right &&
        box.top >= cardBox.top &&
        box.top <= cardBox.bottom
      );
    });
    if (!owner) return element;

    const ownerBox = getElementBox(owner);
    return {
      ...element,
      top: Math.max(ownerBox.top + 12, ownerBox.bottom - 18),
    };
  });
}

function isHorizontalAccentRule(element: SlideLikeElement): boolean {
  if (element.type !== 'shape' || hasShapeText(element)) return false;
  const box = getElementBox(element);
  return box.height <= 8 && box.width >= 360;
}

function isNamedDecorativeHorizontalRule(element: SlideLikeElement): boolean {
  const id = element.id ?? '';
  return /(?:_rule|_panel|_bridge)$/.test(id);
}

function removeFreestandingHorizontalAccentRules<T extends SlideLikeElement>(elements: T[]): T[] {
  const cards = elements.filter(isCardPanelForAccent);

  return elements.filter((element) => {
    if (!isHorizontalAccentRule(element)) return true;
    const box = getElementBox(element);

    const owner = cards.find((card) => {
      const cardBox = getElementBox(card);
      return (
        box.left >= cardBox.left &&
        box.right <= cardBox.right &&
        box.top >= cardBox.top &&
        box.top <= cardBox.bottom
      );
    });

    if (owner) return true;

    const crossesCardBand = cards.some((card) => {
      const cardBox = getElementBox(card);
      return box.top >= cardBox.top && box.top <= cardBox.bottom;
    });
    const isContentAreaChrome = box.top >= 220 && isNamedDecorativeHorizontalRule(element);

    return !crossesCardBand && !isContentAreaChrome;
  });
}

function equationRelationReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const prefix = 'polish_ref_relation';

  const cards = [
    {
      id: 'positive',
      fill: '#e8f5ee',
      color: '#14532d',
      title: 'Δ > 0',
      body: '两个根，两个交点',
    },
    {
      id: 'zero',
      fill: '#fff7dc',
      color: '#8a4b00',
      title: 'Δ = 0',
      body: '一个重根，图像相切',
    },
    {
      id: 'negative',
      fill: '#fde8e8',
      color: '#9f1239',
      title: 'Δ < 0',
      body: '无实根，无交点',
    },
  ];

  return [
    ...referenceHeaderElements(prefix, title, '函数图像与 x 轴的交点，对应方程的实数根', theme),
    shapeElement(`${prefix}_formula_panel`, 150, 202, 700, 116, '#f8fafc', 1),
    textElement(
      `${prefix}_function_formula`,
      'y = ax<sup>2</sup> + bx + c',
      196,
      225,
      250,
      44,
      26,
      theme.textPrimary,
      undefined,
      1.12,
    ),
    textElement(`${prefix}_formula_join`, '与', 488, 225, 32, 44, 24, '#64748b', undefined, 1.12),
    textElement(
      `${prefix}_equation_formula`,
      'ax<sup>2</sup> + bx + c = 0',
      570,
      225,
      250,
      44,
      26,
      theme.textPrimary,
      undefined,
      1.12,
    ),
    textElement(
      `${prefix}_bridge`,
      '<strong>核心关系：</strong>交点横坐标 = 方程实数根。',
      110,
      312,
      780,
      44,
      20,
      theme.textBody,
      undefined,
      1.16,
    ),
    ...cards.flatMap((card, index) => {
      const left = 72 + index * 286;
      return [
        shapeElement(`${prefix}_${card.id}_card`, left, 362, 270, 152, card.fill, 1),
        textElement(
          `${prefix}_${card.id}_title`,
          `<strong>${card.title}</strong>`,
          left + 28,
          376,
          214,
          32,
          24,
          card.color,
          undefined,
          1.1,
        ),
        textElement(
          `${prefix}_${card.id}_body`,
          card.body,
          left + 28,
          440,
          200,
          54,
          18,
          theme.textBody,
          undefined,
          1.18,
        ),
      ];
    }),
  ];
}

function vertexFormReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const prefix = 'polish_ref_vertex';

  return [
    ...referenceHeaderElements(prefix, title, '从顶点式直接读出顶点、对称轴和图像平移', theme),
    shapeElement(`${prefix}_definition_panel`, 82, 196, 392, 228, '#f8fafc', 1),
    textElement(
      `${prefix}_definition_title`,
      '<strong>顶点式定义</strong>',
      112,
      216,
      320,
      36,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_definition_formula`,
      '<span style="font-size:30px;">y = a(x - h)<sup>2</sup> + k</span>',
      112,
      278,
      320,
      44,
      28,
      theme.textPrimary,
      undefined,
      1.12,
    ),
    textElement(
      `${prefix}_definition_note`,
      '顶点为 (h, k)，对称轴为 x = h。',
      112,
      348,
      320,
      62,
      18,
      theme.textBody,
      undefined,
      1.15,
    ),
    shapeElement(`${prefix}_example_panel`, 526, 196, 392, 228, '#eaf4fb', 1),
    textElement(
      `${prefix}_example_title`,
      '<strong>示例</strong>',
      556,
      216,
      320,
      36,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_example_formula`,
      '<span style="font-size:28px;">y = 2(x - 3)<sup>2</sup> + 5</span>',
      556,
      278,
      320,
      42,
      26,
      theme.textPrimary,
      undefined,
      1.12,
    ),
    textElement(
      `${prefix}_example_note`,
      '顶点：(3, 5)　对称轴：x = 3',
      556,
      348,
      320,
      62,
      18,
      theme.textBody,
      undefined,
      1.15,
    ),
    shapeElement(`${prefix}_takeaway_rule`, 82, 446, 836, 3, theme.accentSecondary, 0.9),
    textElement(
      `${prefix}_takeaway`,
      '口诀：看到 (x - h)<sup>2</sup> 就读 h，常数项读 k。',
      112,
      462,
      776,
      42,
      20,
      theme.textPrimary,
      undefined,
      1.16,
    ),
  ];
}

function quadraticParameterReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const prefix = 'polish_ref_quad_coeff';

  return [
    ...referenceHeaderElements(
      prefix,
      title,
      '看 c 决定 y 轴截距，看 b 与 a 一起决定对称轴位置',
      theme,
    ),
    shapeElement(`${prefix}_c_panel`, 82, 210, 392, 212, '#f8fafc', 1),
    shapeElement(`${prefix}_c_bar`, 82, 228, 8, 154, theme.accent, 1),
    textElement(
      `${prefix}_c_title`,
      '<strong>参数 c：上下位置</strong>',
      118,
      226,
      322,
      36,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_c_key`,
      '当 x = 0 时，y = c',
      118,
      292,
      322,
      34,
      24,
      '#1d4ed8',
      undefined,
      1.08,
    ),
    textElement(
      `${prefix}_c_body`,
      '交点沿 y 轴上下移动。',
      118,
      354,
      318,
      52,
      20,
      theme.textBody,
      undefined,
      1.18,
    ),
    shapeElement(`${prefix}_b_panel`, 526, 210, 392, 212, '#eaf4fb', 1),
    shapeElement(`${prefix}_b_bar`, 526, 228, 8, 154, theme.accentSecondary, 1),
    textElement(
      `${prefix}_b_title`,
      '<strong>参数 b：左右位置</strong>',
      562,
      226,
      322,
      36,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_b_key`,
      '对称轴：x = -b / 2a',
      562,
      292,
      322,
      34,
      24,
      '#9a3412',
      undefined,
      1.08,
    ),
    textElement(
      `${prefix}_b_body`,
      '对称轴左右移动。',
      562,
      354,
      318,
      52,
      20,
      theme.textBody,
      undefined,
      1.18,
    ),
    shapeElement(`${prefix}_formula_panel`, 112, 424, 776, 86, '#fff7ed', 1),
    textElement(
      `${prefix}_formula`,
      '顶点：(-b/2a，(4ac-b²)/4a)',
      150,
      440,
      700,
      54,
      23,
      '#7c3f00',
      undefined,
      1.1,
    ),
  ];
}

function quadraticApplicationReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const prefix = 'polish_ref_quad_application';
  const steps = [
    ['1', '建立坐标系', '把拱桥、利润或轨迹问题转成坐标图像。'],
    ['2', '设函数模型', '根据条件选择一般式、顶点式或交点式。'],
    ['3', '代入求参数', '用已知点、顶点或交点求出未知系数。'],
    ['4', '回到题意', '读最大值、最小值、宽度或高度，并检查定义域。'],
  ];

  return [
    ...referenceHeaderElements(
      prefix,
      title,
      '把真实情境转成二次函数模型，再用图像特征回答问题',
      theme,
    ),
    shapeElement(`${prefix}_problem_panel`, 82, 206, 300, 218, '#f8fafc', 1),
    textElement(
      `${prefix}_problem_title`,
      '<strong>实际问题</strong>',
      112,
      230,
      236,
      34,
      23,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_problem_body`,
      '常见情境：拱桥通行、利润最大、投篮轨迹。<br/><br/>目标不是背公式，而是把题意翻译成函数。',
      112,
      292,
      224,
      92,
      18,
      theme.textBody,
      undefined,
      1.16,
    ),
    shapeElement(`${prefix}_steps_panel`, 426, 206, 492, 218, '#eaf4fb', 1),
    textElement(
      `${prefix}_steps_title`,
      '<strong>建模步骤</strong>',
      456,
      228,
      406,
      34,
      23,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_steps_body`,
      steps
        .map(([number, heading]) => {
          const shortBody =
            number === '1'
              ? '把情境画成图像'
              : number === '2'
                ? '选一般式/顶点式'
                : number === '3'
                  ? '代入已知点'
                  : '读最值、宽度或高度';
          return `<strong>${number}. ${heading}</strong>：${shortBody}`;
        })
        .join('<br/>'),
      456,
      278,
      406,
      126,
      18,
      theme.textBody,
      undefined,
      1.28,
    ),
    shapeElement(`${prefix}_takeaway_rule`, 82, 456, 836, 3, theme.accentSecondary, 0.9),
    textElement(
      `${prefix}_takeaway`,
      '关键检查：单位、定义域、答案是否符合真实情境。',
      112,
      472,
      776,
      28,
      18,
      theme.textPrimary,
      undefined,
      1.1,
    ),
  ];
}

function pythonVariablesReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const prefix = 'polish_ref_python_vars';
  const typeCards = [
    { id: 'int', title: '整数 int', fill: '#dbeafe', color: '#1e40af' },
    { id: 'float', title: '浮点 float', fill: '#dcfce7', color: '#166534' },
    { id: 'str', title: '字符串 str', fill: '#fef3c7', color: '#92400e' },
    { id: 'bool', title: '布尔 bool', fill: '#fce4ec', color: '#881337' },
  ];
  const cardWidth = 190;
  const cardGap = 24;
  const cardTop = 438;
  const cardLeft = 82;

  return [
    ...referenceHeaderElements(
      prefix,
      title,
      '变量负责命名和保存数据，数据类型决定值可以怎样参与运算',
      theme,
    ),
    shapeElement(`${prefix}_variable_panel`, 82, 210, 394, 208, '#f8fafc', 1),
    shapeElement(`${prefix}_variable_bar`, 82, 230, 8, 138, theme.accent, 1),
    textElement(
      `${prefix}_variable_title`,
      '<strong>变量：数据容器</strong>',
      116,
      232,
      320,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_variable_code`,
      'name = "小明"',
      116,
      284,
      320,
      34,
      24,
      '#1d4ed8',
      undefined,
      1.08,
    ),
    textElement(
      `${prefix}_variable_body`,
      '可随时重新赋值。',
      116,
      344,
      316,
      40,
      19,
      theme.textBody,
      undefined,
      1.16,
    ),
    shapeElement(`${prefix}_naming_panel`, 520, 210, 398, 208, '#fff7ed', 1),
    shapeElement(`${prefix}_naming_bar`, 520, 230, 8, 138, theme.accentSecondary, 1),
    textElement(
      `${prefix}_naming_title`,
      '<strong>命名规则</strong>',
      554,
      232,
      316,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_naming_body`,
      '字母、数字、下划线<br/>不能以数字开头<br/>区分大小写：name ≠ Name',
      554,
      300,
      318,
      86,
      19,
      theme.textBody,
      undefined,
      1.24,
    ),
    textElement(
      `${prefix}_type_callout`,
      '<strong>常见数据类型</strong> · <code>type(42)</code> → <code>int</code>',
      82,
      402,
      836,
      30,
      18,
      '#334155',
      undefined,
      1.1,
    ),
    ...typeCards.flatMap((card, index) => {
      const left = cardLeft + index * (cardWidth + cardGap);
      return [
        shapeElement(`${prefix}_type_card_${card.id}`, left, cardTop, cardWidth, 76, card.fill, 1),
        textElement(
          `${prefix}_type_label_${card.id}`,
          `<strong>${card.title}</strong>`,
          left + 18,
          cardTop + 14,
          cardWidth - 36,
          38,
          20,
          card.color,
          undefined,
          1.1,
        ),
      ];
    }),
  ];
}

type CanonicalTextBlock = {
  heading?: string;
  body: string;
};

function splitCanonicalTextLines(element: SlideLikeElement): string[] {
  const record = element as Record<string, unknown>;
  const html =
    element.type === 'shape'
      ? String((record['text'] as { content?: string } | undefined)?.content ?? '')
      : String(record['content'] ?? '');

  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^[•·\-\s]+/, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => line.length >= 3);
}

function getCanonicalSubtitle(elements: SlideLikeElement[], title: string): string {
  const titlePlain = stripHtml(title);
  const subtitle = elements
    .filter((element) => element.type === 'text')
    .filter((element) => element.top >= 96 && element.top < 190)
    .flatMap(splitCanonicalTextLines)
    .find((line) => line !== titlePlain && line.length <= 72);

  return subtitle ?? '把核心概念、方法和例子整理成稳定的课堂页面';
}

function canonicalTopicLabel(title: string, fallback = '本页'): string {
  const plain = stripHtml(title)
    .replace(/[?？].*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = plain
    .split(/[：:]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const topic = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return escapeHtmlShort(topic || fallback, 12);
}

function stepPanelHeading(title: string, suffix: string): string {
  return `${canonicalTopicLabel(title)}${suffix}`;
}

function isLikelyCanonicalHeading(line: string): boolean {
  const compact = line.replace(/\s+/g, '');
  if (compact.length < 3 || compact.length > 18) return false;
  if (/[。.!?！？；;，,]/.test(compact)) return false;
  return true;
}

function extractCanonicalLines(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): string[] {
  const title = stripHtml(getSlideTitle(elements, context));
  const subtitle = getCanonicalSubtitle(elements, title);
  const seen = new Set<string>();

  return elements
    .filter((element) => isReadableElement(element))
    .filter((element) => getElementBox(element).top >= 170)
    .sort((a, b) => a.top - b.top || a.left - b.left)
    .flatMap(splitCanonicalTextLines)
    .map((line) => line.trim())
    .filter((line) => line && line !== title && line !== subtitle)
    .filter((line) => {
      const key = line.replace(/\s+/g, '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function extractCanonicalBlocks(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): CanonicalTextBlock[] {
  const lines = extractCanonicalLines(elements, context);
  const blocks: CanonicalTextBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];
    if (isLikelyCanonicalHeading(line) && next) {
      blocks.push({
        heading: line,
        body: next,
      });
      index += 1;
    } else {
      blocks.push({
        body: line,
      });
    }
  }

  return normalizeCanonicalBlocks(blocks)
    .filter((block) => block.body.length >= 3)
    .slice(0, 5);
}

function normalizeCanonicalBlocks(blocks: CanonicalTextBlock[]): CanonicalTextBlock[] {
  const normalized: CanonicalTextBlock[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const next = blocks[index + 1];
    const heading = stripHtml(block.heading ?? '');
    const body = stripHtml(block.body);
    const nextBody = stripHtml(next?.body ?? '');

    const overviewHeading =
      /(基本数据类型|数据类型|基础类型|primitive|data\s*types?)/i.test(heading) &&
      body.length > 0 &&
      body.length <= 10;
    const nextIsValueList =
      !!next &&
      !next.heading &&
      /[,，、/]|byte|short|int|long|float|double|char|boolean|string/i.test(nextBody) &&
      nextBody.length <= 60;

    if (overviewHeading && nextIsValueList) {
      normalized.push({
        heading: body,
        body: next.body,
      });
      index += 1;
      continue;
    }

    normalized.push(block);
  }

  return normalized;
}

function _extractCanonicalStepLines(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): string[] {
  return extractCanonicalLines(elements, context)
    .filter((line) => /[①②③④⑤⑥⑦⑧⑨]|(^|\s)\d+[.、]/.test(line))
    .map((line, index) =>
      /^[①②③④⑤⑥⑦⑧⑨]/.test(line) || /(^|\s)\d+[.、]/.test(line) ? line : `${index + 1}. ${line}`,
    )
    .slice(0, 5);
}

function hasRobustStepPrefix(line: string): boolean {
  return (
    /^[①②③④⑤⑥⑦⑧⑨]/.test(line) ||
    /(^|\s)\d+\s*[.、:：)]/.test(line) ||
    /(^|\s)(step|steps)\s*\d+\s*[.、:：)]/i.test(line) ||
    /(^|\s)(步骤|第)\s*[一二三四五六七八九十\d]+\s*(步|[.、:：)])/i.test(line)
  );
}

function isRobustCanonicalStepLine(line: string): boolean {
  const compact = line.trim();
  if (!compact) return false;
  if (/step-by-step/i.test(compact) && !/\bstep\s*\d+/i.test(compact)) return false;
  return (
    hasRobustStepPrefix(compact) ||
    /(^|\s)(download|install|configure|verify|start|stop|restart|create|set|follow)\b/i.test(
      compact,
    )
  );
}

function extractRobustCanonicalStepLines(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): string[] {
  const lines = [...extractCanonicalLines(elements, context), ...(context?.keyPoints ?? [])];
  const seen = new Set<string>();

  return lines
    .map((line) => line.trim())
    .filter(isRobustCanonicalStepLine)
    .filter((line) => {
      const key = line.replace(/\s+/g, '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((line, index) => (hasRobustStepPrefix(line) ? line : `${index + 1}. ${line}`))
    .slice(0, 5);
}

function shouldUseCanonicalTextLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  if (elements.some((element) => element.id?.startsWith('polish_ref_'))) return false;
  if (
    elements.some(
      (element) =>
        element.id?.startsWith('polish_quad_') ||
        element.id?.startsWith('polish_visual_') ||
        element.id?.startsWith('polish_density_'),
    )
  ) {
    return false;
  }

  const hasStrongMedia = elements.some((element) =>
    ['image', 'video', 'chart', 'table', 'latex', 'code'].includes(element.type),
  );
  if (hasStrongMedia) return false;

  const generatedLikeCount = elements.filter((element) =>
    /^(text|shape|line|image|video|chart|table|latex)_[\w-]+$/i.test(element.id ?? ''),
  ).length;
  if (generatedLikeCount < Math.max(3, Math.ceil(elements.length * 0.6))) return false;

  const title = getSlideTitle(elements, context);
  if (/(谢谢|结束|目录|大纲|封面|小测验|测验|quiz|thanks|outline)/i.test(title)) return false;

  const blocks = extractCanonicalBlocks(elements, context);
  return blocks.length >= 2;
}

function shouldPreserveComposedTeachingLayout(elements: SlideLikeElement[]): boolean {
  const panels = elements.filter((element) => {
    if (!isBackgroundShapeLike(element)) return false;
    const box = getElementBox(element);
    if (box.top < 180 || box.top > 500) return false;
    if (box.width < 160 || box.height < 88) return false;
    if (box.width > 920 || box.height > 360) return false;
    return true;
  });
  if (panels.length < 2) return false;

  const textBoxes = elements.filter(isReadableElement);
  const panelsWithStructuredText = panels.filter((panel) => {
    const panelBox = getElementBox(panel);
    const containedTextCount = textBoxes.filter((text) => {
      const textBox = getElementBox(text);
      return (
        textBox.left >= panelBox.left &&
        textBox.right <= panelBox.right &&
        textBox.top >= panelBox.top &&
        textBox.bottom <= panelBox.bottom + 24
      );
    }).length;
    return containedTextCount >= 2;
  });

  const hasCardGrid = panels.filter((panel) => getElementBox(panel).width <= 360).length >= 3;
  const hasStackedBands = panels.filter((panel) => getElementBox(panel).width >= 520).length >= 2;

  return panelsWithStructuredText.length >= 2 && (hasCardGrid || hasStackedBands);
}

function normalizeStackedTeachingBands<T extends SlideLikeElement>(elements: T[]): T[] {
  const panels = elements
    .filter((element) => {
      if (!isBackgroundShapeLike(element)) return false;
      const box = getElementBox(element);
      return box.top >= 180 && box.width >= 760 && box.height >= 120;
    })
    .sort((a, b) => a.top - b.top);
  if (panels.length !== 2) return elements;

  const textBoxes = elements.filter(isReadableElement);
  const panelTextGroups = panels.map((panel) => {
    const panelBox = getElementBox(panel);
    return textBoxes
      .filter((text) => {
        const textBox = getElementBox(text);
        return (
          textBox.left >= panelBox.left &&
          textBox.right <= panelBox.right &&
          textBox.top >= panelBox.top &&
          textBox.top <= panelBox.bottom
        );
      })
      .sort((a, b) => a.top - b.top || a.left - b.left);
  });
  if (panelTextGroups.some((group) => group.length < 2)) return elements;

  const left = Math.min(...panels.map((panel) => getElementBox(panel).left));
  const width = Math.max(...panels.map((panel) => getElementBox(panel).width));
  const firstTop = clamp(Math.min(getElementBox(panels[0]).top, 188), 180, 196);
  const panelHeight = 156;
  const panelGap = 8;
  const headingLeft = left + 36;
  const textWidth = width - 72;

  const panelGeometry = panels.map((_panel, index) => ({
    top: firstTop + index * (panelHeight + panelGap),
  }));

  return elements.map((element) => {
    const panelIndex = panels.findIndex((panel) => panel.id === element.id);
    if (panelIndex >= 0) {
      return {
        ...element,
        left,
        top: panelGeometry[panelIndex].top,
        width,
        height: panelHeight,
      };
    }

    const headingIndex = panelTextGroups.findIndex((group) => group[0]?.id === element.id);
    if (headingIndex >= 0 && 'content' in element) {
      return {
        ...element,
        left: headingLeft,
        top: panelGeometry[headingIndex].top + 18,
        width: textWidth,
        height: 38,
        content: setFontSize(String((element as Record<string, unknown>).content ?? ''), 22),
        defaultFontName: FONT_STACK,
        defaultColor: '#1e4f7a',
        lineHeight: 1.08,
        paragraphSpace: 0,
      } as T;
    }

    const bodyPanelIndex = panelTextGroups.findIndex((group) =>
      group.slice(1).some((text) => text.id === element.id),
    );
    if (bodyPanelIndex >= 0 && 'content' in element) {
      return {
        ...element,
        left: headingLeft,
        top: panelGeometry[bodyPanelIndex].top + 58,
        width: textWidth,
        height: 86,
        content: setFontSize(String((element as Record<string, unknown>).content ?? ''), 19),
        defaultFontName: FONT_STACK,
        defaultColor: '#263244',
        lineHeight: 1.06,
        paragraphSpace: 0,
      } as T;
    }

    return element;
  });
}

const CANONICAL_TEXT_VARIANT_COUNT = 5;
const CANONICAL_STEP_VARIANT_COUNT = 3;
const CANONICAL_FORMULA_VARIANT_COUNT = 3;
const CANONICAL_DATA_VARIANT_COUNT = 3;
const CANONICAL_MEDIA_VARIANT_COUNT = 3;

function stableHashNumber(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function canonicalOrderVariant(
  context: SlidePolishContext | undefined,
  count: number,
): number | null {
  const order = context?.order;
  if (typeof order !== 'number' || !Number.isFinite(order) || order <= 0) return null;
  return (Math.floor(order) - 1) % count;
}

function canonicalSignature(
  elements: SlideLikeElement[],
  context: SlidePolishContext | undefined,
  blocks: CanonicalTextBlock[],
): string {
  return [
    context?.order,
    context?.title,
    ...(context?.keyPoints ?? []),
    ...blocks.flatMap((block) => [block.heading, block.body]),
    ...extractCanonicalLines(elements, context).slice(0, 6),
  ]
    .filter(Boolean)
    .join('|');
}

function chooseCanonicalTextVariant(
  elements: SlideLikeElement[],
  context: SlidePolishContext | undefined,
  blocks: CanonicalTextBlock[],
): number {
  const signal = getLayoutSignalText(elements, context);
  if (/(对比|比较|区别|异同|差异|versus| vs\.? )/i.test(signal)) return 2;
  if (/(流程|过程|路径|演进|阶段|从.+到|回调|callback|promise|async\/await)/i.test(signal)) {
    return 3;
  }
  if (/(工具|类型|分类|方式|三大|四种|常见|模块|模式)/i.test(signal)) return 1;
  if (/(原因|根因|关键|重点|核心|原则)/i.test(signal)) return 4;

  const orderVariant = canonicalOrderVariant(context, CANONICAL_TEXT_VARIANT_COUNT);
  if (orderVariant !== null) return orderVariant;

  return (
    stableHashNumber(canonicalSignature(elements, context, blocks)) % CANONICAL_TEXT_VARIANT_COUNT
  );
}

function chooseCanonicalStepVariant(
  elements: SlideLikeElement[],
  context: SlidePolishContext | undefined,
  blocks: CanonicalTextBlock[],
): number {
  const orderVariant = canonicalOrderVariant(context, CANONICAL_STEP_VARIANT_COUNT);
  if (orderVariant !== null) return orderVariant;
  return (
    stableHashNumber(canonicalSignature(elements, context, blocks)) % CANONICAL_STEP_VARIANT_COUNT
  );
}

function canonicalBlock(
  blocks: CanonicalTextBlock[],
  index: number,
  fallbackHeading: string,
  fallbackBody: string,
): CanonicalTextBlock {
  return blocks[index] ?? { heading: fallbackHeading, body: fallbackBody };
}

function canonicalHeading(block: CanonicalTextBlock, fallback: string, max = 20): string {
  const heading = !isStrictGenericCanonicalText(block.heading) ? block.heading : undefined;
  const fallbackHeading = !isStrictGenericCanonicalText(fallback) ? fallback : undefined;
  return escapeHtmlShort(heading ?? fallbackHeading ?? deriveCanonicalHeading(block.body), max);
}

function canonicalBody(block: CanonicalTextBlock, max: number): string {
  return escapeHtmlShort(block.body, max);
}

function deriveCanonicalHeading(text: string): string {
  const clean = stripHtml(text).replace(/\s+/g, ' ').trim();
  const colonLead = clean.split(/[：:]/)[0]?.trim();
  if (colonLead && colonLead.length >= 3 && colonLead.length <= 18) return colonLead;
  const sentenceLead = clean.split(/[。.!?！？；;，,]/)[0]?.trim();
  if (sentenceLead && sentenceLead.length >= 3) return sentenceLead;
  return clean || '本页内容';
}

function isGenericCanonicalText(text: string | undefined): boolean {
  if (!text) return true;
  const normalized = stripHtml(text).replace(/\s+/g, '');
  if (!normalized) return true;
  return /^(核心功能|核心抓手|学习目标|本页要点|关键结论|课堂小结|小结|结论|要点[一二三四五六\d]*|重点[一二三四五六\d]*|方法|结果|观察|追问)$/i.test(
    normalized,
  );
}

function canonicalConcreteBody(block: CanonicalTextBlock, fallback: string, max: number): string {
  const body = isStrictGenericCanonicalText(block.body) ? fallback : block.body;
  return escapeHtmlShort(body, max);
}

function isStrictGenericCanonicalText(text: string | undefined): boolean {
  if (isGenericCanonicalText(text)) return true;
  const normalized = stripHtml(text ?? '').replace(/\s+/g, '');
  return /^(核心功能|核心抓手|学习目标|本页要点|关键结论|课堂小结|小结|结论|视角[A-C]|观点[A-C]|Perspective[A-C]|CoreFeature|KeyPoint|Conclusion|Step\d{1,2})$/i.test(
    normalized,
  );
}

function canonicalBandText(block: CanonicalTextBlock, fallback: string, max: number): string {
  const heading = !isStrictGenericCanonicalText(block.heading) ? block.heading : undefined;
  const body = isStrictGenericCanonicalText(block.body) ? fallback : block.body;
  if (heading && body && heading !== body) {
    return `<strong>${escapeHtmlShort(heading, 18)}</strong>：${escapeHtmlShort(body, max)}`;
  }
  return escapeHtmlShort(body || heading || fallback, max + 18);
}

function concreteCanonicalTextCandidates(
  blocks: CanonicalTextBlock[],
  context?: SlidePolishContext,
): string[] {
  return [
    ...(context?.keyPoints ?? []),
    ...blocks.flatMap((block) => [block.heading, block.body]),
  ].filter((value): value is string => !!value && !isStrictGenericCanonicalText(value));
}

function concreteCanonicalTextFallback(
  blocks: CanonicalTextBlock[],
  context: SlidePolishContext | undefined,
  fallback: string,
): string {
  return concreteCanonicalTextCandidates(blocks, context)[0] ?? fallback;
}

function extractMediaElements(
  elements: SlideLikeElement[],
): Array<SlideLikeElement & Record<string, unknown>> {
  return elements
    .filter((element) => element.type === 'image' || element.type === 'video')
    .map((element) => element as SlideLikeElement & Record<string, unknown>)
    .slice(0, 2);
}

function mediaElementFrom(
  source: SlideLikeElement & Record<string, unknown>,
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
): SlideLikeElement & Record<string, unknown> {
  return {
    ...source,
    id,
    left,
    top,
    width,
    height,
    rotate: 0,
  };
}

function shouldUseCanonicalMediaLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  if (elements.some((element) => element.id?.startsWith('polish_ref_'))) return false;
  if (elements.some((element) => element.id?.startsWith('polish_quad_'))) return false;

  const mediaElements = extractMediaElements(elements);
  if (mediaElements.length === 0) return false;

  const hasBlockingStructure = elements.some((element) =>
    ['chart', 'table', 'latex', 'code'].includes(element.type),
  );
  if (hasBlockingStructure) return false;

  const generatedLikeCount = elements.filter((element) =>
    /^(text|shape|line|image|video|chart|table|latex)_[\w-]+$/i.test(element.id ?? ''),
  ).length;
  if (generatedLikeCount < Math.max(3, Math.ceil(elements.length * 0.55))) return false;

  const title = getSlideTitle(elements, context);
  if (/(谢谢|结束|目录|大纲|封面|小测验|测验|quiz|thanks|outline)/i.test(title)) return false;

  return true;
}

function chooseCanonicalMediaVariant(
  elements: SlideLikeElement[],
  context: SlidePolishContext | undefined,
  blocks: CanonicalTextBlock[],
): number {
  const orderVariant = canonicalOrderVariant(context, CANONICAL_MEDIA_VARIANT_COUNT);
  if (orderVariant !== null) return orderVariant;
  return (
    stableHashNumber(canonicalSignature(elements, context, blocks)) % CANONICAL_MEDIA_VARIANT_COUNT
  );
}

function canonicalMediaReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const subtitle = getCanonicalSubtitle(elements, title);
  const mediaElements = extractMediaElements(elements);
  const blocks = extractCanonicalBlocks(elements, context);
  const variant = chooseCanonicalMediaVariant(elements, context, blocks);
  const mainMedia = mediaElements[0];
  const first = canonicalBlock(blocks, 0, '观察重点', subtitle);
  const second = canonicalBlock(blocks, 1, '课堂提示', context?.keyPoints?.[0] ?? subtitle);
  const third = canonicalBlock(blocks, 2, '追问', context?.keyPoints?.[1] ?? first.body);

  if (variant === 1) {
    const prefix = 'polish_ref_canonical_media_v1';

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      mediaElementFrom(mainMedia, `${prefix}_media_main`, 82, 216, 546, 274),
      shapeElement(`${prefix}_right_rule`, 678, 222, 3, 236, theme.accent, 0.9),
      textElement(
        `${prefix}_right_title`,
        `<strong>${canonicalHeading(first, '观察重点', 18)}</strong>`,
        706,
        238,
        190,
        42,
        24,
        theme.textPrimary,
        undefined,
        1.1,
      ),
      textElement(
        `${prefix}_right_body`,
        canonicalBody(first, 36),
        706,
        324,
        190,
        86,
        19,
        theme.textBody,
        undefined,
        1.2,
      ),
    ];
  }

  if (variant === 2) {
    const prefix = 'polish_ref_canonical_media_v2';

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      shapeElement(`${prefix}_left_rule`, 82, 220, 3, 232, theme.accentSecondary, 0.9),
      textElement(
        `${prefix}_left_title`,
        `<strong>${canonicalHeading(second, '先看什么', 18)}</strong>`,
        112,
        236,
        230,
        42,
        24,
        theme.textPrimary,
        undefined,
        1.1,
      ),
      textElement(
        `${prefix}_left_body`,
        canonicalBody(second, 42),
        112,
        320,
        230,
        84,
        19,
        theme.textBody,
        undefined,
        1.2,
      ),
      mediaElementFrom(mainMedia, `${prefix}_media_right`, 404, 216, 514, 274),
    ];
  }

  const prefix = 'polish_ref_canonical_media_v0';

  return [
    ...referenceHeaderElements(prefix, title, subtitle, theme, context),
    mediaElementFrom(mainMedia, `${prefix}_media_top`, 132, 204, 736, 214),
    shapeElement(`${prefix}_bottom_rule`, 132, 452, 736, 3, theme.accent, 0.9),
    textElement(
      `${prefix}_bottom_note`,
      `<strong>${canonicalHeading(third, '观察后追问', 16)}</strong>：${canonicalBody(third, 36)}`,
      164,
      466,
      672,
      36,
      18,
      theme.textBody,
      undefined,
      1.12,
    ),
  ];
}

function extractDataElements(
  elements: SlideLikeElement[],
): Array<SlideLikeElement & Record<string, unknown>> {
  return elements
    .filter((element) => element.type === 'table' || element.type === 'chart')
    .map((element) => element as SlideLikeElement & Record<string, unknown>)
    .slice(0, 2);
}

function dataElementFrom(
  source: SlideLikeElement & Record<string, unknown>,
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
): SlideLikeElement & Record<string, unknown> {
  return {
    ...source,
    id,
    left,
    top,
    width,
    height,
    rotate: 0,
  };
}

function shouldUseCanonicalDataLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  if (elements.some((element) => element.id?.startsWith('polish_ref_'))) return false;
  if (elements.some((element) => element.id?.startsWith('polish_quad_'))) return false;

  const dataElements = extractDataElements(elements);
  if (dataElements.length === 0) return false;

  const hasBlockingMedia = elements.some((element) =>
    ['image', 'video', 'latex', 'code'].includes(element.type),
  );
  if (hasBlockingMedia) return false;

  const generatedLikeCount = elements.filter((element) =>
    /^(text|shape|line|image|video|chart|table|latex)_[\w-]+$/i.test(element.id ?? ''),
  ).length;
  if (generatedLikeCount < Math.max(3, Math.ceil(elements.length * 0.55))) return false;

  const title = getSlideTitle(elements, context);
  if (/(谢谢|结束|目录|大纲|封面|小测验|测验|quiz|thanks|outline)/i.test(title)) return false;

  return true;
}

function chooseCanonicalDataVariant(
  elements: SlideLikeElement[],
  context: SlidePolishContext | undefined,
  blocks: CanonicalTextBlock[],
): number {
  const orderVariant = canonicalOrderVariant(context, CANONICAL_DATA_VARIANT_COUNT);
  if (orderVariant !== null) return orderVariant;
  return (
    stableHashNumber(canonicalSignature(elements, context, blocks)) % CANONICAL_DATA_VARIANT_COUNT
  );
}

function canonicalDataReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const subtitle = getCanonicalSubtitle(elements, title);
  const dataElements = extractDataElements(elements);
  const blocks = extractCanonicalBlocks(elements, context);
  const variant = chooseCanonicalDataVariant(elements, context, blocks);
  const mainData = dataElements[0];
  const secondData = dataElements[1] ?? dataElements[0];
  const first = canonicalBlock(blocks, 0, '观察对象', subtitle);
  const second = canonicalBlock(blocks, 1, '对比结论', context?.keyPoints?.[0] ?? subtitle);
  const third = canonicalBlock(blocks, 2, '课堂提问', context?.keyPoints?.[1] ?? first.body);

  if (variant === 1) {
    const prefix = 'polish_ref_canonical_data_v1';

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      dataElementFrom(mainData, `${prefix}_data_main`, 82, 214, 520, 248),
      shapeElement(`${prefix}_right_rule`, 652, 218, 3, 230, theme.accent, 0.9),
      textElement(
        `${prefix}_right_title`,
        `<strong>${canonicalHeading(first, '读表/读图', 16)}</strong>`,
        682,
        232,
        220,
        38,
        24,
        theme.textPrimary,
        undefined,
        1.1,
      ),
      textElement(
        `${prefix}_right_body`,
        canonicalBody(first, 44),
        682,
        310,
        220,
        86,
        19,
        theme.textBody,
        undefined,
        1.2,
      ),
      shapeElement(`${prefix}_bottom_rule`, 82, 490, 836, 3, theme.accentSecondary, 0.9),
    ];
  }

  if (variant === 2) {
    const prefix = 'polish_ref_canonical_data_v2';

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      shapeElement(`${prefix}_top_rule`, 82, 210, 836, 3, theme.accent, 0.9),
      dataElementFrom(mainData, `${prefix}_data_top`, 82, 236, 836, 218),
      textElement(
        `${prefix}_left_note`,
        `<strong>${canonicalHeading(second, '公式推导', 16)}</strong>：${canonicalConcreteBody(second, context?.keyPoints?.[0] ?? subtitle, 52)}`,
        92,
        470,
        388,
        42,
        17,
        theme.textBody,
        undefined,
        1.1,
      ),
      textElement(
        `${prefix}_right_note`,
        `<strong>${canonicalHeading(third, '继续推导', 16)}</strong>：${canonicalConcreteBody(third, context?.keyPoints?.[1] ?? first.body, 58)}`,
        512,
        470,
        396,
        42,
        17,
        '#1e3a5f',
        undefined,
        1.1,
      ),
    ];
  }

  const prefix = 'polish_ref_canonical_data_v0';

  return [
    ...referenceHeaderElements(prefix, title, subtitle, theme, context),
    shapeElement(`${prefix}_left_rule`, 82, 222, 3, 230, theme.accent, 0.9),
    textElement(
      `${prefix}_left_title`,
      `<strong>${canonicalHeading(first, '数据视角', 18)}</strong>`,
      112,
      234,
      252,
      38,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_left_body`,
      canonicalBody(first, 44),
      112,
      312,
      252,
      84,
      19,
      theme.textBody,
      undefined,
      1.2,
    ),
    dataElementFrom(secondData, `${prefix}_data_right`, 430, 218, 488, 250),
    shapeElement(`${prefix}_takeaway_rule`, 430, 492, 488, 3, theme.accentSecondary, 0.9),
  ];
}

function extractFormulaElements(
  elements: SlideLikeElement[],
): Array<SlideLikeElement & Record<string, unknown>> {
  return elements
    .filter((element) => element.type === 'latex')
    .map((element) => element as SlideLikeElement & Record<string, unknown>)
    .filter((element) => String(element['latex'] ?? '').trim().length > 0)
    .slice(0, 3);
}

function formulaElementFrom(
  source: SlideLikeElement & Record<string, unknown>,
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
): SlideLikeElement & Record<string, unknown> {
  return {
    ...source,
    id,
    type: 'latex',
    left,
    top,
    width,
    height,
    rotate: 0,
    align: 'center',
    preserveBox: true,
  };
}

function shouldUseCanonicalFormulaLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  if (elements.some((element) => element.id?.startsWith('polish_ref_'))) return false;
  if (elements.some((element) => element.id?.startsWith('polish_quad_'))) return false;
  if (elements.some((element) => element.id?.startsWith('polish_visual_'))) return false;

  const formulas = extractFormulaElements(elements);
  if (formulas.length === 0) return false;

  const source = getLayoutSignalText(elements, context);
  const hasFormulaPageSignal =
    formulas.length >= 2 ||
    /(公式|方程|关系式|推导|等式|定理|formula|equation|derivation)/i.test(source);
  if (!hasFormulaPageSignal) return false;

  const hasBlockingMedia = elements.some((element) =>
    ['image', 'video', 'chart', 'table', 'code'].includes(element.type),
  );
  if (hasBlockingMedia) return false;

  const generatedLikeCount = elements.filter((element) =>
    /^(text|shape|line|image|video|chart|table|latex)_[\w-]+$/i.test(element.id ?? ''),
  ).length;
  if (generatedLikeCount < Math.max(3, Math.ceil(elements.length * 0.55))) return false;

  const title = getSlideTitle(elements, context);
  if (/(谢谢|结束|目录|大纲|封面|小测验|测验|quiz|thanks|outline)/i.test(title)) return false;

  return true;
}

function chooseCanonicalFormulaVariant(
  elements: SlideLikeElement[],
  context: SlidePolishContext | undefined,
  blocks: CanonicalTextBlock[],
): number {
  const orderVariant = canonicalOrderVariant(context, CANONICAL_FORMULA_VARIANT_COUNT);
  if (orderVariant !== null) return orderVariant;
  return (
    stableHashNumber(canonicalSignature(elements, context, blocks)) %
    CANONICAL_FORMULA_VARIANT_COUNT
  );
}

function canonicalFormulaReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const subtitle = getCanonicalSubtitle(elements, title);
  const formulas = extractFormulaElements(elements);
  const blocks = extractCanonicalBlocks(elements, context);
  const variant = chooseCanonicalFormulaVariant(elements, context, blocks);
  const mainFormula = formulas[0];
  const secondFormula = formulas[1] ?? formulas[0];
  const thirdFormula = formulas[2] ?? formulas[1] ?? formulas[0];
  const mainBlock = canonicalBlock(blocks, 0, '公式含义', subtitle);
  const secondBlock = canonicalBlock(blocks, 1, '使用条件', context?.keyPoints?.[0] ?? subtitle);
  const _thirdBlock = canonicalBlock(
    blocks,
    2,
    '课堂检查',
    context?.keyPoints?.[1] ?? mainBlock.body,
  );

  if (variant === 1) {
    const prefix = 'polish_ref_canonical_formula_v1';

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      shapeElement(`${prefix}_rail`, 96, 218, 3, 224, theme.accent, 0.9),
      ...[mainFormula, secondFormula, thirdFormula]
        .slice(0, Math.min(3, formulas.length))
        .flatMap((formula, index) => {
          const top = 202 + index * 98;
          const block = canonicalBlock(blocks, index, `步骤 ${index + 1}`, subtitle);
          return [
            shapeElement(`${prefix}_formula_panel_${index}`, 128, top, 426, 82, '#f8fafc', 1),
            formulaElementFrom(formula, `${prefix}_formula_${index}`, 148, top + 9, 386, 64),
            shapeElement(
              `${prefix}_note_line_${index}`,
              596,
              top + 8,
              3,
              66,
              theme.accentSecondary,
              0.88,
            ),
            textElement(
              `${prefix}_note_${index}`,
              `<strong>${canonicalHeading(block, `说明 ${index + 1}`, 14)}</strong>：${canonicalBody(block, 22)}`,
              622,
              top + 14,
              260,
              46,
              18,
              theme.textBody,
              undefined,
              1.14,
            ),
          ];
        }),
    ];
  }

  if (variant === 2) {
    const prefix = 'polish_ref_canonical_formula_v2';

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      shapeElement(`${prefix}_left_panel`, 82, 210, 366, 264, '#f8fafc', 1),
      shapeElement(`${prefix}_left_bar`, 82, 236, 8, 162, theme.accent, 1),
      textElement(
        `${prefix}_left_title`,
        `<strong>${canonicalHeading(mainBlock, '公式含义', 18)}</strong>`,
        116,
        242,
        270,
        42,
        24,
        theme.textPrimary,
        undefined,
        1.1,
      ),
      textElement(
        `${prefix}_left_body`,
        canonicalBody(mainBlock, 44),
        116,
        322,
        270,
        82,
        19,
        theme.textBody,
        undefined,
        1.2,
      ),
      shapeElement(`${prefix}_formula_panel`, 500, 218, 418, 156, '#eef6ff', 1),
      formulaElementFrom(mainFormula, `${prefix}_formula_main`, 526, 248, 366, 96),
      shapeElement(`${prefix}_bottom_rule`, 500, 418, 418, 3, theme.accentSecondary, 0.9),
      textElement(
        `${prefix}_bottom_note`,
        `<strong>${canonicalHeading(secondBlock, '代入检查', 14)}</strong>：${canonicalBody(secondBlock, 30)}`,
        526,
        438,
        340,
        44,
        18,
        '#7c3f00',
        undefined,
        1.14,
      ),
    ];
  }

  const prefix = 'polish_ref_canonical_formula_v0';

  return [
    ...referenceHeaderElements(prefix, title, subtitle, theme, context),
    shapeElement(`${prefix}_formula_panel`, 128, 206, 744, 132, '#f8fafc', 1),
    formulaElementFrom(mainFormula, `${prefix}_formula_main`, 164, 232, 672, 82),
    shapeElement(`${prefix}_left_rule`, 128, 374, 330, 3, theme.accent, 0.9),
    textElement(
      `${prefix}_left_note`,
      `<strong>${canonicalHeading(mainBlock, '读公式', 14)}</strong>：${canonicalBody(mainBlock, 28)}`,
      128,
      394,
      330,
      62,
      18,
      theme.textBody,
      undefined,
      1.18,
    ),
    shapeElement(`${prefix}_right_rule`, 542, 374, 330, 3, theme.accentSecondary, 0.9),
    textElement(
      `${prefix}_right_note`,
      `<strong>${canonicalHeading(secondBlock, '用公式', 14)}</strong>：${canonicalBody(secondBlock, 28)}`,
      542,
      394,
      330,
      62,
      18,
      '#7c3f00',
      undefined,
      1.18,
    ),
  ];
}

function canonicalStepsReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const subtitle = getCanonicalSubtitle(elements, title);
  const steps = extractRobustCanonicalStepLines(elements, context);
  const blocks = extractCanonicalBlocks(elements, context);
  const variant = chooseCanonicalStepVariant(elements, context, blocks);
  const stepTopic = canonicalTopicLabel(title);

  if (variant === 1) {
    const prefix = 'polish_ref_canonical_steps_v1';
    const processSteps = steps.slice(0, steps.length >= 4 ? 4 : 3);
    if (processSteps.length >= 4) {
      const positions = [
        [82, 222],
        [520, 222],
        [82, 348],
        [520, 348],
      ] as const;

      return [
        ...referenceHeaderElements(prefix, title, subtitle, theme, context),
        ...processSteps.flatMap((step, index) => {
          const [left, top] = positions[index];
          return [
            shapeElement(`${prefix}_card_${index}`, left, top, 398, 100, '#f8fafc', 1),
            circleElement(`${prefix}_dot_${index}`, left + 22, top + 22, 34, theme.accent, 0.95),
            textElement(
              `${prefix}_step_${index}`,
              `<strong>${index + 1}</strong> ${escapeHtmlShort(step.replace(/^[①②③④⑤⑥⑦⑧⑨]|\d+[.、]\s*/, ''), 30)}`,
              left + 68,
              top + 24,
              300,
              58,
              18,
              theme.textBody,
              undefined,
              1.18,
            ),
          ];
        }),
        shapeElement(`${prefix}_takeaway_panel`, 132, 482, 736, 3, theme.accent, 0.85),
        textElement(
          `${prefix}_takeaway`,
          `<strong>${stepTopic}检查</strong>：${escapeHtmlShort(blocks[0]?.body ?? subtitle, 34)}`,
          166,
          492,
          668,
          28,
          17,
          '#1e3a5f',
          undefined,
          1.08,
        ),
      ];
    }
    const cardWidth = 254;
    const cardGap = 43;
    const cardTop = 236;

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      ...processSteps.flatMap((step, index) => {
        const left = 82 + index * (cardWidth + cardGap);
        return [
          shapeElement(`${prefix}_card_${index}`, left, cardTop, cardWidth, 190, '#f8fafc', 1),
          circleElement(`${prefix}_dot_${index}`, left + 24, cardTop + 26, 40, theme.accent, 0.95),
          textElement(
            `${prefix}_step_${index}`,
            `<strong>${index + 1}</strong> ${escapeHtmlShort(step.replace(/^[①②③④⑤⑥⑦⑧⑨]|\d+[.、]\s*/, ''), 20)}`,
            left + 30,
            cardTop + 76,
            cardWidth - 60,
            96,
            18,
            theme.textBody,
            undefined,
            1.2,
          ),
        ];
      }),
      shapeElement(`${prefix}_takeaway_panel`, 132, 442, 736, 3, theme.accent, 0.9),
      textElement(
        `${prefix}_takeaway`,
        `<strong>${stepTopic}检查</strong>：${escapeHtmlShort(blocks[0]?.body ?? subtitle, 24)}`,
        166,
        452,
        668,
        52,
        18,
        '#1e3a5f',
        undefined,
        1.12,
      ),
    ];
  }

  if (variant === 2) {
    const prefix = 'polish_ref_canonical_steps_v2';
    const stepBody = steps.map((step) => `✓ ${escapeHtmlShort(step, 34)}`).join('<br/>');
    const note = blocks.find((block) => !steps.some((step) => step.includes(block.body)))?.body;

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      shapeElement(`${prefix}_check_panel`, 82, 212, 420, 282, '#f8fafc', 1),
      shapeElement(`${prefix}_check_bar`, 82, 232, 8, 180, theme.accent, 1),
      textElement(
        `${prefix}_check_title`,
        `<strong>${stepPanelHeading(title, '清单')}</strong>`,
        116,
        236,
        318,
        34,
        24,
        theme.textPrimary,
        undefined,
        1.1,
      ),
      textElement(
        `${prefix}_check_body`,
        stepBody,
        116,
        288,
        332,
        184,
        17,
        theme.textBody,
        undefined,
        1.2,
      ),
      shapeElement(`${prefix}_focus_panel`, 548, 212, 370, 178, '#eef6ff', 1),
      textElement(
        `${prefix}_focus_title`,
        `<strong>${stepPanelHeading(title, '目标')}</strong>`,
        582,
        238,
        286,
        32,
        23,
        theme.textPrimary,
        undefined,
        1.1,
      ),
      textElement(
        `${prefix}_focus_body`,
        escapeHtmlShort(note ?? subtitle, 70),
        582,
        294,
        286,
        70,
        18,
        '#1e3a5f',
        undefined,
        1.15,
      ),
      shapeElement(`${prefix}_result_panel`, 548, 398, 370, 3, theme.accentSecondary, 0.9),
      textElement(
        `${prefix}_result`,
        `<strong>最后检查</strong>：${escapeHtmlShort(blocks[1]?.body ?? '能否独立复述每一步的作用', 46)}`,
        582,
        418,
        286,
        48,
        18,
        '#7c3f00',
        undefined,
        1.18,
      ),
    ];
  }

  const prefix = 'polish_ref_canonical_steps_v0';
  const note = blocks.find((block) => !steps.some((step) => step.includes(block.body)))?.body;

  return [
    ...referenceHeaderElements(prefix, title, subtitle, theme, context),
    shapeElement(`${prefix}_goal_panel`, 82, 210, 352, 264, '#f8fafc', 1),
    shapeElement(`${prefix}_goal_bar`, 82, 232, 8, 164, theme.accent, 1),
    textElement(
      `${prefix}_goal_title`,
      `<strong>${stepPanelHeading(title, '目标')}</strong>`,
      116,
      238,
      270,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_goal_body`,
      escapeHtmlShort(note ?? subtitle, 78),
      116,
      304,
      270,
      96,
      20,
      theme.textBody,
      undefined,
      1.2,
    ),
    shapeElement(`${prefix}_steps_panel`, 486, 210, 432, 264, '#eef6ff', 1),
    textElement(
      `${prefix}_steps_title`,
      `<strong>${stepPanelHeading(title, '步骤')}</strong>`,
      520,
      236,
      350,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_steps_body`,
      steps.map((step) => escapeHtmlShort(step, 46)).join('<br/>'),
      520,
      294,
      344,
      136,
      18,
      '#1e3a5f',
      undefined,
      1.34,
    ),
  ];
}

function canonicalTextReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const steps = extractRobustCanonicalStepLines(elements, context);
  if (steps.length >= 2) return canonicalStepsReferenceLayout(elements, context);

  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const subtitle = getCanonicalSubtitle(elements, title);
  const blocks = extractCanonicalBlocks(elements, context);
  const first = blocks[0] ?? { heading: '核心概念', body: subtitle };
  const variant = chooseCanonicalTextVariant(elements, context, blocks);

  if (variant === 1) {
    const prefix = 'polish_ref_canonical_v1';
    const cards = [
      canonicalBlock(blocks, 0, context?.keyPoints?.[0] ?? '课堂入口', subtitle),
      canonicalBlock(blocks, 1, context?.keyPoints?.[1] ?? '操作方法', subtitle),
      canonicalBlock(blocks, 2, context?.keyPoints?.[2] ?? '结果检查', subtitle),
    ];
    const fills = ['#f8fafc', '#eef6ff', '#fff7ed'];

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      ...cards.flatMap((block, index) => {
        const left = 82 + index * 290;
        return [
          shapeElement(`${prefix}_card_${index}`, left, 214, 256, 238, fills[index], 1),
          shapeElement(`${prefix}_card_rule_${index}`, left + 28, 244, 76, 4, theme.accent, 0.9),
          textElement(
            `${prefix}_card_title_${index}`,
            `<strong>${canonicalHeading(block, context?.keyPoints?.[index] ?? block.body, 18)}</strong>`,
            left + 24,
            266,
            208,
            68,
            22,
            theme.textPrimary,
            undefined,
            1.08,
          ),
          textElement(
            `${prefix}_card_body_${index}`,
            canonicalBody(block, 34),
            left + 28,
            346,
            196,
            82,
            18,
            theme.textBody,
            undefined,
            1.18,
          ),
        ];
      }),
    ];
  }

  if (variant === 2) {
    const prefix = 'polish_ref_canonical_v2';
    const leftBlock = canonicalBlock(blocks, 0, '要点一', subtitle);
    const rightBlock = canonicalBlock(blocks, 1, '要点二', context?.keyPoints?.[0] ?? subtitle);
    const bottomBlock = canonicalBlock(blocks, 2, '小结', context?.keyPoints?.[1] ?? first.body);

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      shapeElement(`${prefix}_left_panel`, 82, 212, 398, 246, '#f8fafc', 1),
      shapeElement(`${prefix}_left_bar`, 82, 236, 8, 154, theme.accent, 1),
      textElement(
        `${prefix}_left_title`,
        `<strong>${canonicalHeading(leftBlock, '要点一', 20)}</strong>`,
        116,
        244,
        302,
        36,
        24,
        theme.textPrimary,
        undefined,
        1.1,
      ),
      textElement(
        `${prefix}_left_body`,
        canonicalBody(leftBlock, 34),
        116,
        318,
        302,
        96,
        19,
        theme.textBody,
        undefined,
        1.2,
      ),
      shapeElement(`${prefix}_right_panel`, 520, 212, 398, 246, '#eef6ff', 1),
      shapeElement(`${prefix}_right_bar`, 910, 236, 8, 154, theme.accentSecondary, 1),
      textElement(
        `${prefix}_right_title`,
        `<strong>${canonicalHeading(rightBlock, '要点二', 20)}</strong>`,
        554,
        244,
        302,
        36,
        24,
        theme.textPrimary,
        undefined,
        1.1,
      ),
      textElement(
        `${prefix}_right_body`,
        canonicalBody(rightBlock, 34),
        554,
        318,
        302,
        96,
        19,
        '#1e3a5f',
        undefined,
        1.2,
      ),
      shapeElement(`${prefix}_bridge`, 170, 440, 660, 3, theme.accentSecondary, 0.9),
      textElement(
        `${prefix}_bridge_text`,
        `<strong>${canonicalHeading(bottomBlock, '小结', 14)}</strong>：${canonicalBody(bottomBlock, 28)}`,
        204,
        450,
        592,
        52,
        18,
        '#7c3f00',
        undefined,
        1.05,
      ),
    ];
  }

  if (variant === 3) {
    const prefix = 'polish_ref_canonical_v3';
    const timelineBlocks = [
      canonicalBlock(blocks, 0, '起点', subtitle),
      canonicalBlock(blocks, 1, '变化', context?.keyPoints?.[0] ?? subtitle),
      canonicalBlock(blocks, 2, '方法', context?.keyPoints?.[1] ?? subtitle),
      canonicalBlock(blocks, 3, '结果', context?.keyPoints?.[2] ?? first.body),
    ];

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      shapeElement(`${prefix}_rail_panel`, 82, 210, 142, 278, '#f8fafc', 1),
      shapeElement(`${prefix}_rail`, 144, 238, 8, 206, theme.accent, 0.9),
      ...timelineBlocks.flatMap((block, index) => {
        const top = 206 + index * 72;
        return [
          circleElement(`${prefix}_node_${index}`, 130, top + 20, 36, theme.accent, 0.95),
          shapeElement(
            `${prefix}_item_${index}`,
            270,
            top,
            648,
            72,
            index % 2 ? '#eef6ff' : '#f8fafc',
            1,
          ),
          textElement(
            `${prefix}_item_text_${index}`,
            `<strong>${canonicalHeading(block, `阶段 ${index + 1}`, 12)}</strong>：${canonicalBody(block, 16)}`,
            300,
            top + 10,
            580,
            50,
            18,
            index % 2 ? '#1e3a5f' : theme.textBody,
            undefined,
            1.12,
          ),
        ];
      }),
    ];
  }

  if (variant === 4) {
    const prefix = 'polish_ref_canonical_v4';
    const focusBlock = canonicalBlock(blocks, 0, '核心抓手', subtitle);
    const leftBlocks = [
      canonicalBlock(blocks, 1, '要点一', context?.keyPoints?.[0] ?? subtitle),
      canonicalBlock(blocks, 2, '要点二', context?.keyPoints?.[1] ?? subtitle),
      canonicalBlock(blocks, 3, '要点三', context?.keyPoints?.[2] ?? first.body),
    ];

    const concreteCandidates = concreteCanonicalTextCandidates(blocks, context);
    const v4LeftBlocks =
      (context?.keyPoints?.length ?? 0) >= 2
        ? context!.keyPoints!.slice(0, 3).map((point) => ({ body: point }))
        : leftBlocks.map((block, index) => ({
            ...block,
            body: isGenericCanonicalText(block.body)
              ? (concreteCandidates[index + 1] ?? context?.keyPoints?.[index] ?? block.body)
              : block.body,
          }));
    const focusFallback = concreteCanonicalTextFallback(blocks, context, subtitle);

    return [
      ...referenceHeaderElements(prefix, title, subtitle, theme, context),
      ...v4LeftBlocks.flatMap((block, index) => {
        const top = 212 + index * 96;
        return [
          shapeElement(
            `${prefix}_left_band_${index}`,
            82,
            top,
            390,
            92,
            index % 2 ? '#eef6ff' : '#f8fafc',
            1,
          ),
          textElement(
            `${prefix}_left_text_${index}`,
            canonicalBandText(block, context?.keyPoints?.[index] ?? `要点 ${index + 1}`, 44),
            110,
            top + 12,
            330,
            70,
            18,
            index % 2 ? '#1e3a5f' : theme.textBody,
            undefined,
            1.15,
          ),
        ];
      }),
      shapeElement(`${prefix}_focus_panel`, 520, 210, 398, 278, '#fff7ed', 1),
      shapeElement(`${prefix}_focus_bar`, 520, 236, 8, 176, theme.accentSecondary, 1),
      textElement(
        `${prefix}_focus_title`,
        `<strong>${canonicalHeading(focusBlock, '核心抓手', 20)}</strong>`,
        556,
        246,
        300,
        38,
        25,
        theme.textPrimary,
        undefined,
        1.1,
      ),
      textElement(
        `${prefix}_focus_body`,
        canonicalConcreteBody(focusBlock, focusFallback, 88),
        556,
        328,
        302,
        92,
        20,
        '#7c3f00',
        undefined,
        1.2,
      ),
    ];
  }

  const prefix = 'polish_ref_canonical_v0';
  const rightBlocks = blocks.slice(1, 4);
  const bandTop = 204;
  const bandHeight = 96;
  const bandGap = 16;

  return [
    ...referenceHeaderElements(prefix, title, subtitle, theme, context),
    shapeElement(`${prefix}_anchor_panel`, 82, 210, 330, 276, '#f8fafc', 1),
    shapeElement(`${prefix}_anchor_bar`, 82, 236, 8, 172, theme.accent, 1),
    textElement(
      `${prefix}_anchor_title`,
      `<strong>${escapeHtmlShort(first.heading ?? '核心概念', 20)}</strong>`,
      116,
      242,
      246,
      38,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_anchor_body`,
      escapeHtmlShort(first.body, 82),
      116,
      316,
      246,
      92,
      20,
      theme.textBody,
      undefined,
      1.2,
    ),
    ...rightBlocks.flatMap((block, index) => {
      const top = bandTop + index * (bandHeight + bandGap);
      return [
        shapeElement(`${prefix}_band_${index}`, 452, top, 466, bandHeight, '#eef6ff', 1),
        textElement(
          `${prefix}_band_text_${index}`,
          `<strong>${escapeHtmlShort(block.heading ?? `要点 ${index + 1}`, 18)}</strong>：${escapeHtmlShort(block.body, 34)}`,
          478,
          top + 12,
          410,
          70,
          18,
          '#1e3a5f',
          undefined,
          1.18,
        ),
      ];
    }),
  ];
}

type RedisInternalFocus = 'sds' | 'list' | 'hash' | 'set' | 'zset';

function getRedisInternalFocus(text: string): RedisInternalFocus | null {
  const normalized = stripHtml(text).replace(/\s+/g, ' ');
  if (
    /^\s*(?:String|\u5b57\u7b26\u4e32)(?:\s|[:：])/i.test(normalized) &&
    /(\bsds\b|internal|\u5185\u90e8|\u5e95\u5c42|\u6700\u901a\u7528\u7684\u6570\u636e\u7ed3\u6784)/i.test(
      normalized,
    )
  ) {
    return 'sds';
  }
  if (
    /^\s*(?:Sorted\s*Set|ZSet|\u6709\u5e8f\u96c6\u5408)(?:\s|[:：])/i.test(normalized) &&
    /(skiplist|dict|\u8df3\u8868|\u53cc\u7d22\u5f15|\u5185\u90e8|\u5e95\u5c42|\u5e55\u540e\u82f1\u96c4)/i.test(
      normalized,
    )
  ) {
    return 'zset';
  }

  const hasSortedSetSignal = /(zset|sorted\s*set|\u6709\u5e8f\u96c6\u5408)/i.test(normalized);
  if (
    /(skiplist|\u8df3\u8868)/i.test(normalized) ||
    (hasSortedSetSignal &&
      /(dict|\u54c8\u5e0c\u8868|\u5b57\u5178|skiplist|\u8df3\u8868|\u53cc\u7d22\u5f15|\u5e95\u5c42|\u5185\u90e8)/i.test(
        normalized,
      ))
  ) {
    return 'zset';
  }
  if (
    !hasSortedSetSignal &&
    (/(\bsds\b|simple\s*dynamic\s*string|set\s*\/\s*get|get\s*\/\s*set)/i.test(normalized) ||
      (/\bstring\b/i.test(normalized) &&
        /(\u5185\u90e8|\u5e95\u5c42|\u7f16\u7801|\u7de8\u78bc|\u5b9e\u73b0|\u5be6\u73fe|internal|encoding|implementation)/i.test(
          normalized,
        )))
  ) {
    return 'sds';
  }
  if (/(intset|\u6574\u6570\u96c6\u5408)/i.test(normalized)) {
    return 'set';
  }
  if (
    (/\bhash\b|\u54c8\u5e0c|\u6563\u5217/i.test(normalized) &&
      /(\bdict\b|hashtable|\u5b57\u5178|\u54c8\u5e0c\u8868|\u5e95\u5c42|\u5185\u90e8|\u7f16\u7801|\u7de8\u78bc|listpack|ziplist)/i.test(
        normalized,
      )) ||
    (/\bdict\b|\u5b57\u5178/i.test(normalized) &&
      /(\bhash\b|\u54c8\u5e0c|\u6563\u5217|\u5b57\u6bb5|field|value|\u5bf9\u8c61|\u5c0d\u8c61)/i.test(
        normalized,
      ))
  ) {
    return 'hash';
  }
  if (
    /(quicklist|listpack|ziplist|\u538b\u7f29\u5217\u8868|\u7d27\u51d1\u5217\u8868)/i.test(
      normalized,
    ) ||
    (/\blist\b|\u5217\u8868|\u961f\u5217|\u6642\u95f4\u7ebf|\u65f6\u95f4\u7ebf/i.test(normalized) &&
      /(\u5e95\u5c42|\u5185\u90e8|\u7f16\u7801|\u7de8\u78bc|\u94fe\u8868|\u96d9\u5411|quicklist|listpack|ziplist)/i.test(
        normalized,
      ))
  ) {
    return 'list';
  }
  if (
    /(intset|\u6574\u6570\u96c6\u5408)/i.test(normalized) ||
    (/set/i.test(normalized) &&
      /(dict|\u5b57\u5178|\u7f16\u7801|\u7de8\u78bc|\u81ea\u52a8\u5207\u6362|\u81ea\u52d5\u5207\u63db|\u5347\u7ea7)/i.test(
        normalized,
      ))
  ) {
    return 'set';
  }
  if (
    /(sds|simple\s*dynamic\s*string|string.{0,18}sds|\u5b57\u7b26\u4e32.{0,18}sds)/i.test(
      normalized,
    )
  ) {
    return 'sds';
  }
  return null;
}

function hasExplicitRedisSignal(text: string): boolean {
  return /\bredis\b/i.test(text);
}

function shouldUseRedisInternalStructureLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  if (elements.some((element) => element.id?.startsWith('polish_ref_redis_internal_'))) {
    return false;
  }
  if (
    elements.some(
      (element) =>
        element.id?.startsWith('polish_ref_') && !element.id?.startsWith('polish_ref_canonical_'),
    )
  ) {
    return false;
  }
  if (
    elements.some((element) =>
      ['image', 'video', 'chart', 'table', 'latex', 'code'].includes(element.type),
    )
  ) {
    return false;
  }

  const source = getLayoutSignalText(elements, context);
  const title = getSlideTitle(elements, context);
  if (!hasExplicitRedisSignal(source)) return false;
  if (hasRedisChoicePracticeSummarySignal(title) && !getRedisInternalFocus(title)) return false;
  const titleFocus = getRedisInternalFocus(title);
  if (
    !titleFocus &&
    (hasRedisOverviewSignal(source) || getRedisMentionedSpecificFocuses(source).size >= 3)
  ) {
    return false;
  }

  const focus = getRedisInternalFocus(source);
  if (!focus) return false;

  const generatedLikeCount = elements.filter((element) =>
    /^(text|shape|line|image|video|chart|table|latex)_[\w-]+$/i.test(element.id ?? ''),
  ).length;
  const readableCount = elements.filter(isReadableElement).length;
  return generatedLikeCount >= Math.max(3, Math.ceil(elements.length * 0.45)) || readableCount >= 3;
}

function redisInternalTheme(context?: SlidePolishContext): SlidePolishTheme {
  const baseTheme = getPolishTheme(context);
  return {
    ...baseTheme,
    accent: '#2563eb',
    accentSecondary: '#38bdf8',
    panel: '#eff6ff',
  };
}

function redisInternalHeaderElements(
  prefix: string,
  title: string,
  subtitle: string,
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  return [
    textElement(
      `${prefix}_title`,
      `<strong>${title}</strong>`,
      82,
      48,
      836,
      58,
      34,
      theme.textPrimary,
      undefined,
      1.12,
    ),
    textElement(
      `${prefix}_subtitle`,
      subtitle,
      82,
      122,
      836,
      38,
      22,
      theme.textBody,
      undefined,
      1.15,
    ),
    shapeElement(`${prefix}_rule`, 82, 188, 836, 3, theme.accent, 0.95),
  ];
}

function redisInternalBlocks(focus: RedisInternalFocus): Array<{ heading: string; body: string }> {
  if (focus === 'sds') {
    return [
      { heading: '为什么快', body: '内存读写少，单线程少锁。' },
      { heading: 'SDS 结构', body: 'len、alloc、buf 分开记录。' },
      { heading: '安全性', body: '不依赖结束符，可存二进制。' },
      { heading: '性能策略', body: '预分配与惰性释放降开销。' },
    ];
  }

  if (focus === 'set') {
    return [
      { heading: '编码条件', body: '成员都是整数且数量较少时使用 intset。' },
      { heading: 'intset 优势', body: '连续内存、有序存储，适合小规模整数集合。' },
      { heading: 'dict 优势', body: '支持任意成员类型，平均查找复杂度为 O(1)。' },
      { heading: '升级规则', body: '插入字符串或规模变大时自动迁移到 dict。' },
    ];
  }

  if (focus === 'list') {
    return [
      { heading: '结构组合', body: 'quicklist 把多个 listpack 串成双向链表。' },
      { heading: '两端操作', body: 'LPUSH、RPOP 等命令主要在链表两端移动。' },
      { heading: '内存控制', body: 'listpack 让小元素连续存放，减少指针开销。' },
      { heading: '适用场景', body: '队列、消息缓冲和时间线都依赖顺序访问。' },
    ];
  }

  if (focus === 'hash') {
    return [
      { heading: '对象拆分', body: '一个 key 下保存多个 field/value 字段。' },
      { heading: '小对象优化', body: '字段少且短时可用 listpack 紧凑存储。' },
      { heading: '规模扩大', body: '字段变多后切换 dict，保持快速定位。' },
      { heading: '业务价值', body: '适合用户资料、配置项和对象局部更新。' },
    ];
  }

  return [
    { heading: '双结构协同', body: '跳表负责排序范围查询，哈希表负责单点查分。' },
    { heading: '命令路径', body: 'ZSCORE 走 dict，ZRANGE 和 ZRANK 走 skiplist。' },
    { heading: '一致性', body: '两个结构共享 member，写入时必须同步维护。' },
    { heading: '适用场景', body: '排行榜、热度排序和实时积分都依赖分数顺序。' },
  ];
}

function _redisInternalDetailElements(
  prefix: string,
  focus: RedisInternalFocus,
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  const blocks = redisInternalBlocks(focus);
  return blocks.flatMap((block, index) => {
    const top = 214 + index * 70;
    return [
      shapeElement(`${prefix}_detail_bar_${index}`, 536, top + 8, 5, 46, blueAccent(index), 0.95),
      textElement(
        `${prefix}_detail_text_${index}`,
        `<strong>${escapeHtmlShort(block.heading, 12)}</strong>：${escapeHtmlShort(block.body, 34)}`,
        558,
        top + 8,
        334,
        46,
        18,
        theme.textBody,
        undefined,
        1.12,
      ),
    ];
  });
}

function redisInternalSdsVisual(
  prefix: string,
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  return [
    shapeElement(`${prefix}_visual_panel`, 82, 210, 440, 184, '#ffffff', 1),
    textElement(
      `${prefix}_visual_title`,
      '<strong>SDS 内存结构示意</strong>',
      112,
      230,
      338,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    ...[
      ['len', '当前长度'],
      ['alloc', '已分配容量'],
      ['buf[]', '真实字节数组'],
    ].flatMap(([label, desc], index) => {
      const left = 116 + index * 118;
      const width = index === 2 ? 126 : 104;
      return [
        shapeElement(`${prefix}_sds_box_${index}`, left, 292, width, 64, '#eff6ff', 1),
        textElement(
          `${prefix}_sds_label_${index}`,
          `<strong>${label}</strong><br/>${desc}`,
          left + 14,
          304,
          width - 28,
          42,
          18,
          '#1e3a5f',
          undefined,
          1.1,
        ),
      ];
    }),
    textElement(
      `${prefix}_sds_note`,
      '<strong>长度单独记录</strong>：O(1) 取长度',
      102,
      358,
      400,
      38,
      22,
      theme.textBody,
      undefined,
      1.08,
    ),
  ];
}

function redisInternalListVisual(
  prefix: string,
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  const nodeLefts = [116, 252, 388];
  return [
    shapeElement(`${prefix}_visual_panel`, 82, 210, 414, 292, '#ffffff', 1),
    shapeElement(`${prefix}_visual_bar`, 82, 236, 5, 222, theme.accent, 0.96),
    textElement(
      `${prefix}_visual_title`,
      '<strong>quicklist 存储链路</strong>',
      112,
      230,
      338,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    ...nodeLefts.flatMap((left, index) => [
      shapeElement(`${prefix}_quick_node_${index}`, left, 306, 92, 82, '#eff6ff', 1),
      shapeElement(`${prefix}_quick_bar_${index}`, left, 316, 6, 54, blueAccent(index), 0.95),
      textElement(
        `${prefix}_quick_label_${index}`,
        `<strong>node ${index + 1}</strong><br/>元素 A/B`,
        left + 10,
        312,
        72,
        54,
        16,
        '#1e3a5f',
        undefined,
        1.06,
      ),
    ]),
    lineElement(`${prefix}_quick_arrow_0`, 214, 348, [0, 0], [26, 0], 2, '#93c5fd', {
      points: ['', 'arrow'],
    }),
    lineElement(`${prefix}_quick_arrow_1`, 350, 348, [0, 0], [26, 0], 2, '#93c5fd', {
      points: ['', 'arrow'],
    }),
    textElement(
      `${prefix}_listpack_label`,
      '每个节点内部用 listpack 紧凑存储多个元素',
      116,
      416,
      352,
      44,
      19,
      theme.textBody,
      undefined,
      1.16,
    ),
    shapeElement(`${prefix}_list_rule`, 116, 484, 352, 3, '#0ea5e9', 0.9),
  ];
}

function redisInternalHashVisual(
  prefix: string,
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  const buckets = ['0', '1', '2'];
  const rows = [
    ['name', 'Alice'],
    ['age', '20'],
    ['city', '杭州'],
  ] as const;
  return [
    shapeElement(`${prefix}_visual_panel`, 82, 210, 414, 292, '#ffffff', 1),
    shapeElement(`${prefix}_visual_bar`, 82, 236, 5, 222, theme.accent, 0.96),
    textElement(
      `${prefix}_visual_title`,
      '<strong>Hash 字段索引结构</strong>',
      112,
      230,
      338,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    shapeElement(`${prefix}_bucket_column`, 116, 300, 112, 194, '#eff6ff', 1),
    shapeElement(`${prefix}_bucket_sep_0`, 116, 366, 112, 2, '#dbeafe', 1),
    shapeElement(`${prefix}_bucket_sep_1`, 116, 432, 112, 2, '#dbeafe', 1),
    ...buckets.map((bucket, index) =>
      textElement(
        `${prefix}_bucket_label_${index}`,
        `槽 ${bucket}`,
        146,
        306 + index * 64,
        58,
        48,
        22,
        '#1e3a5f',
      ),
    ),
    ...rows.flatMap(([field, value], index) => {
      const top = 300 + index * 64;
      return [
        lineElement(`${prefix}_field_link_${index}`, 232, top + 30, [0, 0], [18, 0], 2, '#93c5fd', {
          points: ['', 'arrow'],
        }),
        shapeElement(
          `${prefix}_field_node_${index}`,
          260,
          top,
          176,
          58,
          index === 1 ? '#dbeafe' : '#eff6ff',
          1,
        ),
        textElement(
          `${prefix}_field_text_${index}`,
          `<strong>${field}</strong> → ${value}`,
          276,
          top + 5,
          136,
          50,
          18,
          '#1e3a5f',
          undefined,
          1.05,
        ),
      ];
    }),
    shapeElement(`${prefix}_hash_rule`, 116, 496, 320, 3, '#0ea5e9', 0.9),
  ];
}

function redisInternalSetVisual(
  prefix: string,
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  return [
    shapeElement(`${prefix}_visual_panel`, 82, 210, 414, 292, '#ffffff', 1),
    textElement(
      `${prefix}_visual_title`,
      '<strong>Set 编码切换路径</strong>',
      112,
      230,
      338,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    shapeElement(`${prefix}_intset_box`, 96, 302, 148, 92, '#eff6ff', 1),
    textElement(
      `${prefix}_intset_text`,
      '<strong>intset</strong><br/>整数且少量',
      116,
      318,
      108,
      52,
      20,
      '#1e3a5f',
      undefined,
      1.12,
    ),
    lineElement(`${prefix}_upgrade_arrow_0`, 250, 348, [0, 0], [18, 0], 2, '#93c5fd', {
      points: ['', 'arrow'],
    }),
    shapeElement(`${prefix}_upgrade_box`, 274, 302, 148, 92, '#dbeafe', 1),
    textElement(
      `${prefix}_upgrade_label`,
      '自动升级',
      294,
      329,
      108,
      30,
      20,
      '#1e3a5f',
      undefined,
      1.08,
    ),
    lineElement(`${prefix}_upgrade_arrow_1`, 428, 348, [0, 0], [18, 0], 2, '#93c5fd', {
      points: ['', 'arrow'],
    }),
    shapeElement(`${prefix}_dict_box`, 452, 302, 148, 92, '#dbeafe', 1),
    textElement(
      `${prefix}_dict_text`,
      '<strong>dict</strong><br/>通用集合',
      472,
      318,
      108,
      52,
      20,
      '#1e3a5f',
      undefined,
      1.12,
    ),
    textElement(
      `${prefix}_set_note`,
      '插入字符串或成员增多时，Redis 自动迁移编码，应用层无感知。',
      118,
      420,
      334,
      48,
      19,
      theme.textBody,
      undefined,
      1.16,
    ),
  ];
}

function redisInternalZsetVisual(
  prefix: string,
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  return [
    shapeElement(`${prefix}_visual_panel`, 82, 210, 440, 292, '#ffffff', 1),
    textElement(
      `${prefix}_visual_title`,
      '<strong>ZSet 双索引结构</strong>',
      112,
      230,
      338,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    shapeElement(`${prefix}_skiplist_panel`, 112, 286, 286, 96, '#f8fbff', 1),
    textElement(
      `${prefix}_skiplist_label`,
      '<strong>skiplist</strong>：范围排序',
      132,
      298,
      232,
      28,
      20,
      '#1e3a5f',
      undefined,
      1.05,
    ),
    ...[0, 1].map((index) =>
      shapeElement(
        `${prefix}_skiplist_lane_${index}`,
        132,
        342 + index * 22,
        216 - index * 44,
        3,
        '#60a5fa',
        index === 0 ? 0.72 : 0.5,
      ),
    ),
    shapeElement(`${prefix}_dict_panel`, 430, 286, 188, 96, '#dbeafe', 1),
    textElement(
      `${prefix}_dict_label`,
      '<strong>dict</strong><br/>member → score',
      448,
      306,
      150,
      58,
      21,
      '#1e3a5f',
      undefined,
      1.12,
    ),
    lineElement(`${prefix}_shared_member`, 400, 334, [0, 0], [24, 0], 2, '#2563eb', {
      points: ['', 'arrow'],
    }),
    textElement(
      `${prefix}_zset_note`,
      'member 同步维护',
      318,
      414,
      174,
      36,
      20,
      '#2563eb',
      undefined,
      1.1,
    ),
  ];
}

function redisInternalVisualElements(
  prefix: string,
  focus: RedisInternalFocus,
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  if (focus === 'sds') return redisInternalSdsVisual(prefix, theme);
  if (focus === 'list') return redisInternalListVisual(prefix, theme);
  if (focus === 'hash') return redisInternalHashVisual(prefix, theme);
  if (focus === 'set') return redisInternalSetVisual(prefix, theme);
  return redisInternalZsetVisual(prefix, theme);
}

function translateRedisInternalElements(
  elements: Array<SlideLikeElement & Record<string, unknown>>,
  dx: number,
  dy: number,
): Array<SlideLikeElement & Record<string, unknown>> {
  return elements.map((element) => ({
    ...element,
    left: element.left + dx,
    top: element.top + dy,
  }));
}

function redisInternalDetailCards(
  prefix: string,
  focus: RedisInternalFocus,
  theme: SlidePolishTheme,
  positions: Array<{ left: number; top: number; width: number; height: number }>,
  options: {
    bodyChars?: number;
    lineHeight?: number;
    insetX?: number;
    insetY?: number;
    fontSize?: number;
  } = {},
): Array<SlideLikeElement & Record<string, unknown>> {
  const blocks = redisInternalBlocks(focus).slice(0, positions.length);
  const bodyChars = options.bodyChars ?? 34;
  const lineHeight = options.lineHeight ?? 1.08;
  const insetX = options.insetX ?? 18;
  const insetY = options.insetY ?? 10;
  const fontSize = options.fontSize ?? 18;

  return blocks.flatMap((block, index) => {
    const pos = positions[index];
    return [
      shapeElement(
        `${prefix}_detail_card_${index}`,
        pos.left,
        pos.top,
        pos.width,
        pos.height,
        '#ffffff',
        1,
      ),
      shapeElement(
        `${prefix}_detail_bar_${index}`,
        pos.left,
        pos.top + 12,
        5,
        Math.max(36, pos.height - 24),
        blueAccent(index),
        0.95,
      ),
      textElement(
        `${prefix}_detail_text_${index}`,
        `<strong>${escapeHtmlShort(block.heading, 12)}</strong>：${escapeHtmlShort(block.body, bodyChars)}`,
        pos.left + insetX,
        pos.top + insetY,
        pos.width - insetX - 14,
        pos.height - insetY - 8,
        fontSize,
        theme.textBody,
        undefined,
        lineHeight,
      ),
    ];
  });
}

function redisInternalDetailRows(
  prefix: string,
  focus: RedisInternalFocus,
  theme: SlidePolishTheme,
  rows: Array<{ left: number; top: number; width: number; height: number }>,
  options: {
    bodyChars?: number;
    lineHeight?: number;
  } = {},
): Array<SlideLikeElement & Record<string, unknown>> {
  const blocks = redisInternalBlocks(focus).slice(0, rows.length);
  const bodyChars = options.bodyChars ?? 28;
  const lineHeight = options.lineHeight ?? 1.06;

  return blocks.flatMap((block, index) => {
    const row = rows[index];
    return [
      shapeElement(
        `${prefix}_detail_row_bar_${index}`,
        row.left,
        row.top + 9,
        5,
        Math.max(32, row.height - 18),
        blueAccent(index),
        0.95,
      ),
      textElement(
        `${prefix}_detail_row_text_${index}`,
        `<strong>${escapeHtmlShort(block.heading, 12)}</strong>：${escapeHtmlShort(block.body, bodyChars)}`,
        row.left + 18,
        row.top + 6,
        row.width - 26,
        row.height - 12,
        18,
        theme.textBody,
        undefined,
        lineHeight,
      ),
    ];
  });
}

function redisInternalVariantLayout(
  focus: RedisInternalFocus,
  prefix: string,
  title: string,
  subtitle: string,
  theme: SlidePolishTheme,
  _context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const header = redisInternalHeaderElements(prefix, title, subtitle, theme);
  const visual = redisInternalVisualElements(prefix, focus, theme);

  if (focus === 'hash') {
    return [
      ...header,
      shapeElement(`${prefix}_layout_split_left`, 70, 212, 390, 286, '#eff6ff', 0.72),
      ...redisInternalDetailRows(
        prefix,
        focus,
        theme,
        [
          { left: 92, top: 230, width: 334, height: 48 },
          { left: 92, top: 294, width: 334, height: 48 },
          { left: 92, top: 358, width: 334, height: 48 },
          { left: 92, top: 422, width: 334, height: 48 },
        ],
        {
          bodyChars: 30,
          lineHeight: 1.04,
        },
      ),
      ...translateRedisInternalElements(visual, 430, 0),
      shapeElement(`${prefix}_layout_rule`, 488, 224, 3, 264, theme.accentSecondary, 0.85),
    ];
  }

  if (focus === 'list') {
    const compactVisual = visual.filter(
      (element) => !element.id?.endsWith('_listpack_label') && !element.id?.endsWith('_list_rule'),
    );

    return [
      ...header,
      shapeElement(`${prefix}_layout_left_diagram`, 70, 212, 468, 286, '#ffffff', 1),
      ...compactVisual,
      shapeElement(`${prefix}_layout_right_stack`, 566, 212, 352, 286, '#eff6ff', 0.72),
      ...redisInternalDetailRows(
        prefix,
        focus,
        theme,
        [
          { left: 588, top: 230, width: 308, height: 48 },
          { left: 588, top: 294, width: 308, height: 48 },
          { left: 588, top: 358, width: 308, height: 48 },
          { left: 588, top: 422, width: 308, height: 48 },
        ],
        {
          bodyChars: 28,
          lineHeight: 1.04,
        },
      ),
      shapeElement(`${prefix}_layout_join_rule`, 548, 234, 3, 242, theme.accent, 0.72),
    ];
  }

  if (focus === 'set') {
    const compactVisual = visual.filter(
      (element) => !element.id?.endsWith('_visual_panel') && !element.id?.endsWith('_set_note'),
    );

    return [
      ...header,
      shapeElement(`${prefix}_layout_center_stage`, 138, 212, 724, 184, '#ffffff', 1),
      ...translateRedisInternalElements(compactVisual, 160, -4),
      ...redisInternalDetailCards(prefix, focus, theme, [
        { left: 82, top: 420, width: 398, height: 74 },
        { left: 520, top: 420, width: 398, height: 74 },
      ]),
    ];
  }

  if (focus === 'zset') {
    const compactVisual = visual.filter(
      (element) => !element.id?.endsWith('_visual_panel') && !element.id?.endsWith('_zset_note'),
    );

    return [
      ...header,
      shapeElement(`${prefix}_layout_rank_stage`, 70, 212, 860, 182, '#ffffff', 1),
      ...translateRedisInternalElements(compactVisual, 178, -18),
      shapeElement(`${prefix}_layout_bottom_band`, 70, 402, 860, 96, '#eff6ff', 0.72),
      ...redisInternalDetailRows(
        prefix,
        focus,
        theme,
        [
          { left: 92, top: 416, width: 248, height: 56 },
          { left: 376, top: 416, width: 248, height: 56 },
          { left: 660, top: 416, width: 248, height: 56 },
        ],
        {
          bodyChars: 16,
          lineHeight: 1.04,
        },
      ),
      shapeElement(`${prefix}_layout_rank_rule`, 104, 398, 792, 3, theme.accent, 0.78),
    ];
  }

  return [
    ...header,
    shapeElement(`${prefix}_layout_memory_band`, 70, 214, 860, 160, '#ffffff', 1),
    ...translateRedisInternalElements(visual, 176, -8),
    shapeElement(`${prefix}_layout_bottom_band`, 70, 376, 860, 138, '#eff6ff', 0.72),
    ...redisInternalDetailRows(
      prefix,
      focus,
      theme,
      [
        { left: 92, top: 398, width: 392, height: 52 },
        { left: 516, top: 398, width: 392, height: 52 },
        { left: 92, top: 453, width: 392, height: 52 },
        { left: 516, top: 453, width: 392, height: 52 },
      ],
      {
        bodyChars: 18,
        lineHeight: 1.04,
      },
    ),
  ];
}

function redisInternalStructureReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const focus = getRedisInternalFocus(getLayoutSignalText(elements, context)) ?? 'sds';
  const theme = redisInternalTheme(context);
  const title = getSlideTitle(elements, context);
  const subtitle = getCanonicalSubtitle(elements, title);
  const prefix = `polish_ref_redis_internal_${focus}`;

  return redisInternalVariantLayout(focus, prefix, title, subtitle, theme, context);
}

function shouldUseRedisDataStructureLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  if (elements.some((element) => element.id?.startsWith('polish_ref_redis_ds_'))) return false;

  const source = getLayoutSignalText(elements, context);
  const hasRedis = /redis/i.test(source);
  const hasDataStructure =
    /(数据结构|data\s*structure|String|List|Hash|Set|Sorted\s*Set|ZSet|排行榜|队列|集合)/i.test(
      source,
    );
  if (!hasRedis || !hasDataStructure) return false;

  const title = getSlideTitle(elements, context);
  const titleFocus = getRedisSpecificFocusFromText(title);
  const hasOverviewSignal = hasRedisOverviewSignal(source);
  const hasChoicePracticeSummarySignal = hasRedisChoicePracticeSummarySignal(`${title} ${source}`);
  const mentionedFocuses = getRedisMentionedSpecificFocuses(source);

  if (hasChoicePracticeSummarySignal && !titleFocus && !hasOverviewSignal) return false;
  if (!titleFocus && !hasOverviewSignal && mentionedFocuses.size < 2) return false;

  const generatedLikeCount = elements.filter((element) =>
    /^(text|shape|line|image|video|chart|table|latex)_[\w-]+$/i.test(element.id ?? ''),
  ).length;
  const isGeneratedLike = generatedLikeCount >= Math.max(3, Math.ceil(elements.length * 0.45));
  const hasSparseCards =
    elements.filter((element) => element.type === 'shape' && Number(element.height ?? 0) >= 140)
      .length >= 2;

  return isGeneratedLike || hasSparseCards || elements.length < 14;
}

type RedisDataStructureFocus = 'overview' | 'string' | 'list' | 'hash' | 'set' | 'zset';

type RedisDataStructureItem = {
  id: RedisDataStructureFocus;
  name: string;
  desc: string;
  color: string;
  node: readonly [number, number, number, number];
};

function hasRedisOverviewSignal(text: string): boolean {
  const normalized = stripHtml(text).replace(/\s+/g, ' ');
  return (
    /(data\s*structure\s*(overview|map|comparison)|redis\s*(overview|data\s*structures?))/i.test(
      normalized,
    ) ||
    /(\u6838\u5fc3|\u5e38\u7528|\u4e94\u79cd|\u4e3b\u8981|\u57fa\u672c).{0,8}\u6570\u636e\u7ed3\u6784/i.test(
      normalized,
    ) ||
    /(鏍稿績|甯哥敤|浜旂|涓昏|鍩烘湰).{0,12}鏁版嵁缁撴瀯/i.test(normalized) ||
    /鏁版嵁缁撴瀯.{0,12}(姒傝堪|姒傝|鎬昏|瀵圭収|鍦板浘|姣旇緝)/i.test(normalized) ||
    /\u6570\u636e\u7ed3\u6784.{0,8}(\u6982\u8ff0|\u6982\u89c8|\u603b\u89c8|\u5bf9\u7167|\u5730\u56fe|\u6bd4\u8f83)/i.test(
      normalized,
    )
  );
}

function hasRedisChoicePracticeSummarySignal(text: string): boolean {
  const normalized = stripHtml(text).replace(/\s+/g, ' ');
  return (
    /(\u9009\u62e9|\u9009\u6750|\u600e\u4e48\u9009|\u5982\u4f55\u9009|\u6307\u5357|\u5efa\u8bae|\u6700\u4f73\u5b9e\u8df5|\u5b9e\u8df5|\u603b\u7ed3|\u5c0f\u7ed3|\u5173\u952e\u8981\u70b9|\u56de\u987e|\u8fdb\u9636|\u8d44\u6e90|\u8bfe\u540e|\u5ef6\u4f38|\u6ce8\u610f\u4e8b\u9879|\u907f\u5751|\u89c4\u8303)/i.test(
      normalized,
    ) ||
    /(choose|choice|selection|recommendations?|resources?|best\s*practice|summary|recap|advanced|guidelines?|pitfall)/i.test(
      normalized,
    )
  );
}

function getRedisMentionedSpecificFocuses(
  text: string,
): Set<Exclude<RedisDataStructureFocus, 'overview'>> {
  const mentioned = new Set<Exclude<RedisDataStructureFocus, 'overview'>>();
  const sourceWithoutSortedSet = text.replace(/sorted\s*set|zset/gi, ' ');
  for (const focus of ['string', 'list', 'hash', 'set', 'zset'] as const) {
    const focusSource = focus === 'set' ? sourceWithoutSortedSet : text;
    if (getRedisSpecificFocusFromText(focusSource, focus)) mentioned.add(focus);
  }
  return mentioned;
}

function getRedisDataStructureFocus(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): RedisDataStructureFocus {
  const title = getSlideTitle(elements, context);
  const source = `${title} ${getLayoutSignalText(elements, context)}`;
  const titleHasOverviewSignal = hasRedisOverviewSignal(title);
  const sourceHasOverviewSignal = hasRedisOverviewSignal(source);
  const titleFocus = getRedisSpecificFocusFromText(title);
  if (titleHasOverviewSignal || (sourceHasOverviewSignal && !titleFocus)) return 'overview';
  if (titleFocus) return titleFocus;

  const mentioned = getRedisMentionedSpecificFocuses(source);
  if (!titleFocus && /redis/i.test(source) && mentioned.size >= 2) return 'overview';
  if (sourceHasOverviewSignal) return 'overview';
  if (
    mentioned.size >= 3 ||
    /(核心数据结构|常用.*数据结构|五种.*数据结构|data\s*structure\s*overview)/i.test(source)
  ) {
    return 'overview';
  }

  return getRedisSpecificFocusFromText(source) ?? 'overview';
}

function getRedisSpecificFocusFromText(
  text: string,
  only?: Exclude<RedisDataStructureFocus, 'overview'>,
): Exclude<RedisDataStructureFocus, 'overview'> | null {
  const checks: Array<[Exclude<RedisDataStructureFocus, 'overview'>, RegExp]> = [
    ['zset', /(sorted\s*set|zset|有序集合|排行榜|权重|排名)/i],
    ['string', /(string|字符串|键值|计数器|验证码)/i],
    ['list', /(list|列表|有序列表|队列|时间线|消息列表)/i],
    ['hash', /(hash|哈希|散列|对象|字段)/i],
    ['set', /(^|[^a-z])set([^a-z]|$)|集合|去重|标签|交集|并集/i],
  ];

  for (const [focus, pattern] of checks) {
    if (only && focus !== only) continue;
    if (pattern.test(text)) return focus;
  }
  return null;
}

function redisHeaderElements(
  prefix: string,
  title: string,
  subtitle: string,
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  return [
    textElement(
      `${prefix}_title`,
      `<strong>${title}</strong>`,
      82,
      42,
      836,
      58,
      34,
      theme.textPrimary,
      undefined,
      1.12,
    ),
    textElement(
      `${prefix}_subtitle`,
      subtitle,
      82,
      122,
      836,
      38,
      22,
      theme.textBody,
      undefined,
      1.15,
    ),
    shapeElement(`${prefix}_rule`, 82, 188, 836, 3, theme.accent, 0.95),
  ];
}

function redisDataStructureReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const baseTheme = getPolishTheme(context);
  const theme: SlidePolishTheme = {
    ...baseTheme,
    accent: '#2f80d1',
    accentSecondary: '#38bdf8',
    panel: '#eff6ff',
  };
  const title = getSlideTitle(elements, context);
  const subtitle = getCanonicalSubtitle(elements, title);
  const prefix = 'polish_ref_redis_ds';
  const structures: RedisDataStructureItem[] = [
    {
      id: 'string',
      name: 'String',
      desc: '缓存值 / 计数器',
      color: '#2f80d1',
      node: [132, 340, 112, 44],
    },
    {
      id: 'list',
      name: 'List',
      desc: '队列 / 时间线',
      color: '#0ea5e9',
      node: [132, 398, 112, 44],
    },
    {
      id: 'hash',
      name: 'Hash',
      desc: '对象字段集合',
      color: '#2563eb',
      node: [334, 340, 112, 44],
    },
    {
      id: 'set',
      name: 'Set',
      desc: '去重 / 标签',
      color: '#38bdf8',
      node: [334, 398, 112, 44],
    },
    {
      id: 'zset',
      name: 'Sorted Set',
      desc: '排行榜 / 权重',
      color: '#4f46e5',
      node: [232, 456, 112, 44],
    },
  ];

  const focus = getRedisDataStructureFocus(elements, context);
  if (focus !== 'overview') {
    return redisFocusedDataStructureReferenceLayout({
      prefix,
      focus,
      structures,
      theme,
      title,
      subtitle,
      context,
    });
  }

  return [
    ...redisHeaderElements(prefix, title, subtitle, theme),
    shapeElement(`${prefix}_backplate`, 64, 196, 872, 318, '#ffffff', 1),
    shapeElement(`${prefix}_overview_top_rule`, 112, 258, 392, 3, '#dbeafe', 1),
    textElement(
      `${prefix}_overview_heading`,
      '<strong>五种结构对照</strong>',
      112,
      214,
      390,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    tableElement(
      `${prefix}_overview_table`,
      112,
      274,
      392,
      218,
      [['结构', '典型场景'], ...structures.map((item) => [item.name, item.desc])],
      [0.36, 0.64],
      '#2f80d1',
    ),
    shapeElement(`${prefix}_scenario_top_rule`, 598, 258, 292, 3, '#dbeafe', 1),
    textElement(
      `${prefix}_scenario_heading`,
      '<strong>按场景选择</strong>',
      598,
      214,
      290,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    tableElement(
      `${prefix}_scenario_table`,
      598,
      292,
      292,
      158,
      [
        ['场景', '结构'],
        ['单值与计数', 'String'],
        ['顺序处理', 'List / Sorted Set'],
        ['对象与集合', 'Hash / Set'],
      ],
      [0.46, 0.54],
      '#0ea5e9',
    ),
    textElement(
      `${prefix}_summary_note`,
      '先判断读写模型，再选择对应结构',
      520,
      458,
      370,
      30,
      18,
      theme.textBody,
      undefined,
      1.08,
    ),
    shapeElement(`${prefix}_bottom_rule`, 112, 508, 778, 3, '#0ea5e9', 0.9),
  ];
}

function redisFocusedDataStructureReferenceLayout(args: {
  prefix: string;
  focus: Exclude<RedisDataStructureFocus, 'overview'>;
  structures: RedisDataStructureItem[];
  theme: SlidePolishTheme;
  title: string;
  subtitle: string;
  context?: SlidePolishContext;
}): Array<SlideLikeElement & Record<string, unknown>> {
  const { prefix: basePrefix, focus, structures, theme, title, subtitle, context: _context } = args;
  const prefix = `${basePrefix}_focus_${focus}`;
  const item = structures.find((candidate) => candidate.id === focus) ?? structures[0];
  const details: Record<Exclude<RedisDataStructureFocus, 'overview'>, string[]> = {
    string: ['保存单个值', '原子计数', '设置过期时间'],
    list: ['按插入顺序保存', '适合队列和时间线', '两端都能快速操作'],
    hash: ['把对象拆成字段', '适合用户资料', '局部字段可单独更新'],
    set: ['自动去重', '适合标签集合', '支持交集和并集'],
    zset: ['每个成员带分数', '按分数排序', '适合排行榜'],
  };

  const visualElements = redisFocusedVisualElements(prefix, focus, item, theme);
  const detailRows = details[focus];

  return [
    ...redisHeaderElements(prefix, title, subtitle, theme),
    shapeElement(`${prefix}_backplate`, 64, 196, 872, 330, '#ffffff', 1),
    shapeElement(`${prefix}_visual_panel`, 82, 204, 456, 310, '#ffffff', 1),
    shapeElement(`${prefix}_visual_bar`, 82, 228, 5, 244, '#2f80d1', 0.95),
    textElement(
      `${prefix}_visual_title`,
      `<strong>${item.name} 的结构视图</strong>`,
      112,
      224,
      390,
      34,
      24,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    ...visualElements,
    shapeElement(`${prefix}_detail_panel`, 572, 214, 346, 300, '#ffffff', 1),
    shapeElement(`${prefix}_detail_panel_bar`, 572, 238, 5, 248, '#2f80d1', 0.95),
    textElement(
      `${prefix}_detail_heading`,
      '<strong>这一页只讲什么</strong>',
      598,
      232,
      290,
      32,
      22,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_detail_focus`,
      `<strong>${item.name}</strong>：${item.desc}`,
      598,
      282,
      290,
      38,
      18,
      '#1e3a5f',
      undefined,
      1.12,
    ),
    ...detailRows.flatMap((detail, index) => {
      const top = 342 + index * 56;
      return [
        circleElement(`${prefix}_detail_dot_${index}`, 600, top + 9, 14, blueAccent(index), 0.95),
        textElement(
          `${prefix}_detail_text_${index}`,
          detail,
          626,
          top,
          252,
          32,
          18,
          theme.textBody,
          undefined,
          1.1,
        ),
      ];
    }),
    shapeElement(`${prefix}_scenario_rule`, 572, 506, 346, 3, '#0ea5e9', 0.9),
  ];
}

function blueAccent(index: number): string {
  return ['#2f80d1', '#0ea5e9', '#2563eb', '#38bdf8', '#4f46e5'][index % 5];
}

function redisFocusedVisualElements(
  prefix: string,
  focus: Exclude<RedisDataStructureFocus, 'overview'>,
  item: RedisDataStructureItem,
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  if (focus === 'string') {
    return [
      shapeElement(`${prefix}_string_key_box`, 116, 316, 126, 58, '#ffffff', 1),
      shapeElement(`${prefix}_string_key_bar`, 116, 326, 6, 36, item.color, 0.95),
      textElement(
        `${prefix}_string_key`,
        '<strong>key</strong>',
        138,
        326,
        74,
        34,
        18,
        theme.textPrimary,
      ),
      lineElement(`${prefix}_string_arrow`, 254, 345, [0, 0], [76, 0], 2, '#93c5fd', {
        points: ['', 'arrow'],
      }),
      shapeElement(`${prefix}_string_value_box`, 346, 316, 140, 58, '#ffffff', 1),
      shapeElement(`${prefix}_string_value_bar`, 346, 326, 6, 36, '#0ea5e9', 0.95),
      textElement(
        `${prefix}_string_value`,
        '<strong>value</strong>',
        368,
        326,
        86,
        34,
        18,
        theme.textPrimary,
      ),
      ...['SET', 'INCR', 'EXPIRE'].flatMap((label, index) => {
        const left = 116 + index * 124;
        return [
          shapeElement(`${prefix}_string_op_box_${index}`, left, 424, 98, 42, '#ffffff', 1),
          textElement(`${prefix}_string_op_${index}`, label, left + 16, 430, 66, 28, 18, '#1e3a5f'),
        ];
      }),
      shapeElement(`${prefix}_string_rule`, 116, 492, 370, 3, '#0ea5e9', 0.9),
    ];
  }

  if (focus === 'list') {
    return [
      shapeElement(`${prefix}_list_rail`, 116, 352, 374, 4, '#bfdbfe', 1),
      lineElement(`${prefix}_list_flow`, 116, 354, [0, 0], [374, 0], 2, '#93c5fd', {
        points: ['', 'arrow'],
      }),
      ...['LPUSH', '元素', 'RPOP'].flatMap((label, index) => {
        const left = 116 + index * 136;
        return [
          shapeElement(`${prefix}_list_step_${index}`, left, 318, 108, 70, '#ffffff', 1),
          shapeElement(
            `${prefix}_list_step_bar_${index}`,
            left,
            328,
            6,
            42,
            blueAccent(index),
            0.95,
          ),
          textElement(
            `${prefix}_list_step_text_${index}`,
            `<strong>${label}</strong>`,
            left + 18,
            337,
            74,
            32,
            18,
            theme.textPrimary,
          ),
        ];
      }),
      textElement(
        `${prefix}_list_note`,
        '左进右出，形成有序处理链',
        116,
        428,
        374,
        34,
        18,
        theme.textBody,
        undefined,
        1.12,
      ),
      shapeElement(`${prefix}_list_rule`, 116, 492, 374, 3, '#0ea5e9', 0.9),
    ];
  }

  if (focus === 'hash') {
    return [
      shapeElement(`${prefix}_hash_table`, 116, 312, 370, 136, '#ffffff', 1),
      shapeElement(`${prefix}_hash_header_rule`, 116, 312, 370, 4, '#bfdbfe', 1),
      lineElement(`${prefix}_hash_col`, 274, 312, [0, 0], [0, 136], 1, '#cbd5e1'),
      lineElement(`${prefix}_hash_row`, 116, 350, [0, 0], [370, 0], 1, '#dbe3ef'),
      textElement(
        `${prefix}_hash_fields`,
        '<strong>field</strong><br/>name<br/>level',
        142,
        318,
        90,
        112,
        18,
        theme.textPrimary,
        undefined,
        1.22,
      ),
      textElement(
        `${prefix}_hash_values`,
        '<strong>value</strong><br/>Alice<br/>12',
        306,
        318,
        90,
        112,
        18,
        theme.textPrimary,
        undefined,
        1.22,
      ),
      shapeElement(`${prefix}_hash_rule`, 116, 492, 370, 3, '#0ea5e9', 0.9),
    ];
  }

  if (focus === 'set') {
    return [
      circleElement(`${prefix}_set_circle_a`, 154, 326, 132, '#dbeafe', 0.92),
      circleElement(`${prefix}_set_circle_b`, 236, 326, 132, '#e0f2fe', 0.92),
      textElement(`${prefix}_set_a`, '<strong>A</strong>', 146, 304, 54, 28, 18, '#1e3a5f'),
      textElement(`${prefix}_set_b`, '<strong>B</strong>', 398, 304, 54, 28, 18, '#1e3a5f'),
      textElement(`${prefix}_set_middle`, '交集', 256, 374, 74, 28, 18, theme.textPrimary),
      shapeElement(`${prefix}_set_rule`, 116, 492, 374, 3, '#0ea5e9', 0.9),
    ];
  }

  return [
    ...[
      ['01', 'user:8', '98.5'],
      ['02', 'user:3', '91.0'],
      ['03', 'user:6', '86.0'],
    ].flatMap(([rank, member, score], index) => {
      const top = 306 + index * 66;
      const barWidth = 304 - index * 44;
      return [
        textElement(`${prefix}_zset_rank_${index}`, rank, 116, top + 8, 42, 28, 18, '#1e3a5f'),
        shapeElement(`${prefix}_zset_bar_${index}`, 168, top + 24, barWidth, 10, '#dbeafe', 1),
        shapeElement(
          `${prefix}_zset_bar_accent_${index}`,
          168,
          top + 24,
          52,
          10,
          blueAccent(index),
          0.95,
        ),
        textElement(
          `${prefix}_zset_member_${index}`,
          member,
          190,
          top + 5,
          104,
          28,
          18,
          theme.textPrimary,
        ),
        textElement(`${prefix}_zset_score_${index}`, score, 356, top + 5, 76, 28, 18, '#1e3a5f'),
      ];
    }),
    shapeElement(`${prefix}_zset_rule`, 116, 506, 374, 3, '#0ea5e9', 0.9),
  ];
}

function shouldUseCubicIntroLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  const source = getLayoutSignalText(elements, context);
  const title = getSlideTitle(elements, context);
  return (
    /三次函数引入|\u4e09\u6b21\u51fd\u6570\u5f15\u5165/i.test(title) &&
    /一次函数|\u4e00\u6b21\u51fd\u6570/.test(source) &&
    /二次函数|\u4e8c\u6b21\u51fd\u6570/.test(source) &&
    /(一般形式|\u4e00\u822c\u5f62\u5f0f|ax\^3|x³|x\^3)/i.test(source)
  );
}

function cubicIntroReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const prefix = 'polish_ref_cubic_intro';
  const cardTop = 200;
  const cardWidth = 260;
  const cardGap = 28;
  const cardLefts = [82, 82 + cardWidth + cardGap, 82 + (cardWidth + cardGap) * 2];

  return [
    textElement(
      `${prefix}_title`,
      `<strong>${title}</strong>`,
      82,
      48,
      836,
      56,
      34,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    shapeElement(`${prefix}_rule`, 82, 126, 836, 2, '#d7dde8', 1),
    textElement(
      `${prefix}_review_heading`,
      '<strong>一、回顾已知</strong>',
      82,
      152,
      300,
      34,
      22,
      theme.accent,
      undefined,
      1.1,
    ),
    shapeElement(`${prefix}_linear_card`, cardLefts[0], cardTop, cardWidth, 130, '#e8f4fd', 1),
    textElement(
      `${prefix}_linear_content`,
      '<strong>一次函数</strong><br/>f(x) = kx + b<br/>k ≠ 0',
      cardLefts[0] + 24,
      cardTop + 20,
      cardWidth - 48,
      84,
      20,
      theme.textPrimary,
      undefined,
      1.16,
    ),
    shapeElement(`${prefix}_quadratic_card`, cardLefts[1], cardTop, cardWidth, 130, '#e8f4fd', 1),
    textElement(
      `${prefix}_quadratic_content`,
      '<strong>二次函数</strong><br/>f(x) = ax<sup>2</sup> + bx + c<br/>a ≠ 0',
      cardLefts[1] + 24,
      cardTop + 20,
      cardWidth - 48,
      84,
      19,
      theme.textPrimary,
      undefined,
      1.16,
    ),
    shapeElement(`${prefix}_feature_card`, cardLefts[2], cardTop, cardWidth, 130, '#fef9e7', 1),
    textElement(
      `${prefix}_feature_content`,
      '<strong>一次函数特征</strong><br/>图像为直线<br/>斜率 k 决定增减',
      cardLefts[2] + 24,
      cardTop + 20,
      cardWidth - 48,
      84,
      18,
      '#5f3b00',
      undefined,
      1.16,
    ),
    shapeElement(`${prefix}_problem_panel`, 82, 360, 402, 134, '#f5f5f5', 1),
    textElement(
      `${prefix}_problem_content`,
      '<strong>二、实际问题引入</strong><br/>无盖长方体盒子的容积关系中会出现 x<sup>3</sup> 项，最高次数为 3，进入新的函数类型。',
      110,
      380,
      330,
      88,
      18,
      theme.textBody,
      undefined,
      1.18,
    ),
    shapeElement(`${prefix}_formula_panel`, 526, 360, 392, 134, '#f0f9ff', 1),
    textElement(
      `${prefix}_formula_content`,
      '<strong>三、三次函数的一般形式</strong><br/>f(x) = ax<sup>3</sup> + bx<sup>2</sup> + cx + d<br/>a、b、c、d 为常数，且 a ≠ 0。',
      554,
      380,
      320,
      88,
      18,
      theme.textBody,
      undefined,
      1.18,
    ),
  ];
}

function shouldUseCubicGraphFeaturesLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  const source = getLayoutSignalText(elements, context);
  const title = getSlideTitle(elements, context);
  const hasCubicGraphTitle =
    /三次函数.*图像特征|\u4e09\u6b21\u51fd\u6570.*\u56fe\u50cf\u7279\u5f81/.test(title);
  return (
    hasCubicGraphTitle &&
    /(走势|对称性|交点|\u8d70\u52bf|\u5bf9\u79f0\u6027|\u4ea4\u70b9)/.test(source) &&
    elements.some((element) => element.type === 'chart')
  );
}

function cubicGraphFeaturesReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const prefix = 'polish_ref_cubic_graph';

  return [
    textElement(
      `${prefix}_title`,
      `<strong>${title}</strong>`,
      82,
      44,
      836,
      54,
      34,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_subtitle`,
      '从走势、对称性到交点，快速读懂三次函数图像',
      82,
      116,
      836,
      34,
      21,
      theme.accent,
      undefined,
      1.1,
    ),
    shapeElement(`${prefix}_rule`, 82, 168, 836, 2, theme.accent, 0.9),
    shapeElement(`${prefix}_trend_card`, 82, 194, 398, 122, '#f8fafc', 1),
    shapeElement(`${prefix}_trend_bar`, 82, 206, 8, 82, theme.accentSecondary, 1),
    textElement(
      `${prefix}_trend_content`,
      '<strong>走势方向</strong>：由首项系数 a 决定<br/>a > 0：左下 ↗ 右上<br/>a < 0：左上 ↘ 右下',
      110,
      210,
      332,
      86,
      18,
      theme.textBody,
      undefined,
      1.16,
    ),
    shapeElement(`${prefix}_symmetry_card`, 520, 194, 398, 122, '#f8fafc', 1),
    shapeElement(`${prefix}_symmetry_bar`, 520, 206, 8, 82, theme.accent, 1),
    textElement(
      `${prefix}_symmetry_content`,
      '<strong>对称性</strong>：关于拐点中心对称<br/>拐点 (x₀, f(x₀)) 是对称中心<br/>f(x₀+h)+f(x₀-h)=2f(x₀)',
      548,
      210,
      332,
      86,
      18,
      theme.textBody,
      undefined,
      1.16,
    ),
    shapeElement(`${prefix}_graph_panel`, 82, 334, 424, 152, '#ffffff', 1),
    lineElement(`${prefix}_axis_x`, 118, 426, [0, 0], [328, 0], 2, '#a8b3c4', {
      points: ['', 'arrow'],
    }),
    lineElement(`${prefix}_axis_y`, 282, 462, [0, 0], [0, -106], 2, '#a8b3c4', {
      points: ['', 'arrow'],
    }),
    lineElement(`${prefix}_curve_up`, 136, 452, [0, 0], [300, -96], 4, '#5b9bd5', {
      cubic: [
        [82, -8],
        [205, -90],
      ],
    }),
    lineElement(`${prefix}_curve_down`, 136, 356, [0, 0], [300, 96], 4, '#ed7d31', {
      cubic: [
        [82, 8],
        [205, 90],
      ],
    }),
    circleElement(`${prefix}_inflection_dot`, 274, 400, 12, theme.accent, 1),
    textElement(
      `${prefix}_graph_caption`,
      '走势对比：a = 1 与 a = -1',
      118,
      346,
      328,
      22,
      18,
      '#64748b',
      undefined,
      1.08,
    ),
    shapeElement(`${prefix}_legend_panel`, 542, 342, 376, 94, '#ffffff', 1),
    circleElement(`${prefix}_legend_up_dot`, 568, 362, 16, '#5b9bd5', 1),
    textElement(
      `${prefix}_legend_text`,
      'a = 1：图像从左下 ↗ 至右上<br/>a = -1：图像从左上 ↘ 至右下',
      594,
      354,
      286,
      66,
      18,
      theme.textBody,
      undefined,
      1.16,
    ),
    circleElement(`${prefix}_legend_down_dot`, 568, 398, 16, '#ed7d31', 1),
    shapeElement(`${prefix}_intersections_panel`, 542, 442, 376, 72, '#f8fafc', 1),
    textElement(
      `${prefix}_intersections`,
      'x 轴 ≤ 3 交点；y 轴为 (0, d)。',
      558,
      458,
      344,
      24,
      18,
      theme.textBody,
      undefined,
      1.08,
    ),
  ];
}

function shouldUseCubicCoefficientLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  const source = getLayoutSignalText(elements, context);
  const title = getSlideTitle(elements, context);
  const hasCoefficientTitle =
    /三次函数.*系数影响|\u4e09\u6b21\u51fd\u6570.*\u7cfb\u6570\u5f71\u54cd/.test(title) ||
    /系数.*影响|\u7cfb\u6570.*\u5f71\u54cd/.test(title);

  return (
    hasCoefficientTitle &&
    /(系数 a|系数 b|系数 c|系数 d|\u7cfb\u6570 a|\u7cfb\u6570 b|\u7cfb\u6570 c|\u7cfb\u6570 d)/.test(
      source,
    ) &&
    /(ax\^3|x³|x\^3|bx\^2|cx\s*\+\s*d)/i.test(source)
  );
}

function cubicCoefficientReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const prefix = 'polish_ref_cubic_coeff';
  const cardTop = 214;
  const cardWidth = 190;
  const cardHeight = 126;
  const cardGap = 26;
  const cardLefts = [
    82,
    82 + cardWidth + cardGap,
    82 + (cardWidth + cardGap) * 2,
    82 + (cardWidth + cardGap) * 3,
  ];
  const cards = [
    { id: 'a', fill: '#e3f2fd', color: '#1d65b7', title: '系数 a', body: '开口与陡峭' },
    { id: 'b', fill: '#e8f5e9', color: '#2f7d32', title: '系数 b', body: '平移与弯曲' },
    { id: 'c', fill: '#fff3e0', color: '#8a5a00', title: '系数 c', body: '原点斜率' },
    { id: 'd', fill: '#fce4ec', color: '#c62828', title: '系数 d', body: '上下平移' },
  ];

  return [
    textElement(
      `${prefix}_title`,
      `<strong>${title}</strong>`,
      82,
      48,
      836,
      56,
      34,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_subtitle`,
      '探索系数 a、b、c、d 如何改变函数图像形态',
      82,
      120,
      836,
      34,
      21,
      theme.textBody,
      undefined,
      1.1,
    ),
    shapeElement(`${prefix}_rule`, 82, 170, 836, 2, theme.accent, 0.9),
    ...cards.flatMap((card, index) => {
      const left = cardLefts[index];
      return [
        shapeElement(
          `${prefix}_${card.id}_card`,
          left,
          cardTop,
          cardWidth,
          cardHeight,
          card.fill,
          1,
        ),
        textElement(
          `${prefix}_${card.id}_text`,
          `<strong>${card.title}</strong><br/>${card.body}`,
          left + 24,
          cardTop + 32,
          cardWidth - 48,
          62,
          20,
          card.color,
          undefined,
          1.16,
        ),
      ];
    }),
    shapeElement(`${prefix}_formula_panel`, 82, 392, 392, 94, '#ffffff', 1),
    textElement(
      `${prefix}_formula`,
      'f(x) = ax<sup>3</sup> + bx<sup>2</sup> + cx + d',
      110,
      418,
      336,
      42,
      20,
      theme.textPrimary,
      undefined,
      1.12,
    ),
    shapeElement(`${prefix}_note_panel`, 526, 386, 392, 112, '#f5f5f5', 1),
    textElement(
      `${prefix}_note`,
      'a &gt; 0：两端上升；a &lt; 0：两端下降。<br/>c 控制 x → 0 附近的切线斜率。',
      554,
      406,
      328,
      70,
      18,
      theme.textBody,
      undefined,
      1.16,
    ),
  ];
}

function shouldUseCubicSummaryFormulaLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  const source = getLayoutSignalText(elements, context);
  const title = getSlideTitle(elements, context);
  const hasSummaryTitle =
    /(总结.*关键公式|关键公式|课堂小结|\u603b\u7ed3.*\u5173\u952e\u516c\u5f0f)/.test(title) ||
    /(总结.*关键公式|关键公式|课堂小结|\u603b\u7ed3.*\u5173\u952e\u516c\u5f0f)/.test(source);
  const hasCubicFormula = /(ax\^3|x³|x\^3|3ax\^2|\\frac\{b\}\{3a\})/i.test(source);
  const hasFlow = /(解题流程|求导数|单调区间|极值点|拐点)/.test(source);

  return hasSummaryTitle && hasCubicFormula && hasFlow;
}

function cubicSummaryFormulaReferenceLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const prefix = 'polish_ref_cubic_summary';
  const left = 82;
  const right = 520;
  const panelTop = 164;
  const panelHeight = 336;
  const panelWidth = 398;
  const steps = [
    "① 求导：f'(x)=3ax²+2bx+c",
    '② 解方程定位极值候选点',
    '③ 列表分析单调区间',
    '④ 看 a 的符号判断走势',
    '⑤ 画草图，标注极值与拐点',
  ];

  return [
    textElement(
      `${prefix}_title`,
      `<strong>${title}</strong>`,
      82,
      48,
      836,
      56,
      34,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    shapeElement(`${prefix}_rule`, 82, 132, 836, 3, theme.accent, 0.85),
    shapeElement(`${prefix}_formula_panel`, left, panelTop, panelWidth, panelHeight, '#f8faff', 1),
    textElement(
      `${prefix}_formula_heading`,
      '<strong>核心公式</strong>',
      left + 28,
      panelTop + 22,
      panelWidth - 56,
      52,
      22,
      theme.textPrimary,
      undefined,
      1.12,
    ),
    textElement(
      `${prefix}_formula_1`,
      'f(x) = ax<sup>3</sup> + bx<sup>2</sup> + cx + d&nbsp;&nbsp;(a ≠ 0)',
      left + 38,
      236,
      panelWidth - 76,
      54,
      22,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_formula_2`,
      "f'(x) = 3ax<sup>2</sup> + 2bx + c = 0",
      left + 38,
      314,
      panelWidth - 76,
      54,
      22,
      theme.textPrimary,
      undefined,
      1.1,
    ),
    textElement(
      `${prefix}_formula_3`,
      'x = -<span style="display:inline-block;text-align:center;vertical-align:middle;"><span style="display:block;border-bottom:1px solid currentColor;padding:0 6px;">b</span><span style="display:block;padding:0 6px;">3a</span></span>',
      left + 120,
      388,
      180,
      58,
      22,
      theme.textPrimary,
      undefined,
      1.05,
    ),
    shapeElement(`${prefix}_flow_panel`, right, panelTop, panelWidth, panelHeight, '#f0f4ff', 1),
    textElement(
      `${prefix}_flow_heading`,
      '<strong>解题流程</strong>',
      right + 28,
      panelTop + 22,
      panelWidth - 56,
      52,
      22,
      theme.textPrimary,
      undefined,
      1.12,
    ),
    shapeElement(`${prefix}_flow_list_card`, right + 26, 236, 346, 248, '#dbeafe', 1),
    textElement(
      `${prefix}_flow_steps`,
      steps.join('<br/>'),
      right + 48,
      254,
      300,
      202,
      18,
      '#1e3a5f',
      undefined,
      1.45,
    ),
  ];
}

function referenceLayoutElements<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] | null {
  const title = getSlideTitle(elements, context);
  if (elements.some((element) => element.id?.startsWith('polish_ref_vertex_'))) {
    if (isQuadraticParameterTitle(title)) {
      return quadraticParameterReferenceLayout(elements, context) as T[];
    }
    if (isQuadraticApplicationTitle(title)) {
      return quadraticApplicationReferenceLayout(elements, context) as T[];
    }
  }
  if (elements.some((element) => element.id?.startsWith('polish_ref_'))) return elements;
  if (shouldPreserveComposedTeachingLayout(elements)) return null;
  if (shouldUsePythonVariablesLayout(elements, context)) {
    return pythonVariablesReferenceLayout(elements, context) as T[];
  }
  if (shouldUseRedisInternalStructureLayout(elements, context)) {
    return redisInternalStructureReferenceLayout(elements, context) as T[];
  }
  if (shouldUseCubicIntroLayout(elements, context)) {
    return cubicIntroReferenceLayout(elements, context) as T[];
  }
  if (shouldUseCubicGraphFeaturesLayout(elements, context)) {
    return cubicGraphFeaturesReferenceLayout(elements, context) as T[];
  }
  if (shouldUseCubicCoefficientLayout(elements, context)) {
    return cubicCoefficientReferenceLayout(elements, context) as T[];
  }
  if (shouldUseCubicSummaryFormulaLayout(elements, context)) {
    return cubicSummaryFormulaReferenceLayout(elements, context) as T[];
  }
  if (shouldUseEquationRelationLayout(elements, context)) {
    return equationRelationReferenceLayout(elements, context) as T[];
  }
  if (isQuadraticTopicText(getLayoutSignalText(elements, context))) {
    if (isQuadraticParameterTitle(title)) {
      return quadraticParameterReferenceLayout(elements, context) as T[];
    }
    if (isQuadraticApplicationTitle(title)) {
      return quadraticApplicationReferenceLayout(elements, context) as T[];
    }
  }
  if (shouldUseVertexFormLayout(elements, context)) {
    return vertexFormReferenceLayout(elements, context) as T[];
  }
  if (shouldUseRedisDataStructureLayout(elements, context)) {
    return redisDataStructureReferenceLayout(elements, context) as T[];
  }
  if (shouldUseCanonicalMediaLayout(elements, context)) {
    return canonicalMediaReferenceLayout(elements, context) as T[];
  }
  if (shouldUseCanonicalDataLayout(elements, context)) {
    return canonicalDataReferenceLayout(elements, context) as T[];
  }
  if (shouldUseCanonicalFormulaLayout(elements, context)) {
    return canonicalFormulaReferenceLayout(elements, context) as T[];
  }
  if (shouldUseCanonicalTextLayout(elements, context)) {
    return canonicalTextReferenceLayout(elements, context) as T[];
  }
  return null;
}

function shouldUseQuadraticTeachingLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  const source = getContextSourceText(elements, context);
  if (!isQuadraticTopicText(source)) return false;
  if (!isParabolaGraphIntroSlide(elements, context)) return false;

  const hasRichMedia = elements.some((element) =>
    ['image', 'video', 'chart', 'table', 'latex'].includes(element.type),
  );
  if (hasRichMedia) return false;

  const hasCurvedParabola = elements.some((element) => {
    if (element.type !== 'line') return false;
    const record = element as Record<string, unknown>;
    return Array.isArray(record['curve']) || Array.isArray(record['cubic']);
  });
  const learningBlockCount = elements.filter(isReadableElement).length;

  return !hasCurvedParabola || elements.length < 16 || learningBlockCount < 5;
}

function isParabolaGraphIntroSlide(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  const title = getSlideTitle(elements, context);
  const source = getContextSourceText(elements, context);
  const titleSignalsGraph = /图像|图象|抛物线|\u56fe\u50cf|\u56fe\u8c61|\u629b\u7269\u7ebf/i.test(
    title,
  );
  if (!titleSignalsGraph) return false;

  const specificNonGraphTopic =
    /顶点式|一元二次方程|判别式|实际应用|应用|最值|性质|平移|配方法|一般式|解析式|\u9876\u70b9\u5f0f|\u4e00\u5143\u4e8c\u6b21\u65b9\u7a0b|\u5224\u522b\u5f0f|\u5b9e\u9645\u5e94\u7528|\u5e94\u7528|\u6700\u503c|\u6027\u8d28|\u5e73\u79fb|\u914d\u65b9\u6cd5|\u4e00\u822c\u5f0f|\u89e3\u6790\u5f0f/i;
  if (specificNonGraphTopic.test(title)) return false;

  return /抛物线|开口|对称轴|顶点|parabola|\u629b\u7269\u7ebf|\u5f00\u53e3|\u5bf9\u79f0\u8f74|\u9876\u70b9/i.test(
    source,
  );
}

function quadraticTeachingLayout(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const title = getSlideTitle(elements, context);
  const gridColor = '#d7e3f2';
  const axisColor = '#75869d';

  return [
    textElement(
      'polish_quad_title',
      `<strong>${title}</strong>`,
      82,
      50,
      836,
      64,
      34,
      theme.textPrimary,
    ),
    shapeElement('polish_quad_title_rule', 82, 126, 836, 3, theme.accent, 0.92),
    shapeElement('polish_quad_graph_panel', 76, 154, 526, 336, theme.panel, 0.64),
    ...[190, 260, 330, 400, 470].map((x, index) =>
      lineElement(`polish_quad_grid_v_${index}`, x, 186, [0, 0], [0, 258], 1, gridColor, {
        opacity: 0.5,
      }),
    ),
    ...[224, 278, 332, 386, 440].map((y, index) =>
      lineElement(`polish_quad_grid_h_${index}`, 116, y, [0, 0], [430, 0], 1, gridColor, {
        opacity: 0.5,
      }),
    ),
    lineElement('polish_quad_axis_x', 116, 440, [0, 0], [430, 0], 2, axisColor, {
      points: ['', 'arrow'],
    }),
    lineElement('polish_quad_axis_y', 330, 460, [0, 0], [0, -268], 2, axisColor, {
      points: ['', 'arrow'],
    }),
    lineElement(
      'polish_quad_symmetry_axis',
      330,
      432,
      [0, 0],
      [0, -206],
      2,
      theme.accentSecondary,
      {
        style: 'dashed',
      },
    ),
    lineElement('polish_quad_parabola', 162, 438, [0, 0], [336, 0], 5, theme.accent, {
      curve: [168, -244],
    }),
    circleElement('polish_quad_vertex_dot', 321, 186, 18, theme.accent, 0.95),
    shapeElement('polish_quad_formula_pad', 202, 198, 300, 72, '#ffffff', 0.96),
    textElement(
      'polish_quad_formula_text',
      '<strong>y = ax<sup>2</sup> + bx + c</strong>',
      222,
      207,
      260,
      48,
      18,
      theme.textPrimary,
    ),
    shapeElement('polish_quad_vertex_label_pad', 356, 246, 158, 74, '#ffffff', 0.92),
    textElement(
      'polish_quad_vertex_label',
      '\u9876\u70b9\uff1a\u6700\u9ad8/\u6700\u4f4e\u70b9',
      370,
      258,
      128,
      46,
      18,
      theme.textBody,
    ),
    shapeElement('polish_quad_axis_label_pad', 176, 310, 140, 66, '#ffffff', 0.92),
    textElement(
      'polish_quad_axis_label',
      '\u5bf9\u79f0\u8f74',
      204,
      322,
      84,
      42,
      18,
      theme.textBody,
    ),
    textElement(
      'polish_quad_graph_caption',
      '\u629b\u7269\u7ebf\u7531\u5f00\u53e3\u3001\u9876\u70b9\u3001\u5bf9\u79f0\u8f74\u5171\u540c\u51b3\u5b9a\u5f62\u72b6',
      106,
      452,
      460,
      42,
      18,
      theme.textBody,
    ),
    shapeElement('polish_quad_notes_panel', 626, 154, 318, 336, '#ffffff', 0.98),
    shapeElement('polish_quad_notes_bar', 626, 174, 5, 292, theme.accent, 1),
    textElement(
      'polish_quad_notes_title',
      '<strong>\u8bfb\u56fe\u4e09\u6b65</strong>',
      654,
      174,
      234,
      42,
      24,
      theme.textPrimary,
    ),
    circleElement('polish_quad_step_1_dot', 650, 232, 40, theme.accent, 0.92),
    textElement(
      'polish_quad_step_1_text',
      '<strong>1. \u770b\u5f00\u53e3</strong><br/>\u5224\u65ad a \u7684\u6b63\u8d1f\u548c\u53d8\u5316\u8d8b\u52bf',
      704,
      226,
      208,
      64,
      18,
      theme.textBody,
    ),
    circleElement('polish_quad_step_2_dot', 650, 304, 40, theme.accent, 0.92),
    textElement(
      'polish_quad_step_2_text',
      '<strong>2. \u627e\u9876\u70b9</strong><br/>\u786e\u5b9a\u6700\u503c\u548c\u51fd\u6570\u4e2d\u5fc3',
      704,
      298,
      208,
      64,
      18,
      theme.textBody,
    ),
    circleElement('polish_quad_step_3_dot', 650, 376, 40, theme.accent, 0.92),
    textElement(
      'polish_quad_step_3_text',
      '<strong>3. \u5224\u5bf9\u79f0</strong><br/>\u5de6\u53f3\u5bf9\u5e94\u70b9\u8ddd\u79bb\u76f8\u7b49',
      704,
      370,
      208,
      64,
      18,
      theme.textBody,
    ),
    shapeElement('polish_quad_takeaway_rule', 654, 452, 258, 1, '#d7dde8', 1),
    textElement(
      'polish_quad_takeaway',
      '<strong>\u8bb0\u4f4f</strong>\uff1a\u56fe\u50cf\u8981\u5bf9\u4e0a\u53c2\u6570',
      654,
      448,
      258,
      44,
      18,
      theme.textBody,
    ),
  ];
}

function extractContextKeywords(context?: SlidePolishContext): string[] {
  const keywords = [...(context?.keyPoints ?? []), ...(context?.title ? [context.title] : [])]
    .map((item) => stripHtml(item))
    .map((item) => item.replace(/^\[[^\]]+\]\s*/, '').trim())
    .filter(Boolean);

  const fallback = ['Core idea', 'Key relation', 'Apply'];
  return [...keywords, ...fallback].slice(0, 3);
}

function quadraticVisualAnchorElements(
  theme: SlidePolishTheme,
): Array<SlideLikeElement & Record<string, unknown>> {
  return [
    shapeElement('polish_visual_panel', 110, 188, 410, 245, theme.panel, 0.58),
    shapeElement('polish_visual_formula_pad', 238, 208, 235, 48, '#ffffff', 0.94),
    textElement(
      'polish_visual_formula_label',
      '<strong>y = ax^2 + bx + c</strong>',
      254,
      218,
      196,
      28,
      18,
      theme.textPrimary,
    ),
    lineElement('polish_visual_axis_x', 160, 360, [0, 0], [310, 0], 2, '#7f8da3', {
      points: ['', 'arrow'],
    }),
    lineElement('polish_visual_axis_y', 170, 395, [0, 0], [0, -170], 2, '#7f8da3', {
      points: ['', 'arrow'],
    }),
    lineElement('polish_visual_parabola', 190, 360, [0, 0], [250, 0], 4, theme.accent, {
      curve: [125, -210],
    }),
    circleElement('polish_visual_vertex_dot', 307, 247, 16, theme.accent, 0.9),
    shapeElement('polish_visual_curve_label_pad', 338, 278, 132, 54, '#ffffff', 0.9),
    textElement('polish_visual_curve_label', '图像是抛物线', 350, 288, 108, 28, 18, theme.textBody),
    textElement('polish_visual_vertex_label', '顶点 / 开口', 335, 246, 118, 28, 18, theme.textBody),
  ];
}

function conceptVisualAnchorElements(
  theme: SlidePolishTheme,
  keywords: string[],
): Array<SlideLikeElement & Record<string, unknown>> {
  const elements: Array<SlideLikeElement & Record<string, unknown>> = [
    shapeElement('polish_visual_panel', 110, 188, 410, 245, theme.panel, 0.58),
    lineElement('polish_visual_spine', 148, 226, [0, 0], [0, 150], 3, theme.accent, {
      points: ['', 'arrow'],
    }),
  ];

  keywords.slice(0, 3).forEach((keyword, index) => {
    const top = 214 + index * 68;
    elements.push(
      circleElement(`polish_visual_node_${index}`, 138, top + 15, 20, theme.accent, 0.88),
    );
    elements.push(
      shapeElement(`polish_visual_label_pad_${index}`, 178, top, 276, 52, '#ffffff', 0.92),
    );
    elements.push(
      textElement(
        `polish_visual_label_${index}`,
        escapeHtmlShort(keyword, 34),
        194,
        top + 10,
        244,
        30,
        18,
        theme.textBody,
      ),
    );
  });

  return elements;
}

function extractSlideKeywords(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): string[] {
  const fromContext = context?.keyPoints?.map((point) => stripHtml(point)).filter(Boolean) ?? [];
  if (fromContext.length > 0) return fromContext.slice(0, 3);

  return elements
    .filter((element) => element.type === 'text')
    .map((element) => stripHtml(String((element as Record<string, unknown>).content ?? '')))
    .flatMap((text) => text.split(/[。；;，,\n]|•|·/))
    .map((text) => text.trim())
    .filter((text) => text.length >= 3 && text.length <= 24)
    .slice(0, 3);
}

function intersects(
  element: SlideLikeElement,
  box: { left: number; top: number; width: number; height: number },
): boolean {
  return (
    intersectionArea(getElementBox(element), toBox(box.left, box.top, box.width, box.height)) > 0
  );
}

function hasTitleDivider(elements: SlideLikeElement[]): boolean {
  return elements.some((element) => {
    if (!['shape', 'line'].includes(element.type)) return false;
    const box = getElementBox(element);
    return box.top >= 120 && box.top <= 180 && box.width >= 360 && box.height <= 10;
  });
}

function createRichnessLayer(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const keywords = extractSlideKeywords(elements, context);
  const theme = getPolishTheme(context);
  const layer: Array<SlideLikeElement & Record<string, unknown>> = [];
  const prefix = 'polish_rich';

  const titleRuleBox = { left: 105, top: 154, width: 790, height: 3 };
  const titleRuleIsClear = !elements.some((element) => intersects(element, titleRuleBox));
  if (!hasTitleDivider(elements) && titleRuleIsClear) {
    layer.push(shapeElement(`${prefix}_title_rule`, 105, 154, 790, 2, theme.accent, 0.9));
  }

  const bottomNoteBox = { left: 112, top: 444, width: 776, height: 58 };
  const bottomNoteIsClear = !elements.some((element) => intersects(element, bottomNoteBox));
  if (keywords.length > 0 && bottomNoteIsClear && elements.length < 10) {
    layer.push(shapeElement(`${prefix}_takeaway_rule`, 112, 452, 776, 1, '#d7dde8', 1));
    layer.push(
      textElement(
        `${prefix}_takeaway_text`,
        `<strong>本页要点</strong> ${keywords.map((keyword) => escapeHtmlShort(keyword, 18)).join(' / ')}`,
        112,
        462,
        776,
        40,
        18,
        theme.textBody,
      ),
    );
  }

  // Legacy card-heavy enrichments are intentionally disabled for the clean GIF-style deck.
  const bottomStripBox = { left: 104, top: 430, width: 792, height: 84 };
  const bottomIsClear =
    !elements.some((element) => intersects(element, bottomStripBox)) && elements.length < 0;
  if (keywords.length > 0 && bottomIsClear) {
    layer.push(shapeElement(`${prefix}_strip`, 112, 462, 776, 34, theme.background, 0.96));
    layer.push(shapeElement(`${prefix}_strip_accent`, 112, 462, 5, 34, theme.accent, 1));
    layer.push(
      textElement(
        `${prefix}_strip_text`,
        `<strong>本页抓手</strong>　${keywords.map((keyword) => escapeHtmlShort(keyword, 20)).join('　/　')}`,
        132,
        470,
        720,
        20,
        14,
        theme.textBody,
      ),
    );
  }

  const hasRightPanel = elements.some(
    (element) => element.left > 520 && Number(element.height ?? 0) > 80,
  );
  const sideCardBox = { left: 580, top: 196, width: 316, height: 176 };
  const sideCardIsClear =
    !elements.some((element) => intersects(element, sideCardBox)) && elements.length < 0;
  if (!hasRightPanel && sideCardIsClear && keywords.length > 0) {
    layer.push(shapeElement(`${prefix}_side_card`, 590, 206, 294, 154, theme.background, 0.98));
    layer.push(shapeElement(`${prefix}_side_bar`, 590, 206, 5, 154, theme.accentSecondary, 1));
    layer.push(
      textElement(
        `${prefix}_side_title`,
        '<strong>课堂观察</strong>',
        612,
        222,
        210,
        24,
        17,
        theme.textPrimary,
      ),
    );
    keywords.slice(0, 3).forEach((keyword, index) => {
      layer.push(
        textElement(
          `${prefix}_side_${index}`,
          `${index + 1}. ${escapeHtmlShort(keyword, 22)}`,
          614,
          258 + index * 30,
          238,
          23,
          15,
          theme.textBody,
        ),
      );
    });
  }

  if (elements.length < 0) {
    const titleGlowBox = { left: 104, top: 60, width: 190, height: 22 };
    const titleGlowIsClear = !elements.some((element) => intersects(element, titleGlowBox));
    if (titleGlowIsClear) {
      layer.push(shapeElement(`${prefix}_title_glow`, 104, 66, 190, 10, theme.accent, 0.18));
    }
  }

  return layer;
}

function escapeHtmlShort(text: string, max: number): string {
  const boundedText = truncateReadableText(text, max);
  return boundedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateReadableText(text: string, max: number): string {
  if (text.length <= max) return text;

  const codeTokenMatch = text.match(
    /\b(?:do-while|while|for|switch|case|break|continue|boolean|double|float|byte|short|int|long|char|String)\b/i,
  );
  let limit = max;
  if (codeTokenMatch && codeTokenMatch.index !== undefined) {
    const tokenEnd = codeTokenMatch.index + codeTokenMatch[0].length;
    if (tokenEnd > max && tokenEnd <= max + 18) {
      limit = tokenEnd;
    }
  }

  if (/[A-Za-z0-9_-]/.test(text[limit - 1] ?? '') && /[A-Za-z0-9_-]/.test(text[limit] ?? '')) {
    const tokenEnd = text.slice(limit).search(/[^A-Za-z0-9_-]/);
    if (tokenEnd >= 0 && tokenEnd <= 18) {
      limit += tokenEnd;
    } else {
      const tokenStart = text.slice(0, limit).search(/[A-Za-z0-9_-]+$/);
      if (tokenStart >= 0 && limit - tokenStart >= 4) {
        limit = tokenStart;
      }
    }
  }

  const clipped = text
    .slice(0, limit)
    .replace(/[，,、:：；;+\-*/=([{（\s]+$/g, '')
    .trimEnd();
  return clipped || text.slice(0, max);
}

export function enrichSlideElements<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return elements;

  const hasRichnessLayer = elements.some((element) => element.id?.startsWith('polish_rich_'));
  if (hasRichnessLayer) return elements;

  const visualCount = elements.filter((element) =>
    ['image', 'video', 'chart', 'table', 'latex', 'shape'].includes(element.type),
  ).length;
  const textCount = elements.filter((element) => element.type === 'text').length;
  const shouldEnrich = elements.length < 13 || visualCount < 5 || textCount < 3;

  if (!shouldEnrich) return elements;
  return [...elements, ...createRichnessLayer(elements, context)] as T[];
}

function isPlainTextCardProtectedElement(element: SlideLikeElement): boolean {
  return Boolean(
    element.id?.startsWith('polish_ref_') ||
    element.id?.startsWith('polish_quad_') ||
    element.id?.startsWith('polish_visual_') ||
    element.id?.startsWith('polish_density_') ||
    element.id?.startsWith('polish_plain_') ||
    element.id?.startsWith('classroom_qa_safe_'),
  );
}

function getPlainTextCardTargets(elements: SlideLikeElement[]): SlideLikeElement[] {
  const title = getTitleElement(elements);
  return elements
    .filter((element) => {
      if (element === title) return false;
      if (element.type !== 'text') return false;
      if ((element as Record<string, unknown>)['fill']) return false;

      const box = getElementBox(element);
      const text = getTextContent(element).replace(/\s+/g, '');
      return (
        box.top >= 128 &&
        box.top <= 448 &&
        box.width >= 240 &&
        box.height >= 32 &&
        text.length >= 10
      );
    })
    .sort((a, b) => a.top - b.top)
    .slice(0, 5);
}

function shouldAddPlainTextCardLayer(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): boolean {
  if (context?.decorate === false) return false;
  if (elements.some(isPlainTextCardProtectedElement)) return false;
  if (elements.some(isStrongMediaElement)) return false;
  if (elements.filter(isBackgroundShapeLike).length > 0) return false;
  if (!getTitleElement(elements)) return false;

  const textCount = elements.filter((element) => element.type === 'text').length;
  const targets = getPlainTextCardTargets(elements);
  return textCount >= 4 && targets.length >= 3 && targets.length <= 5;
}

function addPlainTextCardLayer<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] {
  if (!shouldAddPlainTextCardLayer(elements, context)) return elements;

  const theme = getPolishTheme(context);
  const targets = getPlainTextCardTargets(elements);
  const cards = targets.map((element, index) => {
    const box = getElementBox(element);
    return shapeElement(
      `polish_plain_card_${index}`,
      Math.max(MARGIN, box.left - 18),
      Math.max(118, box.top - 12),
      Math.min(CANVAS_WIDTH - MARGIN * 2, box.width + 36),
      box.height + 26,
      index % 2 === 0 ? '#ffffff' : '#f3f9ff',
      0.96,
    );
  });
  const accents = targets.map((element, index) => {
    const box = getElementBox(element);
    return shapeElement(
      `polish_plain_accent_${index}`,
      Math.max(MARGIN, box.left - 18),
      box.top + 10,
      4,
      Math.max(30, box.height - 20),
      index % 2 === 0 ? theme.accent : theme.accentSecondary,
      0.86,
    );
  });
  const titleRule = hasTitleDivider(elements)
    ? []
    : [shapeElement('polish_plain_title_rule', 86, 126, 260, 4, theme.accent, 0.9)];

  return [...titleRule, ...cards, ...accents, ...elements] as T[];
}

type SlideQualityIssue = {
  type:
    | 'blocking_layout'
    | 'tiny_text'
    | 'generic_template_label'
    | 'likely_truncated_text'
    | 'underfilled_table'
    | 'excessive_blank_space'
    | 'render_clip_risk';
  detail: string;
};

const QUALITY_BLOCKING_LAYOUT_TYPES = new Set<LayoutGuardIssue['type']>([
  'readable_element_overlap',
  'foreground_overlay_collision',
  'latex_box_too_small',
  'unsafe_bottom_zone',
  'text_outside_background',
]);

function getElementPlainText(element: SlideLikeElement): string {
  if (element.type === 'latex') {
    return String((element as Record<string, unknown>)['latex'] ?? '');
  }
  if (element.type === 'shape') {
    const text = (element as Record<string, unknown>)['text'] as { content?: string } | undefined;
    return stripHtml(String(text?.content ?? ''));
  }
  return stripHtml(getTextContent(element));
}

function isGenericTemplateLabelText(text: string): boolean {
  const normalized = text.replace(/\s+/g, '').trim();
  if (!normalized) return false;

  if (
    /^(核心功能|核心抓手|视角[A-C]|观点[A-C]|Perspective[A-C]|CoreFeature|KeyPoint|Conclusion)$/i.test(
      normalized,
    )
  ) {
    return true;
  }

  if (/^Step\d{1,2}$/i.test(normalized)) return true;

  return false;
}

function findGenericTemplateLabelIssues(elements: SlideLikeElement[]): SlideQualityIssue[] {
  return elements
    .filter((element) => element.type === 'text' || hasShapeText(element))
    .map((element) => ({ element, text: getElementPlainText(element) }))
    .filter(({ text }) => isGenericTemplateLabelText(text))
    .map(({ element, text }) => ({
      type: 'generic_template_label' as const,
      detail: `${element.id ?? 'text'} is a template label without concrete teaching content: ${text}`,
    }));
}

function containsDangerousGenericTemplateText(text: string): boolean {
  return /(Perspective\s*[A-C]|Core\s*Feature|Key\s*Point|Conclusion|Step\s*\d{1,2}|核心功能|视角\s*[A-C])/i.test(
    text,
  );
}

function contextualReplacementText(context: SlidePolishContext | undefined, index: number): string {
  const candidates = [
    ...(context?.keyPoints ?? []),
    context?.title,
    '把本页概念、方法和例子整理成可讲解的课堂内容。',
  ].filter((value): value is string => !!value && !isStrictGenericCanonicalText(value));

  return candidates[index % candidates.length] ?? '把本页概念、方法和例子整理成可讲解的课堂内容。';
}

function replaceGenericTemplateLabels<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] {
  let replacementIndex = 0;

  return elements.map((element) => {
    if (element.type !== 'text') return element;

    const plain = getElementPlainText(element);
    if (!isGenericTemplateLabelText(plain) && !containsDangerousGenericTemplateText(plain)) {
      return element;
    }

    const content = String((element as Record<string, unknown>)['content'] ?? '');
    const fontSize = getFontSize(content, element.top < 150 ? 28 : 18);
    const replacement = contextualReplacementText(context, replacementIndex);
    replacementIndex += 1;

    return {
      ...element,
      content: `<p style="font-size:${fontSize}px;font-family:${FONT_STACK};line-height:1.2;">${escapeHtmlShort(
        replacement,
        element.top < 150 ? 42 : 82,
      )}</p>`,
    };
  });
}

function hasLikelyDanglingEnding(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (/[，,、:：；;+\-*/=([{（]$/.test(normalized)) return true;
  if (/(^|[\s<])(?:Databas|Conclusio|Perspectiv|Featur|Functio|Formul)$/i.test(normalized)) {
    return true;
  }
  if (/[A-Za-z]{5,}$/.test(normalized) && !/[.!?。！？）)]$/.test(normalized)) {
    const lastWord = normalized.match(/[A-Za-z]+$/)?.[0] ?? '';
    return /^(databas|conclusio|perspectiv|functio|formul|paramet|variab|derivat)$/i.test(lastWord);
  }
  return false;
}

function findLikelyTruncatedTextIssues(elements: SlideLikeElement[]): SlideQualityIssue[] {
  return elements
    .filter(
      (element) => element.type === 'text' || element.type === 'latex' || hasShapeText(element),
    )
    .map((element) => ({ element, text: getElementPlainText(element) }))
    .filter(({ text }) => hasLikelyDanglingEnding(text))
    .map(({ element, text }) => ({
      type: 'likely_truncated_text' as const,
      detail: `${element.id ?? 'text'} looks truncated near: ${text.slice(-32)}`,
    }));
}

function findUnderfilledTableIssues(elements: SlideLikeElement[]): SlideQualityIssue[] {
  const tables = elements.filter((element) => element.type === 'table');
  if (tables.length !== 1) return [];

  const hasCompetingVisual = elements.some((element) =>
    ['image', 'video', 'chart', 'latex', 'code'].includes(element.type),
  );
  if (hasCompetingVisual) return [];

  const table = tables[0];
  const box = getElementBox(table);
  const area = box.width * box.height;
  if (box.width >= 720 && box.height >= 250 && area >= 190000) return [];

  return [
    {
      type: 'underfilled_table',
      detail: `${table.id ?? 'table'} occupies ${Math.round(area)}px^2; table-first pages need a larger table block`,
    },
  ];
}

function findExcessiveBlankSpaceIssues(elements: SlideLikeElement[]): SlideQualityIssue[] {
  const meaningful = elements.filter((element) => {
    if (isThinDecorativeElement(element)) return false;
    if (element.id?.startsWith('polish_density_')) return false;
    return (
      isReadableElement(element) || ['image', 'video', 'chart', 'table'].includes(element.type)
    );
  });
  if (meaningful.length < 3) return [];

  const occupiedRatio = getDensityOccupiedRatio(elements);
  if (occupiedRatio >= 0.16) return [];

  return [
    {
      type: 'excessive_blank_space',
      detail: `Slide occupied ratio ${occupiedRatio.toFixed(2)} is too low after density optimization`,
    },
  ];
}

function findRenderClipRiskIssues(elements: SlideLikeElement[]): SlideQualityIssue[] {
  return elements
    .filter((element) => element.type === 'text')
    .map((element) => {
      const content = getTextContent(element);
      const plain = stripHtml(content);
      const fontSize = getFontSize(content, element.top < 150 ? 32 : 18);
      const lineHeight = Number((element as Record<string, unknown>)['lineHeight'] ?? 1.35);
      const estimatedHeight = estimateTextHeight(content, element.width, fontSize, lineHeight) - 20;
      const availableHeight = Math.max(1, Number(element.height ?? 24) - 20);
      const requiredScale = availableHeight / Math.max(1, estimatedHeight);
      const minimumScale = element.top < 150 ? 0.8 : 0.62;
      return {
        element,
        content,
        plain,
        estimatedHeight,
        availableHeight,
        requiredScale,
        minimumScale,
      };
    })
    .filter(({ content, plain }) => plain.length >= 42 || /<br\s*\/?>|<\/p>\s*<p\b/i.test(content))
    .filter(
      ({ estimatedHeight, availableHeight, requiredScale, minimumScale }) =>
        estimatedHeight * minimumScale > availableHeight + 4 || requiredScale < 0.72,
    )
    .map(({ element, estimatedHeight, availableHeight, requiredScale }) => ({
      type: 'render_clip_risk' as const,
      detail: `${element.id ?? 'text'} estimated text height ${Math.round(
        estimatedHeight,
      )} exceeds render box ${Math.round(availableHeight)} at scale ${requiredScale.toFixed(2)}`,
    }));
}

function auditSlideQualityGate(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): SlideQualityIssue[] {
  const layoutIssues = auditSlideLayout(elements)
    .filter(
      (issue) => QUALITY_BLOCKING_LAYOUT_TYPES.has(issue.type) || issue.type === 'text_too_small',
    )
    .map((issue) => ({
      type: issue.type === 'text_too_small' ? ('tiny_text' as const) : ('blocking_layout' as const),
      detail: issue.detail,
    }));

  return [
    ...layoutIssues,
    ...findGenericTemplateLabelIssues(elements),
    ...findLikelyTruncatedTextIssues(elements),
    ...findUnderfilledTableIssues(elements),
    ...findRenderClipRiskIssues(elements),
    ...findExcessiveBlankSpaceIssues(elements),
  ].filter((issue) => {
    if (issue.type !== 'excessive_blank_space') return true;
    const title = getSlideTitle(elements, context);
    return !/(封面|目录|谢谢|结束|outline|thanks|quiz)/i.test(title);
  });
}

function isOpenMaicGeneratedElementSet(elements: SlideLikeElement[]): boolean {
  if (elements.length === 0) return false;
  const generatedLikeCount = elements.filter((element) =>
    /^(text|shape|line|image|video|chart|table|latex)_[\w-]+$/i.test(element.id ?? ''),
  ).length;
  return generatedLikeCount >= Math.max(3, Math.ceil(elements.length * 0.55));
}

function repairQualityGateLayout<T extends SlideLikeElement>(elements: T[]): T[] {
  const renderFitAdjusted = expandTextBoxesForRenderFit(elements);
  const repaired = repairSlideLayout(
    enforceReadableSafeBounds(
      resolveVerticalReadableOverlaps(
        normalizeStepSections(normalizeCardTextOwnership(normalizeParallelRows(renderFitAdjusted))),
      ),
    ),
  );

  return reserveBottomCalloutSpace(
    enforceReadableSafeBounds(
      resolveVerticalReadableOverlaps(
        normalizeStepSections(normalizeCardTextOwnership(normalizeParallelRows(repaired))),
      ),
    ),
  );
}

function expandTextBoxesForRenderFit<T extends SlideLikeElement>(elements: T[]): T[] {
  return elements.map((element) => {
    if (element.type !== 'text') return element;

    const content = getTextContent(element);
    const plain = stripHtml(content);
    if (plain.length < 42 && !/<br\s*\/?>|<\/p>\s*<p\b/i.test(content)) return element;

    const fontSize = getFontSize(content, element.top < 150 ? 32 : 18);
    const lineHeight = Number((element as Record<string, unknown>)['lineHeight'] ?? 1.35);
    const estimatedHeight = estimateTextHeight(content, element.width, fontSize, lineHeight);
    const currentHeight = Number(element.height ?? 24);
    if (estimatedHeight <= currentHeight) return element;

    const safeBottom = CANVAS_HEIGHT - MARGIN;
    const availableHeight = safeBottom - element.top;
    if (availableHeight < Math.max(48, currentHeight)) return element;

    return {
      ...element,
      height: Math.min(availableHeight, Math.max(currentHeight, estimatedHeight)),
    };
  });
}

function qualityFallbackReferenceLayout<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] {
  if (elements.some((element) => element.type === 'image' || element.type === 'video')) {
    return canonicalMediaReferenceLayout(elements, context) as T[];
  }
  if (elements.some((element) => element.type === 'table' || element.type === 'chart')) {
    return canonicalDataReferenceLayout(elements, context) as T[];
  }
  if (elements.some((element) => element.type === 'latex' || element.type === 'code')) {
    return canonicalFormulaReferenceLayout(elements, context) as T[];
  }
  return canonicalTextReferenceLayout(elements, context) as T[];
}

function applySlideQualityGate<T extends SlideLikeElement>(
  elements: T[],
  sourceElements: T[],
  context?: SlidePolishContext,
): T[] {
  const sanitized = replaceGenericTemplateLabels(elements, context);
  const issues = auditSlideQualityGate(sanitized, context);
  if (issues.length === 0) return sanitized;

  const repaired = replaceGenericTemplateLabels(repairQualityGateLayout(sanitized), context);
  const repairedIssues = auditSlideQualityGate(repaired, context);
  const requiresFallback = issues.some(
    (issue) =>
      issue.type === 'generic_template_label' ||
      issue.type === 'underfilled_table' ||
      issue.type === 'likely_truncated_text' ||
      issue.type === 'render_clip_risk',
  );
  if (!requiresFallback && (repairedIssues.length === 0 || repairedIssues.length < issues.length)) {
    return repaired;
  }

  if (!isOpenMaicGeneratedElementSet(sourceElements)) return repaired;

  const fallback = qualityFallbackReferenceLayout(sourceElements, context);
  const polishedFallback = replaceGenericTemplateLabels(
    polishReferenceLayoutElements(fallback, context),
    context,
  );
  const fallbackIssues = auditSlideQualityGate(polishedFallback, context).filter(
    (issue) => issue.type !== 'excessive_blank_space',
  );

  if (fallbackIssues.length < issues.length) return polishedFallback as T[];
  return repaired;
}

export function polishSlideElements<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] {
  const baseElements = elements.filter((element) => !element.id?.startsWith('polish_rich_'));
  const referenceElements = referenceLayoutElements(baseElements, context);
  if (referenceElements) {
    return sanitizeDecorativeChrome(
      addDeckDiversitySignature(
        applySlideQualityGate(
          polishReferenceLayoutElements(referenceElements, context),
          baseElements,
          context,
        ),
        context,
      ),
    );
  }

  const shouldDecorate = context?.decorate !== false;
  const layoutElements =
    shouldDecorate && shouldUseQuadraticTeachingLayout(baseElements, context)
      ? (quadraticTeachingLayout(baseElements, context) as T[])
      : baseElements;
  const prefersPlainTextCardLayer =
    shouldDecorate && shouldAddPlainTextCardLayer(layoutElements, context);
  const shapeCount = layoutElements.filter((element) => element.type === 'shape').length;
  const hasStrongVisual = layoutElements.some((element) =>
    ['image', 'video', 'chart', 'table', 'latex'].includes(element.type),
  );
  const needsVisualAnchor =
    shouldDecorate && !prefersPlainTextCardLayer && !hasStrongVisual && shapeCount < 3;
  const anchoredElements = needsVisualAnchor
    ? ([...visualAnchorElements(context), ...layoutElements] as T[])
    : layoutElements;
  const sourceElements = shouldDecorate
    ? enrichSlideElements(anchoredElements, context)
    : anchoredElements;

  const polished = sourceElements.map((element) => {
    const themedElement = applyThemeToElement(element, context);
    switch (themedElement.type) {
      case 'text':
        return polishTextElement(themedElement);
      case 'latex':
        return polishLatexElement(themedElement);
      case 'line':
        return polishLineElement(themedElement);
      case 'shape':
      case 'image':
      case 'video':
      case 'chart':
      case 'table':
        return polishBoxElement(themedElement);
      default:
        return themedElement;
    }
  });

  const readableLayout = protectReadableLayout(polished, context);
  const normalizedBands = normalizeStackedTeachingBands(readableLayout);
  const qualityAdjusted = applySlideQualityGate(normalizedBands, baseElements, context);
  const finalBands = normalizeStackedTeachingBands(qualityAdjusted);
  const visuallyLayered = shouldDecorate ? addPlainTextCardLayer(finalBands, context) : finalBands;

  return sanitizeDecorativeChrome(addDeckDiversitySignature(visuallyLayered, context));
}

function polishReferenceLayoutElements<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] {
  const polished = elements.map((element) => {
    const themedElement = applyThemeToElement(element, context);
    switch (themedElement.type) {
      case 'text':
        return polishTextElement(themedElement);
      case 'latex':
        return polishLatexElement(themedElement);
      case 'line':
        return polishLineElement(themedElement);
      case 'shape':
      case 'image':
      case 'video':
      case 'chart':
      case 'table':
        return polishBoxElement(themedElement);
      default:
        return themedElement;
    }
  });

  return enforceReadableSafeBounds(polished);
}

function optimizeDominantTableDensity<T extends SlideLikeElement>(elements: T[]): T[] {
  const tables = elements.filter((element) => element.type === 'table');
  if (tables.length !== 1) return elements;

  const hasCompetingVisual = elements.some((element) =>
    ['image', 'video', 'chart', 'latex', 'code'].includes(element.type),
  );
  if (hasCompetingVisual) return elements;

  const table = tables[0];
  const tableBox = getElementBox(table);
  const hasTableCaption = elements.some((element) => {
    if (element.type !== 'text') return false;
    const box = getElementBox(element);
    const horizontalOverlap =
      Math.min(box.right, tableBox.right) - Math.max(box.left, tableBox.left);
    return (
      horizontalOverlap >= tableBox.width * 0.45 &&
      box.top < tableBox.top &&
      tableBox.top - box.top <= 100
    );
  });
  if (hasTableCaption) return elements;

  const tableArea = tableBox.width * tableBox.height;
  if (tableBox.width >= 700 && tableBox.height >= 280) return elements;
  if (tableArea >= 240000) return elements;

  const title = getTitleElement(elements);
  const titleBottom = title ? getElementBox(title).bottom : 128;
  const top = Math.max(168, titleBottom + 44);
  const bottom = 486;
  const targetHeight = Math.max(286, bottom - top);

  return elements.map((element) => {
    if (element !== table) return element;
    return {
      ...element,
      left: 92,
      top,
      width: 816,
      height: targetHeight,
      cellMinHeight: Math.max(
        Number((element as Record<string, unknown>).cellMinHeight ?? 0),
        Math.floor(targetHeight / 5),
      ),
    };
  });
}

function protectReadableLayout<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] {
  const compacted = compactTitleWhitespace(elements);
  const cardOwned = normalizeCardTextOwnership(compacted);
  const parallelAligned = normalizeParallelRows(cardOwned);
  const stepAdjusted = normalizeStepSections(parallelAligned);
  const bottomAdjusted = fitBottomReadableRows(stepAdjusted);
  const tableCaptionAdjusted = fitTableCaptionsAboveTables(bottomAdjusted);
  const tableDensityAdjusted = optimizeDominantTableDensity(tableCaptionAdjusted);
  const tableCaptionReadjusted = fitTableCaptionsAboveTables(tableDensityAdjusted);
  const latexAdjusted = fitLatexAroundRightColumn(tableCaptionReadjusted);
  const rightColumnAdjusted = fitRightColumnAboveTables(latexAdjusted);
  const cleaned = removeDecorationsCoveringReadableContent(rightColumnAdjusted);
  const calloutReserved = reserveBottomCalloutSpace(cleaned);
  const spaced = resolveVerticalReadableOverlaps(calloutReserved);
  const repaired = repairSlideLayout(enforceReadableSafeBounds(spaced));
  const finalReserved = reserveBottomCalloutSpace(repaired);
  const finalSpaced = normalizeParallelRows(
    enforceReadableSafeBounds(
      resolveVerticalReadableOverlaps(
        normalizeStepSections(normalizeCardTextOwnership(finalReserved)),
      ),
    ),
  );
  const finalLayout = reserveBottomCalloutSpace(
    normalizeStepSections(normalizeCardTextOwnership(finalSpaced)),
  );
  const densityOptimized = optimizeSparseLayout(finalLayout, context);
  if (densityOptimized === finalLayout) return finalLayout;

  return enforceReadableSafeBounds(resolveVerticalReadableOverlaps(densityOptimized));
}

function getTitleElement<T extends SlideLikeElement>(elements: T[]): T | undefined {
  return elements
    .filter((element) => element.type === 'text')
    .filter((element) => {
      const text = getTextContent(element);
      const box = getElementBox(element);
      return box.top < 140 && box.width >= 420 && text.length > 0 && text.length <= 48;
    })
    .sort((a, b) => a.top - b.top || b.width - a.width)[0];
}

function isTitleZoneElement(element: SlideLikeElement, title?: SlideLikeElement): boolean {
  if (element === title) return true;
  const box = getElementBox(element);
  return box.top < 160 && (element.type === 'text' || isThinDecorativeElement(element));
}

function isDensityGeneratedElement(element: SlideLikeElement): boolean {
  return Boolean(element.id?.startsWith('polish_density_'));
}

function isStrongMediaElement(element: SlideLikeElement): boolean {
  return ['image', 'video', 'chart', 'table', 'latex'].includes(element.type);
}

function isDensityProtectedElement(element: SlideLikeElement): boolean {
  return Boolean(
    element.id?.startsWith('polish_ref_') ||
    element.id?.startsWith('polish_quad_') ||
    element.id?.startsWith('polish_visual_'),
  );
}

function getContentBounds(elements: SlideLikeElement[]): ElementBox | null {
  if (elements.length === 0) return null;

  const boxes = elements.map(getElementBox);
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return toBox(left, top, right - left, bottom - top);
}

function getDensityOccupiedRatio(elements: SlideLikeElement[]): number {
  const measurable = elements.filter((element) => {
    if (isThinDecorativeElement(element)) return false;
    if (isDensityGeneratedElement(element)) return false;
    if (
      element.type === 'shape' &&
      !hasShapeText(element) &&
      !(element as Record<string, unknown>).fill
    ) {
      return false;
    }
    return (
      isReadableElement(element) ||
      ['shape', 'image', 'video', 'chart', 'table'].includes(element.type)
    );
  });

  const occupiedArea = measurable.reduce((total, element) => {
    const box = getElementBox(element);
    return total + Math.min(box.width * box.height, CANVAS_WIDTH * CANVAS_HEIGHT * 0.35);
  }, 0);

  return occupiedArea / (CANVAS_WIDTH * CANVAS_HEIGHT);
}

function isSummaryBandText(element: SlideLikeElement): boolean {
  if (element.type !== 'text') return false;
  const text = getTextContent(element);
  return /^(课堂小结|核心思想|本页要点|关键结论|总结|Takeaway|Core idea|Learning goal|Next)/i.test(
    text,
  );
}

function getDensityMainElements(
  elements: SlideLikeElement[],
  title?: SlideLikeElement,
): SlideLikeElement[] {
  return elements.filter((element) => {
    if (isTitleZoneElement(element, title)) return false;
    if (isSummaryBandText(element)) return false;
    if (isThinDecorativeElement(element)) return false;
    if (isDensityGeneratedElement(element)) return false;
    const box = getElementBox(element);
    return box.top >= 170 && (isReadableElement(element) || isBackgroundShapeLike(element));
  });
}

function shouldOptimizeSparseLayout(
  elements: SlideLikeElement[],
  mainElements: SlideLikeElement[],
): boolean {
  if (elements.some(isDensityGeneratedElement)) return false;
  if (elements.some(isDensityProtectedElement)) return false;
  if (mainElements.length === 0) return false;

  const bounds = getContentBounds(mainElements);
  if (!bounds) return false;

  const topGap = bounds.top - 150;
  const bottomBlank = CANVAS_HEIGHT - MARGIN - bounds.bottom;
  const occupiedRatio = getDensityOccupiedRatio(elements);

  return occupiedRatio < 0.24 && (topGap > 58 || bottomBlank > 94);
}

function getDensityKeywords(elements: SlideLikeElement[], context?: SlidePolishContext): string[] {
  const keywords = extractSlideKeywords(elements, context);
  if (keywords.length > 0) return keywords.slice(0, 3);
  return ['核心概念', '关键方法', '结果检验'];
}

function densityAnchorElements(
  elements: SlideLikeElement[],
  context?: SlidePolishContext,
): Array<SlideLikeElement & Record<string, unknown>> {
  const theme = getPolishTheme(context);
  const keywords = getDensityKeywords(elements, context);
  const prefix = 'polish_density_anchor';

  return [
    shapeElement(`${prefix}_panel`, 82, 178, 318, 232, theme.panel, 0.64),
    lineElement(`${prefix}_spine`, 124, 220, [0, 0], [0, 146], 3, theme.accent, {
      points: ['', 'arrow'],
    }),
    ...keywords.flatMap((keyword, index) => {
      const top = 206 + index * 62;
      return [
        shapeElement(`${prefix}_label_pad_${index}`, 154, top, 208, 50, '#ffffff', 0.94),
        textElement(
          `${prefix}_label_${index}`,
          escapeHtmlShort(keyword, 24),
          174,
          top + 11,
          168,
          28,
          18,
          theme.textBody,
          undefined,
          1.1,
        ),
      ];
    }),
  ];
}

function applySparseTwoBandLayout<T extends SlideLikeElement>(
  elements: T[],
  mainTexts: T[],
  context?: SlidePolishContext,
): T[] {
  const theme = getPolishTheme(context);
  const bandLeft = 452;
  const bandTop = 178;
  const bandWidth = 466;
  const bandHeight = 92;
  const bandGap = 22;
  const textTargets = new Map<
    string | undefined,
    Partial<SlideLikeElement> & { content?: string; paragraphSpace?: number; lineHeight?: number }
  >();
  const bandShapes = mainTexts.map((text, index) => {
    const top = bandTop + index * (bandHeight + bandGap);
    textTargets.set(text.id, {
      left: bandLeft + 28,
      top: top + 16,
      width: bandWidth - 56,
      height: 58,
      content: setFontSize(String((text as Record<string, unknown>).content ?? ''), 20),
      paragraphSpace: 0,
      lineHeight: 1.18,
    });
    return shapeElement(
      `polish_density_band_${index}`,
      bandLeft,
      top,
      bandWidth,
      bandHeight,
      '#f8fafc',
      1,
    );
  });

  return [
    ...(densityAnchorElements(elements, context) as T[]),
    ...(bandShapes as T[]),
    ...elements.map((element) => {
      const target = textTargets.get(element.id);
      if (!target) return element;
      return {
        ...element,
        ...target,
        defaultColor: (element as Record<string, unknown>)['defaultColor'] || theme.textBody,
      };
    }),
  ] as T[];
}

function expandSparseSummaryBand<T extends SlideLikeElement>(elements: T[]): T[] {
  const summary = elements
    .filter(isSummaryBandText)
    .filter((element) => {
      const box = getElementBox(element);
      return box.top >= 360 && (box.width < 700 || box.height < 56);
    })
    .sort((a, b) => getElementBox(b).top - getElementBox(a).top)[0];

  if (!summary) return elements;

  const summaryTop = CANVAS_HEIGHT - MARGIN - 64;
  return elements.map((element) => {
    if (element !== summary) return element;
    return {
      ...element,
      left: 105,
      top: summaryTop,
      width: 790,
      height: 64,
      fill: (element as Record<string, unknown>)['fill'] || '#f8fafc',
      content: setFontSize(String((element as Record<string, unknown>).content ?? ''), 18),
      paragraphSpace: 0,
      lineHeight: 1.18,
    };
  }) as T[];
}

function liftSparseMainContent<T extends SlideLikeElement>(
  elements: T[],
  mainElements: SlideLikeElement[],
): T[] {
  const bounds = getContentBounds(mainElements);
  if (!bounds || bounds.top <= 188) return elements;

  const lift = Math.min(bounds.top - 188, 56);
  if (lift <= 0) return elements;

  const mainIds = new Set(mainElements.map((element) => element.id));
  return elements.map((element) => {
    if (!mainIds.has(element.id)) return element;
    return {
      ...element,
      top: Math.max(168, element.top - lift),
    };
  }) as T[];
}

function optimizeSparseLayout<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] {
  const title = getTitleElement(elements);
  if (!title) return elements;

  const mainElements = getDensityMainElements(elements, title);
  if (!shouldOptimizeSparseLayout(elements, mainElements)) return elements;

  const hasStrongMedia = elements.some(isStrongMediaElement);
  const backgroundCount = elements.filter(isBackgroundShapeLike).length;
  const mainTexts = mainElements.filter(
    (element): element is T => element.type === 'text' && !isSummaryBandText(element),
  );

  if (!hasStrongMedia && backgroundCount <= 1 && mainTexts.length >= 2 && mainTexts.length <= 3) {
    return applySparseTwoBandLayout(elements, mainTexts, context);
  }

  const lifted = liftSparseMainContent(elements, mainElements);
  return expandSparseSummaryBand(lifted);
}

function compactTitleWhitespace<T extends SlideLikeElement>(elements: T[]): T[] {
  const title = elements
    .filter((element) => element.type === 'text' && element.top < 130)
    .sort((a, b) => a.top - b.top)[0];
  if (!title || title.top <= MARGIN) return elements;

  const shift = clamp(title.top - MARGIN, 0, 36);
  if (shift <= 0) return elements;

  return elements.map((element) => ({
    ...element,
    top: Math.max(0, element.top - shift),
  }));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function isParallelRowCandidate(element: SlideLikeElement): boolean {
  const box = getElementBox(element);
  if (box.top < 100 || box.top > 430) return false;
  if (box.width < 120 || box.width > 360 || box.height < 24 || box.height > 180) return false;
  if (!['shape', 'text', 'latex'].includes(element.type)) return false;
  if (element.type === 'shape') {
    return Boolean((element as Record<string, unknown>).fill);
  }
  return true;
}

function getParallelRows<T extends SlideLikeElement>(elements: T[]): T[][] {
  const rows: T[][] = [];
  const candidates = elements.filter(isParallelRowCandidate).sort((a, b) => a.top - b.top);

  for (const candidate of candidates) {
    const row = rows.find(
      (group) => group[0].type === candidate.type && Math.abs(group[0].top - candidate.top) <= 32,
    );
    if (row) {
      row.push(candidate);
    } else {
      rows.push([candidate]);
    }
  }

  return rows
    .map((row) => row.sort((a, b) => a.left - b.left))
    .filter((row) => {
      if (row.length < 3) return false;
      const boxes = row.map(getElementBox);
      const widthRange =
        Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width));
      if (widthRange > 56) return false;

      for (let i = 1; i < boxes.length; i += 1) {
        if (boxes[i - 1].right > boxes[i].left) return false;
      }

      return true;
    });
}

function normalizeParallelRows<T extends SlideLikeElement>(elements: T[]): T[] {
  const targets = new Map<T, Pick<SlideLikeElement, 'left' | 'top' | 'width' | 'height'>>();

  for (const row of getParallelRows(elements)) {
    const boxes = row.map(getElementBox);
    const left = Math.min(...boxes.map((box) => box.left));
    const right = Math.max(...boxes.map((box) => box.right));
    const targetWidth = Math.round(median(boxes.map((box) => box.width)));
    const gap = (right - left - targetWidth * row.length) / (row.length - 1);
    if (!Number.isFinite(gap) || gap < 16 || gap > 96) continue;

    const targetTop = Math.round(median(boxes.map((box) => box.top)));
    const targetHeight = Math.round(Math.max(...boxes.map((box) => box.height)));

    row.forEach((element, index) => {
      targets.set(element, {
        left: Math.round(left + index * (targetWidth + gap)),
        top: targetTop,
        width: targetWidth,
        height: targetHeight,
      });
    });
  }

  if (targets.size === 0) return elements;

  return elements.map((element) => {
    const target = targets.get(element);
    return target ? ({ ...element, ...target } as T) : element;
  });
}

function getCardBackgroundRows<T extends SlideLikeElement>(elements: T[]): T[][] {
  const candidates = elements
    .filter((element) => {
      if (!isBackgroundShapeLike(element)) return false;
      const box = getElementBox(element);
      if (box.top < 150 || box.top > 470) return false;
      if (box.width < 160 || box.width > 520) return false;
      const isMainCard = box.height >= 72 && box.height <= 320 && box.top <= 430;
      const isCardStrip = box.height >= 44 && box.height < 72 && box.top >= 360;
      if (!isMainCard && !isCardStrip) return false;
      return true;
    })
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const rows: T[][] = [];
  for (const candidate of candidates) {
    const row = rows.find((group) => Math.abs(group[0].top - candidate.top) <= 28);
    if (row) {
      row.push(candidate);
    } else {
      rows.push([candidate]);
    }
  }

  return rows
    .map((row) => row.sort((a, b) => a.left - b.left))
    .filter((row) => {
      if (row.length < 3 || row.length > 4) return false;
      const boxes = row.map(getElementBox);
      for (let i = 1; i < boxes.length; i += 1) {
        const gap = boxes[i].left - boxes[i - 1].right;
        if (gap < 12 || gap > 120) return false;
      }
      return true;
    });
}

function getCardRowBox(cards: SlideLikeElement[]): ElementBox {
  return cards
    .map(getElementBox)
    .reduce(
      (acc, box) =>
        toBox(
          Math.min(acc.left, box.left),
          Math.min(acc.top, box.top),
          Math.max(acc.right, box.right) - Math.min(acc.left, box.left),
          Math.max(acc.bottom, box.bottom) - Math.min(acc.top, box.top),
        ),
      getElementBox(cards[0]),
    );
}

function getCardIndexForX(cards: SlideLikeElement[], x: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  cards.forEach((card, index) => {
    const box = getElementBox(card);
    const center = box.left + box.width / 2;
    const distance = Math.abs(center - x);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });
  return bestIndex;
}

function isCardReadableCandidate(element: SlideLikeElement): boolean {
  return element.type === 'text' || element.type === 'latex';
}

function rowsShareColumns(a: SlideLikeElement[], b: SlideLikeElement[]): boolean {
  if (a.length !== b.length) return false;

  return a.every((card, index) => {
    const cardBox = getElementBox(card);
    const otherBox = getElementBox(b[index]);
    const centerDelta = Math.abs(
      cardBox.left + cardBox.width / 2 - (otherBox.left + otherBox.width / 2),
    );
    return centerDelta <= 36 && Math.abs(cardBox.width - otherBox.width) <= 72;
  });
}

function findNestedCardRow(
  cards: SlideLikeElement[],
  allRows: SlideLikeElement[][],
): SlideLikeElement[] | undefined {
  const rowBox = getCardRowBox(cards);
  return allRows.find((row) => {
    if (row === cards) return false;
    const otherBox = getCardRowBox(row);
    return (
      otherBox.top > rowBox.top + 20 &&
      otherBox.top < rowBox.bottom - 4 &&
      rowsShareColumns(cards, row)
    );
  });
}

function candidateBelongsToNestedRow(
  candidate: SlideLikeElement,
  currentCards: SlideLikeElement[],
  allRows: SlideLikeElement[][],
): boolean {
  const candidateBox = getElementBox(candidate);
  const centerX = candidateBox.left + candidateBox.width / 2;
  const centerY = candidateBox.top + candidateBox.height / 2;
  const currentBox = getCardRowBox(currentCards);

  return allRows.some((row) => {
    if (row === currentCards) return false;
    const rowBox = getCardRowBox(row);
    return (
      rowBox.top > currentBox.top + 20 &&
      centerY >= rowBox.top - 4 &&
      centerY <= rowBox.bottom + 8 &&
      centerX >= rowBox.left - 90 &&
      centerX <= rowBox.right + 90 &&
      rowsShareColumns(currentCards, row)
    );
  });
}

function groupCardCandidatesByTop<T extends SlideLikeElement>(
  indexedCandidates: Array<{ element: T; index: number }>,
): Array<Array<{ element: T; index: number }>> {
  const bands: Array<Array<{ element: T; index: number }>> = [];

  indexedCandidates.forEach((candidate) => {
    const candidateTop = getElementBox(candidate.element).top;
    const band = bands.find(
      (group) => Math.abs(getElementBox(group[0].element).top - candidateTop) <= 18,
    );
    if (band) {
      band.push(candidate);
    } else {
      bands.push([candidate]);
    }
  });

  return bands.map((band) => band.sort((a, b) => a.index - b.index));
}

function startsLikeColumnSpecificText(text: string): boolean {
  return /^(\s*([①②③④⑤⑥⑦⑧⑨]|\d+[.)、:]|[A-D][.:：]|Delta\s*[<=>]|Δ|D\s*[<=>]|f\s*[(']|x\s*[<=>]))/i.test(
    text,
  );
}

function isLikelyCardRowCaption(element: SlideLikeElement): boolean {
  if (element.type !== 'text') return false;
  const text = getTextContent(element);
  if (!text || startsLikeColumnSpecificText(text)) return false;
  return text.length >= 10 || /(关系|个数|数量|count|relationship|summary|note)/i.test(text);
}

function fitCaptionNearCardRow<T extends SlideLikeElement>(
  element: T,
  cards: SlideLikeElement[],
  allRows: SlideLikeElement[][],
): T {
  const rowBox = getCardRowBox(cards);
  const mainRow = allRows
    .filter((row) => row !== cards)
    .filter((row) => {
      const otherBox = getCardRowBox(row);
      return (
        otherBox.top < rowBox.top && otherBox.bottom > rowBox.top && rowsShareColumns(row, cards)
      );
    })
    .sort((a, b) => getCardRowBox(b).top - getCardRowBox(a).top)[0];
  const anchorBox = mainRow ? getCardRowBox(mainRow) : rowBox;
  const leftOffset = Math.min(360, Math.max(320, rowBox.width * 0.34));
  const top = clamp(anchorBox.top - 38, MARGIN, Math.max(MARGIN, rowBox.top - 24));
  const height = Math.min(28, Math.max(22, Number(element.height ?? 24)));

  return {
    ...element,
    left: rowBox.left + leftOffset,
    top,
    width: Math.max(220, rowBox.width - leftOffset),
    height,
  };
}

function getCardTextTarget(
  card: SlideLikeElement,
  cardIndex: number,
  cards: SlideLikeElement[],
  allRows: SlideLikeElement[][],
): SlideLikeElement {
  const nestedRow = findNestedCardRow(cards, allRows);
  if (!nestedRow) return card;

  const cardBox = getElementBox(card);
  const nestedBox = getElementBox(nestedRow[cardIndex]);
  if (nestedBox.top <= cardBox.top + 24 || nestedBox.top >= cardBox.bottom) return card;

  return {
    ...card,
    height: Math.max(44, nestedBox.top - cardBox.top - 6),
  };
}

function fitElementInsideCardBand<T extends SlideLikeElement>(
  element: T,
  card: SlideLikeElement,
): T {
  const fitted = fitElementInsideCard(element, card);
  const cardBox = getElementBox(card);
  if (cardBox.height > 104) return fitted;

  const minTop = cardBox.top + (cardBox.height <= 72 ? 8 : 12);
  const maxBottom = cardBox.bottom - (cardBox.height <= 72 ? 8 : 10);
  const maxHeight = Math.max(24, maxBottom - minTop);
  const preferredHeight = Math.max(
    Number(element.height ?? 0),
    Number(fitted.height ?? 0),
    cardBox.height <= 72 ? 24 : 36,
  );
  const height = Math.min(preferredHeight, maxHeight);
  const next = {
    ...fitted,
    top: minTop,
    height,
  };

  if (next.type !== 'text') return next as T;

  return {
    ...next,
    paragraphSpace: 0,
    lineHeight: cardBox.height <= 72 ? 1.12 : 1.16,
  } as T;
}

function findSectionHeadingAboveCardRow<T extends SlideLikeElement>(
  elements: T[],
  rowBox: ElementBox,
): T | undefined {
  return elements
    .filter((element) => element.type === 'text')
    .filter((element) => {
      const box = getElementBox(element);
      if (box.top < rowBox.top - 130 || box.top > rowBox.top - 18) return false;
      if (box.left > rowBox.left + 48) return false;
      if (box.width > 440) return false;
      const text = getTextContent(element);
      return text.length >= 2 && text.length <= 32;
    })
    .sort((a, b) => getElementBox(b).top - getElementBox(a).top)[0];
}

function expandCompositeCardRows<T extends SlideLikeElement>(elements: T[]): T[] {
  let adjusted = elements.map((element) => ({ ...element })) as T[];
  const rows = getCardBackgroundRows(adjusted);
  const targets = new Map<number, Partial<SlideLikeElement>>();

  for (const cards of rows) {
    const nestedRow = findNestedCardRow(cards, rows);
    if (!nestedRow) continue;

    const rowBox = getCardRowBox(cards);
    const nestedBox = getCardRowBox(nestedRow);
    if (nestedBox.top - rowBox.top >= 88) continue;

    const heading = findSectionHeadingAboveCardRow(adjusted, rowBox);
    const headingBox = heading ? getElementBox(heading) : undefined;
    const headingHeight = heading
      ? Math.min(Number(heading.height ?? headingBox?.height ?? 34), 34)
      : 0;
    const minTop = headingBox
      ? headingBox.top + headingHeight + 14
      : Math.max(MARGIN, rowBox.top - 42);
    const desiredTop = clamp(Math.min(rowBox.top, nestedBox.top - 96), minTop, rowBox.top);
    if (desiredTop >= rowBox.top - 1) continue;

    if (heading) {
      const headingIndex = adjusted.findIndex((element) => element.id === heading.id);
      if (headingIndex >= 0) {
        targets.set(headingIndex, { height: headingHeight });
      }
    }

    cards.forEach((card) => {
      const index = adjusted.findIndex((element) => element.id === card.id);
      if (index < 0) return;
      const box = getElementBox(card);
      targets.set(index, {
        top: desiredTop,
        height: Math.max(72, box.bottom - desiredTop),
      });
    });
  }

  if (targets.size === 0) return elements;

  adjusted = adjusted.map((element, index) => {
    const target = targets.get(index);
    return target ? ({ ...element, ...target } as T) : element;
  });

  return adjusted;
}

function shouldDistributeBandAcrossCards(
  cards: SlideLikeElement[],
  band: Array<{ element: SlideLikeElement; index: number }>,
): boolean {
  if (band.length < cards.length) return false;
  const cardIndexes = new Set(
    band.map(({ element }) => {
      const box = getElementBox(element);
      return getCardIndexForX(cards, box.left + box.width / 2);
    }),
  );
  if (cardIndexes.size < Math.min(cards.length, band.length)) return true;

  return band.some(({ element }, index) =>
    band.slice(index + 1).some(({ element: other }) => {
      const overlap = intersectionArea(getElementBox(element), getElementBox(other));
      const smallerArea = Math.min(
        getElementBox(element).width * getElementBox(element).height,
        getElementBox(other).width * getElementBox(other).height,
      );
      return smallerArea > 0 && overlap / smallerArea >= 0.08;
    }),
  );
}

function hasCardOwnershipConflict(
  cards: SlideLikeElement[],
  candidates: SlideLikeElement[],
): boolean {
  if (candidates.length < cards.length) return false;

  const hasReadableOverlap = candidates.some((element, index) =>
    candidates.slice(index + 1).some((other) => {
      const overlap = intersectionArea(getElementBox(element), getElementBox(other));
      if (overlap <= 0) return false;
      const smallerArea = Math.min(
        getElementBox(element).width * getElementBox(element).height,
        getElementBox(other).width * getElementBox(other).height,
      );
      return smallerArea > 0 && overlap / smallerArea >= 0.08;
    }),
  );
  if (hasReadableOverlap) return true;

  const topBands: SlideLikeElement[][] = [];
  for (const candidate of candidates) {
    const band = topBands.find((group) => Math.abs(group[0].top - candidate.top) <= 18);
    if (band) {
      band.push(candidate);
    } else {
      topBands.push([candidate]);
    }
  }

  return topBands.some((band) => {
    if (band.length < 2 || band.length > cards.length) return false;
    const cardIndexes = new Set(
      band.map((element) => {
        const box = getElementBox(element);
        return getCardIndexForX(cards, box.left + box.width / 2);
      }),
    );
    return cardIndexes.size < band.length;
  });
}

function fitElementInsideCard<T extends SlideLikeElement>(element: T, card: SlideLikeElement): T {
  const cardBox = getElementBox(card);
  const horizontalPad = element.type === 'latex' ? 22 : 20;
  const verticalPad = 14;
  const maxWidth = Math.max(80, cardBox.width - horizontalPad * 2);
  const minWidth = element.type === 'latex' ? Math.min(220, maxWidth) : Math.min(80, maxWidth);
  const width = clamp(Math.min(Math.max(element.width, minWidth), maxWidth), 60, maxWidth);
  const left = cardBox.left + (cardBox.width - width) / 2;
  const minHeight = element.type === 'latex' ? 64 : 30;
  const top = clamp(
    element.top,
    cardBox.top + verticalPad,
    Math.max(cardBox.top + verticalPad, cardBox.bottom - verticalPad - minHeight),
  );
  const height = Math.ceil(
    Math.max(
      minHeight,
      Math.min(Number(element.height ?? minHeight), cardBox.bottom - top - verticalPad),
    ),
  );

  return {
    ...element,
    left,
    top,
    width,
    height,
  };
}

function normalizeCardTextOwnership<T extends SlideLikeElement>(elements: T[]): T[] {
  let adjusted = expandCompositeCardRows(elements).map((element) => ({ ...element })) as T[];
  const cardRows = getCardBackgroundRows(adjusted);

  for (const cards of cardRows) {
    const rowBox = getCardRowBox(cards);

    const indexedCandidates = adjusted
      .map((element, index) => ({ element, index }))
      .filter(({ element }) => isCardReadableCandidate(element))
      .filter(({ element }) => {
        const box = getElementBox(element);
        const centerX = box.left + box.width / 2;
        if (box.top < rowBox.top - 8 || box.top > rowBox.bottom + 18) return false;
        if (centerX < rowBox.left - 90 || centerX > rowBox.right + 90) return false;
        if (candidateBelongsToNestedRow(element, cards, cardRows)) return false;
        return true;
      })
      .sort((a, b) => a.index - b.index);

    const candidates = indexedCandidates.map(({ element }) => element);
    if (!hasCardOwnershipConflict(cards, candidates)) continue;

    const targets = new Map<number, T>();
    const consumedIndexes = new Set<number>();

    for (const rawBand of groupCardCandidatesByTop(indexedCandidates)) {
      if (!shouldDistributeBandAcrossCards(cards, rawBand)) continue;

      const band = [...rawBand];
      if (band.length === cards.length + 1) {
        const captionIndex = band.findIndex(({ element }) => isLikelyCardRowCaption(element));
        if (captionIndex >= 0) {
          const [caption] = band.splice(captionIndex, 1);
          targets.set(caption.index, fitCaptionNearCardRow(caption.element, cards, cardRows));
          consumedIndexes.add(caption.index);
        }
      }

      band.slice(0, cards.length).forEach(({ element, index }, cardIndex) => {
        const targetCard = getCardTextTarget(cards[cardIndex], cardIndex, cards, cardRows);
        targets.set(index, fitElementInsideCardBand(element, targetCard));
        consumedIndexes.add(index);
      });
    }

    if (targets.size === 0) {
      let cardIndex = 0;
      const minCandidateTop = Math.min(...candidates.map((element) => getElementBox(element).top));
      let lastTop = minCandidateTop;

      for (const { element, index } of indexedCandidates) {
        if (
          getElementBox(element).top <= minCandidateTop + 30 &&
          lastTop > minCandidateTop + 30 &&
          cardIndex < cards.length - 1
        ) {
          cardIndex += 1;
        }

        targets.set(index, fitElementInsideCard(element, cards[cardIndex]));
        lastTop = getElementBox(element).top;
      }
    } else {
      for (const { element, index } of indexedCandidates) {
        if (consumedIndexes.has(index)) continue;
        const box = getElementBox(element);
        const cardIndex = getCardIndexForX(cards, box.left + box.width / 2);
        targets.set(index, fitElementInsideCard(element, cards[cardIndex]));
      }
    }

    adjusted = adjusted.map((element, index) => targets.get(index) ?? element);
  }

  return adjusted;
}

function hasBoxOverlap(a: SlideLikeElement, b: SlideLikeElement, padding = 0): boolean {
  return (
    intersectionArea(expandBox(getElementBox(a), padding), expandBox(getElementBox(b), padding)) > 0
  );
}

function getTextContent(element: SlideLikeElement): string {
  if (element.type === 'shape') {
    const text = (element as Record<string, unknown>).text as { content?: string } | undefined;
    return stripHtml(String(text?.content ?? ''));
  }
  return stripHtml(String((element as Record<string, unknown>).content ?? ''));
}

function isBottomAuxiliaryText(element: SlideLikeElement): boolean {
  if (element.type !== 'text') return false;
  const text = getTextContent(element);
  return /^(核心思想|学习目标|本页要点|关键结论|课堂小结|Core idea|Learning goal)/i.test(text);
}

function isBottomBandShape(element: SlideLikeElement): boolean {
  const box = getElementBox(element);
  return (
    element.type === 'shape' &&
    !hasShapeText(element) &&
    box.top > 400 &&
    box.width >= 700 &&
    box.height >= 24 &&
    box.height <= 96
  );
}

function isBottomAuxiliaryCandidate(element: SlideLikeElement): boolean {
  if (element.type !== 'text') return false;
  const box = getElementBox(element);
  const text = getTextContent(element);
  const isAuxiliary =
    isBottomAuxiliaryText(element) ||
    /^(核心思想|学习目标|下一步|拓展|延伸|本页要点|关键结论|课堂小结|Core idea|Learning goal|Next)/i.test(
      text,
    );

  return isAuxiliary && (box.top >= 430 || box.width >= 700);
}

function fitBottomReadableRows<T extends SlideLikeElement>(elements: T[]): T[] {
  const bottomTexts = elements
    .filter(isBottomAuxiliaryCandidate)
    .filter((element) => getElementBox(element).bottom > 420)
    .sort((a, b) => {
      const aText = getTextContent(a);
      const bText = getTextContent(b);
      return bText.length - aText.length;
    });

  if (bottomTexts.length === 0) return elements;

  const hasOverlap = bottomTexts.some((element, index) =>
    bottomTexts.slice(index + 1).some((other) => hasBoxOverlap(element, other, 4)),
  );
  const shouldNormalize = bottomTexts.length === 1 || hasOverlap;
  if (!shouldNormalize) return elements;

  const rowHeight = 44;
  const rowGap = 6;
  const rowsHeight = rowHeight * bottomTexts.length + rowGap * (bottomTexts.length - 1);
  const startTop = CANVAS_HEIGHT - MARGIN - rowsHeight;
  const auxiliaryArea = toBox(105, startTop, 790, rowsHeight);
  const topById = new Map<string | undefined, { top: number; height: number }>();

  bottomTexts.forEach((element, index) => {
    const top = startTop + index * (rowHeight + rowGap);
    topById.set(element.id, {
      top,
      height: rowHeight,
    });
  });

  return elements.map((element) => {
    const row = topById.get(element.id);
    if (!row) {
      if (isBottomBandShape(element)) {
        return {
          ...element,
          left: 60,
          top: startTop,
          width: 880,
          height: Math.min(rowsHeight, 56),
        };
      }
      if (
        isReadableElement(element) &&
        !isBottomAuxiliaryCandidate(element) &&
        getElementBox(element).top < auxiliaryArea.top &&
        intersectionArea(getElementBox(element), expandBox(auxiliaryArea, 6)) > 0
      ) {
        return {
          ...element,
          height: Math.max(36, auxiliaryArea.top - element.top - 8),
        };
      }
      return element;
    }
    return {
      ...element,
      left: 105,
      top: row.top,
      width: 790,
      height: row.height,
    };
  });
}

function isStepHeadingText(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  return /(核心步骤|关键步骤|解题步骤|记忆口诀|步骤与记忆|任务要求|Step|Steps|Keysteps|KeySteps)/i.test(
    compact,
  );
}

function isStepBodyText(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  if (isStepHeadingText(compact)) return false;
  return (
    /[①②③④⑤⑥⑦⑧⑨]/.test(compact) ||
    /(^|\s)(\d+)[.、]/.test(text) ||
    /^(步骤|口诀)[：:]/.test(compact) ||
    /(求导|求f|解f|令f|确定单调|候选|开口方向|中心要记牢)/.test(compact)
  );
}

function isNumberedStepBodyText(text: string): boolean {
  return /[①②③④⑤⑥⑦⑧⑨]/.test(text) || /(^|\s)(\d+)[.、]/.test(text);
}

function getLearningCardBottom(elements: SlideLikeElement[], headingTop: number): number {
  const cards = elements
    .filter(isBackgroundShapeLike)
    .map(getElementBox)
    .filter((box) => {
      if (box.top < 100 || box.top > headingTop + 16) return false;
      if (box.width < 150 || box.height < 60) return false;
      return box.bottom <= headingTop + 24 || box.top < 360;
    });

  if (cards.length === 0) return 0;
  return Math.max(...cards.map((box) => box.bottom));
}

function getCompanionBackgroundForText<T extends SlideLikeElement>(
  text: T,
  elements: T[],
): T | undefined {
  const textBox = getElementBox(text);
  return elements.find((candidate) => {
    if (!isBackgroundShapeLike(candidate)) return false;
    const box = getElementBox(candidate);
    const horizontalOverlap = Math.min(box.right, textBox.right) - Math.max(box.left, textBox.left);
    const verticalOverlap = Math.min(box.bottom, textBox.bottom) - Math.max(box.top, textBox.top);
    return (
      horizontalOverlap >= textBox.width * 0.65 &&
      verticalOverlap >= Math.min(textBox.height, box.height) * 0.45 &&
      box.height <= textBox.height + 42
    );
  });
}

function setTextFontSizeIfNeeded<T extends SlideLikeElement>(element: T, minSize: number): T {
  if (element.type !== 'text') return element;
  const content = String((element as Record<string, unknown>).content ?? '');
  const current = getFontSize(content, minSize);
  if (current >= minSize) return element;
  return {
    ...element,
    content: setFontSize(content, minSize),
  };
}

function stepBodiesBelongToCardRow(
  heading: SlideLikeElement,
  stepBodies: SlideLikeElement[],
  elements: SlideLikeElement[],
): boolean {
  const headingBox = getElementBox(heading);
  return getCardBackgroundRows(elements).some((cards) => {
    const rowBox = getCardRowBox(cards);
    if (rowBox.top < headingBox.top + 24) return false;
    const paddedRow = expandBox(rowBox, 14);
    const ownedBodies = stepBodies.filter((body) => {
      const bodyBox = getElementBox(body);
      const centerX = bodyBox.left + bodyBox.width / 2;
      const centerY = bodyBox.top + bodyBox.height / 2;
      return (
        centerX >= paddedRow.left &&
        centerX <= paddedRow.right &&
        centerY >= paddedRow.top &&
        centerY <= paddedRow.bottom
      );
    });
    return ownedBodies.length >= Math.min(3, stepBodies.length);
  });
}

function normalizeStepSections<T extends SlideLikeElement>(elements: T[]): T[] {
  const headings = elements
    .filter((element) => element.type === 'text')
    .filter((element) => isStepHeadingText(getTextContent(element)))
    .sort((a, b) => b.top - a.top);

  if (headings.length === 0) return elements;

  const heading = headings[0];
  const headingBox = getElementBox(heading);
  if (headingBox.top < 250) return elements;

  const stepBodies = elements
    .filter((element) => element.type === 'text' && element !== heading)
    .filter((element) => isStepBodyText(getTextContent(element)))
    .filter((element) => {
      const box = getElementBox(element);
      if (box.top < 300) return false;
      if (!isNumberedStepBodyText(getTextContent(element)) && box.bottom < headingBox.bottom - 8) {
        return false;
      }
      if (Math.abs(box.top - headingBox.top) <= 120) return true;
      return box.bottom > headingBox.top - 80;
    })
    .sort((a, b) => a.left - b.left || a.top - b.top);

  if (stepBodies.length === 0) return elements;
  if (stepBodiesBelongToCardRow(heading, stepBodies, elements)) return elements;

  const headingHeight = 30;
  const bodyGap = 8;
  const safeBottom = CANVAS_HEIGHT - MARGIN;
  const minBodyHeight = 36;
  const latestHeadingTop = safeBottom - headingHeight - bodyGap - minBodyHeight;
  const cardBottom = getLearningCardBottom(elements, headingBox.top);
  const preferredHeadingTop = Math.max(headingBox.top, cardBottom + 10, 338);
  const headingTop = clamp(Math.min(preferredHeadingTop, latestHeadingTop), 320, latestHeadingTop);
  const bodyTop = headingTop + headingHeight + bodyGap;
  const bodyHeight = Math.max(32, Math.min(56, safeBottom - bodyTop));
  if (bodyHeight < 32) return elements;

  const bodySet = new Set(stepBodies);
  const rightCallout = stepBodies
    .filter((element) => /口诀|Tip|Note|Remember/i.test(getTextContent(element)))
    .sort((a, b) => getElementBox(b).width - getElementBox(a).width)[0];
  const rightCalloutBg = rightCallout
    ? getCompanionBackgroundForText(rightCallout, elements)
    : undefined;
  const hasRightCallout = !!rightCallout && !!rightCalloutBg;
  const leftBodies = hasRightCallout
    ? stepBodies.filter((element) => element !== rightCallout)
    : stepBodies;

  const targets = new Map<
    string | undefined,
    Partial<SlideLikeElement> & { content?: string; paragraphSpace?: number; lineHeight?: number }
  >();

  targets.set(heading.id, {
    left: 68,
    top: headingTop,
    width: hasRightCallout ? 470 : 864,
    height: headingHeight,
    content: setFontSize(String((heading as Record<string, unknown>).content ?? ''), 24),
    paragraphSpace: 0,
    lineHeight: 1.18,
  });

  if (hasRightCallout && rightCallout && rightCalloutBg) {
    const calloutLeft = 570;
    const calloutWidth = 372;
    const calloutTop = bodyTop - 8;
    const calloutHeight = Math.min(Math.max(54, bodyHeight + 16), safeBottom - calloutTop);
    const calloutTextTop = calloutTop + 8;
    targets.set(rightCalloutBg.id, {
      left: calloutLeft,
      top: calloutTop,
      width: calloutWidth,
      height: calloutHeight,
    });
    targets.set(rightCallout.id, {
      left: calloutLeft + 28,
      top: calloutTextTop,
      width: calloutWidth - 56,
      height: Math.max(22, Math.min(36, calloutHeight - 16)),
      content: setFontSize(String((rightCallout as Record<string, unknown>).content ?? ''), 18),
      paragraphSpace: 0,
      lineHeight: 1.28,
    });
  }

  if (leftBodies.length === 1) {
    const body = leftBodies[0];
    targets.set(body.id, {
      left: 68,
      top: bodyTop,
      width: hasRightCallout ? 470 : 864,
      height: bodyHeight,
      content: setFontSize(String((body as Record<string, unknown>).content ?? ''), 18),
      paragraphSpace: 0,
      lineHeight: 1.28,
    });
  } else if (leftBodies.length > 1) {
    const availableWidth = hasRightCallout ? 470 : 864;
    const gap = 18;
    const columnCount = Math.min(leftBodies.length, 2);
    const columnWidth = (availableWidth - gap * (columnCount - 1)) / columnCount;
    leftBodies.forEach((body, index) => {
      const column = index % columnCount;
      const row = Math.floor(index / columnCount);
      const rowHeight = Math.max(34, Math.min(42, bodyHeight - row * 40));
      targets.set(body.id, {
        left: 68 + column * (columnWidth + gap),
        top: bodyTop + row * 40,
        width: columnWidth,
        height: rowHeight,
        content: setFontSize(String((body as Record<string, unknown>).content ?? ''), 18),
        paragraphSpace: 0,
        lineHeight: 1.25,
      });
    });
  }

  if (targets.size <= 1) return elements;

  const stepZoneTop = headingTop - 8;
  const stepZone = toBox(60, stepZoneTop, 890, safeBottom - stepZoneTop);

  return elements.map((element) => {
    const target = targets.get(element.id);
    if (target) {
      return {
        ...element,
        ...target,
      };
    }

    if (
      isReadableElement(element) &&
      !bodySet.has(element) &&
      element !== heading &&
      getElementBox(element).top < stepZone.top &&
      intersectionArea(getElementBox(element), expandBox(stepZone, 4)) > 0
    ) {
      return fitElementAboveZone(element, stepZone);
    }

    if (element.type === 'text') {
      return setTextFontSizeIfNeeded(element, 18);
    }

    return element;
  }) as T[];
}

function isWideBottomCallout(element: SlideLikeElement): boolean {
  if (element.type !== 'text') return false;

  const box = getElementBox(element);
  if (box.top < 360 || box.width < 560 || box.height < 36) return false;

  const text = getTextContent(element);
  const fill = (element as Record<string, unknown>).fill;
  const hasFill = typeof fill === 'string' && fill.trim().length > 0;
  const hasCalloutLabel =
    /^(适用领域|应用领域|应用场景|项目骨架|提示|注意|总结|本页|关键|💡|Takeaway|Tip|Note|Practice|Core idea|Learning goal|Next)/i.test(
      text,
    );

  return hasFill || hasCalloutLabel;
}

function getBottomCalloutIndexes<T extends SlideLikeElement>(elements: T[]): Set<number> {
  const indexes = new Set<number>();

  elements.forEach((element, index) => {
    if (isWideBottomCallout(element)) indexes.add(index);
  });

  if (indexes.size === 0) return indexes;

  const calloutBoxes = [...indexes].map((index) => getElementBox(elements[index]));
  elements.forEach((element, index) => {
    if (indexes.has(index)) return;
    if (!isBackgroundShapeLike(element)) return;

    const box = getElementBox(element);
    const isCompanionBackground = calloutBoxes.some((calloutBox) => {
      const horizontalOverlap =
        Math.min(box.right, calloutBox.right) - Math.max(box.left, calloutBox.left);
      const verticallyAligned =
        box.top <= calloutBox.top + 16 && box.bottom >= calloutBox.bottom - 16;
      const similarHeight = box.height <= calloutBox.height + 36;
      return horizontalOverlap >= calloutBox.width * 0.7 && verticallyAligned && similarHeight;
    });
    if (isCompanionBackground) indexes.add(index);
  });

  return indexes;
}

function isBackgroundShapeLike(element: SlideLikeElement): boolean {
  const box = getElementBox(element);
  return (
    element.type === 'shape' &&
    !hasShapeText(element) &&
    Boolean((element as Record<string, unknown>).fill) &&
    box.width >= 120 &&
    box.height >= 32
  );
}

function isProtectedFromCallout(element: SlideLikeElement): boolean {
  if (isReadableElement(element)) return true;
  if (isBackgroundShapeLike(element)) return true;
  return ['image', 'video', 'chart', 'table'].includes(element.type);
}

function getMinimumCalloutProtectedHeight(element: SlideLikeElement): number {
  if (element.type === 'shape') return 24;
  return getMinimumReadableHeight(element);
}

function fitElementAboveZone<T extends SlideLikeElement>(element: T, zone: ElementBox): T {
  const gap = 8;
  const box = getElementBox(element);
  const minHeight = getMinimumCalloutProtectedHeight(element);
  const limitBottom = zone.top - gap;

  if (box.bottom <= limitBottom) return element;

  if (box.top < limitBottom) {
    const availableHeight = limitBottom - box.top;
    if (availableHeight >= minHeight) {
      return {
        ...element,
        height: Math.min(box.height, availableHeight),
      };
    }
  }

  const liftedTop = limitBottom - box.height;
  if (liftedTop >= MARGIN) {
    return {
      ...element,
      top: liftedTop,
    };
  }

  const height = Math.max(minHeight, limitBottom - MARGIN);
  return {
    ...element,
    top: MARGIN,
    height,
  };
}

function reserveBottomCalloutSpace<T extends SlideLikeElement>(elements: T[]): T[] {
  const calloutIndexes = getBottomCalloutIndexes(elements);
  if (calloutIndexes.size === 0) return elements;

  const zones = [...calloutIndexes].map((index) => expandBox(getElementBox(elements[index]), 8));

  return elements.map((element, index) => {
    if (calloutIndexes.has(index)) return element;
    if (!isProtectedFromCallout(element)) return element;

    const box = getElementBox(element);
    const blockingZone = zones
      .filter((zone) => intersectionArea(box, zone) > 0)
      .sort((a, b) => a.top - b.top)[0];

    if (!blockingZone) return element;
    return fitElementAboveZone(element, blockingZone);
  });
}

function isTableCaption(element: SlideLikeElement): boolean {
  if (element.type !== 'text') return false;
  const text = getTextContent(element);
  const compactText = text.replace(/\s+/g, '');
  return (
    compactText.length > 0 &&
    compactText.length <= 32 &&
    !/^[\d一二三四五六七八九十]+[.、]/.test(compactText)
  );
}

function fitTableCaptionsAboveTables<T extends SlideLikeElement>(elements: T[]): T[] {
  const tables = elements.filter((element) => element.type === 'table');
  if (tables.length === 0) return elements;

  const captionById = new Map<
    string | undefined,
    { left: number; top: number; width: number; height: number }
  >();

  for (const table of tables) {
    const tableBox = getElementBox(table);
    const caption = elements
      .filter(isTableCaption)
      .filter((element) => {
        const box = getElementBox(element);
        const horizontalOverlap =
          Math.min(box.right, tableBox.right) - Math.max(box.left, tableBox.left);
        if (horizontalOverlap < tableBox.width * 0.45) return false;
        if (box.top >= tableBox.top) return false;
        if (tableBox.top - box.top > 90) return false;
        return box.bottom > tableBox.top - 8;
      })
      .sort((a, b) => getElementBox(b).top - getElementBox(a).top)[0];

    if (!caption) continue;

    const height = 36;
    captionById.set(caption.id, {
      left: table.left,
      top: Math.max(MARGIN, table.top - height - 8),
      width: table.width,
      height,
    });
  }

  if (captionById.size === 0) return elements;

  return elements.map((element) => {
    const caption = captionById.get(element.id);
    if (!caption) return element;
    return {
      ...element,
      ...caption,
    };
  });
}

function fitLatexAroundRightColumn<T extends SlideLikeElement>(elements: T[]): T[] {
  return elements.map((element) => {
    if (element.type !== 'latex') return element;

    const formulaBox = getElementBox(element);
    const rightColumnBlockers = elements
      .filter((candidate) => candidate !== element && isReadableElement(candidate))
      .filter((candidate) => {
        const box = getElementBox(candidate);
        if (box.left < 540) return false;
        if (box.top < 140) return false;
        return intersectionArea(formulaBox, expandBox(box, 12)) > 0;
      });

    if (rightColumnBlockers.length === 0) return element;

    const firstRightEdge = Math.min(
      ...rightColumnBlockers.map((candidate) => getElementBox(candidate).left),
    );
    const preferredLeft = clamp(element.left, MARGIN, 140);
    const maxWidth = firstRightEdge - preferredLeft - 32;
    const nextWidth = clamp(maxWidth, 360, element.width);

    return {
      ...element,
      left: preferredLeft,
      width: nextWidth,
      align: 'center',
    };
  });
}

function fitRightColumnAboveTables<T extends SlideLikeElement>(elements: T[]): T[] {
  const tables = elements.filter((element) => element.type === 'table').map(getElementBox);
  if (tables.length === 0) return elements;

  return elements.map((element) => {
    const box = getElementBox(element);
    if (box.left < 540 || box.top < 140 || !['text', 'shape'].includes(element.type))
      return element;

    const nearestTable = tables
      .filter((table) => table.top > box.top && intersectionArea(expandBox(box, 4), table) > 0)
      .sort((a, b) => a.top - b.top)[0];
    if (!nearestTable) return element;

    const maxHeight = nearestTable.top - box.top - 18;
    if (maxHeight < 44 || maxHeight >= box.height) return element;

    return {
      ...element,
      height: maxHeight,
    };
  });
}

function removeDecorationsCoveringReadableContent<T extends SlideLikeElement>(elements: T[]): T[] {
  const readableBoxes = elements
    .filter(isReadableElement)
    .map((element) => expandBox(getElementBox(element), 2));

  if (readableBoxes.length === 0) return elements;

  return elements.filter((element) => {
    if (isMeaningfulDiagramLine(element)) return true;
    if (isClassicTitleDivider(element, elements)) return true;
    if (!isThinDecorativeElement(element)) return true;
    const box = getElementBox(element);
    return !readableBoxes.some((readableBox) => intersectionArea(box, readableBox) > 0);
  });
}

function isClassicTitleDivider(element: SlideLikeElement, elements: SlideLikeElement[]): boolean {
  if (!isThinDecorativeElement(element)) return false;

  const box = getElementBox(element);
  if (box.width < 700 || box.height > 12 || box.top < 108 || box.top > 165) return false;

  return elements.some((candidate) => {
    if (candidate.type !== 'text' || candidate.top > 125) return false;
    const titleBox = getElementBox(candidate);
    return titleBox.width >= 600 && titleBox.bottom <= box.top + 12;
  });
}

function isMeaningfulDiagramLine(element: SlideLikeElement): boolean {
  if (element.type !== 'line') return false;
  const id = element.id ?? '';
  return /^polish_(quad|visual)_(axis|symmetry|parabola)/.test(id);
}

function enforceReadableSafeBounds<T extends SlideLikeElement>(elements: T[]): T[] {
  const safeBottom = CANVAS_HEIGHT - MARGIN;

  return elements.map((element) => {
    if (!isReadableElement(element)) return element;

    const box = getElementBox(element);
    if (box.bottom <= safeBottom) return element;

    const minHeight = element.type === 'text' ? 36 : 28;
    const availableHeight = safeBottom - element.top;
    if (availableHeight >= minHeight) {
      return {
        ...element,
        height: availableHeight,
      };
    }

    const height = Math.max(minHeight, Math.min(box.height, safeBottom - MARGIN));
    return {
      ...element,
      top: safeBottom - height,
      height,
    };
  });
}

function getMinimumReadableHeight(element: SlideLikeElement): number {
  if (element.type === 'latex') return 64;
  if (element.type === 'table') return 72;
  if (element.type === 'text') return element.top < 150 ? 44 : 36;
  return 28;
}

function hasColumnOverlap(a: SlideLikeElement, b: SlideLikeElement): boolean {
  const aBox = getElementBox(a);
  const bBox = getElementBox(b);
  const horizontalOverlap = Math.min(aBox.right, bBox.right) - Math.max(aBox.left, bBox.left);
  return horizontalOverlap > Math.min(aBox.width, bBox.width) * 0.35;
}

function resolveVerticalReadableOverlaps<T extends SlideLikeElement>(elements: T[]): T[] {
  const gap = 8;
  const adjusted = elements.map((element) => ({ ...element }));

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    const readables = adjusted
      .filter(isReadableElement)
      .sort((a, b) => a.top - b.top || a.left - b.left);

    for (let i = 0; i < readables.length; i += 1) {
      const upper = readables[i];
      const upperBox = getElementBox(upper);
      const lower = readables
        .slice(i + 1)
        .filter((candidate) => candidate.top > upper.top)
        .filter((candidate) => hasColumnOverlap(upper, candidate))
        .sort((a, b) => a.top - b.top)[0];

      if (!lower) continue;
      if (upperBox.bottom <= lower.top - gap) continue;

      const minHeight = getMinimumReadableHeight(upper);
      const nextHeight = lower.top - upper.top - gap;
      if (nextHeight >= minHeight && nextHeight < Number(upper.height ?? upperBox.height)) {
        upper.height = nextHeight;
        changed = true;
        continue;
      }

      const lowerHeight = Number(lower.height ?? getElementBox(lower).height);
      const pushedTop = upperBox.bottom + gap;
      if (pushedTop + lowerHeight <= CANVAS_HEIGHT - MARGIN) {
        lower.top = pushedTop;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return adjusted as T[];
}

export function polishGeneratedSlideData(
  data: GeneratedSlideData,
  context?: SlidePolishContext,
): GeneratedSlideData {
  return {
    ...data,
    elements: polishSlideElements(data.elements, context),
  };
}

export function polishSlide(slide: Slide, context?: SlidePolishContext): Slide {
  return {
    ...slide,
    theme: {
      ...slide.theme,
      fontName: FONT_STACK,
      fontColor: slide.theme.fontColor || '#263244',
    },
    elements: polishSlideElements(slide.elements, context) as unknown as PPTElement[],
  };
}
