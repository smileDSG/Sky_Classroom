/**
 * Sky Classroom — Mistake cause analyzer (rule-based, no LLM).
 */

import type { MistakeCause } from '@/lib/solve/types';

// ── Keyword sets for misreading detection ────────────────────────────

const MISREADING_KEYWORDS = [
  '下列选项中',
  '错误的是',
  '正确的是',
  '不正确',
  '不属于',
  '不是',
  '除了',
  '不包括',
  '错误的选项',
  '正确的选项',
  '不符合',
  '不符合的是',
  '表述错误的是',
  '表述正确的是',
];

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract all numeric values from a string (integers, decimals, scientific).
 * Returns an array of numbers in the order they appear.
 */
export function extractNumbers(text: string): number[] {
  if (!text) return [];

  // Match numbers: optional sign, digits/decimal, optional scientific notation
  const re = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  const matches = text.match(re);
  if (!matches) return [];

  return matches.map(Number).filter((n) => !isNaN(n));
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeAnswer(s: string): string {
  return normalizeWhitespace(s).toLowerCase();
}

/**
 * Check whether two numbers differ by roughly an order of magnitude (factor of ~10).
 */
function isOrderOfMagnitudeOff(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  // We consider "one order of magnitude" when the ratio is close to 10 or 0.1
  const ratio = a / b;
  return (ratio >= 8 && ratio <= 12) || (ratio >= 0.08 && ratio <= 0.12);
}

/**
 * Check whether `user` contains the key digits of `correct` but in a
 * different arrangement (reversed order, wrong sign, etc.).
 */
function hasKeyDigitsButWrongStructure(
  correctNums: number[],
  userNums: number[],
): boolean {
  if (correctNums.length === 0 || userNums.length === 0) return false;

  const sortNums = (nums: number[]) =>
    [...nums].sort((x, y) => x - y).map(String);

  const sortedCorrect = sortNums(correctNums);
  const sortedUser = sortNums(userNums);

  // Same sorted numbers but different order → method wrong
  if (
    sortedCorrect.length === sortedUser.length &&
    sortedCorrect.every((v, i) => v === sortedUser[i])
  ) {
    const correctSeq = correctNums.map(String);
    const userSeq = userNums.map(String);
    if (correctSeq.join(',') !== userSeq.join(',')) {
      return true;
    }
  }

  // Check sign flips
  const correctAbs = correctNums.map(Math.abs).sort((x, y) => x - y);
  const userAbs = userNums.map(Math.abs).sort((x, y) => x - y);
  if (
    correctAbs.length === userAbs.length &&
    correctAbs.every((v, i) => v === userAbs[i])
  ) {
    const correctSigns = correctNums.map((n) => (n >= 0 ? 1 : -1));
    const userSigns = userNums.map((n) => (n >= 0 ? 1 : -1));
    if (correctSigns.join(',') !== userSigns.join(',')) {
      return true;
    }
  }

  return false;
}

/**
 * Check for format issues: extra spaces, case differences, unit mismatches
 * when the core content is essentially correct.
 */
function isFormatIssue(correct: string, user: string): boolean {
  const stripped = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  const coreCorrect = stripped(correct);
  const coreUser = stripped(user);

  // If stripped versions match but raw versions differ → format issue
  if (coreCorrect === coreUser && correct !== user) {
    return true;
  }

  // Case mismatch (same after lowercasing but different before)
  if (correct.toLowerCase() === user.toLowerCase() && correct !== user) {
    return true;
  }

  // Unit differences: e.g. "10cm" vs "10 cm" or "10 cm" vs "10 厘米"
  // Already covered by whitespace, but also check number-only match
  const correctNums = extractNumbers(correct);
  const userNums = extractNumbers(user);
  if (
    correctNums.length > 0 &&
    userNums.length > 0 &&
    correctNums.length === userNums.length &&
    correctNums.every((n, i) => n === userNums[i]) &&
    correct.length !== user.length
  ) {
    return true;
  }

  return false;
}

// ── Main analyzer ────────────────────────────────────────────────────

/**
 * Rule-based mistake cause analysis.
 *
 * Priority (highest to lowest):
 *  1. User answer is empty → 'concept-unclear'
 *  2. Answers are identical → no mistake (return 'careless' as safe default)
 *  3. Numbers differ by ~10x → 'calculation-error'
 *  4. User has the right digits but wrong order/sign → 'method-wrong'
 *  5. User likely ignored qualifying keywords → 'misreading'
 *  6. Format issue (spacing, casing, units) but core content matches → 'format-error'
 *  7. Fallback → 'concept-unclear'
 */
export function analyzeMistakeCause(
  problem: string,
  correctAnswer: string,
  userAnswer: string,
): MistakeCause {
  // 1. Empty answer
  if (!userAnswer || userAnswer.trim() === '') {
    return 'concept-unclear';
  }

  // 2. Exact match — should not be a mistake in the first place
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  const normalizedUser = normalizeAnswer(userAnswer);
  if (normalizedCorrect === normalizedUser) {
    return 'careless';
  }

  const correctNums = extractNumbers(correctAnswer);
  const userNums = extractNumbers(userAnswer);

  // 3. Order-of-magnitude error
  if (
    correctNums.length === 1 &&
    userNums.length === 1 &&
    isOrderOfMagnitudeOff(userNums[0], correctNums[0])
  ) {
    return 'calculation-error';
  }

  // Also check pairwise when lengths match
  if (
    correctNums.length > 0 &&
    correctNums.length === userNums.length &&
    correctNums.some((_, i) => isOrderOfMagnitudeOff(userNums[i], correctNums[i]))
  ) {
    return 'calculation-error';
  }

  // 4. Right key digits but wrong structure (order/sign)
  if (hasKeyDigitsButWrongStructure(correctNums, userNums)) {
    return 'method-wrong';
  }

  // 5. Misreading — keywords in problem that user likely ignored
  const problemText = normalizeAnswer(problem);
  for (const keyword of MISREADING_KEYWORDS) {
    if (problemText.includes(keyword)) {
      // If the keyword is about "error"/"incorrect" and the user gave what
      // looks like the direct answer instead of the opposite, it's misreading
      return 'misreading';
    }
  }

  // 6. Format issue
  if (isFormatIssue(correctAnswer, userAnswer)) {
    return 'format-error';
  }

  // 7. Default fallback
  return 'concept-unclear';
}
