/**
 * Text Measurement Utilities
 *
 * Pure-math text sizing without DOM dependencies.
 * Optimised for CJK + Latin mixed educational content.
 */

import type { TemplateSlotV2, ThemeToken } from '../types';
import type { ContentFitResult, OverflowItem, TemplateCapacity } from './types';
import { getTemplateCapacity } from './capacity-registry';

const CJK_WIDTH_RATIO = 0.95;   // CJK chars are nearly full-width of fontSize
const LATIN_WIDTH_RATIO = 0.55; // Latin chars are roughly half-width
const LINE_HEIGHT_MULTIPLIER = 1.5;

/**
 * Estimate average character width for a given font family.
 * Returns a ratio of fontSize.
 */
function getAvgCharWidthRatio(fontFamily: string): number {
  const lower = fontFamily.toLowerCase();
  // Chinese fonts: CJK-dominant
  if (
    lower.includes('yahei') ||
    lower.includes('simhei') ||
    lower.includes('simsun') ||
    lower.includes('noto sans sc') ||
    lower.includes('pingfang')
  ) {
    return 0.88; // Mixed CJK/Latin at ~88% of fontSize on average
  }
  // English / Latin fonts
  return 0.55;
}

/**
 * Count characters in a string (CJK chars counted individually,
 * Latin words counted by length). Pure length is sufficient for overflow
 * detection; we do not need grapheme clusters here.
 */
export function countChars(text: string): number {
  return text?.length ?? 0;
}

/**
 * Estimate how many lines a text block will occupy.
 *
 * @param text          Raw text content
 * @param fontSize      Font size in px
 * @param containerWidth Available width in px
 * @param fontFamily    Font family name (used for width ratio)
 */
export function estimateLines(
  text: string,
  fontSize: number,
  containerWidth: number,
  fontFamily = 'Microsoft YaHei',
): number {
  if (!text || containerWidth <= 0 || fontSize <= 0) return 0;

  const ratio = getAvgCharWidthRatio(fontFamily);
  const avgCharWidth = fontSize * ratio;
  const charsPerLine = Math.max(1, Math.floor(containerWidth / avgCharWidth));

  // Count explicit newlines as additional line breaks
  const lineBreaks = (text.match(/\n/g) || []).length;
  const textLength = countChars(text);

  return lineBreaks + Math.ceil(textLength / charsPerLine);
}

/**
 * Measure content length for a specific param field.
 */
function measureField(
  field: string,
  value: unknown,
  capacity: TemplateCapacity,
  theme: ThemeToken,
): OverflowItem | null {
  const { maxChars, maxLines, maxBullets, maxBulletChars, maxItems } = capacity;

  // String fields: bodyText, leftText, rightText, quote, formula, code, etc.
  if (typeof value === 'string') {
    const chars = countChars(value);
    const lines = estimateLines(value, theme.bodyFontSize, theme.contentMaxWidth, theme.fontFamily);

    if (chars > maxChars || lines > maxLines) {
      return {
        field,
        actual: Math.max(chars, lines),
        limit: chars > maxChars ? maxChars : maxLines,
        strategy: 'truncate',
      };
    }
    return null;
  }

  // Bullet arrays
  if (field === 'bullets' && Array.isArray(value)) {
    const items = value as string[];
    const violations: number[] = [];

    if (items.length > maxBullets) {
      return { field, actual: items.length, limit: maxBullets, strategy: 'truncate' };
    }

    items.forEach((b, i) => {
      if (countChars(b) > maxBulletChars) violations.push(i);
    });

    if (violations.length > 0) {
      return {
        field: `${field}[${violations[0]}]`,
        actual: countChars(items[violations[0]]),
        limit: maxBulletChars,
        strategy: 'truncate',
      };
    }
    return null;
  }

  // Step arrays
  if (field === 'steps' && Array.isArray(value)) {
    const items = value as { title?: string; text?: string }[];
    if (items.length > maxItems) {
      return { field, actual: items.length, limit: maxItems, strategy: 'truncate' };
    }

    let totalChars = 0;
    items.forEach((s) => {
      totalChars += countChars(s.title ?? '') + countChars(s.text ?? '');
    });

    if (totalChars > maxChars) {
      return { field, actual: totalChars, limit: maxChars, strategy: 'truncate' };
    }
    return null;
  }

  // Grid / generic item arrays
  if (Array.isArray(value)) {
    if (value.length > maxItems && maxItems > 0) {
      return { field, actual: value.length, limit: maxItems, strategy: 'truncate' };
    }

    // Estimate total chars across all items
    let totalChars = 0;
    value.forEach((item) => {
      if (typeof item === 'string') totalChars += countChars(item);
      else if (item && typeof item === 'object') {
        totalChars += countChars((item as Record<string, unknown>).text as string ?? '');
        totalChars += countChars((item as Record<string, unknown>).title as string ?? '');
        totalChars += countChars((item as Record<string, unknown>).description as string ?? '');
      }
    });

    if (totalChars > maxChars) {
      return { field, actual: totalChars, limit: maxChars, strategy: 'truncate' };
    }
    return null;
  }

  return null;
}

/**
 * Check whether a template slot's content fits within its template's capacity.
 *
 * @param slot     The AI-generated slot (template + params)
 * @param theme    Current theme token (for font metrics)
 * @returns        ContentFitResult with overflow details
 */
export function estimateContentFit(
  slot: TemplateSlotV2,
  theme: ThemeToken,
): ContentFitResult {
  const capacity = getTemplateCapacity(slot.template);
  if (!capacity) {
    // Unknown template: allow through but warn
    return { fits: true, overflows: [] };
  }

  const overflows: OverflowItem[] = [];

  for (const [key, value] of Object.entries(slot.params)) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }

    const item = measureField(key, value, capacity, theme);
    if (item) overflows.push(item);
  }

  return { fits: overflows.length === 0, overflows };
}

/**
 * Batch-check multiple slots.
 */
export function estimateBatchContentFit(
  slots: TemplateSlotV2[],
  theme: ThemeToken,
): Array<{ index: number; fits: boolean; overflows: OverflowItem[] }> {
  return slots.map((slot, index) => ({
    index,
    ...estimateContentFit(slot, theme),
  }));
}
