/**
 * Normalize an answer string for comparison.
 * Strips LaTeX delimiters, option prefixes, extra whitespace.
 */
export function normalizeAnswer(raw: string): string {
  let s = raw.trim();

  // Strip $$ block delimiters
  s = s.replace(/^\$\$([\s\S]*)\$\$$/, '$1');
  // Strip $ inline delimiters
  s = s.replace(/^\$(.*)\$$/, '$1');
  // Strip remaining $
  s = s.replace(/\$/g, '');

  s = s.trim();

  // Option prefix: A/B/C/D or 选项A or (A) or （A）
  const optionMatch = s.match(/^(?:选项|[（(])?([A-Da-d])[）)]?$/);
  if (optionMatch) {
    return optionMatch[1]!.toLowerCase();
  }

  // Normalize Chinese parentheses
  s = s.replace(/（/g, '(').replace(/）/g, ')');

  // Normalize whitespace around commas
  s = s.replace(/\s*,\s*/g, ',');

  return s.trim();
}

/**
 * Convert common LaTeX expressions to plain text for comparison.
 * e.g. \frac{1}{2} -> 1/2
 */
function latexToPlain(s: string): string {
  // \frac{a}{b} -> a/b
  s = s.replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '$1/$2');
  // Remove remaining LaTeX commands like \left, \right, \text, \mathrm, etc.
  s = s.replace(/\\(?:left|right|text|mathrm|mathbf|mathit|operatorname)\s*\{?/g, '');
  s = s.replace(/\\[,;!]/g, '');
  return s;
}

/**
 * Try to parse a string as a number.
 */
function tryParseNumber(s: string): number | null {
  // Handle fractions like 1/2
  const fracMatch = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1]!, 10);
    const den = parseInt(fracMatch[2]!, 10);
    if (den !== 0) return num / den;
  }

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Compare two normalized answers.
 * Returns { match, confidence }.
 */
export function matchAnswers(
  answerA: string,
  answerB: string,
): { match: boolean; confidence: number } {
  const a = normalizeAnswer(answerA);
  const b = normalizeAnswer(answerB);

  // Exact match after normalization
  if (a === b) return { match: true, confidence: 1.0 };

  // Case-insensitive for single-letter options
  if (a.length === 1 && b.length === 1 && a.toLowerCase() === b.toLowerCase()) {
    return { match: true, confidence: 1.0 };
  }

  // Convert LaTeX to plain text for comparison
  const aPlain = latexToPlain(a);
  const bPlain = latexToPlain(b);
  if (aPlain === bPlain) return { match: true, confidence: 0.95 };

  // Numeric comparison (using plain-text versions for LaTeX fractions)
  const numA = tryParseNumber(aPlain);
  const numB = tryParseNumber(bPlain);
  if (numA !== null && numB !== null) {
    if (Math.abs(numA - numB) < 1e-9) return { match: true, confidence: 0.95 };
  }

  // Set comparison: {1,2,3} vs {1, 2, 3}
  const setA = parseSet(aPlain);
  const setB = parseSet(bPlain);
  if (setA && setB) {
    const match = setA.length === setB.length && setA.every((v, i) => v === setB[i]);
    return { match, confidence: match ? 0.9 : 0 };
  }

  // Interval comparison: [0,1] vs [0, 1]
  const intervalA = aPlain.replace(/\s+/g, '');
  const intervalB = bPlain.replace(/\s+/g, '');
  if (intervalA === intervalB) return { match: true, confidence: 0.9 };

  return { match: false, confidence: 0 };
}

function parseSet(s: string): string[] | null {
  const match = s.match(/^\{(.+)\}$/);
  if (!match) return null;
  return match[1]!
    .split(',')
    .map((v) => v.trim())
    .sort();
}
