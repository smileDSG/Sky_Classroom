/**
 * Quoted property fragment fixer.
 *
 * Fixes AI responses that emit malformed property fragments like:
 *   "height: 76"     →   "height": 76
 *   "fixedRatio: false" → "fixedRatio": false
 *
 * Only applies inside object context (between { , tokens) to avoid
 * corrupting valid JSON string values.
 */

import type { RepairStrategy, RepairContext, RepairResult } from './types';

const QUOTED_PROPERTY_REGEX =
  /([,{]\s*)"([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(true|false|null|[+-]?\d+(?:\.\d+)?)"(?=\s*[,}])/g;

export const quotedPropertyFixer: RepairStrategy = {
  name: 'quoted-property-fixer',
  priority: 10,

  repair(context: RepairContext): RepairResult | null {
    const before = context.currentText;
    const fixed = before.replace(
      QUOTED_PROPERTY_REGEX,
      (_match, prefix, key, value) => `${prefix}"${key}": ${value}`,
    );

    if (fixed === before) return null;

    return {
      text: fixed,
      meta: { fragmentCount: countMatches(before) },
    };
  },
};

function countMatches(text: string): number {
  let count = 0;
  const regex = new RegExp(QUOTED_PROPERTY_REGEX.source, 'g');
  while (regex.exec(text) !== null) count++;
  return count;
}
