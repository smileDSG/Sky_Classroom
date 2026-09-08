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
    {
      pageNum: 3,
      type: 'chapter',
      title: '定义与历史',
      contentOutline: { focus: '勾股定理的历史背景和定义', keyConcepts: ['勾股定理'] },
    },
    {
      pageNum: 4,
      type: 'concept',
      title: '核心概念',
      contentOutline: {
        focus: '勾股定理核心定义',
        keyConcepts: ['勾股定理', '直角边', '斜边'],
        notes: '讲清 a^2+b^2=c^2',
      },
    },
  ],
};

function makeValidOutput() {
  return {
    sectionId: 1,
    pages: [
      {
        pageNum: 3,
        pageType: 'chapter',
        content: {
          num: '01',
          title: '定义与历史',
          subtitle: '探索勾股定理的起源',
          preview: '从周髀算经到毕达哥拉斯',
        },
      },
      {
        pageNum: 4,
        pageType: 'concept',
        content: {
          title: '勾股定理核心概念',
          cards: [
            { title: '勾股定理', desc: '直角三角形两直角边的平方和等于斜边的平方' },
            { title: '直角边', desc: '构成直角的两条边' },
          ],
          summary: '勾股定理是几何学的基础定理',
        },
      },
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
    mockCallLLM.mockResolvedValueOnce({
      text: JSON.stringify({ sectionId: 1, pages: 'not an array' }),
    });
    const result = await generateSectionContent(sampleSection, '勾股定理', '高中', dna, mockModel);
    expect(result.success).toBe(false);
  });

  it('handles LLM failure', async () => {
    mockCallLLM.mockRejectedValueOnce(new Error('API error'));
    const result = await generateSectionContent(sampleSection, '勾股定理', '高中', dna, mockModel);
    expect(result.success).toBe(false);
  });

  it('auto-fixes missing formulas for concept pages', async () => {
    const output = {
      sectionId: 1,
      pages: [
        {
          pageNum: 4,
          pageType: 'concept',
          content: {
            title: '核心概念',
            cards: [
              { title: '总反应方程式', desc: '锌铜原电池中，Zn + Cu²⁺ → Zn²⁺ + Cu 是总反应。' },
            ],
            summary: '氧化还原反应总结',
          },
        },
      ],
    };
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(output) });
    const result = await generateSectionContent(sampleSection, '氧化还原', '高中', dna, mockModel);
    expect(result.success).toBe(true);
    const page = result.output!.pages[0];
    expect(page.content.formulas).toBeDefined();
    expect(
      (page.content.formulas as Array<{ label: string; latex: string }>).length,
    ).toBeGreaterThan(0);
    const latex = (page.content.formulas as Array<{ label: string; latex: string }>)[0].latex;
    expect(latex).toContain('\\rightarrow');
  });

  it('auto-fixes missing formulas for case pages', async () => {
    const caseSection: SectionPlan = {
      sectionId: 1,
      title: '计算实例',
      pages: [
        {
          pageNum: 4,
          type: 'case',
          title: '浓度计算',
          contentOutline: { focus: '能斯特方程计算', keyConcepts: ['能斯特方程'] },
        },
      ],
    };
    const output = {
      sectionId: 1,
      pages: [
        {
          pageNum: 4,
          pageType: 'case',
          content: {
            title: '浓度计算',
            scenarios: [
              {
                problem: '计算 Zn²⁺半电池在25°C时的电极电势。',
                solution: '代入公式 E = -0.76 - (0.0592/2)lg(1/0.1) = -0.7896 V。',
              },
            ],
            highlight: '能斯特方程',
          },
        },
      ],
    };
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(output) });
    const result = await generateSectionContent(caseSection, '电化学', '高中', dna, mockModel);
    expect(result.success).toBe(true);
    expect(result.output!.pages[0].content.formulas).toBeDefined();
    expect((result.output!.pages[0].content.formulas as Array<unknown>).length).toBeGreaterThan(0);
  });

  it('filters directive text leaked from notes', async () => {
    const output = {
      sectionId: 1,
      pages: [
        {
          pageNum: 4,
          pageType: 'concept',
          content: {
            title: '核心概念',
            cards: [
              { title: '公式推导', desc: '需完整呈现关键公式，推导过程应分步展示，逻辑清晰。' },
            ],
            summary: '总结',
          },
        },
      ],
    };
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(output) });
    const result = await generateSectionContent(sampleSection, '电化学', '高中', dna, mockModel);
    expect(result.success).toBe(true);
    const desc = (result.output!.pages[0].content.cards as Array<{ desc: string }>)[0].desc;
    expect(desc).not.toContain('需完整呈现');
    expect(desc).not.toContain('应分步展示');
  });

  it('preserves formulas latex from Unicode conversion', async () => {
    const output = {
      sectionId: 1,
      pages: [
        {
          pageNum: 4,
          pageType: 'concept',
          content: {
            title: '核心概念',
            cards: [{ title: '公式', desc: '见教材' }],
            formulas: [{ label: '反应式', latex: 'Zn^{2+} + Cu \\rightarrow Zn + Cu^{2+}' }],
            summary: '总结',
          },
        },
      ],
    };
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(output) });
    const result = await generateSectionContent(sampleSection, '电化学', '高中', dna, mockModel);
    expect(result.success).toBe(true);
    const formulas = result.output!.pages[0].content.formulas as Array<{ latex: string }>;
    expect(formulas[0].latex).toBe('Zn^{2+} + Cu \\rightarrow Zn + Cu^{2+}');
  });

  it('injects fallback formulas when extraction fails', async () => {
    const output = {
      sectionId: 1,
      pages: [
        {
          pageNum: 4,
          pageType: 'concept',
          content: {
            title: '核心概念',
            cards: [
              { title: '总反应方程式', desc: '这是一个关于总反应的文字描述，没有具体公式。' },
            ],
            summary: '总结',
          },
        },
      ],
    };
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(output) });
    const result = await generateSectionContent(sampleSection, '氧化还原', '高中', dna, mockModel);
    expect(result.success).toBe(true);
    const page = result.output!.pages[0];
    expect(page.content.formulas).toBeDefined();
    expect((page.content.formulas as Array<{ label: string }>)[0].label).toBe('总反应方程式');
  });
});
