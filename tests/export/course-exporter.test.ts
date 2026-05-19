/**
 * B-003: Course PPTX exporter tests
 *
 * Validates course PPTX generation structure, progress reporting,
 * and graceful handling of missing data.
 */
import { describe, it, expect, vi } from 'vitest';
import { exportCourseToPPTX } from '@/lib/export/course-exporter';
import type { CourseExportConfig } from '@/lib/slides/types';
import type { Slide } from '@/lib/types/slides';

// ── Helpers ──────────────────────────────────────────────────────────

function makeTextSlide(
  content: string,
  type: Slide['type'] = 'content',
): Slide {
  return {
    id: `slide-${Math.random().toString(36).slice(2, 8)}`,
    viewportSize: 1000,
    viewportRatio: 0.5625,
    theme: {
      backgroundColor: '#ffffff',
      themeColors: ['#5b9bd5'],
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
    },
    elements: [
      {
        id: 'text_1',
        type: 'text',
        left: 60,
        top: 80,
        width: 880,
        height: 58,
        content: `<p style="font-size:24px;">${content}</p>`,
        defaultFontName: 'Microsoft YaHei',
        defaultColor: '#333333',
        rotate: 0,
      },
    ],
    type,
  } as Slide;
}

const defaultConfig: CourseExportConfig = {
  title: 'Test Course',
  includeSlides: true,
  includeSpeakerNotes: false,
  includeKnowledgePoints: true,
  includeSimilarQuestions: true,
};

// ── Tests ────────────────────────────────────────────────────────────

describe('exportCourseToPPTX', () => {
  it('returns valid CourseExportResult with blob URL', async () => {
    const slides = [makeTextSlide('Slide 1', 'cover'), makeTextSlide('Slide 2'), makeTextSlide('Slide 3', 'end')];
    const result = await exportCourseToPPTX(defaultConfig, slides);

    expect(result.fileUrl).toMatch(/^blob:/);
    expect(result.fileName).toBe('Test Course.pptx');
  }, 15000);

  // NOTE: blob size/magic bytes tests are skipped in jsdom because
  // pptxgenjs.write() blob content is not retrievable via fetch(blobUrl)
  // in the jsdom environment. These would pass in a real browser.

  it('invokes progress callback for each stage', async () => {
    const slides = [makeTextSlide('Slide 1')];
    const onProgress = vi.fn();

    await exportCourseToPPTX(
      { ...defaultConfig, includeKnowledgePoints: false },
      slides,
      undefined,
      undefined,
      onProgress,
    );

    // cover → toc → slides (1) → end → packaging = 5 calls
    expect(onProgress).toHaveBeenCalledTimes(5);
    const stages = onProgress.mock.calls.map((c) => c[0].stage);
    expect(stages).toContain('cover');
    expect(stages).toContain('toc');
    expect(stages).toContain('slides');
    expect(stages).toContain('end');
    expect(stages).toContain('packaging');
  }, 15000);

  it('handles empty slides array gracefully', async () => {
    const result = await exportCourseToPPTX(defaultConfig, []);

    expect(result.fileUrl).toMatch(/^blob:/);
    // With no slides but includeSlides=true: cover → end → packaging
    expect(result.fileName).toBe('Test Course.pptx');
  }, 15000);

  it('skips TOC and slides when includeSlides is false', async () => {
    const slides = [makeTextSlide('Slide 1')];
    const onProgress = vi.fn();

    await exportCourseToPPTX(
      { ...defaultConfig, includeSlides: false },
      slides,
      undefined,
      undefined,
      onProgress,
    );

    const stages = onProgress.mock.calls.map((c) => c[0].stage);
    expect(stages).not.toContain('toc');
    expect(stages).not.toContain('slides');
  }, 15000);

  it('skips knowledge section when includeKnowledgePoints is false', async () => {
    const kp = [{ name: 'Point 1', description: 'Desc', difficulty: 'easy' as const }];
    const onProgress = vi.fn();

    await exportCourseToPPTX(
      { ...defaultConfig, includeKnowledgePoints: false },
      [makeTextSlide('Slide 1')],
      kp,
      undefined,
      onProgress,
    );

    const stages = onProgress.mock.calls.map((c) => c[0].stage);
    expect(stages).not.toContain('knowledge');
  }, 15000);

  it('handles missing knowledge points gracefully', async () => {
    const slides = [makeTextSlide('Content')];

    // includeKnowledgePoints=true but pass undefined
    const result = await exportCourseToPPTX(
      { ...defaultConfig, includeKnowledgePoints: true },
      slides,
      undefined,
      undefined,
    );

    expect(result.fileUrl).toMatch(/^blob:/);
  }, 15000);

  it('respects avatarName in config', async () => {
    const slides = [makeTextSlide('Content')];
    const result = await exportCourseToPPTX(
      { ...defaultConfig, avatarName: '严肃教授' },
      slides,
    );

    expect(result.fileName).toContain('Test Course');
    expect(result.fileUrl).toMatch(/^blob:/);
  }, 15000);

  it('handles slides with shape element', async () => {
    const slide: Slide = {
      id: 'slide-shape',
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: { backgroundColor: '#fff', themeColors: ['#000'], fontColor: '#000', fontName: 'Arial' },
      elements: [
        {
          id: 'shape_1', type: 'shape', left: 100, top: 100, width: 200, height: 100,
          viewBox: '0 0 200 100', path: 'M0 0 L200 0 L200 100 L0 100 Z',
          fill: '#5b9bd5', rotate: 0,
        },
      ],
    } as unknown as Slide;

    const result = await exportCourseToPPTX(defaultConfig, [slide]);
    expect(result.fileUrl).toMatch(/^blob:/);
  }, 15000);

  it('handles slides with latex element', async () => {
    const slide: Slide = {
      id: 'slide-latex',
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: { backgroundColor: '#fff', themeColors: ['#000'], fontColor: '#000', fontName: 'Arial' },
      elements: [
        {
          id: 'latex_1', type: 'latex', left: 60, top: 200, width: 400, height: 70,
          latex: 'a^2 + b^2 = c^2', color: '#000', rotate: 0,
        },
      ],
    } as unknown as Slide;

    const result = await exportCourseToPPTX(defaultConfig, [slide]);
    expect(result.fileUrl).toMatch(/^blob:/);
  }, 15000);

  it('includes knowledge points slide when data provided', async () => {
    const kp = [
      { name: 'Point A', description: 'First concept', difficulty: 'easy' as const },
      { name: 'Point B', description: 'Second concept', difficulty: 'hard' as const },
    ];

    const result = await exportCourseToPPTX(defaultConfig, [makeTextSlide('Content')], kp);
    expect(result.fileUrl).toMatch(/^blob:/);
  }, 15000);

  it('includes similar questions when data provided', async () => {
    const sq = [
      { problem: 'Solve x+1=2', difficulty: 1, knowledgePoint: 'Algebra' },
    ];

    const result = await exportCourseToPPTX(
      defaultConfig,
      [makeTextSlide('Content')],
      [{ name: 'Algebra', description: 'Basic algebra', difficulty: 'easy' as const }],
      sq,
    );
    expect(result.fileUrl).toMatch(/^blob:/);
  }, 15000);
});
