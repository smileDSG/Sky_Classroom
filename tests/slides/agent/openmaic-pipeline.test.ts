import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageModel } from 'ai';
import type { Slide, SlideTheme } from '@/lib/types/slides';

const mockGenerateSlides = vi.fn();
const mockExportPptx = vi.fn();
const mockGeneratePreviewFromPptx = vi.fn();
const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();
const mockPlanOutline = vi.fn();
const mockDesignPage = vi.fn();

vi.mock('fs/promises', () => ({
  default: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

vi.mock('@/lib/slides/slide-generator', () => ({
  generateSlides: (...args: unknown[]) => mockGenerateSlides(...args),
}));

vi.mock('@/lib/slides/pptx-exporter', () => ({
  exportPptx: (...args: unknown[]) => mockExportPptx(...args),
}));

vi.mock('@/lib/slides/pptx-preview', () => ({
  generatePreviewFromPptx: (...args: unknown[]) => mockGeneratePreviewFromPptx(...args),
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/slides/agent/planning-agent', () => ({
  planOutline: (...args: unknown[]) => mockPlanOutline(...args),
}));

vi.mock('@/lib/slides/agent/page-design-agent', () => ({
  designPage: (...args: unknown[]) => mockDesignPage(...args),
}));

vi.mock('@/lib/slides/agent/section-agent', () => ({
  generateSectionContent: vi.fn(),
}));

vi.mock('@/lib/slides/agent/qa-agent', () => ({
  runQA: vi.fn(),
}));

vi.mock('@/lib/slides/agent/instruction-executor', () => ({
  instructionExecutor: { execute: vi.fn() },
}));

vi.mock('@/lib/slides/agent/audit-logger', () => ({
  createAudit: vi.fn(),
  startStep: vi.fn(),
  endStep: vi.fn(),
  errorStep: vi.fn(),
  recordLLMCall: vi.fn(),
  finalizeAudit: vi.fn(),
}));

import {
  createJob,
  getJob,
  runOpenMaicSlidesPipeline,
  runPipeline,
} from '@/lib/slides/agent/pipeline';
import { getDefaultDesignDNA } from '@/lib/slides/agent/design-dna';

const mockModel = { modelId: 'test-model' } as unknown as LanguageModel;

const theme: SlideTheme = {
  backgroundColor: '#ffffff',
  themeColors: ['#2563eb'],
  fontColor: '#111827',
  fontName: 'Microsoft YaHei',
};

function makeSlide(type: Slide['type'], title: string): Slide {
  return {
    id: `${type}-${title}`,
    viewportSize: 1000,
    viewportRatio: 0.5625,
    theme,
    type,
    background: { type: 'solid', color: '#ffffff' },
    elements: [
      {
        id: `${type}-title`,
        type: 'text',
        left: 80,
        top: 60,
        width: 840,
        height: 76,
        rotate: 0,
        content: `<p style="font-size: 32px; text-align: center;"><strong>${title}</strong></p>`,
        defaultFontName: 'Microsoft YaHei',
        defaultColor: '#111827',
      },
    ],
  };
}

function makeSlides(): Slide[] {
  return [
    makeSlide('cover', 'Topic'),
    makeSlide('content', 'Core Idea'),
    makeSlide('end', 'Summary'),
  ];
}

function makeOptions(jobId: string) {
  return {
    topic: 'Topic',
    difficulty: 'senior',
    minPages: 15,
    maxPages: 25,
    designDNA: getDefaultDesignDNA(),
    languageModel: mockModel,
    jobId,
  };
}

describe('OpenMAIC slides pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SKY_SLIDES_LEGACY_PIPELINE;
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockGenerateSlides.mockResolvedValue({ slides: makeSlides(), generationTime: 123 });
    mockExportPptx.mockResolvedValue({
      buffer: Buffer.from('pptx'),
      fileName: 'ignored.pptx',
      size: 4,
    });
    mockGeneratePreviewFromPptx.mockResolvedValue({
      success: true,
      previewId: 'preview123',
      slideImages: ['/temp/preview/preview123/images/slide-1.png'],
    });
  });

  it('runs the OpenMAIC element-level generator and exports AI layout PPTX', async () => {
    const jobId = 'job-openmaic-direct';
    createJob(jobId);

    const result = await runOpenMaicSlidesPipeline(makeOptions(jobId));

    expect(result.totalPages).toBe(3);
    expect(mockGenerateSlides).toHaveBeenCalledWith(
      'Topic',
      expect.objectContaining({
        difficulty: 'senior',
        slideCount: 20,
        language: expect.stringContaining('Simplified Chinese'),
        personaPrompt: expect.stringContaining('do not use the old Sky card-panel template'),
      }),
      expect.any(Function),
    );
    expect(mockExportPptx).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Topic',
        slides: makeSlides(),
        layoutMode: 'ai',
      }),
    );
    expect(mockGeneratePreviewFromPptx).toHaveBeenCalledWith(
      expect.stringMatching(/^\/temp\/pptx\/Topic_[a-z-]+_\d+\.pptx$/),
    );

    const job = getJob(jobId);
    expect(job?.stage).toBe('done');
    expect(job?.pipelineMode).toBe('openmaic');
    expect(job?.pptxUrl).toMatch(/^\/temp\/pptx\/Topic_[a-z-]+_\d+\.pptx$/);
    expect(job?.previewImages).toEqual(['/temp/preview/preview123/images/slide-1.png']);
  });

  it('makes runPipeline skip the legacy planning and page-design agents by default', async () => {
    const jobId = 'job-openmaic-run-pipeline';
    createJob(jobId);

    await runPipeline(makeOptions(jobId));

    expect(mockGenerateSlides).toHaveBeenCalled();
    expect(mockExportPptx).toHaveBeenCalledWith(expect.objectContaining({ layoutMode: 'ai' }));
    expect(mockPlanOutline).not.toHaveBeenCalled();
    expect(mockDesignPage).not.toHaveBeenCalled();
  });
});
