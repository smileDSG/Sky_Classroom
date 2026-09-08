/**
 * Question Bank — Batch Import API
 *
 * POST /api/sky/question-bank/import
 *
 * Accepts multipart/form-data with a single `file` field.
 * Automatically detects format (json/csv/xlsx/pdf/image/docx) and routes to the
 * appropriate importer.
 *
 * Returns SSE stream with progress events:
 *   { type: 'progress', stage: 'parsing'|'validating'|'inserting', processed, total }
 *   { type: 'complete', result: ImportResult }
 *   { type: 'error', message: string }
 */

import { NextRequest } from 'next/server';
import mammoth from 'mammoth';
import { insertBatch } from '@/lib/question-bank/dao';
import {
  createJsonImporter,
  createCsvImporter,
  createXlsxImporter,
  importFromPdf,
} from '@/lib/question-bank/importers';
import type { ImportOptions, ImportPipelineResult } from '@/lib/question-bank/importers';
import type { ImportResult, QuestionBankInsert } from '@/lib/question-bank/types';
import { splitQuestions } from '@/lib/question-bank/importers/pdf-question-splitter';
import { extractStructure } from '@/lib/question-bank/importers/pdf-structure-extractor';
import { postProcessEntries } from '@/lib/question-bank/importers/post-processor';
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import type { ProviderId, ProviderType } from '@/lib/types/provider';
import { apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { requireAdmin } from '@/lib/server/auth/helpers';

const log = createLogger('API:QB:Import');

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ── Format detection ────────────────────────────────────────────────

function detectFormat(file: File): 'json' | 'csv' | 'xlsx' | 'pdf' | 'image' | 'docx' | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mime = file.type.toLowerCase();

  if (ext === 'json' || mime === 'application/json' || mime === 'text/json') return 'json';
  if (ext === 'csv' || mime === 'text/csv' || mime === 'application/csv') return 'csv';
  if (
    ext === 'xlsx' ||
    ext === 'xls' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel'
  )
    return 'xlsx';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || mime.startsWith('image/')) return 'image';
  if (
    ext === 'docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return 'docx';

  // Content sniffing fallback
  return null; // Will read first bytes after
}

async function sniffFormat(
  buffer: Buffer,
): Promise<'json' | 'csv' | 'xlsx' | 'pdf' | 'image' | 'docx' | null> {
  const header = buffer.slice(0, 8).toString('hex');
  // PDF magic: %PDF
  if (buffer.slice(0, 4).toString() === '%PDF') return 'pdf';
  // XLSX magic: PK (zip)
  if (header.startsWith('504b0304')) {
    // Could be xlsx or docx — look at inner structure via mime sniffing is hard,
    // but we can check the file extension again in the caller.
    return null;
  }
  // PNG magic
  if (header.startsWith('89504e47')) return 'image';
  // JPEG magic
  if (header.startsWith('ffd8ff')) return 'image';

  const text = buffer.slice(0, 1024).toString('utf-8').trim();
  if (text.startsWith('[') || text.startsWith('{')) return 'json';
  if (text.includes(',') && text.includes('\n')) return 'csv';

  return null;
}

// ── Image OCR helpers ───────────────────────────────────────────────

interface VisionModelConfig {
  providerId: ProviderId;
  modelId: string;
  apiKey: string;
  providerType: ProviderType;
}

function getVisionModels(): VisionModelConfig[] {
  const models: VisionModelConfig[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    models.push({
      providerId: 'anthropic' as ProviderId,
      modelId: 'claude-sonnet-4-6',
      apiKey: process.env.ANTHROPIC_API_KEY,
      providerType: 'anthropic' as ProviderType,
    });
  }
  if (process.env.QWEN_API_KEY) {
    models.push({
      providerId: 'qwen' as ProviderId,
      modelId: 'qwen3-vl-plus',
      apiKey: process.env.QWEN_API_KEY,
      providerType: 'openai' as ProviderType,
    });
  }
  if (process.env.GLM_API_KEY) {
    models.push({
      providerId: 'glm' as ProviderId,
      modelId: 'glm-5v-turbo',
      apiKey: process.env.GLM_API_KEY,
      providerType: 'openai' as ProviderType,
    });
  }
  return models;
}

const OCR_SYSTEM_PROMPT = `你是一个专业的数学题目识别助手。请逐字逐句识别图片中的所有内容。

要求：
1. 完整识别图片中的所有文字，不要遗漏任何一行
2. 保留题目编号（如 1.、①、(1) 等）
3. 所有数学公式和符号必须用 LaTeX 格式，用 $...$ 包裹行内公式，$$...$$ 包裹独立公式
4. 分数用 \\frac{分子}{分母}，根号用 \\sqrt{}，上下标用 ^ 和 _
5. 纯文字部分保持中文原文
6. 多道题之间用空行分隔
7. 无法看清的内容用 [?] 标记，不要猜测
8. 只输出识别到的题目文字和公式，不要添加解释或问候语`;

async function ocrImageToText(buffer: Buffer, mimeType: string): Promise<string> {
  const visionModels = getVisionModels();
  if (visionModels.length === 0) {
    throw new Error(
      '没有配置支持视觉的模型，请配置 ANTHROPIC_API_KEY 或 GLM_API_KEY 或 QWEN_API_KEY',
    );
  }

  const messages = [
    {
      role: 'user' as const,
      content: [
        { type: 'image' as const, image: buffer, mimeType },
        { type: 'text' as const, text: '请识别这张图片中的所有题目内容，包括文字和数学公式。' },
      ],
    },
  ];

  const MODEL_TIMEOUT = 25_000;

  const modelPromises = visionModels.map(async (visionConfig) => {
    const modelWithInfo = getModel(visionConfig);
    const llmPromise = callLLM(
      {
        model: modelWithInfo.model,
        messages: messages as any,
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
      'qb-import-ocr',
      { retries: 0 },
      undefined,
      OCR_SYSTEM_PROMPT,
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `${visionConfig.providerId}/${visionConfig.modelId} timed out after ${MODEL_TIMEOUT}ms`,
            ),
          ),
        MODEL_TIMEOUT,
      );
    });

    const result = await Promise.race([llmPromise, timeoutPromise]);
    const rawText = result.text || '';
    if (!rawText.trim()) {
      throw new Error(`${visionConfig.providerId}/${visionConfig.modelId}: 返回空白内容`);
    }
    return rawText;
  });

  try {
    const winner = await Promise.any(modelPromises);
    return winner;
  } catch (aggErr) {
    const errors = (aggErr as AggregateError).errors?.map((e: Error) => e.message) || [
      String(aggErr),
    ];
    throw new Error(
      `所有视觉模型均识别失败（已尝试 ${visionModels.length} 个模型）: ${errors.join('; ')}`,
    );
  }
}

// ── DOCX helper ─────────────────────────────────────────────────────

async function extractDocxToText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// ── Generic text import pipeline (shared by PDF/Image/DOCX) ─────────

const CONFIDENCE_THRESHOLD = 0.8;

async function runTextImportPipeline(text: string, options?: ImportOptions): Promise<ImportResult> {
  // Step 1: Split into question segments
  const segments = await splitQuestions(text, {
    callLLM: async (params, source) => callLLM(params as any, source),
  });

  if (segments.length === 0) {
    return {
      total: 0,
      inserted: 0,
      duplicates: 0,
      errors: [{ row: 0, reason: '未从文本中识别出题目' }],
    };
  }

  log.info(`Text pipeline: ${segments.length} segments found`);

  // Step 2: Extract structure for each segment
  const highConfidence: QuestionBankInsert[] = [];
  const lowConfidence: QuestionBankInsert[] = [];
  const errors: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const extracted = await extractStructure(segment.text, {
      callLLM: async (params, source) => callLLM(params as any, source),
    });

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

  // Step 3: Post-process and insert
  const processedHigh = postProcessEntries(highConfidence);
  const processedLow = postProcessEntries(lowConfidence);

  let highResult: ImportResult = {
    total: processedHigh.length,
    inserted: 0,
    duplicates: 0,
    errors: [],
  };
  if (processedHigh.length > 0) {
    try {
      highResult = await insertBatch(processedHigh);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      highResult.errors.push({ row: 0, reason: `入库失败: ${message}` });
    }
  }

  let lowResult: ImportResult = {
    total: processedLow.length,
    inserted: 0,
    duplicates: 0,
    errors: [],
  };
  if (processedLow.length > 0) {
    try {
      lowResult = await insertBatch(processedLow);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      lowResult.errors.push({ row: 0, reason: `入库失败: ${message}` });
    }
  }

  return {
    total: segments.length,
    inserted: highResult.inserted + lowResult.inserted,
    duplicates: highResult.duplicates + lowResult.duplicates,
    errors: [...errors, ...highResult.errors, ...lowResult.errors],
  };
}

// ── SSE helpers ─────────────────────────────────────────────────────

function formatEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}

`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// ── POST handler ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

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
      return apiError(
        'INVALID_FILE_TYPE',
        400,
        '无法识别文件格式，请上传 JSON/CSV/Excel/PDF/图片/Word 文件',
      );
    }

    log.info(`Importing ${format}: ${file.name} (${file.size} bytes)`);

    // ── JSON / CSV / XLSX ────────────────────────────────────────────
    if (format === 'json' || format === 'csv' || format === 'xlsx') {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const write = (data: string) => controller.enqueue(encoder.encode(data));

          try {
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
            }

            write(formatEvent('progress', { stage: 'parsing', processed: 1, total: 1 }));

            if (pipelineResult.rawErrors.length > 0 && pipelineResult.entries.length === 0) {
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

            write(
              formatEvent('progress', {
                stage: 'inserting',
                processed: 0,
                total: pipelineResult.entries.length,
              }),
            );

            const insertResult = await insertBatch(pipelineResult.entries);

            write(
              formatEvent('progress', {
                stage: 'inserting',
                processed: insertResult.inserted,
                total: pipelineResult.entries.length,
              }),
            );

            const result: ImportResult = {
              total: pipelineResult.meta.totalRows,
              inserted: insertResult.inserted,
              duplicates: insertResult.duplicates,
              errors: [...pipelineResult.rawErrors, ...insertResult.errors],
            };

            write(formatEvent('complete', { result }));
            controller.close();
          } catch (err: unknown) {
            log.error('Import stream error:', err);
            write(formatEvent('error', { message: errorMessage(err, '导入失败') }));
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

    // ── PDF ────────────────────────────────────────────────────────────
    if (format === 'pdf') {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const write = (data: string) => controller.enqueue(encoder.encode(data));

          try {
            write(formatEvent('progress', { stage: 'parsing', processed: 0, total: 1 }));

            const pdfResult = await importFromPdf(buffer);

            write(
              formatEvent('progress', {
                stage: 'inserting',
                processed: pdfResult.inserted,
                total: pdfResult.total,
              }),
            );

            write(formatEvent('complete', { result: pdfResult }));
            controller.close();
          } catch (err: unknown) {
            log.error('PDF import stream error:', err);
            write(formatEvent('error', { message: errorMessage(err, 'PDF 导入失败') }));
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

    // ── IMAGE ──────────────────────────────────────────────────────────
    if (format === 'image') {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const write = (data: string) => controller.enqueue(encoder.encode(data));

          try {
            write(formatEvent('progress', { stage: 'parsing', processed: 0, total: 1 }));

            const mimeType = file.type || 'image/png';
            const text = await ocrImageToText(buffer, mimeType);

            write(formatEvent('progress', { stage: 'parsing', processed: 1, total: 1 }));

            const result = await runTextImportPipeline(text);

            write(
              formatEvent('progress', {
                stage: 'inserting',
                processed: result.inserted,
                total: result.total,
              }),
            );
            write(formatEvent('complete', { result }));
            controller.close();
          } catch (err: unknown) {
            log.error('Image import stream error:', err);
            write(formatEvent('error', { message: errorMessage(err, '图片识别导入失败') }));
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

    // ── DOCX ───────────────────────────────────────────────────────────
    if (format === 'docx') {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const write = (data: string) => controller.enqueue(encoder.encode(data));

          try {
            write(formatEvent('progress', { stage: 'parsing', processed: 0, total: 1 }));

            const text = await extractDocxToText(buffer);

            write(formatEvent('progress', { stage: 'parsing', processed: 1, total: 1 }));

            const result = await runTextImportPipeline(text);

            write(
              formatEvent('progress', {
                stage: 'inserting',
                processed: result.inserted,
                total: result.total,
              }),
            );
            write(formatEvent('complete', { result }));
            controller.close();
          } catch (err: unknown) {
            log.error('DOCX import stream error:', err);
            write(formatEvent('error', { message: errorMessage(err, 'Word 文档导入失败') }));
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
  } catch (err: unknown) {
    log.error('Import API error:', err);
    return apiError('INTERNAL_ERROR', 500, '导入处理失败', errorMessage(err, '导入处理失败'));
  }
}
