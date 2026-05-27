import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLM = vi.fn();
vi.mock('@/lib/ai/llm', () => ({ callLLM: (...args: unknown[]) => mockCallLLM(...args) }));

import { generateSectionContent } from '@/lib/slides/agent/section-agent';
import { getDefaultDesignDNA } from '@/lib/slides/agent/design-dna';
import type { SectionPlan } from '@/lib/slides/agent/planning-agent';
import type { LanguageModel } from 'ai';

const mockModel = { modelId: 'test' } as unknown as LanguageModel;

const sampleSection: SectionPlan = {
  sectionId: 1,
  title: '定义与历史',
  pages: [
    { pageNum: 3, type: 'chapter', title: '定义与历史', contentOutline: { focus: '勾股定理的历史背景和定义', keyConcepts: ['勾股定理'] } },
    { pageNum: 4, type: 'concept', title: '核心概念', contentOutline: { focus: '勾股定理核心定义', keyConcepts: ['勾股定理', '直角边', '斜边'], notes: '讲清 a^2+b^2=c^2' } },
  ],
};

function makeValidOutput() {
  return {
    sectionId: 1,
    pages: [
      { pageNum: 3, pageType: 'chapter', content: { num: '01', title: '定义与历史', subtitle: '探索勾股定理的起源', preview: '从周髀算经到毕达哥拉斯' } },
      { pageNum: 4, pageType: 'concept', content: { title: '勾股定理核心概念', cards: [{ title: '勾股定理', desc: '直角三角形两直角边的平方和等于斜边的平方' }], summary: '勾股定理是几何学的基础定理' } },
    ],
  };
}

describe('SectionAgent', () => {
  const dna = getDefaultDesignDNA();

  beforeEach(() => vi.clearAllMocks());

  it('generates section content', async () => {
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(makeValidOutput()) });
    const result = await generateSectionContent(sampleSection, '勾股定理', '高中', dna, mockModel);
    expect(result.success).toBe(true);
    expect(result.output!.pages).toHaveLength(2);
    expect(result.output!.sectionId).toBe(1);
  });

  it('validates output schema', async () => {
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify({ sectionId: 1, pages: 'not an array' }) });
    const result = await generateSectionContent(sampleSection, '勾股定理', '高中', dna, mockModel);
    expect(result.success).toBe(false);
  });

  it('handles LLM failure', async () => {
    mockCallLLM.mockRejectedValueOnce(new Error('API error'));
    const result = await generateSectionContent(sampleSection, '勾股定理', '高中', dna, mockModel);
    expect(result.success).toBe(false);
  });
});
