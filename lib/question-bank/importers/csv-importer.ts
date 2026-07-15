/**
 * Question Bank — CSV importer (lightweight, zero-dependency).
 *
 * Handles:
 * - Comma-separated values
 * - Quoted fields with embedded commas/newlines
 * - UTF-8 BOM removal
 * - Empty rows skipped
 */

import type { QuestionBankInsert } from '@/lib/question-bank/types';
import type { ImportOptions, ImportPipelineResult, Importer } from './types';
import { detectFieldMapping, applyFieldMapping } from './field-mapper';
import { validateRows } from './validators';
import { postProcessEntries } from './post-processor';

export function createCsvImporter(): Importer<string> {
  return {
    name: 'csv',
    supportedExtensions: ['.csv'],
    supportedMimeTypes: ['text/csv', 'application/csv'],

    async parse(source, options): Promise<ImportPipelineResult> {
      if (typeof source !== 'string') {
        return {
          entries: [],
          rawErrors: [{ row: 0, reason: 'CSV 输入必须是字符串' }],
          meta: { totalRows: 0, parsedRows: 0 },
        };
      }

      // Remove UTF-8 BOM if present
      const cleaned = source.replace(/^\uFEFF/, '');

      let rows: string[][];
      try {
        rows = parseCsvLines(cleaned);
      } catch (err: any) {
        return {
          entries: [],
          rawErrors: [{ row: 0, reason: `CSV 解析失败: ${err.message ?? '未知错误'}` }],
          meta: { totalRows: 0, parsedRows: 0 },
        };
      }

      if (rows.length < 1) {
        return {
          entries: [],
          rawErrors: [{ row: 0, reason: 'CSV 文件为空' }],
          meta: { totalRows: 0, parsedRows: 0 },
        };
      }

      const maxRows = options?.maxRows ?? 10000;
      if (rows.length - 1 > maxRows) {
        return {
          entries: [],
          rawErrors: [{ row: 0, reason: `行数超过限制 (${maxRows})` }],
          meta: { totalRows: rows.length - 1, parsedRows: 0 },
        };
      }

      // First row = headers
      const headers = rows[0];
      const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== ''));

      const mappingResult = detectFieldMapping(headers);

      // Convert each data row to canonical object
      const canonicalRows: Record<string, unknown>[] = dataRows.map((cells) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < headers.length; i++) {
          const rawKey = headers[i];
          const value = cells[i] ?? '';
          obj[rawKey] = value;
        }
        return applyFieldMapping(obj, mappingResult.mapping, options);
      });

      if (options?.skipValidation) {
        return {
          entries: canonicalRows as unknown as QuestionBankInsert[],
          rawErrors: [],
          meta: { totalRows: dataRows.length, parsedRows: canonicalRows.length },
        };
      }

      const validation = validateRows(canonicalRows);

      // Post-process: extract options from content for choice questions
      const processedEntries = postProcessEntries(validation.validEntries);

      return {
        entries: processedEntries as unknown as QuestionBankInsert[],
        rawErrors: validation.allErrors,
        meta: {
          totalRows: dataRows.length,
          parsedRows: validation.validCount,
        },
      };
    },
  };
}

// ── Lightweight CSV parser ──────────────────────────────────────────

/**
 * Parse CSV text into a 2D array of strings.
 *
 * Rules:
 * - Fields are separated by commas.
 * - Fields may be quoted with double quotes.
 * - Inside quotes, a double-quote is escaped by doubling it ("").
 * - Inside quotes, commas and newlines are literal.
 * - Carriage returns (\r) are stripped.
 */
function parseCsvLines(text: string): string[][] {
  if (text.trim().length === 0) return [];

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // skip next
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        lines.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\r') {
        // Ignore standalone CR; handle CRLF below
        if (nextChar !== '\n') {
          currentField += char;
        }
      } else {
        currentField += char;
      }
    }
  }

  // Push final field/row
  currentRow.push(currentField);
  lines.push(currentRow);

  // Normalize: ensure all rows have the same number of columns as the header
  if (lines.length > 0) {
    const expectedCols = lines[0].length;
    for (let i = 1; i < lines.length; i++) {
      while (lines[i].length < expectedCols) {
        lines[i].push('');
      }
      if (lines[i].length > expectedCols) {
        lines[i] = lines[i].slice(0, expectedCols);
      }
    }
  }

  return lines;
}
