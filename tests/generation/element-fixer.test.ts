import { describe, expect, it } from 'vitest';
import { fixElementDefaults, processLatexElements } from '@/lib/generation/element-fixer';

type Element = Record<string, unknown>;

describe('fixElementDefaults', () => {
  it('fills missing line element defaults', () => {
    const elements: Element[] = [
      {
        type: 'line',
        id: 'line_1',
        left: 100,
        top: 200,
        width: 300,
        height: 150,
      } as unknown as Element,
    ];
    // @ts-expect-error — partial mock element — partial element shapes
    const fixed = fixElementDefaults(elements);
    const line = fixed[0] as Element;

    expect(line.points).toEqual(['', '']);
    expect(line.start).toEqual([100, 200]);
    expect(line.end).toEqual([400, 350]); // left+width, top+height
    expect(line.style).toBe('solid');
    expect(line.color).toBe('#333333');
  });

  it('preserves valid line elements', () => {
    const elements: Element[] = [
      {
        type: 'line',
        id: 'line_1',
        left: 10,
        top: 20,
        width: 200,
        height: 100,
        points: ['A', 'B'],
        start: [0, 0],
        end: [100, 100],
        style: 'dashed',
        color: '#ff0000',
      } as unknown as Element,
    ];
    // @ts-expect-error — partial mock element
    const fixed = fixElementDefaults(elements);
    const line = fixed[0] as Element;

    expect(line.points).toEqual(['A', 'B']);
    expect(line.start).toEqual([0, 0]);
    expect(line.end).toEqual([100, 100]);
    expect(line.style).toBe('dashed');
    expect(line.color).toBe('#ff0000');
  });

  it('fills missing text element defaults', () => {
    const elements: Element[] = [
      { type: 'text', id: 't1', left: 0, top: 0, width: 100, height: 50 } as Element,
    ];
    // @ts-expect-error — partial mock element
    const fixed = fixElementDefaults(elements);
    const text = fixed[0] as Element;

    expect(text.defaultFontName).toBe('Microsoft YaHei');
    expect(text.defaultColor).toBe('#333333');
    expect(text.content).toBe('');
  });

  it('fills missing shape defaults', () => {
    const elements: Element[] = [
      { type: 'shape', id: 's1', left: 50, top: 50, width: 200, height: 200 } as Element,
    ];
    // @ts-expect-error — partial mock element
    const fixed = fixElementDefaults(elements);
    const shape = fixed[0] as Element;

    expect(shape.viewBox).toBe('0 0 200 200');
    expect(shape.fill).toBe('#5b9bd5');
    expect(shape.fixedRatio).toBe(false);
  });

  it('sets fixedRatio true for images by default', () => {
    const elements: Element[] = [
      { type: 'image', id: 'img1', left: 0, top: 0, width: 400, height: 300 } as Element,
    ];
    // @ts-expect-error — partial mock element
    const fixed = fixElementDefaults(elements);
    const img = fixed[0] as Element;

    expect(img.fixedRatio).toBe(true);
  });

  it('corrects image dimensions to match known aspect ratios', () => {
    const elements: Element[] = [
      {
        type: 'image',
        id: 'img1',
        left: 0,
        top: 0,
        width: 400,
        height: 400,
        src: 'img_1',
      } as unknown as Element,
    ];

    const images = [
      {
        id: 'img_1',
        src: '',
        pageNumber: 1,
        width: 1920,
        height: 1080,
      },
    ];

    // @ts-expect-error — partial mock element
    const fixed = fixElementDefaults(elements, images);
    const img = fixed[0] as Element;

    // 1920/1080 = ~1.778; 400/400 = 1.0 → mismatch >10% → should correct
    const expectedH = Math.round(400 / (1920 / 1080)); // 225
    expect(img.height).toBe(expectedH);
  });

  it('does not modify non-defaultable element types', () => {
    const elements: Element[] = [{ type: 'chart', id: 'c1', chartType: 'bar' } as Element];
    // @ts-expect-error — partial mock element
    const fixed = fixElementDefaults(elements);

    expect(fixed[0]).toEqual(elements[0]);
  });

  it('handles empty elements array', () => {
    const fixed = fixElementDefaults([]);
    expect(fixed).toEqual([]);
  });
});

describe('processLatexElements', () => {
  it('renders valid LaTeX to HTML and adds fixedRatio', () => {
    const elements: Element[] = [
      {
        type: 'latex',
        id: 'latex_1',
        left: 50,
        top: 50,
        latex: 'E = mc^2',
        width: 100,
        height: 40,
      } as unknown as Element,
    ];
    // @ts-expect-error — partial mock element
    const processed = processLatexElements(elements);
    const result = processed[0] as Element;

    expect(result).not.toBeNull();
    expect(result.html).toBeDefined();
    expect(typeof result.html).toBe('string');
    expect((result.html as string).length).toBeGreaterThan(0);
    expect(result.fixedRatio).toBe(true);
  });

  it('removes latex element with empty latex string', () => {
    const elements: Element[] = [{ type: 'latex', id: 'empty_latex', latex: '' } as Element];
    // @ts-expect-error — partial mock element
    const processed = processLatexElements(elements);

    expect(processed).toHaveLength(0);
  });

  it('removes latex element with missing latex field', () => {
    const elements: Element[] = [{ type: 'latex', id: 'missing_latex' } as Element];
    // @ts-expect-error — partial mock element
    const processed = processLatexElements(elements);

    expect(processed).toHaveLength(0);
  });

  it('handles rendering errors gracefully', () => {
    // Invalid LaTeX should be handled by katex with throwOnError: false
    const elements: Element[] = [
      {
        type: 'latex',
        id: 'bad_latex',
        latex: '\\invalid{',
      } as unknown as Element,
    ];
    // @ts-expect-error — partial mock element
    const processed = processLatexElements(elements);

    // With throwOnError: false, katex returns error span HTML rather than throwing
    expect(processed).toHaveLength(1);
  });

  it('passes through non-latex elements unchanged', () => {
    const elements: Element[] = [
      {
        type: 'text',
        id: 't1',
        left: 10,
        top: 10,
        content: 'hello',
        width: 100,
        height: 30,
      } as Element,
      { type: 'shape', id: 's1', fill: '#000', width: 50, height: 50 } as Element,
    ];
    // @ts-expect-error — partial mock element
    const processed = processLatexElements(elements);

    expect(processed).toHaveLength(2);
    expect(processed[0].type).toBe('text');
    expect(processed[1].type).toBe('shape');
  });

  it('handles empty array', () => {
    expect(processLatexElements([])).toEqual([]);
  });
});
