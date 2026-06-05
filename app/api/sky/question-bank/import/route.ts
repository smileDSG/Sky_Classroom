/**
 * Question Bank — Batch Import API
 *
 * POST /api/sky/question-bank/import
 *
 * Accepts multipart/form-data with a single `file` field.
 * Automatically detects format (json/csv/xlsx/pdf) and routes to the
 * appropriate importer.
 *
 * Returns SSE stream with progress events:
 *   { type: 'progress', stage: 'parsing'|'validating'|'inserting', processed, total }
 *   { type: 'complete', result: ImportResult }
 *   { type: 'error', message: string }
 */

import { NextRequest } from 'next/server';
import { insertBatch } from '@/lib/question-bank/dao';
import {
  createJsonImporter,
  createCsvImporter,
  createXlsxImporter,
  createPdfImporter,
  importFromPdf,
} from '@/lib/question-bank/importers';
import type { ImportOptions, ImportPipelineResult } from '@/lib/question-bank/importers';
import type { ImportResult } from '@/lib/question-bank/types';
import { apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:QB:Import');

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ── Format detection ────────────────────────────────────────────────

function detectFormat(file: File): 'json' | 'csv' | 'xlsx' | 'pdf' | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mime = file.type.toLowerCase();

  if (ext === 'json' || mime === 'application/json' || mime === 'text/json') return 'json';
  if (ext === 'csv' || mime === 'text/csv' || mime === 'application/csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls' || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.ms-excel') return 'xlsx';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';

  // Content sniffing fallback
  return null; // Will read first bytes after
}

async function sniffFormat(buffer: Buffer): Promise<'json' | 'csv' | 'xlsx' | 'pdf' | null> {
  const header = buffer.slice(0, 8).toString('hex');
  // PDF magic: %PDF
  if (buffer.slice(0, 4).toString() === '%PDF') return 'pdf';
  // XLSX magic: PK (zip)
  if (header.startsWith('504b0304')) return 'xlsx';

  const text = buffer.slice(0, 1024).toString('utf-8').trim();
  if (text.startsWith('[') || text.startsWith('{')) return 'json';
  if (text.includes(',') && text.includes('\n')) return 'csv';

  return null;
}

// ── SSE helpers ─────────────────────────────────────────────────────

function formatEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}

`;
}

// ── POST handler ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '请上传文件（字段名：file）');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return apiError('FILE_TOO_LARGE', 413, `文件大小超过限制 (${MAX_FILE_SIZE_MB}MB)`);
    }

    let format = detectFormat(file);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!format) {
      format = await sniffFormat(buffer);
    }

    if (!format) {
      return apiError('INVALID_FILE_TYPE', 400, '无法识别文件格式，请上传 JSON/CSV/Excel/PDF 文件');
    }

    log.info(`Importing ${format}: ${file.name} (${file.size} bytes)`);

    // For non-PDF formats, use SSE streaming via ReadableStream
    if (format !== 'pdf') {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const write = (data: string) => controller.enqueue(encoder.encode(data));

          try {
            // Stage 1: Parse
            write(formatEvent('progress', { stage: 'parsing', processed: 0, total: 1 }));

            const options: ImportOptions = { maxRows: 10000 };
            let pipelineResult: ImportPipelineResult;

            switch (format) {
              case 'json': {
                const text = buffer.toString('utf-8');
                pipelineResult = await createJsonImporter().parse(text, options);
                break;
              }
              case 'csv': {
                const text = buffer.toString('utf-8');
                pipelineResult = await createCsvImporter().parse(text, options);
                break;
              }
              case 'xlsx': {
                pipelineResult = await createXlsxImporter().parse(buffer, options);
                break;
              }
              default: {
                write(formatEvent('error', { message: '不支持的文件格式' }));
                controller.close();
                return;
              }
            }

            write(formatEvent('progress', { stage: 'parsing', processed: 1, total: 1 }));

            if (pipelineResult.rawErrors.length > 0 && pipelineResult.entries.length === 0) {
              // All rows failed validation
              const result: ImportResult = {
                total: pipelineResult.meta.totalRows,
                inserted: 0,
                duplicates: 0,
                errors: pipelineResult.rawErrors,
              };
              write(formatEvent('complete', { result }));
              controller.close();
              return;
            }

            // Stage 2: Insert
            write(formatEvent('progress', { stage: 'inserting', processed: 0, total: pipelineResult.entries.length }));

            const insertResult = await insertBatch(pipelineResult.entries);

            write(formatEvent('progress', { stage: 'inserting', processed: insertResult.inserted, total: pipelineResult.entries.length }));

            const result: ImportResult = {
              total: pipelineResult.meta.totalRows,
              inserted: insertResult.inserted,
              duplicates: insertResult.duplicates,
              errors: [...pipelineResult.rawErrors, ...insertResult.errors],
            };

            write(formatEvent('complete', { result }));
            controller.close();
          } catch (err: any) {
            log.error('Import stream error:', err);
            write(formatEvent('error', { message: err.message ?? '导入失败' }));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // PDF format: use importFromPdf directly (it handles its own LLM streaming internally)
    // Still wrap in SSE for consistent frontend experience
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const write = (data: string) => controller.enqueue(encoder.encode(data));

        try {
          write(formatEvent('progress', { stage: 'parsing', processed: 0, total: 1 }));

          const pdfResult = await importFromPdf(buffer);

          write(formatEvent('progress', { stage: 'inserting', processed: pdfResult.inserted, total: pdfResult.total }));

          write(formatEvent('complete', { result: pdfResult }));
          controller.close();
        } catch (err: any) {
          log.error('PDF import stream error:', err);
          write(formatEvent('error', { message: err.message ?? 'PDF 导入失败' }));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    log.error('Import API error:', err);
    return apiError('INTERNAL_ERROR', 500, '导入处理失败', err.message);
  }
}
