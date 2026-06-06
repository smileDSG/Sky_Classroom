import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLM = vi.fn();
vi.mock('@/lib/ai/llm', () => ({ callLLM: (...args: unknown[]) => mockCallLLM(...args) }));

import { planOutline } from '@/lib/slides/agent/planning-agent';
import { getDefaultDesignDNA } from '@/lib/slides/agent/design-dna';
import type { LanguageModel } from 'ai';

const mockModel = { modelId: 'test' } as unknown as LanguageModel;

// ── Mock data helpers ───────────────────────────────────────────────

function makeValidLayer1Skeleton() {
  return {
    sectionSkeletons: [
      {
        sectionId: 1,
        title: '定义与历史',
        focus: '勾股定理的定义和历史背景',
        suggestedPages: 4,
        pageTypeHints: ['chapter', 'concept', 'case', 'summary'],
      },
      {
        sectionId: 2,
        title: '证明与应用',
        focus: '勾股定理的证明方法和实际应用',
        suggestedPages: 3,
        pageTypeHints: ['chapter', 'formula', 'summary'],
      },
    ],
    totalPages: 10, // 1(cover) + 1(toc) + 4 + 3 + 1(end)
  };
}

function makeValidLayer2Section1() {
  return [
    { pageNum: 3, type: 'chapter', title: '第一章', contentOutline: { focus: '本章引入' } },
    { pageNum: 4, type: 'concept', title: '核心概念', contentOutline: { focus: '勾股定理定义', keyConcepts: ['勾股定理', '直角边', '斜边'] } },
    { pageNum: 5, type: 'case', title: '典型例题', contentOutline: { focus: '勾股定理计算', keyConcepts: ['计算'] } },
    { pageNum: 6, type: 'summary', title: '本章小结', contentOutline: { focus: '回顾' } },
  ];
}

function makeValidLayer2Section2() {
  return [
    { pageNum: 7, type: 'chapter', title: '第二章', contentOutline: { focus: '本章引入' } },
    { pageNum: 8, type: 'formula', title: '公式推导', contentOutline: { focus: '推导', keyConcepts: ['推导'] } },
    { pageNum: 9, type: 'summary', title: '本章小结', contentOutline: { focus: '应用', keyConcepts: ['应用'] } },
  ];
}

describe('PlanningAgent', () => {
  const dna = getDefaultDesignDNA();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: route by callLLM tag so concurrent Layer-2 calls always get correct data
    mockCallLLM.mockImplementation(async (_req, tag: string) => {
      if (tag === 'planning-layer1') return { text: JSON.stringify(makeValidLayer1Skeleton()) };
      if (tag === 'planning-layer2-sec1') return { text: JSON.stringify(makeValidLayer2Section1()) };
      if (tag === 'planning-layer2-sec2') return { text: JSON.stringify(makeValidLayer2Section2()) };
      return { text: '{}' };
    });
  });

  it('plans a valid outline', async () => {
    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(true);
    expect(result.outline!.sections).toHaveLength(2);
    expect(result.totalPages).toBe(10);
  });

  it('rejects when page count below minimum', async () => {
    const skeleton = makeValidLayer1Skeleton();
    skeleton.sectionSkeletons[0].suggestedPages = 2;
    skeleton.sectionSkeletons[1].suggestedPages = 1;
    skeleton.totalPages = 6; // 1+1+2+1+1 = 6 < 10
    mockCallLLM.mockImplementation(async (_req, tag: string) => {
      if (tag === 'planning-layer1') return { text: JSON.stringify(skeleton) };
      return { text: '{}' };
    });

    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(false);
  });

  it('trims pages when exceeding maximum', async () => {
    const skeleton = makeValidLayer1Skeleton();
    skeleton.sectionSkeletons[0].suggestedPages = 8; // sec1=8 (+cover+toc=10)
    skeleton.sectionSkeletons[1].suggestedPages = 12; // sec2=12 (+end=13, >10 limit)
    skeleton.totalPages = 23; // 1+1+8+12+1 = 23 > 20

    // Layer 2 section 1: 8 pages (start=3)
    const section1Pages = Array.from({ length: 8 }, (_, i) => ({
      pageNum: 3 + i,
      type: i === 0 ? 'chapter' : i === 7 ? 'summary' : 'case',
      title: `S1页面${i + 1}`,
      contentOutline: { focus: '内容', keyConcepts: ['概念'] },
    }));
    // Layer 2 section 2 after trim: 9 pages (start=11)
    const section2Pages = Array.from({ length: 9 }, (_, i) => ({
      pageNum: 11 + i,
      type: i === 0 ? 'chapter' : i === 8 ? 'summary' : 'case',
      title: `S2页面${i + 1}`,
      contentOutline: { focus: '内容', keyConcepts: ['概念'] },
    }));

    mockCallLLM.mockImplementation(async (_req, tag: string) => {
      if (tag === 'planning-layer1') return { text: JSON.stringify(skeleton) };
      if (tag === 'planning-layer2-sec1') return { text: JSON.stringify(section1Pages) };
      if (tag === 'planning-layer2-sec2') return { text: JSON.stringify(section2Pages) };
      return { text: '{}' };
    });

    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(true);
    expect(result.totalPages).toBeLessThanOrEqual(20);
  });

  it('handles LLM failure', async () => {
    mockCallLLM.mockRejectedValue(new Error('timeout'));
    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(false);
  });

  it('handles invalid JSON from LLM', async () => {
    mockCallLLM.mockResolvedValue({ text: 'not valid json {' });
    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(false);
  });

  it('fails when Layer 2 partial section fails', async () => {
    mockCallLLM.mockImplementation(async (_req, tag: string) => {
      if (tag === 'planning-layer1') return { text: JSON.stringify(makeValidLayer1Skeleton()) };
      if (tag === 'planning-layer2-sec1') return { text: JSON.stringify(makeValidLayer2Section1()) };
      if (tag === 'planning-layer2-sec2') throw new Error('Layer2 timeout');
      return { text: '{}' };
    });

    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(false);
    expect(result.error).toContain('部分章节规划失败');
  });

  it('plans outline with single section', async () => {
    const skeleton = {
      sectionSkeletons: [
        {
          sectionId: 1,
          title: '勾股定理全解',
          focus: '定义、证明与应用',
          suggestedPages: 4,
          pageTypeHints: ['chapter', 'concept', 'case', 'summary'],
        },
      ],
      totalPages: 7, // 1+1+4+1
    };
    const sectionPages = [
      { pageNum: 3, type: 'chapter', title: '第一章', contentOutline: { focus: '本章引入' } },
      { pageNum: 4, type: 'concept', title: '核心概念', contentOutline: { focus: '勾股定理定义', keyConcepts: ['勾股定理'] } },
      { pageNum: 5, type: 'case', title: '典型例题', contentOutline: { focus: '勾股定理计算' } },
      { pageNum: 6, type: 'summary', title: '本章小结', contentOutline: { focus: '回顾' } },
    ];

    mockCallLLM.mockImplementation(async (_req, tag: string) => {
      if (tag === 'planning-layer1') return { text: JSON.stringify(skeleton) };
      if (tag === 'planning-layer2-sec1') return { text: JSON.stringify(sectionPages) };
      return { text: '{}' };
    });

    const result = await planOutline('勾股定理', '高中', 7, 20, dna, mockModel);
    expect(result.success).toBe(true);
    expect(result.totalPages).toBe(7);
    // cover(1) + toc(2) + 4 section pages + end(7) all in one section
    expect(result.outline!.sections[0].pages.length).toBe(7);
    expect(result.outline!.sections[0].pages[0].type).toBe('cover');
    expect(result.outline!.sections[0].pages[1].type).toBe('toc');
    expect(result.outline!.sections[0].pages[6].type).toBe('end');
  });
});
