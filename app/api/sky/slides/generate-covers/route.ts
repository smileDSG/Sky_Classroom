/**
 * POST /api/sky/slides/generate-covers
 *
 * Generate 12 cover design variants for a topic.
 * Returns DesignDNA + PNG thumbnail for each.
 */
import { NextRequest } from 'next/server';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import path from 'path';
import fs from 'fs/promises';

export const maxDuration = 180;
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { generateCovers } from '@/lib/slides/agent/cover-agent';
import { renderCoverPptx } from '@/lib/slides/agent/cover-renderer';
import { convertMultiplePptx } from '@/lib/slides/agent/png-converter';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:GenerateCovers');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, difficulty } = body as { topic?: string; difficulty?: string };

    if (!topic || !topic.trim()) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required field: topic');
    }

    const diff = difficulty || '高中';

    // Resolve model
    const { model: languageModel, modelString } = await resolveModelFromRequest(req, body);
    log.info(`Generating covers for "${topic}" [difficulty=${diff}, model=${modelString}]`);

    // Step 1: LLM → 12 DesignDNA
    const result = await generateCovers(topic.trim(), diff, languageModel);

    if (!result.success || !result.covers) {
      log.error(`Cover generation failed: ${result.error}`);
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, `封面生成失败: ${result.error || '请重试'}`);
    }

    // Step 2: Render cover PPTX + convert to PNG (parallel)
    const publicDir = path.resolve(process.cwd(), 'public');
    const coversDir = path.join(publicDir, 'temp', 'covers');
    await fs.mkdir(coversDir, { recursive: true });

    const coverTitle = topic.trim();
    const coverSubtitle = `${diff}教学课件`;

    const renderResults = await Promise.all(
      result.covers.map(async (cover) => {
        // Render PPTX
        const renderResult = await renderCoverPptx(
          cover.designDNA,
          coverTitle,
          coverSubtitle,
          coversDir,
          cover.id,
        );

        if (!renderResult.success || !renderResult.pptxPath) {
          return { ...cover, pngUrl: null, renderError: renderResult.error };
        }

        return { ...cover, pptxPath: renderResult.pptxPath, pngUrl: null };
      }),
    );

    // Convert all PPTX to PNG
    const pptxPaths = renderResults
      .filter((r) => (r as { pptxPath?: string }).pptxPath)
      .map((r) => (r as { pptxPath: string }).pptxPath);

    const pngResults = pptxPaths.length > 0
      ? await convertMultiplePptx(pptxPaths, coversDir)
      : [];

    // Map PNG results back to covers by matching basename
    const pngMap = new Map<string, string>();
    for (const pr of pngResults) {
      if (pr.success && pr.pngPath) {
        const base = path.basename(pr.pngPath, '.png');
        pngMap.set(base, '/temp/covers/' + path.basename(pr.pngPath));
      }
    }

    const covers = renderResults.map((r) => {
      const pptxPath = (r as { pptxPath?: string }).pptxPath;
      const baseName = pptxPath ? path.basename(pptxPath, '.pptx') : '';
      return {
        id: r.id,
        styleName: r.styleName,
        pngUrl: pngMap.get(baseName) || null,
        recommended: r.recommended,
        designParams: r.designDNA,
      };
    });

    return apiSuccess({ covers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log.error('Generate covers failed:', msg, stack);
    console.error('=== Generate Covers 500 Error ===');
    console.error('Message:', msg);
    console.error('Stack:', stack);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, `封面生成失败: ${msg}`);
  }
}
