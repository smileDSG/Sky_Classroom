import { describe, it, expect } from 'vitest';
import { exportPptx } from '@/lib/slides/pptx-exporter';
import { getDefaultDesignDNA, COLOR_PALETTES, FONT_PAIRS } from '@/lib/slides/agent/design-dna';
import { ALLOWED_LAYOUT_TYPES } from '@/lib/slides/agent/design-dna';
import type { Slide, PPTTextElement } from '@/lib/types/slides';

function textEl(content: string, overrides: Partial<PPTTextElement> = {}): PPTTextElement {
  return {
    id: `el_${content.slice(0, 6)}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'text',
    left: 100,
    top: 200,
    width: 600,
    height: 80,
    rotate: 0,
    content,
    defaultFontName: 'Microsoft YaHei',
    defaultColor: '#1e293b',
    ...overrides,
  };
}

function slide(type: Slide['type'], elements: PPTTextElement[]): Slide {
  return {
    id: `slide_${type}_${Math.random().toString(36).slice(2, 8)}`,
    viewportSize: 1000,
    viewportRatio: 0.5625,
    theme: {
      backgroundColor: '#ffffff',
      themeColors: ['#1e2761'],
      fontColor: '#1e293b',
      fontName: 'Microsoft YaHei',
    },
    elements,
    background: { type: 'solid', color: '#ffffff' },
    type,
  };
}

function templateDNA(layoutType?: string) {
  const dna = getDefaultDesignDNA();
  return {
    ...dna,
    colors: { ...COLOR_PALETTES['coral-energy'] },
    fonts: { ...FONT_PAIRS['impact-arial'] },
    ...(layoutType ? { layoutType } : {}),
  };
}

describe('exportPptx with DesignDNA template', () => {
  it('exports a deck whose cover is rendered from the template layout', async () => {
    const slides = [
      slide('cover', [textEl('勾股定理', { top: 100 }), textEl('初中数学 · 直角三角形')]),
      slide('content', [
        textEl('定理内容', { top: 80 }),
        textEl('a² + b² = c²，直角三角形两直角边的平方和等于斜边的平方。'),
      ]),
      slide('end', [textEl('谢谢观看', { top: 100 })]),
    ];

    const result = await exportPptx({
      title: '勾股定理',
      slides,
      theme: 'academic-navy',
      designDNA: templateDNA('split-panel'),
      layoutMode: 'ai',
    });

    // cover(1) + content(1) + end(1); AI cover elements are replaced by the template cover
    expect(result.size).toBeGreaterThan(20_000);
    expect(result.fileName).toContain('勾股定理');
  });

  it('renders every cover layout type without throwing', async () => {
    const slides = [slide('cover', [textEl('测试封面')]), slide('end', [textEl('结束')])];

    for (const layoutType of ALLOWED_LAYOUT_TYPES) {
      const result = await exportPptx({
        title: '版式回归',
        slides,
        theme: 'minimal',
        designDNA: templateDNA(layoutType),
        layoutMode: 'ai',
      });
      expect(result.size).toBeGreaterThan(10_000);
    }
  });

  it('falls back to hero-left when layoutType is missing', async () => {
    const slides = [slide('cover', [textEl('无版式封面')])];
    const result = await exportPptx({
      title: '无版式',
      slides,
      designDNA: templateDNA(),
    });
    expect(result.size).toBeGreaterThan(10_000);
  });
});
