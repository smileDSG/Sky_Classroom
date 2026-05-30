import { describe, it, expect, vi } from 'vitest';
import { InstructionExecutor } from '@/lib/slides/agent/instruction-executor';

// Minimal pptxgenjs mock
function createMockSlide() {
  const texts: Array<{ text: string; opts: Record<string, unknown> }> = [];
  const formulas: Array<{ opts: Record<string, unknown> }> = [];
  const tables: Array<{ data: unknown[][]; opts: Record<string, unknown> }> = [];

  const slide = {
    addText: vi.fn((text: string, opts: Record<string, unknown>) => {
      texts.push({ text, opts });
    }),
    addFormula: vi.fn((opts: Record<string, unknown>) => {
      formulas.push({ opts });
    }),
    addTable: vi.fn((data: unknown[][], opts: Record<string, unknown>) => {
      tables.push({ data, opts });
    }),
    addShape: vi.fn(),
    addImage: vi.fn(),
    addChart: vi.fn(),
    background: {} as { color?: string; path?: string },
    _texts: texts,
    _formulas: formulas,
    _tables: tables,
  };
  return slide;
}

const mockPres = {
  shapes: { RECTANGLE: 'rect', OVAL: 'oval', LINE: 'line', ROUNDED_RECTANGLE: 'roundRect' },
  charts: { BAR: 'bar', LINE: 'line', PIE: 'pie' },
} as unknown as import('pptxgenjs').default;

describe('InstructionExecutor', () => {
  const executor = new InstructionExecutor();

  describe('addText filtering', () => {
    it('filters [Formula] placeholder text', () => {
      const slide = createMockSlide();
      const result = executor.execute(
        slide as unknown as import('pptxgenjs').Slide,
        mockPres,
        [
          { op: 'addText', params: { text: '[Formula]', x: 1, y: 2, w: 8, h: 1, fontSize: 14 } },
          { op: 'addText', params: { text: '正常文本', x: 1, y: 3, w: 8, h: 1 } },
        ],
        1,
      );
      expect(result.success).toBe(true);
      expect(slide._texts.length).toBe(1);
      expect(slide._texts[0].text).toBe('正常文本');
    });

    it('filters orphaned arrow symbols', () => {
      const slide = createMockSlide();
      executor.execute(
        slide as unknown as import('pptxgenjs').Slide,
        mockPres,
        [
          { op: 'addText', params: { text: '→', x: 1, y: 2, w: 1, h: 0.5 } },
          { op: 'addText', params: { text: '->', x: 1, y: 2.5, w: 1, h: 0.5 } },
          { op: 'addText', params: { text: '步骤1', x: 1, y: 3, w: 3, h: 0.5 } },
        ],
        1,
      );
      expect(slide._texts.length).toBe(1);
      expect(slide._texts[0].text).toBe('步骤1');
    });
  });

  describe('addText LaTeX sanitization', () => {
    it('converts leaked LaTeX commands to Unicode', () => {
      const slide = createMockSlide();
      executor.execute(
        slide as unknown as import('pptxgenjs').Slide,
        mockPres,
        [
          { op: 'addText', params: { text: '\\Delta G = -nFE，电动势', x: 1, y: 2, w: 8, h: 1 } },
          { op: 'addText', params: { text: '温度 \\approx 298 K', x: 1, y: 3, w: 8, h: 1 } },
          { op: 'addText', params: { text: '\\alpha + \\beta \\rightarrow \\gamma', x: 1, y: 4, w: 8, h: 1 } },
        ],
        1,
      );
      expect(slide._texts.length).toBe(3);
      expect(slide._texts[0].text).toBe('Δ G = -nFE，电动势');
      expect(slide._texts[1].text).toBe('温度 ≈ 298 K');
      expect(slide._texts[2].text).toBe('α + β → γ');
    });

    it('converts inline $...$ LaTeX to Unicode', () => {
      const slide = createMockSlide();
      executor.execute(
        slide as unknown as import('pptxgenjs').Slide,
        mockPres,
        [
          { op: 'addText', params: { text: '离子浓度 $Na^+$ 和 $Cl^-$', x: 1, y: 2, w: 8, h: 1 } },
          { op: 'addText', params: { text: '化学式 $H_2O$ 和 $CO_2$', x: 1, y: 3, w: 8, h: 1 } },
        ],
        1,
      );
      expect(slide._texts.length).toBe(2);
      expect(slide._texts[0].text).toContain('Na⁺');
      expect(slide._texts[0].text).toContain('Cl⁻');
      expect(slide._texts[1].text).toContain('H₂O');
      expect(slide._texts[1].text).toContain('CO₂');
    });
  });

  describe('addTable rendering', () => {
    it('renders table with string cells', () => {
      const slide = createMockSlide();
      executor.execute(
        slide as unknown as import('pptxgenjs').Slide,
        mockPres,
        [
          {
            op: 'addTable',
            params: {
              headers: ['A', 'B'],
              rows: [
                ['1', '2'],
                ['3', '4'],
                ['5', '6'],
              ],
              x: 1, y: 2, w: 8,
            },
          },
        ],
        1,
      );
      expect(slide._tables.length).toBe(1);
      const data = slide._tables[0].data as Array<Array<{ text: string }>>;
      expect(data.length).toBe(4); // header + 3 rows
      expect(data[1][0].text).toBe('1');
      expect(data[3][1].text).toBe('6');
    });

    it('skips addTable when cells are objects (schema validation fails)', () => {
      // deepRepairContent in section-agent is responsible for fixing object cells
      // before they reach the instruction executor. If they slip through,
      // schema validation rejects the instruction.
      const slide = createMockSlide();
      const result = executor.execute(
        slide as unknown as import('pptxgenjs').Slide,
        mockPres,
        [
          {
            op: 'addTable',
            params: {
              headers: ['A', 'B'],
              rows: [
                ['1', '2'],
                [{ text: '3' } as unknown as string, '4'],
              ],
              x: 1, y: 2, w: 8,
            },
          },
        ],
        1,
      );
      expect(slide._tables.length).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].op).toBe('addTable');
    });
  });
});
