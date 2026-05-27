import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLM = vi.fn();
vi.mock('@/lib/ai/llm', () => ({ callLLM: (...args: unknown[]) => mockCallLLM(...args) }));

import { planOutline } from '@/lib/slides/agent/planning-agent';
import { getDefaultDesignDNA } from '@/lib/slides/agent/design-dna';
import type { LanguageModel } from 'ai';

const mockModel = { modelId: 'test' } as unknown as LanguageModel;

function makeValidOutline() {
  return {
    sections: [
      {
        sectionId: 1,
        title: '定义与历史',
        pages: [
          { pageNum: 1, type: 'cover', title: '封面', contentOutline: { focus: '封面页' } },
          { pageNum: 2, type: 'toc', title: '目录', contentOutline: { focus: '目录页', keyConcepts: ['定义', '证明', '应用'] } },
          { pageNum: 3, type: 'chapter', title: '第一章', contentOutline: { focus: '本章引入' } },
          { pageNum: 4, type: 'concept', title: '核心概念', contentOutline: { focus: '勾股定理定义', keyConcepts: ['勾股定理', '直角边', '斜边'] } },
          { pageNum: 5, type: 'case', title: '典型例题', contentOutline: { focus: '勾股定理计算', keyConcepts: ['计算'] } },
          { pageNum: 6, type: 'summary', title: '本章小结', contentOutline: { focus: '回顾' } },
        ],
      },
      {
        sectionId: 2,
        title: '证明与应用',
        pages: [
          { pageNum: 7, type: 'chapter', title: '第二章', contentOutline: { focus: '本章引入' } },
          { pageNum: 8, type: 'formula', title: '公式推导', contentOutline: { focus: '推导', keyConcepts: ['推导'] } },
          { pageNum: 9, type: 'case', title: '应用题', contentOutline: { focus: '应用', keyConcepts: ['应用'] } },
          { pageNum: 10, type: 'end', title: '结束', contentOutline: { focus: '结束' } },
        ],
      },
    ],
  };
}

describe('PlanningAgent', () => {
  const dna = getDefaultDesignDNA();

  beforeEach(() => vi.clearAllMocks());

  it('plans a valid outline', async () => {
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(makeValidOutline()) });
    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(true);
    expect(result.outline!.sections).toHaveLength(2);
    expect(result.totalPages).toBe(10);
  });

  it('rejects when page count below minimum', async () => {
    const outline = makeValidOutline();
    outline.sections = [outline.sections[0]]; // Only 6 pages
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(outline) });
    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(false);
  });

  it('trims pages when exceeding maximum', async () => {
    // Make a bloated outline
    const outline = makeValidOutline();
    for (let i = 0; i < 15; i++) {
      outline.sections[1].pages.splice(1, 0, { pageNum: 99, type: 'case', title: 'extra', contentOutline: { focus: 'extra' } });
    }
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(outline) });
    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(true);
    // Should be trimmed to ≤20
    expect(result.totalPages).toBeLessThanOrEqual(20);
  });

  it('handles LLM failure', async () => {
    mockCallLLM.mockRejectedValueOnce(new Error('timeout'));
    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(false);
  });

  it('handles invalid JSON from LLM', async () => {
    mockCallLLM.mockResolvedValueOnce({ text: 'not valid json {' });
    const result = await planOutline('勾股定理', '高中', 10, 20, dna, mockModel);
    expect(result.success).toBe(false);
  });
});
