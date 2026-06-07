import { describe, it, expect } from 'vitest';
import { InstructionExecutor, type Instruction } from '@/lib/slides/agent/instruction-executor';
import pptxgen from 'pptxgenjs';

describe('InstructionExecutor', () => {
  const executor = new InstructionExecutor();

  function makeSlide() {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';
    return { slide: pres.addSlide(), pres };
  }

  it('executes setBackground instruction', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      { op: 'setBackground', params: { color: '1A2744' } },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('executes addText instruction', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      { op: 'addText', params: { text: '勾股定理', x: 1, y: 2, w: 5, h: 1, fontSize: 36, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true } },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
  });

  it('executes addShape instruction', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      { op: 'addShape', params: { type: 'RECTANGLE', x: 1, y: 1, w: 3, h: 2, fillColor: 'F0E6C8', fillTransparency: 10 } },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
  });

  it('executes addTable instruction', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      { op: 'addTable', params: { headers: ['A', 'B', 'C'], rows: [['1', '2', '3'], ['4', '5', '6']], x: 1, y: 1, w: 8, headerBgColor: '1E293B', headerColor: 'FFFFFF', borderColor: 'E2E8F0' } },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
  });

  it('executes addChart instruction', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      { op: 'addChart', params: { chartType: 'BAR', data: [{ name: 'Data', labels: ['A', 'B'], values: [10, 20] }], x: 1, y: 1, w: 8, h: 4 } },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
  });

  it('skips unknown op with error logged', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      { op: 'unknownOp' as never, params: {} },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBeTruthy();
  });

  it('continues after failed instruction', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      { op: 'addText' as never, params: {} },
      { op: 'setBackground', params: { color: '1A2744' } },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    // Second instruction should still execute
    expect(result.errors).toHaveLength(1);
  });

  it('validates hex color format', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      { op: 'setBackground', params: { color: 'NOTHEX' } },
    ];
    // Should fail schema validation
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(false);
  });

  it('executes multiple instruction types in sequence', async () => {
    const { slide, pres } = makeSlide();
    const instructions: Instruction[] = [
      { op: 'setBackground', params: { color: '1A2744' } },
      { op: 'addText', params: { text: 'Title', x: 1, y: 0.5, w: 5, h: 0.7, fontSize: 34, color: 'FFFFFF' } },
      { op: 'addShape', params: { type: 'OVAL', x: 8, y: 4, w: 2, h: 2, fillColor: 'D4A843', fillTransparency: 88 } },
    ];
    const result = await executor.execute(slide, pres, instructions, 1);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
