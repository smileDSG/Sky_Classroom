/**
 * Sky Classroom — Avatar Speech Generator (B-002)
 *
 * Extracts text from slides, splits into sentences, and generates
 * TTS audio for each sentence using dependency-injected TTS function.
 */
import type { Slide, PPTElement } from '@/lib/types/slides';
import type { AvatarConfig, AvatarSpeech } from '@/lib/slides/types';
import { getAvatarById } from './avatar-config';
import { createLogger } from '@/lib/logger';

const log = createLogger('AvatarSpeech');

// ── TTS Injection Type ──────────────────────────────────────────────

/** Result of a single TTS generation call (structurally matches generateTTS) */
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

// ── Text Extraction ─────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g;

function stripHtml(html: string): string {
  return html.replace(HTML_TAG_RE, '').trim();
}

export function extractTextFromSlideElements(elements: PPTElement[]): string[] {
  const texts: string[] = [];

  for (const el of elements) {
    switch (el.type) {
      case 'text': {
        const t = stripHtml(el.content);
        if (t) texts.push(t);
        break;
      }
      case 'shape': {
        const shapeEl = el as { text?: { content: string } };
        if (shapeEl.text?.content) {
          const t = stripHtml(shapeEl.text.content);
          if (t) texts.push(t);
        }
        break;
      }
      case 'table': {
        const tableEl = el as { data?: { text: string }[][] };
        if (tableEl.data) {
          for (const row of tableEl.data) {
            for (const cell of row) {
              if (cell.text?.trim()) texts.push(cell.text.trim());
            }
          }
        }
        break;
      }
      case 'latex': {
        const latexEl = el as { latex?: string };
        if (latexEl.latex?.trim()) texts.push(latexEl.latex.trim());
        break;
      }
      case 'code': {
        const codeEl = el as { lines?: { content: string }[] };
        if (codeEl.lines) {
          const code = codeEl.lines.map((l) => l.content).join(' ');
          if (code.trim()) texts.push(code);
        }
        break;
      }
    }
  }

  return texts;
}

export function extractTextFromSlides(slides: Slide[]): string {
  return slides
    .map((slide) => extractTextFromSlideElements(slide.elements).join(' '))
    .filter((t) => t.trim().length > 0)
    .join('\n');
}

// ── Sentence Splitting ──────────────────────────────────────────────

const SENTENCE_END_RE = /(?<=[。！？!?.])\s*/;
const PUNCT_ONLY_RE = /^[。！？!?.]+$/;

export function splitSentences(text: string): string[] {
  if (!text) return [];
  const segments = text
    .replace(/\n+/g, '\n')
    .split(SENTENCE_END_RE);
  return segments
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !PUNCT_ONLY_RE.test(s));
}

// ── Duration Estimation ─────────────────────────────────────────────

export function estimateAudioDuration(audio: Uint8Array, format: string): number {
  if (format === 'wav' && audio.length > 44) {
    // WAV: data chunk starts at byte 44, PCM 16-bit mono at 24000 Hz
    const dataSize = audio.length - 44;
    const bytesPerSample = 2; // 16-bit
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

  const text = extractTextFromSlides(slides);
  if (!text.trim()) {
    return { avatarId, segments: [] };
  }

  const sentences = splitSentences(text);
  const speed = options?.speed ?? avatar.voiceConfig.speed;
  const concurrency = options?.concurrency ?? 3;

  const segments: AvatarSpeech['segments'] = [];

  // Process sentences with bounded concurrency
  for (let i = 0; i < sentences.length; i += concurrency) {
    const batch = sentences.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (sentence): Promise<AvatarSpeech['segments'][number]> => {
        try {
          const result = await ttsGenFn(
            {
              providerId: avatar.voiceConfig.providerId,
              voice: avatar.voiceConfig.voiceId,
              speed,
            },
            sentence,
          );

          const audioBuffer = Buffer.from(result.audio);
          const duration = estimateAudioDuration(result.audio, result.format);

          return {
            text: sentence,
            audioUrl: `data:audio/${result.format};base64,${audioBuffer.toString('base64')}`,
            duration,
          };
        } catch (err) {
          log.warn(`TTS failed for sentence: "${sentence.substring(0, 50)}..."`, err);
          return {
            text: sentence,
            audioUrl: '',
            duration: Math.round(sentence.length * 65),
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
