/**
 * Truncated JSON fixer.
 *
 * Handles AI responses that get cut off mid-generation:
 * - Array cut off → close with ]
 * - Object cut off → balance with }
 * - Zero padding → remove NUL bytes
 */

import type { RepairStrategy, RepairContext, RepairResult } from './types';

export const truncatedJsonFixer: RepairStrategy = {
  name: 'truncated-json-fixer',
  priority: 40,

  repair(context: RepairContext): RepairResult | null {
    let fixed = context.currentText;

    // Remove zero-width and NUL characters
    const cleaned = fixed.replace(/\0/g, '');
    if (cleaned !== fixed) {
      fixed = cleaned;
    }

    let meta: Record<string, unknown> | undefined;

    const trimmed = fixed.trim();
    if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
      const lastCompleteObj = fixed.lastIndexOf('}');
      if (lastCompleteObj > 0) {
        fixed = fixed.substring(0, lastCompleteObj + 1) + ']';
        meta = { type: 'array-truncated' };
      }
    } else if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
      const openBraces = (fixed.match(/{/g) || []).length;
      const closeBraces = (fixed.match(/}/g) || []).length;
      if (openBraces > closeBraces) {
        fixed += '}'.repeat(openBraces - closeBraces);
        meta = { type: 'object-truncated', missingBraces: openBraces - closeBraces };
      }
    }

    if (fixed === context.currentText) return null;

    return { text: fixed, meta };
  },
};
