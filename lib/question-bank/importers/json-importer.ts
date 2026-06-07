/**
 * Question Bank — JSON array importer.
 *
 * Expects a JSON array of objects, each representing a question.
 */

import type { QuestionBankInsert } from '@/lib/question-bank/types';
import type { ImportOptions, ImportPipelineResult, Importer } from './types';
import { detectFieldMapping, applyFieldMapping } from './field-mapper';
import { validateRows } from './validators';
import { postProcessEntries } from './post-processor';

export function createJsonImporter(): Importer<string | unknown[]> {
  return {
    name: 'json',
    supportedExtensions: ['.json'],
    supportedMimeTypes: ['application/json', 'text/json'],

    async parse(source, options): Promise<ImportPipelineResult> {
      let rawArray: unknown[];

      if (typeof source === 'string') {
        try {
          const parsed = JSON.parse(source);
          if (!Array.isArray(parsed)) {
            throw new Error('JSON 根元素必须是数组');
          }
          rawArray = parsed;
        } catch (err: any) {
          return {
            entries: [],
            rawErrors: [{ row: 0, reason: `JSON 解析失败: ${err.message ?? '未知错误'}` }],
            meta: { totalRows: 0, parsedRows: 0 },
          };
        }
      } else if (Array.isArray(source)) {
        rawArray = source;
      } else {
        return {
          entries: [],
          rawErrors: [{ row: 0, reason: '输入必须是 JSON 字符串或对象数组' }],
          meta: { totalRows: 0, parsedRows: 0 },
        };
      }

      const maxRows = options?.maxRows ?? 10000;
      if (rawArray.length > maxRows) {
        return {
          entries: [],
          rawErrors: [{ row: 0, reason: `行数超过限制 (${maxRows})` }],
          meta: { totalRows: rawArray.length, parsedRows: 0 },
        };
      }

      if (rawArray.length === 0) {
        return {
          entries: [],
          rawErrors: [],
          meta: { totalRows: 0, parsedRows: 0 },
        };
      }

      // Detect field mapping from the first row
      const firstRow = rawArray[0];
      if (!firstRow || typeof firstRow !== 'object' || Array.isArray(firstRow)) {
        return {
          entries: [],
          rawErrors: [{ row: 1, reason: '数组元素必须是对象' }],
          meta: { totalRows: rawArray.length, parsedRows: 0 },
        };
      }

      const rawColumns = Object.keys(firstRow as Record<string, unknown>);
      const mappingResult = detectFieldMapping(rawColumns);

      // Convert raw rows to canonical rows
      const canonicalRows: Record<string, unknown>[] = rawArray.map((item, idx) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return { __invalid: true, __index: idx + 1 };
        }
        return applyFieldMapping(item as Record<string, unknown>, mappingResult.mapping, options);
      });

      const invalidRows = canonicalRows.filter((r) => r.__invalid);
      const validCanonicalRows = canonicalRows.filter((r) => !r.__invalid);

      const parseErrors = invalidRows.map((r) => ({
        row: r.__index as number,
        reason: '数组元素必须是对象',
      }));

      if (options?.skipValidation) {
        return {
          entries: validCanonicalRows as unknown as QuestionBankInsert[],
          rawErrors: parseErrors,
          meta: { totalRows: rawArray.length, parsedRows: validCanonicalRows.length },
        };
      }

      // Validate
      const validation = validateRows(validCanonicalRows);

      // Post-process: extract options from content for choice questions
      const processedEntries = postProcessEntries(validation.validEntries);

      return {
        entries: processedEntries as unknown as QuestionBankInsert[],
        rawErrors: [...parseErrors, ...validation.allErrors],
        meta: {
          totalRows: rawArray.length,
          parsedRows: validation.validCount,
        },
      };
    },
  };
}
