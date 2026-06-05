/**
 * Regression tests for PPT generation fixes:
 *  1. Formula deduplication in fallback merge (page-design-agent)
 *  2. addShape skip when no fill/line (instruction-executor)
 *  3. Empty placeholder removal from slide master (pptx-exporter)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLM = vi.fn();
vi.mock('@/lib/ai/llm', () => ({ callLLM: (...args: unknown[]) => mockCallLLM(...args) }));

import { designPage } from '@/lib/slides/agent/page-design-agent';
import { InstructionExecutor } from '@/lib/slides/agent/instruction-executor';
import { getDefaultDesignDNA } from '@/lib/slides/agent/design-dna';
import type { LanguageModel } from 'ai';
import pptxgen from 'pptxgenjs';

const mockModel = { modelId: 'test' } as unknown as LanguageModel;
const designDNA = getDefaultDesignDNA();

describe('PPT Fixes — Formula deduplication', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT duplicate formulas for concept pages in fallback merge', async () => {
    // LLM returns sparse instructions (only title + 1 card) → triggers fallback
    const sparseLlmOutput = JSON.stringify({
      pageNum: 4,
      instructions: [
        { op: 'addText', params: { text: '光合作用的过程', x: 0.8, y: 0.5, w: 11.7, h: 0.7, fontSize: 24, bold: true } },
        { op: 'addText', params: { text: '概念卡片', x: 0.8, y: 1.5, w: 11.7, h: 0.4, fontSize: 16, bold: true } },
        { op: 'addText', params: { text: '这是概念描述。', x: 0.8, y: 2.0, w: 11.7, h: 1.0, fontSize: 13 } },
      ],
    });
    mockCallLLM.mockResolvedValueOnce({ text: sparseLlmOutput });

    const content = {
      title: '光合作用的过程',
      cards: [
        { title: '概念卡片', desc: '这是概念描述。' },
        { title: '另一个卡片', desc: '这是另一个描述。' },
      ],
      summary: '总结内容',
      formulas: [
        { label: '水的光解', latex: '2H_2O \\rightarrow O_2 + 4H^+ + 4e^-' },
        { label: 'NADP+还原', latex: 'NADP^+ + 2e^- + H^+ \\rightarrow NADPH' },
      ],
    };

    const result = await designPage(4, 'concept', content, 10, designDNA, mockModel);
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.pageInstructions).toBeDefined();

    const instructions = result.pageInstructions!.instructions;
    const formulaInsts = instructions.filter((i) => i.op === 'addFormula');
    const formulaLatexList = formulaInsts.map((i) => (i.params as { latex: string }).latex);

    // Each unique latex should appear at most once
    const uniqueLatex = new Set(formulaLatexList);
    expect(uniqueLatex.size).toBe(formulaLatexList.length);

    // We expect exactly 2 unique formulas (not 4 or 6)
    expect(formulaLatexList.length).toBe(2);
  });

  it('does NOT inject formulas for chapter pages (no formula support in schema)', async () => {
    const sparseLlmOutput = JSON.stringify({
      pageNum: 3,
      instructions: [
        { op: 'addText', params: { text: '第二章', x: 0.8, y: 0.5, w: 11.7, h: 0.7, fontSize: 24, bold: true } },
        { op: 'addText', params: { text: '化学方程式与配平', x: 0.8, y: 2.0, w: 11.7, h: 0.5, fontSize: 18 } },
      ],
    });
    mockCallLLM.mockResolvedValueOnce({ text: sparseLlmOutput });

    const content = { num: '02', title: '化学方程式', subtitle: '掌握化学方程式的书写与配平方法' };
    const result = await designPage(3, 'chapter', content, 10, designDNA, mockModel);
    expect(result.success).toBe(true);

    const instructions = result.pageInstructions!.instructions;
    const formulaInsts = instructions.filter((i) => i.op === 'addFormula');
    expect(formulaInsts.length).toBe(0);
  });
});

describe('PPT Fixes — Instruction Executor', () => {
  it('skips addShape when neither fillColor nor lineColor is provided', async () => {
    const pres = new pptxgen();
    const slide = pres.addSlide();
    const executor = new InstructionExecutor();

    const instructions = [
      { op: 'addShape', params: { type: 'RECTANGLE', x: 0, y: 0, w: 1, h: 1 } },
      { op: 'addShape', params: { type: 'RECTANGLE', x: 0, y: 0, w: 1, h: 1, fillColor: '#FF0000' } },
    ];

    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.errors.length).toBe(0);
    // Only the second shape (with fillColor) should be added
    const shapesAfter = (slide as unknown as { _slideObjects: Array<{ shape?: string }> })._slideObjects.filter((o) => o.shape);
    expect(shapesAfter.length).toBe(1);
  });

  it('adds shape when lineColor is provided even without fillColor', async () => {
    const pres = new pptxgen();
    const slide = pres.addSlide();
    const executor = new InstructionExecutor();

    const instructions = [
      { op: 'addShape', params: { type: 'RECTANGLE', x: 0, y: 0, w: 1, h: 1, lineColor: '#000000' } },
    ];

    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.errors.length).toBe(0);
    const shapesAfter = (slide as unknown as { _slideObjects: Array<{ shape?: string }> })._slideObjects.filter((o) => o.shape);
    expect(shapesAfter.length).toBe(1);
  });
});
