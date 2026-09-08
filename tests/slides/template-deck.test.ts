/**
 * Template deck tests — structured content schema, LLM content generation,
 * and deterministic fixed-layout rendering for every page type.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  templateDeckSchema,
  generateTemplateDeckContent,
  buildTemplateDeckBuffer,
  summarizeTemplatePages,
  type TemplatePage,
} from '@/lib/slides/template-deck';
import {
  getDefaultDesignDNA,
  COLOR_PALETTES,
  FONT_PAIRS,
  type DesignDNA,
} from '@/lib/slides/agent/design-dna';
import { buildThemeFromDesignDNA } from '@/lib/slides/pptx-themes';
import type { AICallFn } from '@/lib/generation/pipeline-types';

function dna(): DesignDNA {
  const base = getDefaultDesignDNA();
  return {
    ...base,
    colors: { ...COLOR_PALETTES['forest-moss'] },
    fonts: { ...FONT_PAIRS['impact-arial'] },
    layoutType: 'hero-left',
  };
}

function samplePages(): TemplatePage[] {
  return [
    {
      pageType: 'toc',
      title: '课程目录',
      items: [
        { title: '光合作用概述', desc: '总反应与场所' },
        { title: '光反应' },
        { title: '暗反应' },
      ],
    },
    {
      pageType: 'bullets',
      title: '核心概念',
      points: [
        { lead: '场所', detail: '叶绿体' },
        { lead: '原料', detail: 'CO₂ 和 H₂O' },
        { lead: '产物', detail: '有机物和 O₂' },
      ],
      keyTakeaway: '光能 → 化学能',
    },
    {
      pageType: 'comparison',
      title: '光反应 vs 暗反应',
      leftLabel: '光反应',
      leftPoints: ['需要光照', '场所：类囊体薄膜', '产物：ATP、NADPH'],
      rightLabel: '暗反应',
      rightPoints: ['不需光照', '场所：基质', '产物：有机物'],
      note: '两者相互依存',
    },
    {
      pageType: 'steps',
      title: '光合作用过程',
      steps: [
        { title: '光能吸收', desc: '色素捕获光子' },
        { title: '水的光解', desc: '释放 O₂' },
        { title: 'CO₂ 固定', desc: '与 C₅ 结合' },
      ],
    },
    {
      pageType: 'formula',
      title: '总反应式',
      latex: '6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2',
      meaning: ['光能转化为化学能', 'O₂ 全部来自 H₂O'],
      example: '验证实验：同位素标记 H₂¹⁸O',
    },
    {
      pageType: 'table',
      title: '影响因素',
      headers: ['因素', '影响', '应用'],
      rows: [
        ['光照强度', '正相关', '温室补光'],
        ['CO₂浓度', '正相关', '通风施气肥'],
      ],
    },
    {
      pageType: 'quiz',
      title: '课堂练习',
      question: '光合作用释放的 O₂ 来自于？',
      options: ['CO₂', 'H₂O', '葡萄糖', '叶绿素'],
      answer: 'H₂O',
      analysis: '同位素标记实验证明',
    },
    {
      pageType: 'summary',
      title: '本课小结',
      points: [
        { lead: '场所', detail: '类囊体与基质' },
        { lead: '过程', detail: '光反应与暗反应' },
        { lead: '意义', detail: '物质与能量转化' },
      ],
    },
  ];
}

describe('templateDeckSchema', () => {
  it('accepts all 8 page types', () => {
    const result = templateDeckSchema.safeParse({ pages: samplePages() });
    expect(result.success).toBe(true);
  });

  it('rejects unknown pageType and out-of-range counts', () => {
    const bad = {
      pages: [
        { pageType: 'freeform-canvas', title: '自由发挥' },
        { pageType: 'bullets', title: '要点', points: [] },
      ],
    };
    expect(templateDeckSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects quiz answer missing from options constraints is not enforced but fields are required', () => {
    const missing = {
      pages: [{ pageType: 'quiz', title: '练习', question: '1+1=?', options: ['2'] }],
    };
    expect(templateDeckSchema.safeParse(missing).success).toBe(false);
  });
});

describe('generateTemplateDeckContent', () => {
  const stylePrompt = 'Preferred palette: cover #2C5F2D, accent #97BC62.';

  it('parses and validates valid LLM output', async () => {
    const aiCall = vi.fn(async () =>
      JSON.stringify({ pages: samplePages().slice(0, 3) }),
    ) as unknown as AICallFn;

    const pages = await generateTemplateDeckContent('光合作用', '高中', 3, stylePrompt, aiCall);

    expect(pages).toHaveLength(3);
    expect(pages[0].pageType).toBe('toc');
    // style context reaches the system prompt for content emphasis
    const [system] = (aiCall as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(system).toContain('Preferred palette: cover #2C5F2D');
  });

  it('retries once with the validation error, then fails hard', async () => {
    const aiCall = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ pages: [{ pageType: 'garbage' }] }))
      .mockResolvedValueOnce(JSON.stringify({ pages: samplePages().slice(0, 2) }));

    const pages = await generateTemplateDeckContent('光合作用', '高中', 2, stylePrompt, aiCall);

    expect(pages).toHaveLength(2);
    expect(aiCall).toHaveBeenCalledTimes(2);
    const secondUser = (aiCall.mock.calls[1] as [string, string])[1];
    expect(secondUser).toContain('未通过校验');
  });

  it('throws after two invalid attempts', async () => {
    const aiCall = vi.fn(async () => 'not json at all') as unknown as AICallFn;
    await expect(
      generateTemplateDeckContent('光合作用', '高中', 2, stylePrompt, aiCall),
    ).rejects.toThrow(/schema validation/);
    expect(aiCall).toHaveBeenCalledTimes(2);
  });
});

describe('buildTemplateDeckBuffer', () => {
  const theme = buildThemeFromDesignDNA(dna(), 'sky-blue');

  it('renders every page type into a valid PPTX with cover and end slides', async () => {
    const buffer = await buildTemplateDeckBuffer({
      topic: '光合作用与能量转化',
      difficultyLabel: '高中',
      dna: dna(),
      theme,
      pages: samplePages(),
    });

    expect(buffer.length).toBeGreaterThan(30_000); // cover + 8 layouts + end
  }, 60_000);

  it('keeps page order: cover, content pages in order, end', async () => {
    const buffer = await buildTemplateDeckBuffer({
      topic: '测试主题',
      difficultyLabel: '高中',
      dna: dna(),
      theme,
      pages: samplePages().slice(0, 3),
    });
    expect(buffer.length).toBeGreaterThan(15_000);
  }, 60_000);

  it('renders an empty-ish deck (no content pages) without throwing', async () => {
    const buffer = await buildTemplateDeckBuffer({
      topic: '只有封面',
      difficultyLabel: '初中',
      dna: dna(),
      theme,
      pages: [],
    });
    expect(buffer.length).toBeGreaterThan(8_000);
  }, 60_000);
});

describe('summarizeTemplatePages', () => {
  it('numbers pages starting at 2 (cover is page 1)', () => {
    const summaries = summarizeTemplatePages(samplePages().slice(0, 2));
    expect(summaries).toEqual([
      { pageNum: 2, title: '课程目录', type: 'toc' },
      { pageNum: 3, title: '核心概念', type: 'bullets' },
    ]);
  });
});
