import type { GeneratedSlideData } from '@/lib/generation/pipeline-types';
import type { PPTElement, PPTTextElement, Slide } from '@/lib/types/slides';
import { repairSlideLayout } from '@/lib/slides/agent/layout-guard-agent';
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

function getPolishTheme(context?: SlidePolishContext): SlidePolishTheme {
  const palette = context?.themeSelection?.palette;
  return {
    background: withHash(palette?.contentBg, '#ffffff'),
    panel: withHash(palette?.accentLight, '#f5f9ff'),
    accent: withHash(palette?.accent, '#2f80d1'),
    accentSecondary: withHash(palette?.accentSecondary, '#f97316'),
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
  let height = Math.max(
    Number(text.height ?? 0),
    estimateTextHeight(content, text.width, fontSize, lineHeight),
  );
  let top = clamp(text.top, MARGIN, CANVAS_HEIGHT - MARGIN - 32);
  const width = clamp(text.width, 80, CANVAS_WIDTH - MARGIN * 2);
  let left = clamp(text.left, MARGIN, CANVAS_WIDTH - MARGIN - width);

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
  const isWideBottomBand =
    element.type === 'shape' &&
    !hasShapeText(element) &&
    element.top > 400 &&
    width >= 700 &&
    rawHeight >= 24;
  const height = isWideBottomBand
    ? clamp(rawHeight, minHeight, 56)
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
  if (!isQuadraticTopicText(source)) return false;

  return hasAnySignal(source, [
    /顶点式|\u9876\u70b9\u5f0f/i,
    /顶点.*对称轴|\u9876\u70b9.*\u5bf9\u79f0\u8f74/i,
    /a\s*\(\s*x\s*[-−]\s*h\s*\)\s*\^?\s*2/i,
    /a\s*\(\s*x\s*[-−]\s*3\s*\)\s*\^?\s*2/i,
  ]);
}

function referenceHeaderElements(
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

function referenceLayoutElements<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] | null {
  if (elements.some((element) => element.id?.startsWith('polish_ref_'))) return elements;
  if (shouldUseEquationRelationLayout(elements, context)) {
    return equationRelationReferenceLayout(elements, context) as T[];
  }
  if (shouldUseVertexFormLayout(elements, context)) {
    return vertexFormReferenceLayout(elements, context) as T[];
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
        `<strong>Takeaway</strong> ${keywords.map((keyword) => escapeHtmlShort(keyword, 18)).join(' / ')}`,
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
  return text
    .slice(0, max)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

export function polishSlideElements<T extends SlideLikeElement>(
  elements: T[],
  context?: SlidePolishContext,
): T[] {
  const baseElements = elements.filter((element) => !element.id?.startsWith('polish_rich_'));
  const referenceElements = referenceLayoutElements(baseElements, context);
  if (referenceElements) {
    return polishReferenceLayoutElements(referenceElements, context);
  }

  const shouldDecorate = context?.decorate !== false;
  const layoutElements =
    shouldDecorate && shouldUseQuadraticTeachingLayout(baseElements, context)
      ? (quadraticTeachingLayout(baseElements, context) as T[])
      : baseElements;
  const shapeCount = layoutElements.filter((element) => element.type === 'shape').length;
  const hasStrongVisual = layoutElements.some((element) =>
    ['image', 'video', 'chart', 'table', 'latex'].includes(element.type),
  );
  const needsVisualAnchor = shouldDecorate && !hasStrongVisual && shapeCount < 3;
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

  return protectReadableLayout(polished);
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

function protectReadableLayout<T extends SlideLikeElement>(elements: T[]): T[] {
  const compacted = compactTitleWhitespace(elements);
  const parallelAligned = normalizeParallelRows(compacted);
  const stepAdjusted = normalizeStepSections(parallelAligned);
  const bottomAdjusted = fitBottomReadableRows(stepAdjusted);
  const tableCaptionAdjusted = fitTableCaptionsAboveTables(bottomAdjusted);
  const latexAdjusted = fitLatexAroundRightColumn(tableCaptionAdjusted);
  const rightColumnAdjusted = fitRightColumnAboveTables(latexAdjusted);
  const cleaned = removeDecorationsCoveringReadableContent(rightColumnAdjusted);
  const calloutReserved = reserveBottomCalloutSpace(cleaned);
  const spaced = resolveVerticalReadableOverlaps(calloutReserved);
  const repaired = repairSlideLayout(enforceReadableSafeBounds(spaced));
  const finalReserved = reserveBottomCalloutSpace(repaired);
  const finalSpaced = normalizeParallelRows(
    enforceReadableSafeBounds(
      resolveVerticalReadableOverlaps(normalizeStepSections(finalReserved)),
    ),
  );
  return reserveBottomCalloutSpace(normalizeStepSections(finalSpaced));
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
  if (element.type === 'latex') return 60;
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
