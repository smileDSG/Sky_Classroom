/**
 * Question Bank — PDF importer.
 *
 * Orchestrates the full PDF import pipeline:
 *   parse PDF → split questions → extract structure → filter by confidence → insert
 *
 * Extracted questions are inserted directly after structure validation.
 */

import { createLogger } from '@/lib/logger';
import type { QuestionBankInsert, ImportResult } from '@/lib/question-bank/types';
import type { ImportOptions, ImportPipelineResult } from './types';
import { insertBatch as defaultInsertBatch } from '@/lib/question-bank/dao';
import { parsePDF } from '@/lib/pdf/pdf-providers';
import { callLLM } from '@/lib/ai/llm';
import type { PDFParserConfig } from '@/lib/pdf/types';
import { splitQuestions, type QuestionSegment } from './pdf-question-splitter';
import { extractStructure, type ExtractedQuestion } from './pdf-structure-extractor';
import { postProcessEntries } from './post-processor';

const log = createLogger('QB:PDF:Import');
type LLMParams = Parameters<typeof callLLM>[0];

// ── Types ───────────────────────────────────────────────────────────

export interface PdfImportDeps {
  parsePdf: (buffer: Buffer) => Promise<{ text: string }>;
  splitQuestions: (text: string) => Promise<QuestionSegment[]>;
  extractStructure: (text: string) => Promise<ExtractedQuestion | null>;
  insertBatch?: typeof defaultInsertBatch;
}

export type PdfImportResult = ImportResult;

// ── Default deps (production) ───────────────────────────────────────

export function createDefaultPdfDeps(pdfConfig?: PDFParserConfig): PdfImportDeps {
  return {
    parsePdf: async (buffer: Buffer) => {
      const config: PDFParserConfig = pdfConfig ?? { providerId: 'unpdf' };
      const result = await parsePDF(config, buffer);
      return { text: result.text };
    },
    splitQuestions: async (text: string) => {
      return splitQuestions(text, {
        callLLM: async (params, source) => callLLM(params as LLMParams, source),
      });
    },
    extractStructure: async (text: string) => {
      return extractStructure(text, {
        callLLM: async (params, source) => callLLM(params as LLMParams, source),
      });
    },
  };
}

// ── Internal pipeline ───────────────────────────────────────────────

interface PipelineEntries {
  highConfidence: QuestionBankInsert[];
  lowConfidence: QuestionBankInsert[];
  errors: { row: number; reason: string }[];
  totalSegments: number;
}

async function runPdfPipeline(
  pdfBuffer: Buffer,
  options: ImportOptions | undefined,
  deps: PdfImportDeps,
): Promise<PipelineEntries> {
  // Step 1: Parse PDF to text
  let text: string;
  try {
    const parsed = await deps.parsePdf(pdfBuffer);
    text = parsed.text;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误';
    log.error('PDF parsing failed:', err);
    return {
      highConfidence: [],
      lowConfidence: [],
      errors: [{ row: 0, reason: `PDF 解析失败: ${message}` }],
      totalSegments: 0,
    };
  }

  if (!text || text.trim().length === 0) {
    return {
      highConfidence: [],
      lowConfidence: [],
      errors: [{ row: 0, reason: 'PDF 未提取到文本' }],
      totalSegments: 0,
    };
  }

  // Step 2: Split into question segments
  const segments = await deps.splitQuestions(text);
  if (segments.length === 0) {
    return {
      highConfidence: [],
      lowConfidence: [],
      errors: [{ row: 0, reason: '未从 PDF 中识别出题目' }],
      totalSegments: 0,
    };
  }

  log.info(`PDF parsed into ${segments.length} segments`);

  // Step 3: Extract structured data for each segment
  const highConfidence: QuestionBankInsert[] = [];
  const lowConfidence: QuestionBankInsert[] = [];
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const extracted = await deps.extractStructure(segment.text);

    if (!extracted) {
      errors.push({ row: i + 1, reason: '结构化提取失败' });
      continue;
    }

    const entry: QuestionBankInsert = {
      ...options?.defaultValues,
      ...extracted.data,
    };

    if (extracted.confidence >= CONFIDENCE_THRESHOLD) {
      highConfidence.push({ ...entry, verified: true });
    } else {
      lowConfidence.push({ ...entry, verified: true });
    }
  }

  return {
    highConfidence: postProcessEntries(highConfidence),
    lowConfidence: postProcessEntries(lowConfidence),
    errors,
    totalSegments: segments.length,
  };
}

// ── Main import function ────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.8;

/**
 * Import questions from a PDF buffer.
 *
 * @param pdfBuffer  Raw PDF file buffer
 * @param options    Import options
 * @param deps       Injectable dependencies (for testing)
 */
export async function importFromPdf(
  pdfBuffer: Buffer,
  options?: ImportOptions,
  deps?: PdfImportDeps,
): Promise<PdfImportResult> {
  const effectiveDeps = deps ?? createDefaultPdfDeps();

  log.info('Starting PDF import pipeline');

  const pipeline = await runPdfPipeline(pdfBuffer, options, effectiveDeps);

  // Step 4: Insert high-confidence questions
  const doInsert = effectiveDeps.insertBatch ?? defaultInsertBatch;
  let highResult: ImportResult = {
    total: pipeline.highConfidence.length,
    inserted: 0,
    duplicates: 0,
    errors: [],
  };
  if (pipeline.highConfidence.length > 0) {
    try {
      highResult = await doInsert(pipeline.highConfidence);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      highResult.errors.push({ row: 0, reason: `入库失败: ${message}` });
    }
  }

  // Step 5: Insert low-confidence questions
  let lowResult: ImportResult = {
    total: pipeline.lowConfidence.length,
    inserted: 0,
    duplicates: 0,
    errors: [],
  };
  if (pipeline.lowConfidence.length > 0) {
    try {
      lowResult = await doInsert(pipeline.lowConfidence);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      lowResult.errors.push({ row: 0, reason: `入库失败: ${message}` });
    }
  }

  const result: PdfImportResult = {
    total: pipeline.totalSegments,
    inserted: highResult.inserted + lowResult.inserted,
    duplicates: highResult.duplicates + lowResult.duplicates,
    errors: [...pipeline.errors, ...highResult.errors, ...lowResult.errors],
  };

  log.info(`PDF import complete: ${result.inserted} inserted, ${result.errors.length} errors`);
  return result;
}

// ── Importer factory ────────────────────────────────────────────────

import type { Importer } from './types';

export function createPdfImporter(pdfConfig?: PDFParserConfig): Importer<Buffer> {
  return {
    name: 'pdf',
    supportedExtensions: ['.pdf'],
    supportedMimeTypes: ['application/pdf'],

    async parse(source, options): Promise<ImportPipelineResult> {
      if (!Buffer.isBuffer(source)) {
        return {
          entries: [],
          rawErrors: [{ row: 0, reason: 'PDF 输入必须是 Buffer' }],
          meta: { totalRows: 0, parsedRows: 0 },
        };
      }

      const deps = createDefaultPdfDeps(pdfConfig);
      const pipeline = await runPdfPipeline(source, options, deps);

      return {
        entries: [...pipeline.highConfidence, ...pipeline.lowConfidence],
        rawErrors: pipeline.errors,
        meta: {
          totalRows: pipeline.totalSegments,
          parsedRows: pipeline.highConfidence.length + pipeline.lowConfidence.length,
        },
      };
    },
  };
}
