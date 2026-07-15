/**
 * Question Bank — Excel (.xlsx) importer.
 *
 * Uses the `xlsx` library (SheetJS) to read Excel files.
 * Supports multiple sheets; each sheet is treated as an independent dataset.
 */

import type { QuestionBankInsert } from '@/lib/question-bank/types';
import type { ImportOptions, ImportPipelineResult, Importer, ImportRowError } from './types';
import { detectFieldMapping, applyFieldMapping } from './field-mapper';
import { validateRows } from './validators';
import { postProcessEntries } from './post-processor';

export function createXlsxImporter(): Importer<Buffer | ArrayBuffer> {
  return {
    name: 'xlsx',
    supportedExtensions: ['.xlsx', '.xls'],
    supportedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],

    async parse(source, options): Promise<ImportPipelineResult> {
      const XLSX = await import('xlsx');
      let workbook: import('xlsx').WorkBook;

      try {
        const buffer = source instanceof ArrayBuffer ? Buffer.from(source) : source;
        workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      } catch (err: any) {
        return {
          entries: [],
          rawErrors: [{ row: 0, reason: `Excel 解析失败: ${err.message ?? '未知错误'}` }],
          meta: { totalRows: 0, parsedRows: 0 },
        };
      }

      const maxRows = options?.maxRows ?? 10000;
      const allEntries: QuestionBankInsert[] = [];
      const allErrors: ImportRowError[] = [];
      let totalRows = 0;
      let parsedRows = 0;

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '',
          blankrows: false,
        });

        if (jsonRows.length === 0) continue;

        // Detect mapping from first row keys
        const firstRow = jsonRows[0];
        const rawColumns = Object.keys(firstRow);
        const mappingResult = detectFieldMapping(rawColumns);

        // If sheet name looks like a subject, use it as default
        const sheetDefaults: Partial<QuestionBankInsert> = {};
        if (
          sheetName &&
          !['sheet1', 'sheet2', 'sheet3', '工作表1', '工作表2', '工作表3'].includes(
            sheetName.toLowerCase(),
          )
        ) {
          sheetDefaults.subject = sheetName;
        }

        const canonicalRows: Record<string, unknown>[] = jsonRows.map((row) => {
          const mergedDefaults = { ...sheetDefaults, ...options?.defaultValues };
          return applyFieldMapping(row, mappingResult.mapping, { defaultValues: mergedDefaults });
        });

        totalRows += canonicalRows.length;

        if (totalRows > maxRows) {
          allErrors.push({ row: 0, reason: `行数超过限制 (${maxRows})` });
          break;
        }

        if (options?.skipValidation) {
          allEntries.push(...(canonicalRows as unknown as QuestionBankInsert[]));
          parsedRows += canonicalRows.length;
          continue;
        }

        const validation = validateRows(canonicalRows);

        // Post-process: extract options from content for choice questions
        const processedEntries = postProcessEntries(validation.validEntries);

        allEntries.push(...processedEntries);
        allErrors.push(...validation.allErrors);
        parsedRows += validation.validCount;
      }

      return {
        entries: allEntries,
        rawErrors: allErrors,
        meta: { totalRows, parsedRows },
      };
    },
  };
}
