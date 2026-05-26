/**
 * LaTeX escape fixer.
 *
 * AI models often emit LaTeX commands (\frac, \left, \right, \times, etc.)
 * inside JSON strings. These backslash-letter sequences are invalid JSON
 * escape sequences and must be double-escaped (\\frac → \\\\frac).
 *
 * Key insight: if a backslash-letter is followed by another letter,
 * it's part of a LaTeX command name (e.g. \frac, \neq, \times, \bar)
 * and must ALWAYS be double-escaped, even if the first letter happens
 * to be a valid JSON escape character (b, f, n, r, t).
 */

import type { RepairStrategy, RepairContext, RepairResult } from './types';

const JSON_ESCAPE_CHARS = new Set('bfnrtu');
const LETTER = /[a-zA-Z]/;

export const latexEscapeFixer: RepairStrategy = {
  name: 'latex-escape-fixer',
  priority: 20,

  repair(context: RepairContext): RepairResult | null {
    let changed = false;

    const fixed = context.currentText.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match, content) => {
      const fixedContent = content.replace(/\\([a-zA-Z])/g, (_m: string, ch: string, offset: number, str: string) => {
        const nextChar = str[offset + 2];
        const isLatexCommand = nextChar != null && LETTER.test(nextChar);

        if (JSON_ESCAPE_CHARS.has(ch) && !isLatexCommand) {
          return `\\${ch}`; // real JSON escape: \n, \t etc. — keep as-is
        }
        changed = true;
        return `\\\\${ch}`; // LaTeX command — double-escape for JSON
      });
      return `"${fixedContent}"`;
    });

    if (!changed) return null;

    return { text: fixed, meta: { type: 'latex' } };
  },
};
