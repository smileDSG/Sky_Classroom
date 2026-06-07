/**
 * Sky Classroom — Avatar Speech Generator (B-002)
 *
 * Builds narration scripts from slides using the speech-script builder,
 * then generates TTS audio for each segment with dependency-injected TTS.
 */
import type { Slide } from '@/lib/types/slides';
import type { AvatarSpeech } from '@/lib/slides/types';
import type { SpeechSegment } from './speech-script';
import { buildFullScript } from './speech-script';
import { getAvatarById } from './avatar-config';
import { createLogger } from '@/lib/logger';

const log = createLogger('AvatarSpeech');

// ── TTS Injection Type ──────────────────────────────────────────────

/** Result of a single TTS generation call */
export interface TTSGenResult {
  audio: Uint8Array;
  format: string;
}

/** Injection type — matches generateTTS(config, text) signature */
export type TTSGenerateFn = (
  config: { providerId: string; voice: string; speed?: number },
  text: string,
) => Promise<TTSGenResult>;

// ── Options ──────────────────────────────────────────────────────────

export interface AvatarSpeechOptions {
  speed?: number;
  concurrency?: number;
}

// ── Re-exports (backward compat) ─────────────────────────────────────

export {
  buildSlideScript,
  buildFullScript,
} from './speech-script';
export type { SpeechSegment, SlideScript } from './speech-script';

// ── Text extraction helpers (kept for backward compat, deprecated) ───

/** @deprecated Use buildSlideScript() from speech-script.ts instead */
export function extractTextFromSlides(slides: Slide[]): string {
  const script = buildFullScript(slides);
  return script.flatMap((s) => s.segments.map((seg) => seg.text)).join('\n');
}

/** @deprecated Use buildSlideScript() from speech-script.ts instead */
export function extractTextFromSlideElements(): string[] {
  return [];
}

/** @deprecated Use SpeechSegment from speech-script.ts instead */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  return text
    .replace(/\n+/g, '\n')
    .split(/(?<=[。！？!?.])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^[。！？!?.]+$/.test(s));
}

// ── Duration Estimation ─────────────────────────────────────────────

export function estimateAudioDuration(audio: Uint8Array, format: string): number {
  if (format === 'wav' && audio.length > 44) {
    const dataSize = audio.length - 44;
    const bytesPerSample = 2;
    const sampleRate = 24000;
    return Math.round((dataSize / (sampleRate * bytesPerSample)) * 1000);
  }
  return 0;
}

// ── Main ────────────────────────────────────────────────────────────

export async function generateAvatarSpeech(
  slides: Slide[],
  avatarId: string,
  ttsGenFn: TTSGenerateFn,
  options?: AvatarSpeechOptions,
): Promise<AvatarSpeech> {
  const avatar = getAvatarById(avatarId);
  if (!avatar) {
    throw new Error(`Avatar not found: ${avatarId}`);
  }

  // Build structured narration script with highlight markers
  const script = buildFullScript(slides);
  const speechSegments: SpeechSegment[] = script.flatMap((s) => s.segments);

  if (speechSegments.length === 0) {
    return { avatarId, segments: [] };
  }

  const speed = options?.speed ?? avatar.voiceConfig.speed;
  const concurrency = options?.concurrency ?? 3;

  const segments: AvatarSpeech['segments'] = [];

  for (let i = 0; i < speechSegments.length; i += concurrency) {
    const batch = speechSegments.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (seg): Promise<AvatarSpeech['segments'][number]> => {
        try {
          const result = await ttsGenFn(
            {
              providerId: avatar.voiceConfig.providerId,
              voice: avatar.voiceConfig.voiceId,
              speed,
            },
            seg.text,
          );

          const audioBuffer = Buffer.from(result.audio);
          const duration = estimateAudioDuration(result.audio, result.format);

          return {
            text: seg.text,
            audioUrl: `data:audio/${result.format};base64,${audioBuffer.toString('base64')}`,
            duration,
            highlightElementId: seg.highlightElementId ?? undefined,
            slideIndex: seg.slideIndex,
          };
        } catch (err) {
          log.warn(`TTS failed for: "${seg.text.substring(0, 50)}..."`, err);
          return {
            text: seg.text,
            audioUrl: '',
            duration: Math.round(seg.text.length * 65),
            highlightElementId: seg.highlightElementId ?? undefined,
            slideIndex: seg.slideIndex,
          };
        }
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        segments.push(r.value);
      } else {
        log.warn('TTS batch item rejected', r.reason);
      }
    }
  }

  return { avatarId, segments };
}
