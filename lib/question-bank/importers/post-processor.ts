/**
 * Question Bank — import post-processor.
 *
 * Handles smart extraction of options from content text and merges
 * multi-column options that field-mapper may have missed.
 */

import type { QuestionBankInsert } from '@/lib/question-bank/types';

const log = { warn: console.warn, info: console.info };

// ── Multi-column option detection ───────────────────────────────────

/** Column names that represent individual choice options */
const MULTI_OPTION_PATTERNS: { pattern: RegExp; index: (match: RegExpExecArray) => number }[] = [
  // A, B, C, D, E, F (single letter, case-insensitive)
  { pattern: /^[a-f]$/i, index: (m) => m[0].toUpperCase().charCodeAt(0) - 65 },
  // 选项A, 选项B, ...
  { pattern: /^选项\s*([a-f])$/i, index: (m) => m[1].toUpperCase().charCodeAt(0) - 65 },
  // choiceA, choiceB, ...
  { pattern: /^choice\s*([a-f])$/i, index: (m) => m[1].toUpperCase().charCodeAt(0) - 65 },
  // option1, option2, ... (1-based)
  { pattern: /^option\s*(\d+)$/i, index: (m) => Number(m[1]) - 1 },
  // 选项1, 选项2, ...
  { pattern: /^选项\s*(\d+)$/i, index: (m) => Number(m[1]) - 1 },
  // 备选A, 备选B, ...
  { pattern: /^备选\s*([a-f])$/i, index: (m) => m[1].toUpperCase().charCodeAt(0) - 65 },
];

/**
 * Extract options from raw column names that weren't caught by the main
 * field mapper. E.g. columns named "A", "B", "C", "D" or "选项A", "选项B".
 */
export function extractMultiColumnOptions(
  rawRow: Record<string, unknown>,
  mapping: Record<string, string>,
): string[] | null {
  const options: (string | null)[] = [];
  let found = false;

  for (const [rawKey, value] of Object.entries(rawRow)) {
    const normalizedKey = rawKey.trim().toLowerCase();

    // Skip columns already mapped to something other than 'options'
    const mappedTo = mapping[rawKey];
    if (mappedTo && mappedTo !== 'options') continue;

    for (const { pattern, index } of MULTI_OPTION_PATTERNS) {
      const match = pattern.exec(normalizedKey);
      if (match) {
        const idx = index(match);
        const val = String(value ?? '').trim();
        if (val) {
          while (options.length <= idx) options.push(null);
          options[idx] = val;
          found = true;
        }
        break;
      }
    }
  }

  if (!found) return null;

  // Compact: remove trailing nulls, keep internal nulls as empty strings
  while (options.length > 0 && options[options.length - 1] === null) {
    options.pop();
  }

  return options.map((o) => o ?? '');
}

// ── Content-based option extraction ───────────────────────────────────

/**
 * Common patterns for options embedded in question content:
 *
 *   A. xxx
 *   B. xxx
 *   C. xxx
 *   D. xxx
 *
 *   A、xxx
 *   B、xxx
 *
 *   (A) xxx
 *   (B) xxx
 *
 *   A) xxx
 *   B) xxx
 *
 *   A xxx
 *   B xxx
 */
const OPTION_PATTERNS = [
  // A. / B. / C. / D.  (most common)
  /^\s*([A-F])[\.．。]\s*(.+)$/,
  // A、 / B、 / C、 / D、
  /^\s*([A-F])[、,]\s*(.+)$/,
  // (A) / (B) / (C) / (D)
  /^\s*\(([A-F])\)\s*(.+)$/,
  // A) / B) / C) / D)
  /^\s*([A-F])\)\s*(.+)$/,
  // A xxx / B xxx (loose, only if preceded by newline)
  /^\s*([A-F])\s+(.+)$/,
];

/**
 * Extract options from the end of question content.
 * Returns the cleaned content (with options removed) and the options array.
 */
export function extractOptionsFromContent(content: string): {
  content: string;
  options: string[];
} {
  if (!content || content.trim().length === 0) {
    return { content, options: [] };
  }

  const lines = content.split(/\r?\n/);
  const options: (string | null)[] = [];
  let firstOptionLine = -1;

  // Scan from the end to find contiguous option lines
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;

    let matched = false;
    for (const pattern of OPTION_PATTERNS) {
      const match = pattern.exec(line);
      if (match) {
        const letter = match[1].toUpperCase();
        const idx = letter.charCodeAt(0) - 65; // A=0, B=1, ...
        const text = match[2].trim();
        if (text) {
          while (options.length <= idx) options.push(null);
          options[idx] = text;
          matched = true;
          if (firstOptionLine === -1 || i < firstOptionLine) {
            firstOptionLine = i;
          }
        }
        break;
      }
    }

    if (!matched) {
      // If we already found options and this line doesn't match,
      // and it's not empty, stop scanning
      if (firstOptionLine !== -1) break;
    }
  }

  // Validate: must have at least 2 contiguous options at the end
  if (firstOptionLine === -1) {
    return { content, options: [] };
  }

  // Check that options are contiguous (no gaps in A, B, C...)
  const validOptions: string[] = [];
  for (let i = 0; i < options.length; i++) {
    if (options[i] === null || options[i] === undefined) break;
    validOptions.push(options[i]!);
  }

  if (validOptions.length < 2) {
    return { content, options: [] };
  }

  // Remove option lines from content
  const cleanedLines = lines.slice(0, firstOptionLine);
  // Also remove any trailing empty lines
  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === '') {
    cleanedLines.pop();
  }

  const cleanedContent = cleanedLines.join('\n').trim();

  // If cleaning removed everything, keep original
  if (!cleanedContent) {
    return { content, options: validOptions };
  }

  return { content: cleanedContent, options: validOptions };
}

// ── Post-process imported entries ─────────────────────────────────────

/**
 * Post-process a batch of imported entries:
 * 1. For choice questions with empty options, try to extract from content
 * 2. Ensure options are string arrays (not JSON strings)
 */
export function postProcessEntries(entries: QuestionBankInsert[]): QuestionBankInsert[] {
  return entries.map((entry) => {
    const isChoice = entry.questionType === 'choice' || entry.questionType === 'judge';
    if (!isChoice) return entry;

    // Already has valid options?
    if (Array.isArray(entry.options) && entry.options.length >= 2) {
      // Ensure all elements are strings
      return {
        ...entry,
        options: entry.options.map((o) => String(o ?? '')).filter((o) => o.length > 0),
      };
    }

    // Try to extract from content
    if (entry.content) {
      const extracted = extractOptionsFromContent(entry.content);
      if (extracted.options.length >= 2) {
        log.info(`Extracted ${extracted.options.length} options from content for: ${entry.content.slice(0, 40)}...`);
        return {
          ...entry,
          content: extracted.content,
          options: extracted.options,
        };
      }
    }

    return entry;
  });
}
