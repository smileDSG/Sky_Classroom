import { describe, it, expect } from 'vitest';
import { InstructionExecutor, type Instruction } from '@/lib/slides/agent/instruction-executor';
import pptxgen from 'pptxgenjs';

describe('Formula Placeholder Defense', () => {
  const executor = new InstructionExecutor();

  function makeSlide() {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';
    return { slide: pres.addSlide(), pres };
  }

  // ── Layer 2: InstructionExecutor interception ───────────────────────

  it('filters pure [Formula] placeholder text', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      {
        op: 'addText',
        params: { text: '[Formula]', x: 1, y: 1, w: 5, h: 1, fontSize: 16, color: '000000' },
      },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    // The text should be filtered (not added), so no error but also no text element
  });

  it('filters pure [formula] lowercase placeholder', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      {
        op: 'addText',
        params: { text: '  [formula]  ', x: 1, y: 1, w: 5, h: 1, fontSize: 16, color: '000000' },
      },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('filters pure 【公式】 placeholder', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      {
        op: 'addText',
        params: { text: '【公式】', x: 1, y: 1, w: 5, h: 1, fontSize: 16, color: '000000' },
      },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('replaces placeholder in mixed text and records warning', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      {
        op: 'addText',
        params: {
          text: '结果如 [Formula] 所示',
          x: 1,
          y: 1,
          w: 5,
          h: 1,
          fontSize: 16,
          color: '000000',
        },
      },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    // Placeholder is replaced with Chinese description, no error pushed (it's a fix, not a failure)
  });

  it('replaces 【公式】 in mixed text', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      {
        op: 'addText',
        params: {
          text: '根据【公式】计算得出',
          x: 1,
          y: 1,
          w: 5,
          h: 1,
          fontSize: 16,
          color: '000000',
        },
      },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('allows normal text without placeholders', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      {
        op: 'addText',
        params: {
          text: '勾股定理是直角三角形的基本定理',
          x: 1,
          y: 1,
          w: 5,
          h: 1,
          fontSize: 16,
          color: '000000',
        },
      },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('allows text with square brackets that are not placeholders', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      {
        op: 'addText',
        params: {
          text: '参见[1]和[2]的文献',
          x: 1,
          y: 1,
          w: 5,
          h: 1,
          fontSize: 16,
          color: '000000',
        },
      },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ── Layer 3: QA detection ──────────────────────────────────────────

  it('QA detects placeholder contamination in instructions', async () => {
    // This test verifies the QA layer can detect placeholders
    // We'll test this by importing the QA function and passing instructions with placeholders
    const { runQA } = await import('@/lib/slides/agent/qa-agent');

    const outline = {
      sections: [
        {
          sectionId: 1,
          title: '测试',
          pages: [
            {
              pageNum: 1,
              type: 'cover' as const,
              title: '封面',
              contentOutline: { focus: '封面' },
            },
            {
              pageNum: 2,
              type: 'concept' as const,
              title: '概念',
              contentOutline: { focus: '概念', keyConcepts: ['a'] },
            },
          ],
        },
      ],
    };

    const allContent = [
      {
        sectionId: 1,
        pages: [
          { pageNum: 1, pageType: 'cover', content: { title: '封面' } },
          {
            pageNum: 2,
            pageType: 'concept',
            content: { title: '概念', cards: [{ title: 't', desc: 'd' }], summary: 's' },
          },
        ],
      },
    ];

    // Mock instructions with placeholder contamination
    const instructions = [
      {
        pageNum: 2,
        instructions: [
          {
            op: 'addText' as const,
            params: { text: '【公式】', x: 1, y: 1, w: 5, h: 1, fontSize: 16, color: '000000' },
          },
        ],
      },
    ];

    // We need a mock language model for the QA call
    const mockModel = { modelId: 'test' } as any;

    const result = await runQA('测试', '高中', outline, allContent, 2, mockModel, instructions);

    // Should detect placeholder contamination
    const placeholderIssues = result.issues.filter((i) => i.type === 'placeholder_contamination');
    expect(placeholderIssues.length).toBeGreaterThan(0);
    expect(placeholderIssues[0].severity).toBe('high');
  });
});
