/**
 * Pipeline Validator
 *
 * Runs before assembleSlidesV2 to detect content overflow and
 * auto-fix by truncating params so every slide fits its template.
 */

import { estimateContentFit, fixSlotOverflow, getTemplateCapacity } from '@/lib/slides/content-sizing';
import type { TemplateSlotV2, ThemeToken } from '@/lib/slides/types';

export interface ValidationResult {
  fixedSlots: TemplateSlotV2[];
  fixes: string[];
  warnings: string[];
}

/**
 * Validate every slot against its template capacity and apply
 * auto-fixes (truncation) where content overflows.
 */
export function validateAndFixSlots(
  slots: TemplateSlotV2[],
  theme: ThemeToken,
): ValidationResult {
  const fixes: string[] = [];
  const warnings: string[] = [];

  const fixedSlots = slots.map((slot, i) => {
    const capacity = getTemplateCapacity(slot.template);
    if (!capacity) {
      warnings.push(`Slot ${i} (${slot.template}): no capacity registry, skipping validation`);
      return slot;
    }

    const fit = estimateContentFit(slot, theme);
    if (fit.fits) return slot;

    const fix = fixSlotOverflow(slot, capacity, 'truncate');
    if (fix.wasFixed) {
      fixes.push(`Slide ${i + 1} (${slot.template}): ${fix.fixes.join('; ')}`);
      return fix.slot;
    }

    // Overflow detected but could not be fixed (e.g. scale/split not implemented)
    const overflowDesc = fit.overflows.map((o) => `${o.field}(${o.actual}/${o.limit})`).join(', ');
    warnings.push(`Slide ${i + 1} (${slot.template}): overflow detected — ${overflowDesc}`);
    return slot;
  });

  return { fixedSlots, fixes, warnings };
}
