/**
 * Invalid escape sequence fixer.
 *
 * Fixes non-JSON-escape backslash sequences (\S, \L, etc.) that
 * frequently appear in math/science content. Doubles the backslash
 * so JSON.parse accepts them as literal backslashes.
 *
 * Valid JSON escapes preserved: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
 */

import type { RepairStrategy, RepairContext, RepairResult } from './types';

const VALID_ESCAPE_CHAR = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);

export const invalidEscapeFixer: RepairStrategy = {
  name: 'invalid-escape-fixer',
  priority: 30,

  repair(context: RepairContext): RepairResult | null {
    let changed = false;

    const fixed = context.currentText.replace(/\\([^"\\\/bfnrtu\n\r])/g, (match, char) => {
      if (/[a-zA-Z]/.test(char)) {
        changed = true;
        return '\\\\' + char;
      }
      return match;
    });

    if (!changed) return null;

    return { text: fixed, meta: { type: 'invalid-escapes' } };
  },
};
