/**
 * Question Bank — pure utility functions (client-safe).
 *
 * These functions have zero server dependencies and can be safely
 * imported by client components and solve-cache.ts.
 */

// ── Hashing ──────────────────────────────────────────────────────────

export function hashProblemText(text: string): string {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[，。！？、；：""''（）【】《》\s]/g, '');
  return stableHash(normalized);
}

function stableHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return `qb_${(h >>> 0).toString(36)}`;
}

// ── Similarity ──────────────────────────────────────────────────────

export function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const aGrams = bigrams(a);
  const bGrams = bigrams(b);
  const intersection = new Set([...aGrams].filter((x) => bGrams.has(x)));
  const union = new Set([...aGrams, ...bGrams]);
  return intersection.size / union.size;
}

function bigrams(text: string): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) {
    grams.add(text.slice(i, i + 2));
  }
  return grams;
}
