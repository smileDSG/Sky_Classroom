/**
 * jsonrepair library integration strategy.
 *
 * Uses the `jsonrepair` package as a last-resort fix for heavily
 * malformed JSON (e.g., unescaped quotes in text, single quotes, etc.)
 */

import { jsonrepair } from 'jsonrepair';
import type { RepairStrategy, RepairContext, RepairResult } from './types';

export const jsonrepairFixer: RepairStrategy = {
  name: 'jsonrepair-fixer',
  priority: 60,

  repair(context: RepairContext): RepairResult | null {
    try {
      const repaired = jsonrepair(context.currentText);

      // jsonrepair may return the same string if nothing to fix
      if (repaired === context.currentText) return null;

      // Quick sanity: must still look like JSON
      if (!repaired.trim().startsWith('{') && !repaired.trim().startsWith('[')) {
        return null;
      }

      return { text: repaired, meta: { type: 'jsonrepair' } };
    } catch {
      return null;
    }
  },
};
