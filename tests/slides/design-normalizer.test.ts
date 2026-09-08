import { describe, it, expect } from 'vitest';
import { normalizeSlideDesign, slideBackgroundColor } from '@/lib/slides/design-normalizer';
import {
  getDefaultDesignDNA,
  COLOR_PALETTES,
  FONT_PAIRS,
  type DesignDNA,
} from '@/lib/slides/agent/design-dna';
import type { Slide, PPTTextElement, PPTShapeElement } from '@/lib/types/slides';

function dna(): DesignDNA {
  const base = getDefaultDesignDNA();
  return {
    ...base,
    colors: { ...COLOR_PALETTES['forest-moss'] },
    fonts: { ...FONT_PAIRS['impact-arial'] },
    layoutType: 'hero-centered',
  };
}

function textEl(content: string, overrides: Partial<PPTTextElement> = {}): PPTTextElement {
  return {
    id: `t_${Math.random().toString(36).slice(2, 8)}`,
    type: 'text',
    left: 60,
    top: 45,
    width: 500,
    height: 76,
    rotate: 0,
    content,
    defaultFontName: 'Microsoft YaHei',
    defaultColor: '#333333',
    ...overrides,
  };
}

function shapeEl(overrides: Partial<PPTShapeElement> = {}): PPTShapeElement {
  return {
    id: `s_${Math.random().toString(36).slice(2, 8)}`,
    type: 'shape',
    left: 50,
    top: 120,
    width: 900,
    height: 330,
    rotate: 0,
    path: 'M0 0 L900 0 L900 330 L0 330 Z',
    viewBox: [900, 330],
    fill: '#5b9bd5',
    fixedRatio: false,
    ...overrides,
  } as PPTShapeElement;
}

function slide(type: Slide['type'], elements: PPTElement[], bg?: Slide['background']): Slide {
  return {
    id: `s_${Math.random().toString(36).slice(2, 8)}`,
    viewportSize: 1000,
    viewportRatio: 0.5625,
    theme: {
      backgroundColor: '#ffffff',
      themeColors: ['#ffffff'],
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
    },
    elements,
    background: bg ?? { type: 'solid', color: '#ffffff' },
    type,
  };
}

describe('normalizeSlideDesign', () => {
  it('remaps off-palette element colors to the template palette', () => {
    const richBody = textEl('这是一段足够长的正文内容，用于避免触发空面板清理逻辑的判定条件。', {
      top: 200,
      defaultColor: '#333333',
    });
    const [s] = normalizeSlideDesign(
      [
        slide('content', [
          textEl('正文', { defaultColor: '#333333' }),
          shapeEl({ fill: '#5b9bd5' }),
          richBody,
        ]),
      ],
      dna(),
    );
    const t = s.elements[0] as PPTTextElement;
    const sh = s.elements[1] as PPTShapeElement;
    const paletteValues = Object.values(COLOR_PALETTES['forest-moss']).map((c) => `#${c}`);
    expect(paletteValues).toContain(t.defaultColor.toUpperCase());
    expect(paletteValues).toContain(sh.fill?.toUpperCase());
    // #333333 should snap to the dark text token
    expect(t.defaultColor.toUpperCase()).toBe('#1B3A1D');
  });

  it('unifies fonts: title uses heading font, body uses body font, inline font-family stripped', () => {
    const [s] = normalizeSlideDesign(
      [
        slide('content', [
          textEl('<p style="font-size:32px;font-family:Arial;">标题</p>'),
          textEl('<p style="font-family:Georgia;">正文内容</p>', { top: 200 }),
        ]),
      ],
      dna(),
    );
    const title = s.elements[0] as PPTTextElement;
    const body = s.elements[1] as PPTTextElement;
    expect(title.defaultFontName).toBe('SimHei');
    expect(body.defaultFontName).toBe('SimHei');
    expect(title.content).not.toContain('font-family');
    expect(body.content).not.toContain('font-family');
  });

  it('rewrites undersized title font-size to the template scale', () => {
    const [s] = normalizeSlideDesign(
      [
        slide('content', [
          textEl('<p style="font-size:32px;"><strong>植物如何捕获光能</strong></p>', {
            width: 600,
          }),
        ]),
      ],
      dna(),
    );
    const title = s.elements[0] as PPTTextElement;
    expect(title.content).toMatch(/font-size:\s*(?:[4-9]\d|5[0-6])px/i);
    expect(title.content).not.toContain('32px');
  });

  it('repairs dark text on the dark end-slide background', () => {
    const [s] = normalizeSlideDesign(
      [
        slide(
          'end',
          [
            textEl('核心结论回顾', { defaultColor: '#1B3A1D' }),
            textEl('要点正文', { defaultColor: '#333333', top: 200 }),
          ],
          { type: 'solid', color: '#0B3D2E' },
        ),
      ],
      dna(),
    );
    for (const el of s.elements) {
      expect((el as PPTTextElement).defaultColor.toUpperCase()).toBe('#F5F5F5'); // textOnDark
    }
  });

  it('drops naked panels on near-empty content slides', () => {
    const [s] = normalizeSlideDesign(
      [slide('content', [textEl('光反应 vs 暗反应对比'), shapeEl()])],
      dna(),
    );
    expect(s.elements.some((el) => el.type === 'shape')).toBe(false);
  });

  it('keeps panels on content-rich slides', () => {
    const rich = textEl(
      '<p>这是信息量充足的一段内容，包含足够的文字数量，因此页面上的面板形状应当被保留下来，不应被误删。</p>',
      { top: 200 },
    );
    const [s] = normalizeSlideDesign([slide('content', [textEl('标题'), shapeEl(), rich])], dna());
    expect(s.elements.some((el) => el.type === 'shape')).toBe(true);
  });

  it('leaves cover slides untouched', () => {
    const original = textEl('<p style="font-size:20px;color:#123456;">封面标题</p>', {
      defaultColor: '#123456',
    });
    const [s] = normalizeSlideDesign([slide('cover', [original])], dna());
    expect(s.elements[0]).toBe(original);
  });

  it('leaves unparsable colors alone', () => {
    const [s] = normalizeSlideDesign(
      [slide('content', [textEl('文本', { defaultColor: 'not-a-color' })])],
      dna(),
    );
    expect((s.elements[0] as PPTTextElement).defaultColor).toBe('not-a-color');
  });

  it('maps line colors into the palette', () => {
    const line = {
      id: 'l1',
      type: 'line' as const,
      left: 100,
      top: 100,
      width: 200,
      rotate: 0,
      start: [100, 100] as [number, number],
      end: [300, 100] as [number, number],
      color: '#0D47A1',
      style: 'solid' as const,
    };
    const [s] = normalizeSlideDesign([slide('content', [textEl('标题'), line])], dna());
    const paletteValues = Object.values(COLOR_PALETTES['forest-moss']).map((c) => `#${c}`);
    const mapped = (s.elements[1] as { color: string }).color.toUpperCase();
    expect(paletteValues).toContain(mapped);
  });
});

describe('slideBackgroundColor', () => {
  it('prefers slide background over fallback', () => {
    const s = slide('content', [], { type: 'solid', color: '#0B3D2E' });
    expect(slideBackgroundColor(s, '#ffffff')).toBe('#0B3D2E');
  });

  it('falls back when background is missing or an image', () => {
    const noBg = slide('content', []);
    noBg.background = undefined;
    expect(slideBackgroundColor(noBg, '#ffffff')).toBe('#ffffff');
    const imgBg = slide('content', [], { type: 'image', image: { src: '/x.png', size: 'cover' } });
    expect(slideBackgroundColor(imgBg, '#ffffff')).toBe('#ffffff');
  });
});
