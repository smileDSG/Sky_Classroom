/**
 * Control character fixer.
 *
 * Strips or escapes ASCII control characters (0x00-0x1F, 0x7F)
 * that invalidate JSON.parse. Preserves \n, \r, \t by re-escaping.
 */

import type { RepairStrategy, RepairContext, RepairResult } from './types';

export const controlCharFixer: RepairStrategy = {
  name: 'control-char-fixer',
  priority: 50,

  repair(context: RepairContext): RepairResult | null {
    let changed = false;

    const fixed = context.currentText.replace(/[\x00-\x1F\x7F]/g, (char) => {
      changed = true;
      switch (char) {
        case '\n':
          return '\\n';
        case '\r':
          return '\\r';
        case '\t':
          return '\\t';
        default:
          return '';
      }
    });

    if (!changed) return null;

    return { text: fixed, meta: { type: 'control-chars' } };
  },
};
