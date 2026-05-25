/**
 * Overflow Handler
 *
 * Applies content truncation / scaling strategies when AI-generated
 * text exceeds a template's capacity limits.
 */

import type { TemplateSlotV2 } from '../types';
import type { TemplateCapacity, OverflowStrategy, OverflowFixResult } from './types';
import { countChars } from './text-measurer';

const TRUNCATE_ELLIPSIS = '…';

/**
 * Truncate a string to fit within maxChars, preserving whole words
 * where possible. Appends ellipsis if truncated.
 */
function truncateText(text: string, maxChars: number): string {
  if (countChars(text) <= maxChars) return text;
  const cut = Math.max(1, maxChars - countChars(TRUNCATE_ELLIPSIS));
  return text.slice(0, cut) + TRUNCATE_ELLIPSIS;
}

/**
 * Truncate bullet array: limit item count and per-item length.
 */
function truncateBullets(bullets: string[], capacity: TemplateCapacity): string[] {
  let result = bullets.slice(0, capacity.maxBullets);
  if (capacity.maxBulletChars > 0) {
    result = result.map((b) => truncateText(b, capacity.maxBulletChars));
  }
  return result;
}

/**
 * Truncate step array: limit item count and per-item text length.
 */
function truncateSteps(
  steps: { title?: string; text?: string }[],
  capacity: TemplateCapacity,
): Array<{ title: string; text: string }> {
  return steps.slice(0, capacity.maxItems).map((s) => ({
    title: truncateText(s.title ?? '', 40),
    text: truncateText(s.text ?? '', capacity.maxChars / Math.max(1, capacity.maxItems)),
  }));
}

/**
 * Truncate generic item array (gridItems, timelineItems, keyPoints, etc).
 */
function truncateItems<T>(items: T[], capacity: TemplateCapacity): T[] {
  return items.slice(0, capacity.maxItems);
}

/**
 * Fix overflow in a single slot by mutating its params.
 *
 * @param slot      The AI-generated slot
 * @param capacity  Template capacity constraints
 * @param strategy  Overflow handling strategy
 * @returns         Fix result with logs
 */
export function fixSlotOverflow(
  slot: TemplateSlotV2,
  capacity: TemplateCapacity,
  strategy: OverflowStrategy = 'truncate',
): OverflowFixResult & { slot: TemplateSlotV2 } {
  if (strategy === 'warn') {
    return { slot, wasFixed: false, fixes: [`[warn] ${slot.template} may overflow`] };
  }

  if (strategy === 'scale' || strategy === 'split') {
    // scale/split are reserved for future implementation
    return { slot, wasFixed: false, fixes: [`[${strategy}] not yet implemented for ${slot.template}`] };
  }

  const fixes: string[] = [];
  const params = { ...slot.params };

  // String fields: title, subtitle, bodyText, leftText, rightText, quote, formula, code
  const stringFields = ['title', 'subtitle', 'bodyText', 'leftText', 'rightText', 'quote', 'formula', 'code'] as const;
  stringFields.forEach((field) => {
    const value = params[field];
    if (typeof value === 'string' && countChars(value) > capacity.maxChars) {
      const original = countChars(value);
      (params as Record<string, unknown>)[field] = truncateText(value, capacity.maxChars);
      fixes.push(`${field}: ${original} → ${capacity.maxChars} chars`);
    }
  });

  // Bullets
  if (Array.isArray(params.bullets)) {
    const originalCount = params.bullets.length;
    const originalChars = params.bullets.map((b) => countChars(b));
    const maxBulletChars = capacity.maxBulletChars;

    let changed = false;
    if (originalCount > capacity.maxBullets) {
      changed = true;
      fixes.push(`bullets: ${originalCount} → ${capacity.maxBullets} items`);
    }
    if (maxBulletChars > 0 && originalChars.some((c) => c > maxBulletChars)) {
      changed = true;
      fixes.push(`bullet chars: capped to ${maxBulletChars}`);
    }

    if (changed || originalCount > capacity.maxBullets) {
      params.bullets = truncateBullets(params.bullets, capacity);
    }
  }

  // Steps
  if (Array.isArray(params.steps)) {
    const originalCount = params.steps.length;
    if (originalCount > capacity.maxItems) {
      params.steps = truncateSteps(params.steps, capacity);
      fixes.push(`steps: ${originalCount} → ${capacity.maxItems} items`);
    }
  }

  // Grid items
  if (Array.isArray(params.gridItems)) {
    const originalCount = params.gridItems.length;
    if (originalCount > capacity.maxItems) {
      params.gridItems = truncateItems(params.gridItems, capacity);
      fixes.push(`gridItems: ${originalCount} → ${capacity.maxItems} items`);
    }
  }

  // Key points
  if (Array.isArray(params.keyPoints)) {
    const originalCount = params.keyPoints.length;
    if (originalCount > capacity.maxItems) {
      params.keyPoints = truncateItems(params.keyPoints, capacity);
      fixes.push(`keyPoints: ${originalCount} → ${capacity.maxItems} items`);
    }
  }

  // Objectives
  if (Array.isArray(params.objectives)) {
    const originalCount = params.objectives.length;
    if (originalCount > capacity.maxItems) {
      params.objectives = truncateItems(params.objectives, capacity);
      fixes.push(`objectives: ${originalCount} → ${capacity.maxItems} items`);
    }
  }

  // Timeline items
  if (Array.isArray(params.timelineItems)) {
    const originalCount = params.timelineItems.length;
    if (originalCount > capacity.maxItems) {
      params.timelineItems = truncateItems(params.timelineItems, capacity);
      fixes.push(`timelineItems: ${originalCount} → ${capacity.maxItems} items`);
    }
  }

  // Pros / cons (each is a string[])
  if (Array.isArray(params.pros) && capacity.maxItems > 0) {
    const original = params.pros.length;
    if (original > capacity.maxItems) {
      params.pros = params.pros.slice(0, capacity.maxItems);
      fixes.push(`pros: ${original} → ${capacity.maxItems} items`);
    }
  }
  if (Array.isArray(params.cons) && capacity.maxItems > 0) {
    const original = params.cons.length;
    if (original > capacity.maxItems) {
      params.cons = params.cons.slice(0, capacity.maxItems);
      fixes.push(`cons: ${original} → ${capacity.maxItems} items`);
    }
  }

  // Sections (TOC)
  if (Array.isArray(params.sections)) {
    const originalCount = params.sections.length;
    if (originalCount > capacity.maxItems) {
      params.sections = truncateItems(params.sections, capacity);
      fixes.push(`sections: ${originalCount} → ${capacity.maxItems} items`);
    }
  }

  return {
    slot: { ...slot, params },
    wasFixed: fixes.length > 0,
    fixes,
  };
}
