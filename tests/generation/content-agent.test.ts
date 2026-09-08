import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { SceneOutline } from '@/lib/types/generation';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import {
  structuredContentSchema,
  inferContentTypeFromOutline,
  generateStructuredContent,
  type StructuredContent,
  type ContentType,
} from '@/lib/generation/classroom-content-agent';

// ── Task 1: Schema Tests ────────────────────────────────────────────

describe('Task 1: structuredContentSchema', () => {
  it('validates concept content', () => {
    const concept: StructuredContent = {
      type: 'concept',
      title: '光合作用的概念',
      cards: [
        { title: '光反应', desc: '光反应是光合作用的第一阶段，发生在类囊体膜上，需要光能驱动。' },
        {
          title: '暗反应',
          desc: '暗反应是光合作用的第二阶段，发生在叶绿体基质中，不需要光能直接参与。',
        },
        {
          title: '能量转化',
          desc: '光合作用将光能转化为化学能，储存在有机物中，为生物提供能量来源。',
        },
      ],
      summary: '光合作用是植物利用光能将二氧化碳和水转化为有机物的过程。',
    };
    const result = structuredContentSchema.safeParse(concept);
    expect(result.success).toBe(true);
  });

  it('validates concept with formulas', () => {
    const concept: StructuredContent = {
      type: 'concept',
      title: '光合作用的概念',
      cards: [
        { title: '光反应', desc: '光反应是光合作用的第一阶段，发生在类囊体膜上，需要光能驱动。' },
        {
          title: '暗反应',
          desc: '暗反应是光合作用的第二阶段，发生在叶绿体基质中，不需要光能直接参与。',
        },
      ],
      summary: '光合作用是植物利用光能将二氧化碳和水转化为有机物的过程。',
      formulas: [{ label: '总反应式', latex: '6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2' }],
    };
    const result = structuredContentSchema.safeParse(concept);
    expect(result.success).toBe(true);
  });

  it('validates case content', () => {
    const caseContent: StructuredContent = {
      type: 'case',
      title: '光合作用案例分析',
      scenarios: [
        {
          problem: '为什么植物在光照不足时会出现生长缓慢的现象？请从光合作用的角度进行分析。',
          solution:
            '光照不足导致光反应减弱，ATP和NADPH生成减少，进而影响暗反应中碳的固定，最终导致有机物合成减少。',
        },
        {
          problem: '在实际农业生产中，如何提高大棚作物的产量？请提出具体可行的措施。',
          solution:
            '可以通过增加光照强度、延长光照时间、提高二氧化碳浓度、合理施肥等方式来促进光合作用，从而提高作物产量。',
        },
      ],
      highlight: '光照是光合作用的关键因素',
    };
    const result = structuredContentSchema.safeParse(caseContent);
    expect(result.success).toBe(true);
  });

  it('validates compare content', () => {
    const compare: StructuredContent = {
      type: 'compare',
      title: '光反应与暗反应对比',
      left: {
        title: '光反应',
        items: [
          '必须在有光照条件下才能进行反应',
          '在叶绿体的类囊体膜上进行',
          '能够产生ATP和NADPH供暗反应使用',
          '分解水分子并释放氧气到大气中',
        ],
      },
      right: {
        title: '暗反应',
        items: [
          '不需要光照直接参与反应过程',
          '在叶绿体基质中进行酶促反应',
          '消耗光反应产生的ATP和NADPH',
          '固定二氧化碳并生成有机物',
        ],
      },
      conclusion: '光反应和暗反应相互配合，共同完成光合作用，缺一不可。',
    };
    const result = structuredContentSchema.safeParse(compare);
    expect(result.success).toBe(true);
  });

  it('validates process content', () => {
    const process: StructuredContent = {
      type: 'process',
      title: '光合作用过程',
      steps: [
        {
          num: '1',
          title: '光吸收',
          desc: '叶绿素分子吸收光能后，电子被激发到高能级状态，这是光反应的起始步骤。',
        },
        {
          num: '2',
          title: '电子传递',
          desc: '激发态电子通过类囊体膜上的电子传递链传递，逐步释放能量用于合成ATP。',
        },
        {
          num: '3',
          title: '碳固定',
          desc: '二氧化碳与RuBP结合，经过卡尔文循环的一系列酶促反应生成有机物。',
        },
      ],
    };
    const result = structuredContentSchema.safeParse(process);
    expect(result.success).toBe(true);
  });

  it('validates summary content', () => {
    const summary: StructuredContent = {
      type: 'summary',
      title: '本章总结',
      keyPoints: [
        '光合作用是植物利用光能合成有机物的过程',
        '光反应发生在类囊体膜上，产生ATP和NADPH',
        '暗反应在叶绿体基质中进行，固定二氧化碳',
        '光合作用对维持地球生态系统至关重要',
      ],
      preview: '下一章将学习细胞呼吸',
    };
    const result = structuredContentSchema.safeParse(summary);
    expect(result.success).toBe(true);
  });

  it('validates table content', () => {
    const table: StructuredContent = {
      type: 'table',
      title: '光合作用与呼吸作用对比',
      headers: ['特征', '光合作用', '呼吸作用'],
      rows: [
        ['场所', '叶绿体', '线粒体'],
        ['能量变化', '光能→化学能', '化学能→ATP'],
        ['原料', 'CO₂和H₂O', '有机物和O₂'],
      ],
      summary: '光合作用和呼吸作用是相互关联的代谢过程。',
    };
    const result = structuredContentSchema.safeParse(table);
    expect(result.success).toBe(true);
  });

  it('validates formula content', () => {
    const formula: StructuredContent = {
      type: 'formula',
      title: '光合作用总反应式',
      mainFormula: '6CO_2 + 6H_2O \\xrightarrow{光} C_6H_{12}O_6 + 6O_2',
      derivation: '光合作用中，6分子二氧化碳和6分子水在光能作用下生成1分子葡萄糖和6分子氧气。',
      application: '该方程式可用于计算光合作用中物质的转化量。',
    };
    const result = structuredContentSchema.safeParse(formula);
    expect(result.success).toBe(true);
  });

  it('rejects invalid content type', () => {
    const invalid = {
      type: 'invalid',
      title: 'Test',
    };
    const result = structuredContentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects concept with too few cards', () => {
    const concept = {
      type: 'concept',
      title: 'Test',
      cards: [
        {
          title: 'Only one',
          desc: 'This is the only card with enough description text to pass validation.',
        },
      ],
      summary: 'Summary text here.',
    };
    const result = structuredContentSchema.safeParse(concept);
    expect(result.success).toBe(false);
  });

  it('rejects compare with too few left items', () => {
    const compare = {
      type: 'compare',
      title: 'Test',
      left: { title: 'A', items: ['one'] },
      right: { title: 'B', items: ['one', 'two', 'three'] },
      conclusion: 'Conclusion text here.',
    };
    const result = structuredContentSchema.safeParse(compare);
    expect(result.success).toBe(false);
  });

  it('rejects formula without mainFormula', () => {
    const formula = {
      type: 'formula',
      title: 'Test',
      derivation: 'Derivation text here.',
    };
    const result = structuredContentSchema.safeParse(formula);
    expect(result.success).toBe(false);
  });
});

// ── Task 2: inferContentTypeFromOutline Tests ───────────────────────

describe('Task 2: inferContentTypeFromOutline', () => {
  it('returns formula for formula/equation keywords in title', () => {
    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '光合作用总反应式',
      description: '展示光合作用的化学方程式',
      keyPoints: ['方程式', '化学反应'],
      order: 1,
    };
    expect(inferContentTypeFromOutline(outline)).toBe('formula');
  });

  it('returns compare for comparison keywords', () => {
    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '光反应与暗反应对比',
      description: '比较两个过程的异同',
      keyPoints: ['对比', '异同'],
      order: 1,
    };
    expect(inferContentTypeFromOutline(outline)).toBe('compare');
  });

  it('returns case for case/scenario keywords', () => {
    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '光合作用案例分析',
      description: '通过实际案例理解原理',
      keyPoints: ['案例', '分析'],
      order: 1,
    };
    expect(inferContentTypeFromOutline(outline)).toBe('case');
  });

  it('returns process for step/process keywords', () => {
    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '光合作用过程',
      description: '分步骤讲解光合作用',
      keyPoints: ['步骤', '过程'],
      order: 1,
    };
    expect(inferContentTypeFromOutline(outline)).toBe('process');
  });

  it('returns table for table keywords', () => {
    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '对比表格',
      description: '用表格展示对比',
      keyPoints: ['表格', '对比'],
      order: 1,
    };
    expect(inferContentTypeFromOutline(outline)).toBe('table');
  });

  it('returns summary for summary keywords', () => {
    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '本章总结',
      description: '总结本章要点',
      keyPoints: ['总结', '要点'],
      order: 1,
    };
    expect(inferContentTypeFromOutline(outline)).toBe('summary');
  });

  it('returns concept as default fallback', () => {
    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '光合作用的概念',
      description: '介绍光合作用的基本概念',
      keyPoints: ['概念', '定义'],
      order: 1,
    };
    expect(inferContentTypeFromOutline(outline)).toBe('concept');
  });

  it('uses keyPoints for keyword matching', () => {
    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '化学反应',
      description: '介绍反应',
      keyPoints: ['公式', '计算'],
      order: 1,
    };
    expect(inferContentTypeFromOutline(outline)).toBe('formula');
  });

  it('returns concept when no specific keywords match', () => {
    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '植物生理学',
      description: '介绍植物生理学基础',
      keyPoints: ['基础', '原理'],
      order: 1,
    };
    expect(inferContentTypeFromOutline(outline)).toBe('concept');
  });
});

// ── Task 3: generateStructuredContent Tests ─────────────────────────

describe('Task 3: generateStructuredContent', () => {
  it('calls aiCallFn with correct prompt structure', async () => {
    const mockAICall = vi.fn<AICallFn>().mockResolvedValue(
      JSON.stringify({
        type: 'concept',
        title: '光合作用',
        cards: [
          {
            title: '定义',
            desc: '光合作用是绿色植物利用光能将二氧化碳和水转化为有机物并释放氧气的生化过程。',
          },
          {
            title: '场所',
            desc: '光合作用主要在叶绿体中进行，叶绿体含有叶绿素等光合色素，能够捕获光能。',
          },
          {
            title: '意义',
            desc: '光合作用是地球上最重要的化学反应之一，为几乎所有生物提供能量和氧气来源。',
          },
        ],
        summary: '光合作用是植物利用光能合成有机物的过程，对生命系统至关重要。',
      }),
    );

    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '光合作用的概念',
      description: '介绍光合作用',
      keyPoints: ['定义', '场所', '意义'],
      order: 1,
    };

    const result = await generateStructuredContent({
      outline,
      aiCallFn: mockAICall,
      subject: '生物学',
      grade: '高中',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.type).toBe('concept');
    expect(mockAICall).toHaveBeenCalledTimes(1);

    const [, userPrompt] = mockAICall.mock.calls[0];
    expect(userPrompt).toContain('光合作用的概念');
    expect(userPrompt).toContain('生物学');
  });

  it('returns error when aiCallFn throws', async () => {
    const mockAICall = vi.fn<AICallFn>().mockRejectedValue(new Error('Network error'));

    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: 'Test',
      description: 'Test desc',
      keyPoints: ['a', 'b'],
      order: 1,
    };

    const result = await generateStructuredContent({
      outline,
      aiCallFn: mockAICall,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('returns error when AI returns invalid JSON', async () => {
    const mockAICall = vi.fn<AICallFn>().mockResolvedValue('not json at all');

    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: 'Test',
      description: 'Test desc',
      keyPoints: ['a', 'b'],
      order: 1,
    };

    const result = await generateStructuredContent({
      outline,
      aiCallFn: mockAICall,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error when AI returns JSON that fails schema validation', async () => {
    const mockAICall = vi.fn<AICallFn>().mockResolvedValue(
      JSON.stringify({
        type: 'concept',
        title: 'Test',
        // missing required cards and summary
      }),
    );

    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: 'Test',
      description: 'Test desc',
      keyPoints: ['a', 'b'],
      order: 1,
    };

    const result = await generateStructuredContent({
      outline,
      aiCallFn: mockAICall,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('parses JSON wrapped in markdown fences', async () => {
    const mockAICall = vi.fn<AICallFn>().mockResolvedValue(`\`\`\`json
{
  "type": "summary",
  "title": "本章总结",
  "keyPoints": [
    "第一要点内容详细展开说明",
    "第二要点内容详细展开说明",
    "第三要点内容详细展开说明",
    "第四要点内容详细展开说明"
  ]
}
\`\`\``);

    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '总结',
      description: '总结内容',
      keyPoints: ['a', 'b', 'c', 'd'],
      order: 1,
    };

    const result = await generateStructuredContent({
      outline,
      aiCallFn: mockAICall,
    });

    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('summary');
  });

  it('passes inferred content type to prompt', async () => {
    const mockAICall = vi.fn<AICallFn>().mockResolvedValue(
      JSON.stringify({
        type: 'formula',
        title: '质能方程',
        mainFormula: 'E = mc^2',
        derivation:
          '爱因斯坦在狭义相对论中提出，质量和能量可以相互转化。当物体释放能量时，其质量会相应减少。',
      }),
    );

    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '重要公式',
      description: '展示公式',
      keyPoints: ['公式', '推导'],
      order: 1,
    };

    const result = await generateStructuredContent({
      outline,
      aiCallFn: mockAICall,
      contentType: 'formula',
    });

    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('formula');
  });

  it('handles compare content generation', async () => {
    const mockAICall = vi.fn<AICallFn>().mockResolvedValue(
      JSON.stringify({
        type: 'compare',
        title: '对比分析',
        left: {
          title: 'A方案',
          items: ['实施成本相对较低容易接受', '技术成熟稳定风险较小', '适用范围广泛兼容性好'],
        },
        right: {
          title: 'B方案',
          items: ['长期效益显著回报率高', '创新程度高技术领先行业', '可持续发展性强环保节能'],
        },
        conclusion: '两种方案各有优势和不足，需根据实际需求和预算进行选择。',
      }),
    );

    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '对比',
      description: '对比分析',
      keyPoints: ['对比', '差异'],
      order: 1,
    };

    const result = await generateStructuredContent({
      outline,
      aiCallFn: mockAICall,
      contentType: 'compare',
    });

    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('compare');
  });

  it('handles table content generation', async () => {
    const mockAICall = vi.fn<AICallFn>().mockResolvedValue(
      JSON.stringify({
        type: 'table',
        title: '数据表格',
        headers: ['项目', '数值A', '数值B'],
        rows: [
          ['第一组数据', '数值内容b', '数值内容c'],
          ['第二组数据', '数值内容e', '数值内容f'],
        ],
        summary: '表格展示了各组数据的对比情况，可以清晰看出差异。',
      }),
    );

    const outline: SceneOutline = {
      id: '1',
      type: 'slide',
      title: '表格',
      description: '数据展示',
      keyPoints: ['数据', '对比'],
      order: 1,
    };

    const result = await generateStructuredContent({
      outline,
      aiCallFn: mockAICall,
      contentType: 'table',
    });

    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('table');
  });
});
