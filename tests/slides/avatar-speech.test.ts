/**
 * B-002: Avatar speech generation tests
 *
 * Validates avatar configs, text extraction, sentence splitting,
 * duration estimation, and TTS orchestration using dependency injection.
 */
import { describe, it, expect } from 'vitest';
import {
  generateAvatarSpeech,
  extractTextFromSlides,
  extractTextFromSlideElements,
  splitSentences,
  estimateAudioDuration,
} from '@/lib/slides/avatar-speech';
import { AVATAR_CONFIGS, getAvatarById } from '@/lib/slides/avatar-config';
import type { TTSGenerateFn, TTSGenResult } from '@/lib/slides/avatar-speech';
import type { Slide, PPTElement } from '@/lib/types/slides';

// ── Helpers ──────────────────────────────────────────────────────────

function makeFakeWav(): Uint8Array {
  const buf = new Uint8Array(1044);
  // RIFF header
  buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
  // WAVE
  buf[8] = 0x57; buf[9] = 0x41; buf[10] = 0x56; buf[11] = 0x45;
  // fmt chunk
  buf[12] = 0x66; buf[13] = 0x6d; buf[14] = 0x74; buf[15] = 0x20;
  buf[16] = 16; // chunk size
  buf[20] = 1;  // PCM
  buf[22] = 1;  // mono
  buf[24] = 0x80; buf[25] = 0xBB; // 48000 sample rate
  buf[28] = 0x00; buf[29] = 0xEE; buf[30] = 0x02; // byte rate
  buf[32] = 2;  // block align
  buf[34] = 16; // bits per sample
  // data chunk
  buf[36] = 0x64; buf[37] = 0x61; buf[38] = 0x74; buf[39] = 0x61;
  return buf;
}

function makeFakeTTS(): {
  ttsGenFn: TTSGenerateFn;
  calls: Array<{ config: Record<string, unknown>; text: string }>;
} {
  const calls: Array<{ config: Record<string, unknown>; text: string }> = [];
  const ttsGenFn: TTSGenerateFn = async (config, text) => {
    calls.push({ config, text });
    return { audio: makeFakeWav(), format: 'wav' };
  };
  return { ttsGenFn, calls };
}

function makeTextElement(overrides: Partial<PPTElement> = {}): PPTElement {
  return {
    id: 'text_1',
    type: 'text',
    left: 100,
    top: 80,
    width: 800,
    height: 58,
    content: '<p style="font-size:24px;">勾股定理</p>',
    defaultFontName: 'Microsoft YaHei',
    defaultColor: '#333333',
    rotate: 0,
    ...overrides,
  } as PPTElement;
}

function makeSlide(elements: PPTElement[], type: Slide['type'] = 'content'): Slide {
  return {
    id: `slide-${Math.random().toString(36).slice(2, 8)}`,
    viewportSize: 1000,
    viewportRatio: 0.5625,
    theme: {
      backgroundColor: '#ffffff',
      themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'],
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
    },
    elements,
    type,
  };
}

// ── Avatar Config Tests ──────────────────────────────────────────────

describe('AVATAR_CONFIGS', () => {
  it('has exactly 3 avatars', () => {
    expect(AVATAR_CONFIGS).toHaveLength(3);
  });

  it('all avatars have unique IDs', () => {
    const ids = AVATAR_CONFIGS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all avatars use VoxCPM provider', () => {
    for (const a of AVATAR_CONFIGS) {
      expect(a.voiceConfig.providerId).toBe('voxcpm-tts');
    }
  });

  it('all avatars have non-empty personality', () => {
    for (const a of AVATAR_CONFIGS) {
      expect(a.personality.length).toBeGreaterThan(10);
    }
  });

  it('all avatars have a name and avatarUrl', () => {
    for (const a of AVATAR_CONFIGS) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.avatarUrl).toContain('/avatars/');
    }
  });
});

describe('getAvatarById', () => {
  it('returns correct avatar for known ID', () => {
    const avatar = getAvatarById('serious-professor');
    expect(avatar).toBeDefined();
    expect(avatar!.name).toBe('严肃教授');
  });

  it('returns undefined for unknown ID', () => {
    expect(getAvatarById('nonexistent')).toBeUndefined();
  });
});

// ── Text Extraction Tests ────────────────────────────────────────────

describe('extractTextFromSlideElements', () => {
  it('strips HTML from text elements', () => {
    const el = makeTextElement({
      content: '<p style="font-size:24px;">勾股定理</p>',
    });
    const texts = extractTextFromSlideElements([el]);
    expect(texts).toEqual(['勾股定理']);
  });

  it('extracts text from shape elements with embedded text', () => {
    const shape = {
      id: 'shape_1', type: 'shape', left: 0, top: 0, width: 100, height: 20,
      viewBox: '0 0 100 20', path: 'M0 0 L100 0', fill: '#000',
      text: { content: '<p>重要概念</p>' },
      rotate: 0,
    } as unknown as PPTElement;
    const texts = extractTextFromSlideElements([shape]);
    expect(texts).toContain('重要概念');
  });

  it('extracts LaTeX expressions', () => {
    const latex: PPTElement = {
      id: 'latex_1', type: 'latex', left: 60, top: 200, width: 400, height: 70,
      latex: 'a^2 + b^2 = c^2', color: '#000',
      rotate: 0,
    } as PPTElement;
    const texts = extractTextFromSlideElements([latex]);
    expect(texts).toContain('a^2 + b^2 = c^2');
  });

  it('skips non-text elements (image, line, video, audio)', () => {
    const img: PPTElement = {
      id: 'img_1', type: 'image', left: 0, top: 0, width: 100, height: 100,
      src: 'https://example.com/img.png', fixedRatio: true,
      rotate: 0,
    } as PPTElement;
    const texts = extractTextFromSlideElements([img]);
    expect(texts).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(extractTextFromSlideElements([])).toEqual([]);
  });

  it('handles text elements with empty content', () => {
    const el = makeTextElement({ content: '<p></p>' });
    expect(extractTextFromSlideElements([el])).toEqual([]);
  });
});

describe('extractTextFromSlides', () => {
  it('joins text from multiple slides', () => {
    const s1 = makeSlide([
      makeTextElement({ content: '<p>第一章</p>' }),
    ]);
    const s2 = makeSlide([
      makeTextElement({ content: '<p>第二章</p>' }),
    ]);
    const text = extractTextFromSlides([s1, s2]);
    expect(text).toContain('第一章');
    expect(text).toContain('第二章');
  });

  it('skips slides with no extractable text', () => {
    const empty: PPTElement = {
      id: 'img_1', type: 'image', left: 0, top: 0, width: 100, height: 100,
      src: '', fixedRatio: true, rotate: 0,
    } as PPTElement;
    const s = makeSlide([empty]);
    expect(extractTextFromSlides([s])).toBe('');
  });
});

// ── Sentence Splitting Tests ─────────────────────────────────────────

describe('splitSentences', () => {
  it('splits on Chinese period', () => {
    const result = splitSentences('这是第一句。这是第二句。');
    expect(result).toEqual(['这是第一句。', '这是第二句。']);
  });

  it('splits on exclamation and question marks', () => {
    const result = splitSentences('注意！明白了吗？好的。');
    expect(result).toEqual(['注意！', '明白了吗？', '好的。']);
  });

  it('handles mixed Chinese/English punctuation', () => {
    const result = splitSentences('Hello world. 你好世界！');
    expect(result).toEqual(['Hello world.', '你好世界！']);
  });

  it('filters empty segments', () => {
    const result = splitSentences('你好。    。 世界。');
    expect(result).toEqual(['你好。', '世界。']);
  });

  it('handles text with no delimiters', () => {
    const result = splitSentences('这是一段没有标点的文字');
    expect(result).toEqual(['这是一段没有标点的文字']);
  });

  it('returns empty array for empty string', () => {
    expect(splitSentences('')).toEqual([]);
  });
});

// ── Duration Estimation Tests ────────────────────────────────────────

describe('estimateAudioDuration', () => {
  it('estimates WAV duration from data chunk size', () => {
    const wav = makeFakeWav();
    const duration = estimateAudioDuration(wav, 'wav');
    expect(duration).toBeGreaterThan(0);
  });

  it('returns 0 for non-WAV format', () => {
    expect(estimateAudioDuration(new Uint8Array(100), 'mp3')).toBe(0);
  });

  it('returns non-negative number', () => {
    const duration = estimateAudioDuration(makeFakeWav(), 'wav');
    expect(duration).toBeGreaterThanOrEqual(0);
  });
});

// ── Avatar Speech Generation Tests ───────────────────────────────────

describe('generateAvatarSpeech', () => {
  it('returns correct avatarId in result', async () => {
    const { ttsGenFn } = makeFakeTTS();
    const slides = [makeSlide([
      makeTextElement({ content: '<p>勾股定理是基本的几何定理。</p>' }),
    ])];

    const result = await generateAvatarSpeech(slides, 'serious-professor', ttsGenFn);
    expect(result.avatarId).toBe('serious-professor');
  });

  it('returns segments with text, audioUrl, duration fields', async () => {
    const { ttsGenFn } = makeFakeTTS();
    const slides = [makeSlide([
      makeTextElement({ content: '<p>勾股定理。直角三角形的性质。</p>' }),
    ])];

    const result = await generateAvatarSpeech(slides, 'serious-professor', ttsGenFn);
    expect(result.segments.length).toBeGreaterThan(0);

    for (const seg of result.segments) {
      expect(seg.text).toBeTruthy();
      expect(typeof seg.audioUrl).toBe('string');
      expect(seg.audioUrl).toContain('data:audio/wav;base64,');
      expect(seg.duration).toBeGreaterThanOrEqual(0);
    }
  });

  it('calls TTS for each sentence', async () => {
    const { ttsGenFn, calls } = makeFakeTTS();
    const slides = [makeSlide([
      makeTextElement({ content: '<p>第一句。第二句。第三句。</p>' }),
    ])];

    await generateAvatarSpeech(slides, 'serious-professor', ttsGenFn);
    expect(calls.length).toBe(3);
  });

  it('respects speed override option', async () => {
    const { ttsGenFn, calls } = makeFakeTTS();
    const slides = [makeSlide([
      makeTextElement({ content: '<p>勾股定理。</p>' }),
    ])];

    await generateAvatarSpeech(slides, 'serious-professor', ttsGenFn, { speed: 1.5 });
    expect(calls[0].config.speed).toBe(1.5);
  });

  it('uses avatar default speed when no override', async () => {
    const { ttsGenFn, calls } = makeFakeTTS();
    const slides = [makeSlide([
      makeTextElement({ content: '<p>勾股定理。</p>' }),
    ])];

    await generateAvatarSpeech(slides, 'serious-professor', ttsGenFn);
    expect(calls[0].config.speed).toBe(0.95);
  });

  it('handles empty slides gracefully', async () => {
    const { ttsGenFn, calls } = makeFakeTTS();
    const result = await generateAvatarSpeech([], 'serious-professor', ttsGenFn);
    expect(result.segments).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('handles slides with no text content', async () => {
    const { ttsGenFn, calls } = makeFakeTTS();
    const empty: PPTElement = {
      id: 'img_1', type: 'image', left: 0, top: 0, width: 100, height: 100,
      src: '', fixedRatio: true, rotate: 0,
    } as PPTElement;
    const slides = [makeSlide([empty])];
    const result = await generateAvatarSpeech(slides, 'serious-professor', ttsGenFn);
    expect(result.segments).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('throws for unknown avatarId', async () => {
    const { ttsGenFn } = makeFakeTTS();
    await expect(
      generateAvatarSpeech([], 'nonexistent', ttsGenFn),
    ).rejects.toThrow('Avatar not found');
  });

  it('handles TTS failure gracefully (empty audioUrl)', async () => {
    const failingTTS: TTSGenerateFn = async () => {
      throw new Error('TTS service unavailable');
    };
    const slides = [makeSlide([
      makeTextElement({ content: '<p>勾股定理。</p>' }),
    ])];

    const result = await generateAvatarSpeech(slides, 'serious-professor', failingTTS);
    expect(result.segments.length).toBeGreaterThan(0);
    for (const seg of result.segments) {
      expect(seg.text).toBeTruthy();
      expect(seg.audioUrl).toBe('');
    }
  });

  it('uses correct voiceConfig from avatar', async () => {
    const { ttsGenFn, calls } = makeFakeTTS();
    const slides = [makeSlide([
      makeTextElement({ content: '<p>测试。</p>' }),
    ])];

    await generateAvatarSpeech(slides, 'gentle-senior', ttsGenFn);
    expect(calls[0].config.voice).toBe('voxcpm:auto');
    expect(calls[0].config.speed).toBe(1.05);
  });
});
