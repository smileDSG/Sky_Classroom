type LayoutElement = {
  id?: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height?: number;
};

type ElementBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export interface LayoutGuardIssue {
  type:
    | 'text_outside_background'
    | 'text_too_small'
    | 'low_text_contrast'
    | 'foreground_overlay_collision'
    | 'readable_element_overlap'
    | 'latex_box_too_small'
    | 'unsafe_bottom_zone'
    | 'misaligned_parallel_group'
    | 'missing_visual_anchor'
    | 'low_content_richness'
    | 'weak_visual_hierarchy'
    | 'excessive_colored_panels'
    | 'unlabeled_visual_placeholder'
    | 'data_overwhelms_explanation';
  textId?: string;
  backgroundId?: string;
  detail: string;
}

export interface LayoutGuardOptions {
  includeRichness?: boolean;
}

const DEFAULT_SAFE_BOUNDS = {
  left: 48,
  top: 48,
  right: 952,
  bottom: 514.5,
};

const CANVAS_AREA = 1000 * 562.5;
const CARD_PADDING = 8;
const PARALLEL_GROUP_TOLERANCE = 32;
const MIN_BODY_FONT_SIZE = 18;
const MIN_CONTRAST_RATIO = 4;
const MIN_RICH_ELEMENT_COUNT = 8;
const MIN_LEARNING_TEXT_BLOCKS = 4;
const MIN_VISUAL_ANCHOR_AREA_RATIO = 0.12;
const MIN_VISUAL_HIERARCHY_GAP = 6;
const MIN_LARGE_PANEL_AREA = CANVAS_AREA * 0.018;
const DEFAULT_DARK_TEXT = '#172033';
const DEFAULT_LIGHT_TEXT = '#ffffff';

// Proportions guard: a data/table/chart element that is both >58% wide and >45% tall
// will dominate the page and squeeze the teaching explanation out.
const MAX_DATA_ELEMENT_WIDTH = 580; // ~58% of the 1000px canvas
const MAX_DATA_ELEMENT_HEIGHT = 253; // ~45% of the 562.5px canvas
const MIN_EXPLANATION_LANE_WIDTH = 300;
const MIN_EXPLANATION_LANE_HEIGHT = 110;

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

function getElementBox(element: LayoutElement): ElementBox {
  return toBox(element.left, element.top, element.width, Number(element.height ?? 24));
}

function intersectionArea(a: ElementBox, b: ElementBox): number {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFontSize(content: string): number | undefined {
  const match = content.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i);
  if (!match) return undefined;
  const size = Number(match[1]);
  return Number.isFinite(size) ? size : undefined;
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

function getInlineColor(content: string): string | undefined {
  return content.match(/color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i)?.[1];
}

function setInlineColor(content: string, color: string): string {
  if (/color\s*:/i.test(content)) {
    return content.replace(/color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/gi, `color:${color}`);
  }
  return content.replace(/<(p|span|strong|b)(\s[^>]*)?>/i, (match) => {
    if (/style\s*=/.test(match)) {
      return match.replace(/style="([^"]*)"/i, (_all, style) => `style="color:${color};${style}"`);
    }
    return match.replace('>', ` style="color:${color};">`);
  });
}

function parseColor(color: string): [number, number, number] | undefined {
  const trimmed = color.trim();
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  const rgbMatch = trimmed.match(/^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})/i);
  if (rgbMatch) {
    return [
      Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10))),
      Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10))),
      Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10))),
    ];
  }

  return undefined;
}

function getColorStats(color: string): { chroma: number; average: number } | undefined {
  const rgb = parseColor(color);
  if (!rgb) return undefined;
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const average = rgb.reduce((sum, value) => sum + value, 0) / rgb.length;
  return { chroma: max - min, average };
}

function isWhiteSurface(color: string): boolean {
  const stats = getColorStats(color);
  return !!stats && stats.average >= 246 && stats.chroma <= 16;
}

function isStrongFilledSurface(color: string): boolean {
  const stats = getColorStats(color);
  return !!stats && stats.chroma >= 56 && stats.average <= 238;
}

function relativeLuminance(color: string): number | undefined {
  const rgb = parseColor(color);
  if (!rgb) return undefined;
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number | undefined {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  if (fg === undefined || bg === undefined) return undefined;
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function bestReadableColor(background: string): string {
  const darkContrast = contrastRatio(DEFAULT_DARK_TEXT, background) ?? 0;
  const lightContrast = contrastRatio(DEFAULT_LIGHT_TEXT, background) ?? 0;
  return darkContrast >= lightContrast ? DEFAULT_DARK_TEXT : DEFAULT_LIGHT_TEXT;
}

function hasShapeText(element: LayoutElement): boolean {
  const text = (element as Record<string, unknown>).text as { content?: string } | undefined;
  return !!stripHtml(String(text?.content ?? ''));
}

function isBackgroundShape(element: LayoutElement): boolean {
  const id = String((element as Record<string, unknown>).id ?? '');
  if (id.startsWith('classroom_qa_safe_card_')) return false;

  const box = getElementBox(element);
  return (
    element.type === 'shape' &&
    !hasShapeText(element) &&
    box.width >= 40 &&
    box.height >= 20 &&
    Boolean((element as Record<string, unknown>).fill)
  );
}

function isReadableText(element: LayoutElement): boolean {
  return (
    element.type === 'text' &&
    !!stripHtml(String((element as Record<string, unknown>).content ?? ''))
  );
}

function isReadableLayoutElement(element: LayoutElement): boolean {
  if (isReadableText(element) || hasShapeText(element)) return true;
  return ['latex', 'table', 'chart', 'code'].includes(element.type);
}

/** Data-heavy visual elements that can dominate a page and squeeze out explanations. */
function isDataElement(element: LayoutElement): boolean {
  return element.type === 'table' || element.type === 'chart';
}

/** A teaching explanation lane: centered/body text or a shape carrying real text, not the title. */
function isExplanationLane(element: LayoutElement): boolean {
  if (element.type === 'text') return true;
  if (element.type === 'shape') return hasShapeText(element);
  return false;
}

/** True when an explanation lane is cramped (too narrow or too short to read comfortably). */
function isCrampedLane(box: ElementBox): boolean {
  return box.width < MIN_EXPLANATION_LANE_WIDTH || box.height < MIN_EXPLANATION_LANE_HEIGHT;
}

function auditDataOverwhelmsExplanation<T extends LayoutElement>(
  elements: T[],
): LayoutGuardIssue[] {
  const issues: LayoutGuardIssue[] = [];
  const oversized = elements
    .filter(isDataElement)
    .map((el) => ({ el, box: getElementBox(el) }))
    .filter(({ box }) => box.height > MAX_DATA_ELEMENT_HEIGHT)
    .filter(({ box }) => box.width > MAX_DATA_ELEMENT_WIDTH);

  if (oversized.length === 0) return issues;

  const bodyTexts = elements
    .filter(isExplanationLane)
    .map(getElementBox)
    .filter((box) => box.top >= 100); // below the title zone

  // Only flag when a data block dominates AND a teaching explanation is being starved
  // (present but cramped into a narrow/short lane). A data-only page (e.g. a lone
  // comparison table with no explanation lane) is intentional and accepted.
  const hasStarvedExplanation = bodyTexts.some(
    (t) => t.width < MIN_EXPLANATION_LANE_WIDTH || t.height < MIN_EXPLANATION_LANE_HEIGHT,
  );
  if (!hasStarvedExplanation) return issues;

  for (const { el, box } of oversized) {
    issues.push({
      type: 'data_overwhelms_explanation',
      textId: el.id,
      detail: `data element ${el.id ?? ''} (${box.width}w x ${box.height}h) leaves no readable explanation lane (>=${MIN_EXPLANATION_LANE_WIDTH}w or >=${MIN_EXPLANATION_LANE_HEIGHT}h)`,
    });
  }

  return issues;
}

function getTextContent(element: LayoutElement): string {
  return String((element as Record<string, unknown>).content ?? '');
}

function getPlainText(element: LayoutElement): string {
  if (element.type === 'shape') {
    const text = (element as Record<string, unknown>).text as { content?: string } | undefined;
    return stripHtml(String(text?.content ?? ''));
  }
  if (element.type === 'latex') {
    return String((element as Record<string, unknown>).latex ?? '');
  }
  return stripHtml(getTextContent(element));
}

function getTextColor(element: LayoutElement): string {
  const content = getTextContent(element);
  return (
    getInlineColor(content) ??
    ((element as Record<string, unknown>).defaultColor as string | undefined) ??
    DEFAULT_DARK_TEXT
  );
}

function getBackgroundColor(element: LayoutElement): string | undefined {
  return (element as Record<string, unknown>).fill as string | undefined;
}

function containsTextAnchor(background: ElementBox, text: ElementBox): boolean {
  const centerX = text.left + text.width / 2;
  const centerY = text.top + text.height / 2;
  const horizontalInside = text.left >= background.left - 2 && text.right <= background.right + 2;
  const centerInside =
    centerX >= background.left &&
    centerX <= background.right &&
    centerY >= background.top &&
    centerY <= background.bottom;
  const topInside = text.top >= background.top - 2 && text.top <= background.bottom + 2;

  return horizontalInside && (centerInside || topInside);
}

function containsWithPadding(background: ElementBox, text: ElementBox): boolean {
  return (
    text.left >= background.left + CARD_PADDING &&
    text.top >= background.top + CARD_PADDING &&
    text.right <= background.right - CARD_PADDING &&
    text.bottom <= background.bottom - CARD_PADDING
  );
}

function findBackgroundForText<T extends LayoutElement>(
  text: T,
  elements: T[],
  textIndex: number,
): T | undefined {
  const textBox = getElementBox(text);
  return elements
    .slice(0, textIndex)
    .filter(isBackgroundShape)
    .filter((candidate) => containsTextAnchor(getElementBox(candidate), textBox))
    .sort((a, b) => {
      const aBox = getElementBox(a);
      const bBox = getElementBox(b);
      return aBox.width * aBox.height - bBox.width * bBox.height;
    })[0];
}

function isForegroundOverlayText(element: LayoutElement): boolean {
  if (element.type !== 'text') return false;

  const box = getElementBox(element);
  if (box.top < 360 || box.width < 560 || box.height < 36) return false;

  const fill = (element as Record<string, unknown>).fill;
  const hasFill = typeof fill === 'string' && fill.trim().length > 0;
  const text = stripHtml(getTextContent(element));
  const hasCalloutLabel =
    /^(适用领域|应用领域|应用场景|项目骨架|提示|注意|总结|本页|关键|💡|Takeaway|Tip|Note|Practice|Core idea|Learning goal|Next)/i.test(
      text,
    );

  return hasFill || hasCalloutLabel;
}

function isOverlayCompanionBackground(background: LayoutElement, overlay: LayoutElement): boolean {
  if (!isBackgroundShape(background)) return false;

  const backgroundBox = getElementBox(background);
  const overlayBox = getElementBox(overlay);
  const horizontalOverlap =
    Math.min(backgroundBox.right, overlayBox.right) - Math.max(backgroundBox.left, overlayBox.left);
  const verticallyAligned =
    backgroundBox.top <= overlayBox.top + 16 && backgroundBox.bottom >= overlayBox.bottom - 16;
  const similarHeight = backgroundBox.height <= overlayBox.height + 36;

  return horizontalOverlap >= overlayBox.width * 0.7 && verticallyAligned && similarHeight;
}

function isOverlayCollisionCandidate(element: LayoutElement): boolean {
  if (isReadableText(element)) return true;
  if (isBackgroundShape(element)) return true;
  return ['image', 'video', 'chart', 'table', 'latex', 'code'].includes(element.type);
}

function auditForegroundOverlayCollisions<T extends LayoutElement>(
  elements: T[],
): LayoutGuardIssue[] {
  const issues: LayoutGuardIssue[] = [];

  elements.forEach((element, index) => {
    if (!isForegroundOverlayText(element)) return;

    const overlayBox = getElementBox(element);
    const overlapsEarlierContent = elements.slice(0, index).some((candidate) => {
      if (!isOverlayCollisionCandidate(candidate)) return false;
      if (isOverlayCompanionBackground(candidate, element)) return false;
      return intersectionArea(overlayBox, getElementBox(candidate)) > 0;
    });

    if (overlapsEarlierContent) {
      issues.push({
        type: 'foreground_overlay_collision',
        textId: element.id,
        detail: `${element.id ?? 'foreground overlay'} overlaps earlier slide content`,
      });
    }
  });

  return issues;
}

function isAllowedReadableOverlap(a: LayoutElement, b: LayoutElement): boolean {
  const aBox = getElementBox(a);
  const bBox = getElementBox(b);

  if (isBackgroundShape(a) && containsTextAnchor(aBox, bBox)) return true;
  if (isBackgroundShape(b) && containsTextAnchor(bBox, aBox)) return true;
  if (a.type === 'shape' || b.type === 'shape') return true;

  return false;
}

function auditReadableElementOverlaps<T extends LayoutElement>(elements: T[]): LayoutGuardIssue[] {
  const issues: LayoutGuardIssue[] = [];
  const readables = elements.filter(isReadableLayoutElement);

  for (let i = 0; i < readables.length; i += 1) {
    for (let j = i + 1; j < readables.length; j += 1) {
      const first = readables[i];
      const second = readables[j];
      if (isAllowedReadableOverlap(first, second)) continue;

      const firstBox = getElementBox(first);
      const secondBox = getElementBox(second);
      const overlap = intersectionArea(firstBox, secondBox);
      if (overlap <= 0) continue;

      const smallerArea = Math.min(elementArea(first), elementArea(second));
      if (smallerArea <= 0 || overlap / smallerArea < 0.08) continue;

      issues.push({
        type: 'readable_element_overlap',
        textId: first.id,
        backgroundId: second.id,
        detail: `${first.id ?? first.type} overlaps ${second.id ?? second.type}`,
      });
    }
  }

  return issues;
}

function getLatexMinimumBox(element: LayoutElement): { width: number; height: number } {
  const latex = String((element as Record<string, unknown>).latex ?? '');
  const complex = latex.length > 42 || /\\(frac|sum|int|lim|begin|sqrt|overline)/.test(latex);
  const multiLine = /\\\\/.test(latex);

  if (multiLine) return { width: 420, height: 104 };
  if (complex) return { width: 360, height: 92 };
  return { width: 220, height: 64 };
}

function auditLatexSizing<T extends LayoutElement>(elements: T[]): LayoutGuardIssue[] {
  return elements
    .filter((element) => element.type === 'latex')
    .flatMap((element) => {
      const min = getLatexMinimumBox(element);
      const box = getElementBox(element);
      if (box.width >= min.width && box.height >= min.height) return [];

      return [
        {
          type: 'latex_box_too_small' as const,
          textId: element.id,
          detail: `${element.id ?? 'latex'} box ${Math.round(box.width)}x${Math.round(box.height)} is below ${min.width}x${min.height}`,
        },
      ];
    });
}

function auditSafeBounds<T extends LayoutElement>(elements: T[]): LayoutGuardIssue[] {
  return elements
    .filter(isReadableLayoutElement)
    .filter((element) => {
      const box = getElementBox(element);
      return (
        box.left < DEFAULT_SAFE_BOUNDS.left ||
        box.top < DEFAULT_SAFE_BOUNDS.top ||
        box.right > DEFAULT_SAFE_BOUNDS.right ||
        box.bottom > DEFAULT_SAFE_BOUNDS.bottom
      );
    })
    .map((element) => ({
      type: 'unsafe_bottom_zone' as const,
      textId: element.id,
      detail: `${element.id ?? element.type} sits outside the classroom safe bounds`,
    }));
}

function isParallelCandidate(element: LayoutElement): boolean {
  const box = getElementBox(element);
  if (box.width < 120 || box.width > 360 || box.height < 24 || box.height > 180) return false;
  if (!['text', 'shape', 'latex'].includes(element.type)) return false;
  if (element.type === 'shape' && hasShapeText(element)) return true;
  if (element.type === 'shape') return Boolean((element as Record<string, unknown>).fill);
  return true;
}

function groupParallelRows<T extends LayoutElement>(elements: T[]): T[][] {
  const candidates = elements.filter(isParallelCandidate).sort((a, b) => a.top - b.top);
  const rows: T[][] = [];

  for (const candidate of candidates) {
    const row = rows.find((group) => {
      const first = group[0];
      return (
        candidate.type === first.type &&
        Math.abs(candidate.top - first.top) <= PARALLEL_GROUP_TOLERANCE
      );
    });
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
      for (let i = 1; i < row.length; i += 1) {
        if (getElementBox(row[i - 1]).right > row[i].left) return false;
      }
      return true;
    });
}

function auditParallelAlignment<T extends LayoutElement>(elements: T[]): LayoutGuardIssue[] {
  const issues: LayoutGuardIssue[] = [];

  for (const row of groupParallelRows(elements)) {
    const boxes = row.map(getElementBox);
    const topRange =
      Math.max(...boxes.map((box) => box.top)) - Math.min(...boxes.map((box) => box.top));
    const heightRange =
      Math.max(...boxes.map((box) => box.height)) - Math.min(...boxes.map((box) => box.height));
    const widthRange =
      Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width));
    const gaps = boxes.slice(1).map((box, index) => box.left - boxes[index].right);
    const gapRange = Math.max(...gaps) - Math.min(...gaps);

    if (topRange <= 6 && heightRange <= 10 && widthRange <= 18 && gapRange <= 12) continue;

    issues.push({
      type: 'misaligned_parallel_group',
      detail: `Parallel ${row[0].type} row is not grid-aligned: top range ${topRange.toFixed(1)}px, width range ${widthRange.toFixed(1)}px, gap range ${gapRange.toFixed(1)}px`,
    });
  }

  return issues;
}

function elementArea(element: LayoutElement): number {
  const box = getElementBox(element);
  return Math.max(0, box.width) * Math.max(0, box.height);
}

function unionBoxes(boxes: ElementBox[]): ElementBox | undefined {
  if (boxes.length === 0) return undefined;
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return toBox(left, top, right - left, bottom - top);
}

function expandBox(box: ElementBox, padding: number): ElementBox {
  return toBox(
    box.left - padding,
    box.top - padding,
    box.width + padding * 2,
    box.height + padding * 2,
  );
}

function isLargeColoredBackgroundBox(element: LayoutElement): boolean {
  if (!['shape', 'text'].includes(element.type)) return false;

  const fill = getBackgroundColor(element);
  if (!fill || isWhiteSurface(fill)) return false;

  const box = getElementBox(element);
  if (box.width < 80 || box.height < 24 || elementArea(element) < MIN_LARGE_PANEL_AREA) {
    return false;
  }

  return true;
}

function auditColoredPanelUsage<T extends LayoutElement>(elements: T[]): LayoutGuardIssue[] {
  const panels = elements.filter(isLargeColoredBackgroundBox);
  if (panels.length === 0) return [];

  const hasStrongPanel = panels.some((panel) => {
    const fill = getBackgroundColor(panel);
    return !!fill && isStrongFilledSurface(fill);
  });

  if (panels.length <= 1 && !hasStrongPanel) return [];

  return [
    {
      type: 'excessive_colored_panels',
      detail: `Slide uses ${panels.length} large colored background boxes; clean 天空课堂 pages should use at most one pale panel plus thin dividers`,
    },
  ];
}

function auditUnlabeledVisualPlaceholders<T extends LayoutElement>(
  elements: T[],
): LayoutGuardIssue[] {
  const mediaTypes = new Set(['image', 'video', 'chart', 'table', 'latex']);
  const hasMediaAnchor = elements.some(
    (element) => mediaTypes.has(element.type) && elementArea(element) >= CANVAS_AREA * 0.06,
  );
  if (hasMediaAnchor) return [];

  const diagramShapes = elements.filter(
    (element) =>
      element.type === 'shape' &&
      !hasShapeText(element) &&
      Boolean((element as Record<string, unknown>).fill) &&
      elementArea(element) >= 900,
  );
  const connectorCount = elements.filter((element) => element.type === 'line').length;
  if (diagramShapes.length < 3 || connectorCount < 1) return [];

  const visualBounds = unionBoxes(diagramShapes.map(getElementBox));
  if (!visualBounds) return [];

  const paddedVisualBounds = expandBox(visualBounds, 18);
  const labels = elements.filter((element) => {
    if (element.type !== 'text' && !hasShapeText(element)) return false;
    if (getPlainText(element).length < 4) return false;
    return intersectionArea(getElementBox(element), paddedVisualBounds) > 0;
  });

  if (labels.length > 0) return [];

  return [
    {
      type: 'unlabeled_visual_placeholder',
      detail:
        'Slide has a shape-based visual anchor without labels; replace abstract placeholders with a labeled diagram, image, chart, or formula',
    },
  ];
}

function hasDominantVisualAnchor<T extends LayoutElement>(elements: T[]): boolean {
  const requiredArea = CANVAS_AREA * MIN_VISUAL_ANCHOR_AREA_RATIO;
  const visualTypes = new Set(['image', 'video', 'chart', 'table', 'latex']);

  const hasSingleAnchor = elements.some(
    (element) => visualTypes.has(element.type) && elementArea(element) >= requiredArea * 0.55,
  );
  if (hasSingleAnchor) return true;

  const diagramShapes = elements.filter(
    (element) =>
      element.type === 'shape' &&
      !hasShapeText(element) &&
      elementArea(element) >= 900 &&
      Boolean((element as Record<string, unknown>).fill),
  );
  const connectorCount = elements.filter((element) => element.type === 'line').length;
  const diagramArea = diagramShapes.reduce((sum, element) => sum + elementArea(element), 0);

  return diagramShapes.length >= 3 && connectorCount >= 1 && diagramArea >= requiredArea;
}

function getLearningTextBlocks<T extends LayoutElement>(elements: T[]): T[] {
  return elements.filter((element) => {
    if (element.type !== 'text' && !hasShapeText(element)) return false;
    const plain = getPlainText(element);
    return plain.length >= 6;
  });
}

function getTextFontSizes<T extends LayoutElement>(elements: T[]): number[] {
  return elements
    .filter((element) => element.type === 'text')
    .map((element) => getFontSize(getTextContent(element)))
    .filter((size): size is number => size !== undefined && Number.isFinite(size));
}

function auditSlideRichness<T extends LayoutElement>(elements: T[]): LayoutGuardIssue[] {
  const issues: LayoutGuardIssue[] = [
    ...auditColoredPanelUsage(elements),
    ...auditUnlabeledVisualPlaceholders(elements),
  ];
  const learningBlocks = getLearningTextBlocks(elements);
  const fontSizes = getTextFontSizes(elements);

  if (!hasDominantVisualAnchor(elements)) {
    issues.push({
      type: 'missing_visual_anchor',
      detail:
        'Slide is missing a dominant visual anchor such as an image, diagram, chart, table, or formula block',
    });
  }

  if (
    elements.length < MIN_RICH_ELEMENT_COUNT ||
    learningBlocks.length < MIN_LEARNING_TEXT_BLOCKS
  ) {
    issues.push({
      type: 'low_content_richness',
      detail: `Slide has ${elements.length} elements and ${learningBlocks.length} learning blocks; expected at least ${MIN_RICH_ELEMENT_COUNT} elements and ${MIN_LEARNING_TEXT_BLOCKS} learning blocks`,
    });
  }

  if (fontSizes.length >= 2) {
    const largest = Math.max(...fontSizes);
    const smallest = Math.min(...fontSizes);
    const hasTitleScale = largest >= 28;
    const hasBodyScale = fontSizes.some((size) => size >= MIN_BODY_FONT_SIZE && size <= 24);
    if (!hasTitleScale || !hasBodyScale || largest - smallest < MIN_VISUAL_HIERARCHY_GAP) {
      issues.push({
        type: 'weak_visual_hierarchy',
        detail: 'Slide typography does not show a clear title/body hierarchy',
      });
    }
  } else {
    issues.push({
      type: 'weak_visual_hierarchy',
      detail: 'Slide needs at least two readable text levels to establish hierarchy',
    });
  }

  return issues;
}

export function auditSlideLayout<T extends LayoutElement>(
  elements: T[],
  options: LayoutGuardOptions = {},
): LayoutGuardIssue[] {
  const issues: LayoutGuardIssue[] = [
    ...auditForegroundOverlayCollisions(elements),
    ...auditReadableElementOverlaps(elements),
    ...auditLatexSizing(elements),
    ...auditSafeBounds(elements),
    ...auditParallelAlignment(elements),
    ...auditDataOverwhelmsExplanation(elements),
  ];

  elements.forEach((element, index) => {
    if (!isReadableText(element)) return;

    const content = getTextContent(element);
    const fontSize = getFontSize(content);
    if (fontSize !== undefined && fontSize < MIN_BODY_FONT_SIZE) {
      issues.push({
        type: 'text_too_small',
        textId: element.id,
        detail: `${element.id ?? 'text'} font-size ${fontSize}px is below ${MIN_BODY_FONT_SIZE}px`,
      });
    }

    const background = findBackgroundForText(element, elements, index);
    if (!background) return;

    const textBox = getElementBox(element);
    const backgroundBox = getElementBox(background);
    if (!containsWithPadding(backgroundBox, textBox)) {
      issues.push({
        type: 'text_outside_background',
        textId: element.id,
        backgroundId: background.id,
        detail: `${element.id ?? 'text'} exceeds ${background.id ?? 'background'} bounds`,
      });
    }

    const backgroundColor = getBackgroundColor(background);
    if (!backgroundColor) return;
    const contrast = contrastRatio(getTextColor(element), backgroundColor);
    if (contrast !== undefined && contrast < MIN_CONTRAST_RATIO) {
      issues.push({
        type: 'low_text_contrast',
        textId: element.id,
        backgroundId: background.id,
        detail: `${element.id ?? 'text'} contrast ${contrast.toFixed(2)} is below ${MIN_CONTRAST_RATIO}`,
      });
    }
  });

  return options.includeRichness ? [...issues, ...auditSlideRichness(elements)] : issues;
}

export function repairSlideLayout<T extends LayoutElement>(elements: T[]): T[] {
  const adjusted = elements.map((element) => ({ ...element }));

  adjusted.forEach((element, index) => {
    if (element.type === 'latex') {
      const min = getLatexMinimumBox(element);
      element.width = Math.max(element.width, min.width);
      element.height = Math.max(Number(element.height ?? 0), min.height);

      const box = getElementBox(element);
      if (box.right > DEFAULT_SAFE_BOUNDS.right) {
        element.left = Math.max(DEFAULT_SAFE_BOUNDS.left, DEFAULT_SAFE_BOUNDS.right - box.width);
      }
      if (box.bottom > DEFAULT_SAFE_BOUNDS.bottom) {
        element.top = Math.max(DEFAULT_SAFE_BOUNDS.top, DEFAULT_SAFE_BOUNDS.bottom - box.height);
      }
    }

    // Auto-repair: shrink an oversized table/chart that dominates the page AND is starving a
    // teaching explanation lane. Only applies when it is BOTH too wide and too tall, and only
    // when a cramped explanation lane exists (so a lone data page stays untouched).
    if (isDataElement(element)) {
      const box = getElementBox(element);
      if (box.width > MAX_DATA_ELEMENT_WIDTH && box.height > MAX_DATA_ELEMENT_HEIGHT) {
        const explanation = adjusted.some(
          (candidate) =>
            isExplanationLane(candidate) &&
            candidate.top >= 100 &&
            isCrampedLane(getElementBox(candidate)),
        );
        if (explanation) {
          element.width = MAX_DATA_ELEMENT_WIDTH;
          const nextLeft = Math.max(DEFAULT_SAFE_BOUNDS.left, element.left);
          if (nextLeft + element.width > DEFAULT_SAFE_BOUNDS.right) {
            element.left = Math.max(
              DEFAULT_SAFE_BOUNDS.left,
              DEFAULT_SAFE_BOUNDS.right - element.width,
            );
          } else {
            element.left = nextLeft;
          }
        }
      }
    }

    if (!isReadableText(element)) return;

    const elementRecord = element as unknown as Record<string, unknown>;
    const content = getTextContent(element);
    const fontSize = getFontSize(content);
    if (fontSize !== undefined && fontSize < MIN_BODY_FONT_SIZE) {
      elementRecord['content'] = setFontSize(content, MIN_BODY_FONT_SIZE);
    }

    const background = findBackgroundForText(element, adjusted, index);
    if (!background) return;

    const backgroundColor = getBackgroundColor(background);
    if (backgroundColor) {
      const contrast = contrastRatio(getTextColor(element), backgroundColor);
      if (contrast !== undefined && contrast < MIN_CONTRAST_RATIO) {
        const nextColor = bestReadableColor(backgroundColor);
        elementRecord['content'] = setInlineColor(getTextContent(element), nextColor);
        elementRecord['defaultColor'] = nextColor;
      }
    }

    const textBox = getElementBox(element);
    const backgroundBox = getElementBox(background);
    if (containsWithPadding(backgroundBox, textBox)) return;

    const desiredLeft = Math.min(backgroundBox.left, textBox.left - CARD_PADDING);
    const desiredTop = Math.min(backgroundBox.top, textBox.top - CARD_PADDING);
    const desiredRight = Math.max(backgroundBox.right, textBox.right + CARD_PADDING);
    const desiredBottom = Math.max(backgroundBox.bottom, textBox.bottom + CARD_PADDING);

    const nextLeft = Math.max(DEFAULT_SAFE_BOUNDS.left, desiredLeft);
    const nextTop = Math.max(DEFAULT_SAFE_BOUNDS.top, desiredTop);
    const nextRight = Math.min(DEFAULT_SAFE_BOUNDS.right, desiredRight);
    const nextBottom = Math.min(DEFAULT_SAFE_BOUNDS.bottom, desiredBottom);

    background.left = nextLeft;
    background.top = nextTop;
    background.width = Math.max(24, nextRight - nextLeft);
    background.height = Math.max(20, nextBottom - nextTop);
  });

  return adjusted as T[];
}
