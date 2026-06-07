/**
 * LaTeX escape fixer.
 *
 * AI models often emit LaTeX commands (\frac, \left, \right, \times, etc.)
 * inside JSON strings. These backslash-letter sequences are invalid JSON
 * escape sequences and must be double-escaped (\\frac → \\\\frac).
 *
 * Preserves valid JSON escapes: \b \f \n \r \t \uXXXX
 */

import type { RepairStrategy, RepairContext, RepairResult } from './types';

const JSON_ESCAPE_CHARS = new Set('bfnrtu');

export const latexEscapeFixer: RepairStrategy = {
  name: 'latex-escape-fixer',
  priority: 20,

  repair(context: RepairContext): RepairResult | null {
    let changed = false;

    const fixed = context.currentText.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match, content) => {
      const fixedContent = content.replace(/\\([a-zA-Z])/g, (_m: string, ch: string) => {
        if (JSON_ESCAPE_CHARS.has(ch)) return `\\${ch}`;
        changed = true;
        return `\\\\${ch}`;
      });
      return `"${fixedContent}"`;
    });

    if (!changed) return null;

    return { text: fixed, meta: { type: 'latex' } };
  },
};
