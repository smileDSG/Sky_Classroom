/**
 * B-004: Sky Classroom 全链路集成测试
 *
 * Validates the complete pipeline:
 *   topic → slides (B-001) → avatarSpeech (B-002) → PPTX export (B-003)
 *
 * Uses dependency injection — mock AICallFn and mock TTSGenerateFn.
 */
import { describe, it, expect, vi } from 'vitest';
import { generateSlides } from '@/lib/slides/slide-generator';
import {
  generateAvatarSpeech,
  extractTextFromSlides,
  splitSentences,
} from '@/lib/slides/avatar-speech';
import { exportCourseToPPTX } from '@/lib/export/course-exporter';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { TTSGenerateFn } from '@/lib/slides/avatar-speech';
import type { Slide } from '@/lib/types/slides';
import type { CourseExportConfig } from '@/lib/slides/types';

// ── Mock Data ────────────────────────────────────────────────────────

function makeFakeDeck(count: number) {
  const slides = [];
  for (let i = 0; i < count; i++) {
    const slideType = i === 0 ? 'cover' : i === count - 1 ? 'end' : 'content';
    slides.push({
      type: slideType,
      background: { type: 'solid' as const, color: i === 0 || i === count - 1 ? '#1e3a5f' : '#ffffff' },
      elements: [
        {
          type: 'text' as const,
          left: 60,
          top: 80,
          width: 880,
          height: 58,
          content: `<p style="font-size:24px;">${slideType === 'cover' ? '勾股定理' : slideType === 'end' ? '总结' : `第${i}课`}</p>`,
          defaultFontName: 'Microsoft YaHei',
          defaultColor: slideType === 'cover' || slideType === 'end' ? '#ffffff' : '#333333',
        },
      ],
    });
  }
  return { slides };
}

function makeMockAiCall(fakeDeckJson: string): { aiCall: AICallFn; lastUser: () => string } {
  let lastUser = '';
  const aiCall: AICallFn = async (_system, user) => {
    lastUser = user;
    return fakeDeckJson;
  };
  return { aiCall, lastUser: () => lastUser };
}

function makeFakeWav(): Uint8Array {
  const buf = new Uint8Array(1044);
  buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
  buf[8] = 0x57; buf[9] = 0x41; buf[10] = 0x56; buf[11] = 0x45;
  buf[12] = 0x66; buf[13] = 0x6d; buf[14] = 0x74; buf[15] = 0x20;
  buf[16] = 16; buf[20] = 1; buf[22] = 1;
  buf[24] = 0x80; buf[25] = 0xBB;
  buf[28] = 0x00; buf[29] = 0xEE; buf[30] = 0x02;
  buf[32] = 2; buf[34] = 16;
  buf[36] = 0x64; buf[37] = 0x61; buf[38] = 0x74; buf[39] = 0x61;
  return buf;
}

function makeMockTTS(): { ttsGenFn: TTSGenerateFn; calls: Array<{ text: string }> } {
  const calls: Array<{ text: string }> = [];
  const ttsGenFn: TTSGenerateFn = async (_config, text) => {
    calls.push({ text });
    return { audio: makeFakeWav(), format: 'wav' };
  };
  return { ttsGenFn, calls };
}

function makeFailingTTS(): TTSGenerateFn {
  return async () => { throw new Error('TTS unavailable'); };
}

const exportConfig: CourseExportConfig = {
  title: 'Integration Test',
  includeSlides: true,
  includeSpeakerNotes: false,
  includeKnowledgePoints: false,
  includeSimilarQuestions: false,
};

// ── Tests ────────────────────────────────────────────────────────────

describe('Sky Classroom 全链路集成测试', () => {
  it('全链路: generateSlides → extractText → splitSentences → generateAvatarSpeech → exportCourseToPPTX', async () => {
    const { aiCall } = makeMockAiCall(JSON.stringify(makeFakeDeck(4)));
    const { ttsGenFn } = makeMockTTS();

    // B-001
    const genResult = await generateSlides('勾股定理', { difficulty: 'junior' }, aiCall);
    expect(genResult.slides).toHaveLength(4);
    expect(genResult.generationTime).toBeGreaterThan(0);

    // Text extraction
    const text = extractTextFromSlides(genResult.slides);
    expect(text.length).toBeGreaterThan(0);

    // Sentence splitting
    const sentences = splitSentences(text);
    expect(sentences.length).toBeGreaterThan(0);

    // B-002
    const speech = await generateAvatarSpeech(genResult.slides, 'serious-professor', ttsGenFn);
    expect(speech.avatarId).toBe('serious-professor');
    expect(speech.segments.length).toBeGreaterThan(0);

    // B-003
    const exportResult = await exportCourseToPPTX(
      exportConfig,
      genResult.slides,
    );
    expect(exportResult.fileUrl).toMatch(/^blob:/);
    expect(exportResult.fileName).toContain('.pptx');
  }, 15000);

  it('幻灯片格式完整性: 每张 slide 具备所有必要字段', async () => {
    const { aiCall } = makeMockAiCall(JSON.stringify(makeFakeDeck(4)));

    const result = await generateSlides('Test', { difficulty: 'senior' }, aiCall);
    const slides = result.slides;

    for (const s of slides) {
      expect(s.id).toBeTruthy();
      expect(s.viewportSize).toBe(1000);
      expect(s.viewportRatio).toBe(0.5625);
      expect(s.theme).toBeDefined();
      expect(s.theme.fontName).toBe('Microsoft YaHei');
      expect(s.elements).toBeInstanceOf(Array);
      expect(s.type).toBeDefined();
    }

    expect(slides[0].type).toBe('cover');
    expect(slides[slides.length - 1].type).toBe('end');
    for (let i = 1; i < slides.length - 1; i++) {
      expect(slides[i].type).toBe('content');
    }
  });

  it('AvatarSpeech 结构完整性', async () => {
    const { aiCall } = makeMockAiCall(JSON.stringify(makeFakeDeck(4)));
    const { ttsGenFn } = makeMockTTS();

    const genResult = await generateSlides('Test', { difficulty: 'senior' }, aiCall);
    const speech = await generateAvatarSpeech(genResult.slides, 'gentle-senior', ttsGenFn);

    expect(speech.avatarId).toBe('gentle-senior');
    for (const seg of speech.segments) {
      expect(seg.text).toBeTruthy();
      expect(typeof seg.audioUrl).toBe('string');
      expect(seg.duration).toBeGreaterThanOrEqual(0);
    }
  });

  it('PPTX 导出进度回调覆盖所有 section', async () => {
    const { aiCall } = makeMockAiCall(JSON.stringify(makeFakeDeck(4)));
    const genResult = await generateSlides('Test', { difficulty: 'senior' }, aiCall);
    const onProgress = vi.fn();

    const exportResult = await exportCourseToPPTX(
      exportConfig,
      genResult.slides,
      undefined,
      undefined,
      onProgress,
    );

    expect(exportResult.fileName).toBe('Integration Test.pptx');
    const stages = onProgress.mock.calls.map((c) => c[0].stage);
    expect(stages).toContain('cover');
    expect(stages).toContain('toc');
    expect(stages).toContain('slides');
    expect(stages).toContain('end');
    expect(stages).toContain('packaging');
  }, 15000);

  it('Mock AI 返回空 slides 时全链路不崩溃', async () => {
    const { aiCall } = makeMockAiCall(JSON.stringify({ slides: [] }));

    const genResult = await generateSlides('Empty', { difficulty: 'senior' }, aiCall);
    expect(genResult.slides).toHaveLength(0);

    const text = extractTextFromSlides(genResult.slides);
    expect(text).toBe('');

    const sentences = splitSentences(text);
    expect(sentences).toHaveLength(0);

    const { ttsGenFn } = makeMockTTS();
    const speech = await generateAvatarSpeech(genResult.slides, 'serious-professor', ttsGenFn);
    expect(speech.segments).toHaveLength(0);

    const exportResult = await exportCourseToPPTX(exportConfig, genResult.slides);
    expect(exportResult.fileUrl).toMatch(/^blob:/);
  }, 15000);

  it('TTS 失败时优雅降级: audioUrl 为空串，PPTX 仍正常生成', async () => {
    const { aiCall } = makeMockAiCall(JSON.stringify(makeFakeDeck(4)));
    const genResult = await generateSlides('Test', { difficulty: 'senior' }, aiCall);

    const speech = await generateAvatarSpeech(genResult.slides, 'serious-professor', makeFailingTTS());
    expect(speech.segments.length).toBeGreaterThan(0);
    for (const seg of speech.segments) {
      expect(seg.text).toBeTruthy();
      expect(seg.audioUrl).toBe(''); // graceful degradation
    }

    const exportResult = await exportCourseToPPTX(exportConfig, genResult.slides);
    expect(exportResult.fileUrl).toMatch(/^blob:/);
  }, 15000);

  it('中文内容: 生成 → 分句 → TTS → 导出全流程正常', async () => {
    const chineseDeck = {
      slides: [
        { type: 'cover', background: { type: 'solid', color: '#1e3a5f' }, elements: [{ type: 'text', left: 60, top: 80, width: 880, height: 58, content: '<p>勾股定理。直角三角形的奥秘。</p>', defaultFontName: 'Microsoft YaHei', defaultColor: '#ffffff' }] },
        { type: 'content', background: { type: 'solid', color: '#fff' }, elements: [{ type: 'text', left: 60, top: 80, width: 880, height: 58, content: '<p>a²+b²=c²是几何基本公式。</p>', defaultFontName: 'Microsoft YaHei', defaultColor: '#333333' }] },
        { type: 'end', background: { type: 'solid', color: '#1e3a5f' }, elements: [{ type: 'text', left: 60, top: 80, width: 880, height: 58, content: '<p>谢谢观看！</p>', defaultFontName: 'Microsoft YaHei', defaultColor: '#ffffff' }] },
      ],
    };

    const { aiCall } = makeMockAiCall(JSON.stringify(chineseDeck));
    const { ttsGenFn, calls } = makeMockTTS();

    const genResult = await generateSlides('勾股定理', { difficulty: 'junior' }, aiCall);
    expect(genResult.slides).toHaveLength(3);

    const text = extractTextFromSlides(genResult.slides);
    expect(text).toContain('勾股定理');
    expect(text).toContain('直角三角形的奥秘');

    const speech = await generateAvatarSpeech(genResult.slides, 'humorous-underachiever', ttsGenFn);
    expect(speech.segments.length).toBeGreaterThan(0);
    // All TTS calls received Chinese text
    for (const c of calls) {
      expect(c.text).toBeTruthy();
    }

    const exportResult = await exportCourseToPPTX(exportConfig, genResult.slides);
    expect(exportResult.fileUrl).toMatch(/^blob:/);
  }, 15000);

  it('大数量幻灯片 (12 张): 全链路正常完成', async () => {
    const largeDeck = makeFakeDeck(12);
    const { aiCall } = makeMockAiCall(JSON.stringify(largeDeck));
    const { ttsGenFn } = makeMockTTS();

    const genResult = await generateSlides('Big Course', { difficulty: 'college' }, aiCall);
    expect(genResult.slides).toHaveLength(12);

    const speech = await generateAvatarSpeech(genResult.slides, 'serious-professor', ttsGenFn);
    expect(speech.segments.length).toBeGreaterThan(0);

    const exportResult = await exportCourseToPPTX(exportConfig, genResult.slides);
    expect(exportResult.fileUrl).toMatch(/^blob:/);
  }, 15000);

  it('进度回调完整性: 各阶段依次触发且顺序正确', async () => {
    const { aiCall } = makeMockAiCall(JSON.stringify(makeFakeDeck(4)));
    const { ttsGenFn } = makeMockTTS();
    const progressLog: string[] = [];

    const genResult = await generateSlides('Test', { difficulty: 'senior' }, aiCall);
    progressLog.push('slides-generated');

    await generateAvatarSpeech(genResult.slides, 'serious-professor', ttsGenFn);
    progressLog.push('speech-generated');

    await exportCourseToPPTX(
      exportConfig,
      genResult.slides,
      undefined,
      undefined,
      (p) => progressLog.push(`export:${p.stage}`),
    );
    progressLog.push('export-complete');

    expect(progressLog[0]).toBe('slides-generated');
    expect(progressLog[1]).toBe('speech-generated');
    expect(progressLog.some((l) => l === 'export:cover')).toBe(true);
    expect(progressLog.some((l) => l === 'export:packaging')).toBe(true);
    expect(progressLog[progressLog.length - 1]).toBe('export-complete');
  }, 15000);
});
