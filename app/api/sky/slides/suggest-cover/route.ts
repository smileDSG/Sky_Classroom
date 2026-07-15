/**
 * POST /api/sky/slides/suggest-cover
 *
 * Smart cover recommendation — single LLM call for style discovery,
 * then render cover PPTX + convert to PNG.
 * Returns recommended cover + 3 alternative directions.
 */
import { NextRequest } from 'next/server';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import path from 'path';
import fs from 'fs/promises';

export const maxDuration = 180;
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { suggestCoverStyle } from '@/lib/slides/agent/suggest-cover-agent';
import { renderCoverPptx } from '@/lib/slides/agent/cover-renderer';
import { convertPptxToPng } from '@/lib/slides/agent/png-converter';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SuggestCover');

export async function POST(req: NextRequest) {
  const reqStart = Date.now();
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      log.error(`[API:SuggestCover] request body parse failed: ${msg}`);
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '请求格式错误', msg);
    }
    const { topic, difficulty } = body as { topic?: string; difficulty?: string };

    if (!topic || !topic.trim()) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required field: topic');
    }

    const diff = difficulty || '高中';
    log.info(`[API:SuggestCover] request — topic="${topic.trim()}" difficulty="${diff}"`);

    // Resolve model
    const { model: languageModel, modelString } = await resolveModelFromRequest(req, body);
    log.info(`[API:SuggestCover] using model=${modelString}`);

    // Step 1: LLM → style recommendation
    let styleResult: Awaited<ReturnType<typeof suggestCoverStyle>>;
    const styleStart = Date.now();
    try {
      styleResult = await suggestCoverStyle(topic.trim(), diff, languageModel);
    } catch (styleErr) {
      const msg = styleErr instanceof Error ? styleErr.message : String(styleErr);
      log.error(`[API:SuggestCover] style recommendation threw: ${msg}`);
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '风格推荐异常', msg);
    }
    log.info(`[API:SuggestCover] style recommendation took ${Date.now() - styleStart}ms, success=${styleResult.success}`);

    if (!styleResult.success || !styleResult.designDNA) {
      log.error(`[API:SuggestCover] style recommendation failed: ${styleResult.error}`);
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, `风格推荐失败: ${styleResult.error || '请重试'}`);
    }

    // Step 2: Best-effort server preview. The smart-cover UI renders from
    // designDNA, so PPTX/LibreOffice preview failures should not block it.
    const publicDir = path.resolve(process.cwd(), 'public');
    const coversDir = path.join(publicDir, 'temp', 'covers');
    await fs.mkdir(coversDir, { recursive: true });

    const coverTitle = topic.trim();
    const coverSubtitle = `${diff}教学课件`;
    const designDNA = styleResult.designDNA;
    let pngUrl: string | null = null;
    let previewError: string | undefined;

    const renderStart = Date.now();
    const renderResult = await renderCoverPptx(
      designDNA,
      coverTitle,
      coverSubtitle,
      coversDir,
      0, // index 0 for suggested cover
    );
    log.info(`[API:SuggestCover] PPTX render took ${Date.now() - renderStart}ms, success=${renderResult.success}`);

    if (!renderResult.success || !renderResult.pptxPath) {
      previewError = renderResult.error || 'PPTX preview render failed';
      log.warn(`[API:SuggestCover] PPTX preview unavailable: ${previewError}`);
    } else {
      // Step 3: Convert to PNG
      const pngStart = Date.now();
      const pngResult = await convertPptxToPng(renderResult.pptxPath, coversDir);
      log.info(`[API:SuggestCover] PNG conversion took ${Date.now() - pngStart}ms, success=${pngResult.success}`);

      if (pngResult.success && pngResult.pngPath) {
        pngUrl = '/temp/covers/' + path.basename(pngResult.pngPath);
      } else {
        previewError = pngResult.error || 'PNG preview conversion failed';
        log.warn(`[API:SuggestCover] PNG preview unavailable: ${previewError}`);
      }
    }
    const totalDuration = Date.now() - reqStart;

    log.info(`[API:SuggestCover] complete in ${totalDuration}ms — png=${pngUrl}, style=${designDNA.styleName}`);

    return apiSuccess({
      cover: {
        pngUrl,
        previewAvailable: Boolean(pngUrl),
        ...(previewError ? { previewError } : {}),
        designDNA,
      },
      alternatives: styleResult.alternatives || [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[API:SuggestCover] unhandled error: ${msg}`);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '推荐失败', msg);
  }
}
