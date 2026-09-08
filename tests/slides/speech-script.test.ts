/**
 * B-006: Speech script builder tests
 */
import { describe, it, expect } from 'vitest';
import { buildSlideScript, buildFullScript } from '@/lib/slides/speech-script';
import type { Slide, PPTElement } from '@/lib/types/slides';

function makeSlide(type: string, elements: PPTElement[]): Slide {
  return {
    id: `s_${type}`,
    viewportSize: 1000,
    viewportRatio: 0.5625,
    theme: { backgroundColor: '#fff', themeColors: [], fontColor: '#333', fontName: 'YaHei' },
    elements,
    type: type as Slide['type'],
  };
}

describe('buildSlideScript', () => {
  it('extracts text from text elements with highlight', () => {
    const el: PPTElement = {
      id: 'text_1',
      type: 'text',
      left: 60,
      top: 60,
      width: 880,
      height: 70,
      content: '<p style="font-size:32px;"><strong>勾股定理</strong></p>',
      defaultFontName: 'YaHei',
      defaultColor: '#333',
      rotate: 0,
    } as PPTElement;
    const slide = makeSlide('cover', [el]);
    const script = buildSlideScript(slide, 0);
    expect(script.slideIndex).toBe(0);
    const textSegs = script.segments.filter((s) => s.highlightElementId === 'text_1');
    expect(textSegs.length).toBeGreaterThan(0);
    expect(textSegs[0].text).toContain('勾股定理');
  });

  it('converts LaTeX to spoken form', () => {
    const el: PPTElement = {
      id: 'latex_1',
      type: 'latex',
      left: 60,
      top: 200,
      width: 400,
      height: 70,
      latex: 'a^2 + b^2 = c^2',
      color: '#000',
      rotate: 0,
    } as PPTElement;
    const slide = makeSlide('content', [el]);
    const script = buildSlideScript(slide, 0);
    const latexSeg = script.segments.find((s) => s.highlightElementId === 'latex_1');
    expect(latexSeg).toBeDefined();
    expect(latexSeg!.text).toContain('次方');
    expect(latexSeg!.text).not.toContain('\\frac');
  });

  it('handles fraction formulas', () => {
    const el: PPTElement = {
      id: 'latex_2',
      type: 'latex',
      left: 0,
      top: 0,
      width: 400,
      height: 70,
      latex: '\\frac{1}{2} + \\frac{3}{4} = \\frac{5}{4}',
      color: '#000',
      rotate: 0,
    } as PPTElement;
    const slide = makeSlide('content', [el]);
    const script = buildSlideScript(slide, 0);
    const latexSeg = script.segments.find((s) => s.highlightElementId === 'latex_2');
    expect(latexSeg).toBeDefined();
    expect(latexSeg!.text).toContain('除以');
    expect(latexSeg!.text).not.toContain('\\');
  });

  it('adds slide transition for non-first slides', () => {
    const slide = makeSlide('content', []);
    const script = buildSlideScript(slide, 1);
    const transSeg = script.segments.find(
      (s) => s.highlightElementId === null && s.text.includes('第'),
    );
    expect(transSeg).toBeDefined();
    expect(transSeg!.text).toContain('第2页');
  });

  it('no transition for first slide (index 0)', () => {
    const slide = makeSlide('cover', []);
    const script = buildSlideScript(slide, 0);
    const transSeg = script.segments.find((s) => s.text.includes('第') && s.text.includes('页'));
    expect(transSeg).toBeUndefined();
  });

  it('returns empty segments for slide with only images', () => {
    const img: PPTElement = {
      id: 'img_1',
      type: 'image',
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      src: '',
      fixedRatio: true,
      rotate: 0,
    } as PPTElement;
    const slide = makeSlide('content', [img]);
    const script = buildSlideScript(slide, 0);
    const textSegs = script.segments.filter((s) => s.text.length > 0);
    expect(textSegs).toHaveLength(0);
  });

  it('separates title elements from body', () => {
    const title: PPTElement = {
      id: 't1',
      type: 'text',
      left: 60,
      top: 60,
      width: 880,
      height: 70,
      content: '<p style="font-size:32px;">Title</p>',
      defaultFontName: '',
      defaultColor: '#333',
      rotate: 0,
    } as PPTElement;
    const body: PPTElement = {
      id: 'b1',
      type: 'text',
      left: 60,
      top: 170,
      width: 880,
      height: 118,
      content: '<p style="font-size:16px;">Body text</p>',
      defaultFontName: '',
      defaultColor: '#333',
      rotate: 0,
    } as PPTElement;
    const slide = makeSlide('content', [title, body]);
    const script = buildSlideScript(slide, 1);
    // Find title segment index vs body segment index
    const titleIdx = script.segments.findIndex((s) => s.highlightElementId === 't1');
    const bodyIdx = script.segments.findIndex((s) => s.highlightElementId === 'b1');
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(bodyIdx).toBeGreaterThanOrEqual(0);
    expect(titleIdx).toBeLessThan(bodyIdx); // title comes first
  });
});

describe('buildFullScript', () => {
  it('returns one SlideScript per slide', () => {
    const s1 = makeSlide('cover', []);
    const s2 = makeSlide('content', []);
    const scripts = buildFullScript([s1, s2]);
    expect(scripts).toHaveLength(2);
    expect(scripts[0].slideIndex).toBe(0);
    expect(scripts[1].slideIndex).toBe(1);
  });

  it('slide indices are sequential', () => {
    const slides = Array.from({ length: 5 }, (_, i) => makeSlide('content', []));
    const scripts = buildFullScript(slides);
    expect(scripts.map((s) => s.slideIndex)).toEqual([0, 1, 2, 3, 4]);
  });
});
