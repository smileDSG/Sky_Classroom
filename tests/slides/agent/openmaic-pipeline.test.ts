import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageModel } from 'ai';

const mockGenerateContent = vi.fn();
const mockBuildDeck = vi.fn();
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

vi.mock('@/lib/slides/template-deck', () => ({
  generateTemplateDeckContent: (...args: unknown[]) => mockGenerateContent(...args),
  buildTemplateDeckBuffer: (...args: unknown[]) => mockBuildDeck(...args),
  summarizeTemplatePages: (pages: { title: string; pageType: string }[]) =>
    pages.map((p, i) => ({ pageNum: i + 2, title: p.title, type: p.pageType })),
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

const samplePages = [
  {
    pageType: 'toc' as const,
    title: '目录',
    items: [
      { title: '光合作用概述' },
      { title: '光反应' },
      { title: '暗反应' },
      { title: '影响因素' },
    ],
  },
  {
    pageType: 'bullets' as const,
    title: '核心概念',
    points: [
      { lead: '场所', detail: '叶绿体类囊体薄膜与基质' },
      { lead: '原料', detail: 'CO₂ 和 H₂O' },
      { lead: '产物', detail: '有机物与氧气' },
    ],
    keyTakeaway: '光合作用将光能转化为化学能储存于有机物中',
  },
];

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
    mockGenerateContent.mockResolvedValue(samplePages);
    mockBuildDeck.mockResolvedValue(Buffer.from('pptx'));
    mockGeneratePreviewFromPptx.mockResolvedValue({
      success: true,
      previewId: 'preview123',
      slideImages: ['/temp/preview/preview123/images/slide-1.png'],
    });
  });

  it('generates structured content and renders it through the fixed template layouts', async () => {
    const jobId = 'job-openmaic-direct';
    createJob(jobId);

    const result = await runOpenMaicSlidesPipeline(makeOptions(jobId));

    expect(result.totalPages).toBe(4); // cover + 2 content pages + end
    expect(mockGenerateContent).toHaveBeenCalledWith(
      'Topic',
      '高中',
      18, // slideCount 20 − cover − end
      expect.stringContaining('do not use the old Sky card-panel template'),
      expect.any(Function),
    );
    expect(mockBuildDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'Topic',
        difficultyLabel: '高中',
        dna: getDefaultDesignDNA(),
        pages: samplePages,
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

    expect(mockGenerateContent).toHaveBeenCalled();
    expect(mockBuildDeck).toHaveBeenCalled();
    expect(mockPlanOutline).not.toHaveBeenCalled();
    expect(mockDesignPage).not.toHaveBeenCalled();
  });
});
