/**
 * POST /api/sky/slides/generate
 * Slide generation endpoint — generates a multi-slide deck from a teaching topic.
 */
import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';

export const maxDuration = 300;
import { generateSlides } from '@/lib/slides';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import type { AICallFn } from '@/lib/generation/pipeline-types';

const log = createLogger('API:SkySlidesGenerate');

export async function POST(req: NextRequest) {
  let resolvedModel: string | undefined;
  try {
    const body = await req.json();
    const {
      topic,
      difficulty,
      slideCount,
      language,
    } = body as {
      topic?: string;
      difficulty?: 'junior' | 'senior' | 'college';
      slideCount?: number;
      language?: string;
    };

    if (!topic || !topic.trim()) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required field: topic',
      );
    }

    // ── Resolve model ──
    const { model: languageModel, modelInfo, modelString } = await resolveModelFromRequest(req, body);
    resolvedModel = modelString;

    // ── Build AI call wrapper ──
    const aiCall: AICallFn = async (system: string, user: string) => {
      const result = await callLLM(
        {
          model: languageModel,
          system,
          prompt: user,
          maxOutputTokens: modelInfo?.outputWindow ?? 16384,
        },
        'sky-slides-generate',
      );
      return result.text;
    };

    // ── Generate ──
    log.info(`Generating slides for topic: "${topic}" [model=${modelString}]`);

    const result = await generateSlides(
      topic,
      { topic, difficulty, slideCount, language },
      aiCall,
    );

    return apiSuccess({
      slides: result.slides,
      generationTime: result.generationTime,
    });
  } catch (err) {
    log.error(
      `Slide generation failed [topic=${JSON.stringify(resolvedModel)}]:`,
      err,
    );
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '幻灯片生成失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
