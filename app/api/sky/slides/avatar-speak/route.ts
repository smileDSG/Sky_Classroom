/**
 * POST /api/sky/slides/avatar-speak
 * Avatar speech generation — extracts text from slides and synthesizes TTS audio.
 */
import { NextRequest } from 'next/server';
import { generateTTS } from '@/lib/audio/tts-providers';
import { resolveTTSApiKey, resolveTTSBaseUrl } from '@/lib/server/provider-config';
import { generateAvatarSpeech, getAvatarById } from '@/lib/slides';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import type { TTSGenerateFn } from '@/lib/slides/avatar-speech';

const log = createLogger('API:SkyAvatarSpeak');

export async function POST(req: NextRequest) {
  let avatarId: string | undefined;
  try {
    const body = await req.json();
    const { slides, avatarId: reqAvatarId, speed } = body;
    avatarId = reqAvatarId;

    if (!slides || !Array.isArray(slides) || !avatarId) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required fields: slides (array), avatarId (string)',
      );
    }

    const avatar = getAvatarById(avatarId);
    if (!avatar) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, `Avatar not found: ${avatarId}`);
    }

    // Build the TTS injection closure with server-side credential resolution
    const ttsGenFn: TTSGenerateFn = async (config, text) => {
      const apiKey = resolveTTSApiKey(config.providerId);
      const baseUrl = resolveTTSBaseUrl(config.providerId);

      const result = await generateTTS(
        {
          providerId: config.providerId as never,
          voice: config.voice,
          speed: config.speed,
          apiKey,
          baseUrl,
        },
        text,
      );

      return { audio: result.audio, format: result.format };
    };

    log.info(`Generating avatar speech: avatar="${avatarId}", slides=${slides.length}`);

    const speech = await generateAvatarSpeech(slides, avatarId, ttsGenFn, { speed });

    const totalDuration = speech.segments.reduce((sum, s) => sum + s.duration, 0);

    return apiSuccess({
      avatarId: speech.avatarId,
      segments: speech.segments,
      totalDuration,
    });
  } catch (err) {
    log.error(`Avatar speak failed [avatarId=${avatarId ?? 'unknown'}]:`, err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '讲解音频生成失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
