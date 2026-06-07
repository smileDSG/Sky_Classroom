/**
 * JSON window extraction strategy.
 *
 * Finds the first balanced { } or [ ] block in arbitrary text.
 * Handles nested structures and string escaping.
 */

import type { ExtractionStrategy } from './types';

function findBalancedRange(
  text: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): number {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

export const jsonWindowExtractor: ExtractionStrategy = {
  name: 'json-window-extractor',

  extract(rawResponse: string): string[] {
    const results: string[] = [];

    // Find the earliest-balanced outermost JSON structure.
    // Check both { and [ starting positions and pick whichever
    // opens first. This prevents the inner array from being
    // extracted when the outer object starts earlier.
    const candidates: Array<{ start: number; open: string; close: string }> = [];
    for (const openChar of ['{', '['] as const) {
      const startPos = rawResponse.indexOf(openChar);
      if (startPos !== -1) {
        candidates.push({
          start: startPos,
          open: openChar,
          close: openChar === '{' ? '}' : ']',
        });
      }
    }

    // Prefer the earliest-starting structure
    candidates.sort((a, b) => a.start - b.start);

    for (const c of candidates) {
      const endPos = findBalancedRange(rawResponse, c.start, c.open, c.close);
      if (endPos !== -1) {
        results.push(rawResponse.substring(c.start, endPos + 1));
        // Return only the outermost match — it's the most likely to be
        // the intended JSON response
        break;
      }
    }

    return results;
  },
};
