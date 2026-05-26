/**
 * POST /api/sky/slides/generate
 * Slide generation endpoint — Template Pack only.
 */
import { NextRequest } from 'next/server';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';

export const maxDuration = 300;
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { generateWithTemplatePack } from '@/lib/slides/template-packs/generator';
import { generatePreviewFromPptx } from '@/lib/slides/pptx-preview';
import { createLogger } from '@/lib/logger';
import type { ModelInfo } from '@/lib/types/provider';

const log = createLogger('API:SkySlidesGenerate');

export async function POST(req: NextRequest) {
  let resolvedModel: string | undefined;
  try {
    const body = await req.json();
    const {
      topic,
      difficulty,
      templateId,
    } = body as {
      topic?: string;
      difficulty?: 'junior' | 'senior' | 'college';
      templateId?: string;
    };

    if (!topic || !topic.trim()) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required field: topic');
    }

    if (!templateId) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required field: templateId');
    }

    // ── Resolve model ──
    const { model: languageModel, modelInfo, modelString } = await resolveModelFromRequest(req, body);
    resolvedModel = modelString;

    // ── Template Pack mode (only mode) ──
    log.info(`Template pack mode: "${topic}" [template=${templateId}, model=${modelString}]`);
    const startTime = Date.now();

    const result = await generateWithTemplatePack({
      topic,
      difficulty: difficulty ?? '初中',
      templateId,
      languageModel,
      modelInfo,
    });

    if (!result.success) {
      log.error(`Template pack generation failed: ${result.error}`);
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, `生成失败: ${result.error || '请重试'}`);
    }

    const generationTime = Date.now() - startTime;

    // 直接生成预览图，避免前端二次请求
    const previewResult = await generatePreviewFromPptx(result.pptxUrl!);
    if (previewResult.success) {
      log.info(`Template pack generated with preview: ${previewResult.slideImages.length} images`);
    } else {
      log.warn(`Template pack preview failed: ${previewResult.error}`);
    }

    return apiSuccess({
      pptxUrl: result.pptxUrl,
      fileName: result.fileName,
      filledCount: result.filledCount,
      totalFields: result.totalFields,
      templateId,
      generationTime,
      slideImages: previewResult.success ? previewResult.slideImages : undefined,
      previewId: previewResult.success ? previewResult.previewId : undefined,
    });
  } catch (err) {
    log.error(`Slide generation failed [topic=${JSON.stringify(resolvedModel)}]:`, err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '幻灯片生成失败', err instanceof Error ? err.message : undefined);
  }
}
