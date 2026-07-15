import { describe, it, expect, vi } from 'vitest';
import {
  buildUserPrompt,
  convertContentLatex,
  postProcessContent,
  generateSectionContent,
} from '@/lib/slides/agent/section-agent';
import type { SectionPlan } from '@/lib/slides/agent/planning-agent';
import type { DesignDNA } from '@/lib/slides/agent/design-dna';

// Mock LLM to avoid real API calls
vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '@/lib/ai/llm';
const mockedCallLLM = vi.mocked(callLLM);

describe('buildUserPrompt', () => {
  it('includes sectionId so LLM knows the chapter number', () => {
    const section: SectionPlan = {
      sectionId: 3,
      title: '碳反应',
      pages: [
        { pageNum: 5, type: 'chapter', title: '碳反应', contentOutline: { focus: '暗反应' } },
        { pageNum: 6, type: 'concept', title: '卡尔文循环', contentOutline: { focus: 'C3途径' } },
      ],
    };
    const prompt = buildUserPrompt(section, '光合作用');
    expect(prompt).toContain('章节编号：3');
    expect(prompt).toContain('chapter 类型页面的 content.num 必须与此一致');
    expect(prompt).toContain('num="03"');
  });
});

describe('convertContentLatex', () => {
  it('preserves mainFormula, derivation, application as raw LaTeX', () => {
    const content = {
      title: '公式页',
      mainFormula: '\\frac{a}{b}',
      derivation: '推导 $x=1$ 过程',
      application: '应用 $y=2$ 场景',
      formulas: [{ label: '辅助', latex: 'E=mc^2' }],
    };
    const result = convertContentLatex(content);
    expect(result.mainFormula).toBe('\\frac{a}{b}');
    expect(result.derivation).toBe('推导 $x=1$ 过程');
    expect(result.application).toBe('应用 $y=2$ 场景');
    expect((result.formulas as Array<{ latex: string }>)[0].latex).toBe('E=mc^2');
  });

  it('converts inline $...$ in other string fields to Unicode', () => {
    const content = {
      title: '标题',
      summary: '离子 $Na^+$ 和 $Cl^-$',
      formulas: [{ label: '电荷', latex: '\\text{电荷}' }],
    };
    const result = convertContentLatex(content);
    expect(result.summary).toContain('Na⁺');
    expect(result.summary).toContain('Cl⁻');
  });
});

describe('postProcessContent', () => {
  it('extracts formulas from process steps.desc when formula keywords present', () => {
    const content = {
      title: '光反应步骤',
      steps: [
        { num: '1', title: '光吸收', desc: '光能被叶绿素吸收，发生光化学反应，总反应式为 $2H_2O \\rightarrow O_2 + 4H^+ + 4e^-$' },
        { num: '2', title: '电子传递', desc: '电子沿传递链移动' },
      ],
    };
    // Simulate real pipeline: convert inline LaTeX to Unicode first
    const converted = convertContentLatex(content);
    const result = postProcessContent('process', converted);
    const formulas = result.formulas as Array<{ label: string; latex: string }>;
    expect(formulas.length).toBeGreaterThan(0);
    expect(formulas[0].label).toBe('光吸收');
    expect(formulas[0].latex).toContain('2H_{2}O');
  });
});

describe('generateSectionContent num enforcement', () => {
  it('forces chapter page num to match sectionId', async () => {
    const mockLLMResponse = {
      text: JSON.stringify({
        sectionId: 2,
        pages: [
          { pageNum: 5, pageType: 'chapter', content: { num: '05', title: '光反应', subtitle: '从光能到化学能' } },
          { pageNum: 6, pageType: 'concept', content: { title: '光系统', cards: [{ title: 'PSII', desc: '水裂解' }], summary: '总结' } },
        ],
      }),
    };
    mockedCallLLM.mockResolvedValue(mockLLMResponse as unknown as Awaited<ReturnType<typeof callLLM>>);

    const section: SectionPlan = {
      sectionId: 2,
      title: '光反应',
      pages: [
        { pageNum: 5, type: 'chapter', title: '光反应', contentOutline: { focus: '光反应' } },
        { pageNum: 6, type: 'concept', title: '光系统', contentOutline: { focus: '光系统' } },
      ],
    };

    const result = await generateSectionContent(
      section,
      '光合作用',
      '高中',
      {
        styleName: '测试',
        recommended: false,
        colors: { coverBg: '000000', contentBg: 'FFFFFF', accent: '000000', accentSecondary: '000000', accentLight: '000000', textPrimary: '000000', textBody: '000000', textMuted: '000000', textOnDark: '000000' },
        fonts: { heading: 'SimSun', body: 'SimSun', en: 'Georgia', headingSize: 48, pageTitleSize: 32, bodySize: 14, captionSize: 10 },
        decoration: { motif: 'geometric-lines', density: 'moderate', cornerWeight: 'top-right' },
        components: { cardStyle: 'accent-left-bar', bulletStyle: 'dot', pageNumberStyle: 'number-slash-total' },
        mood: '测试',
        bestFor: ['测试'],
      } as DesignDNA,
      {} as Parameters<typeof generateSectionContent>[4],
    );

    expect(result.success).toBe(true);
    const chapterPage = result.output!.pages.find((p) => p.pageType === 'chapter');
    expect(chapterPage).toBeDefined();
    expect((chapterPage!.content as { num: string }).num).toBe('02');
  });
});
