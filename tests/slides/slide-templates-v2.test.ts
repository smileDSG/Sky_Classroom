/**
 * B-001: Slide Templates V2 tests
 *
 * Validates template registry, assembly, and defensive fallbacks.
 */
import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_REGISTRY_V2,
  getTemplateV2,
  getTemplateDescriptorV2,
  getTemplatesByCategoryV2,
  getAllTemplateDescriptorsV2,
  assembleSlidesV2,
} from '@/lib/slides/slide-templates-v2';
import { SKY_BLUE_THEME } from '@/lib/slides/themes/modern-editor';
import type { TemplateSlotV2 } from '@/lib/slides/types';

describe('TEMPLATE_REGISTRY_V2', () => {
  it('has at least one cover template', () => {
    const covers = Object.values(TEMPLATE_REGISTRY_V2).filter(
      (t) => t.descriptor.category === 'cover',
    );
    expect(covers.length).toBeGreaterThan(0);
  });

  it('has at least one content template', () => {
    const contents = Object.values(TEMPLATE_REGISTRY_V2).filter(
      (t) => t.descriptor.category === 'content',
    );
    expect(contents.length).toBeGreaterThan(0);
  });

  it('has at least one end template', () => {
    const ends = Object.values(TEMPLATE_REGISTRY_V2).filter(
      (t) => t.descriptor.category === 'end',
    );
    expect(ends.length).toBeGreaterThan(0);
  });

  it('every template has requiredParams array', () => {
    for (const entry of Object.values(TEMPLATE_REGISTRY_V2)) {
      expect(entry.descriptor.requiredParams).toBeInstanceOf(Array);
    }
  });

  it('every template has a non-empty visualHint', () => {
    for (const entry of Object.values(TEMPLATE_REGISTRY_V2)) {
      expect(entry.descriptor.visualHint.length).toBeGreaterThan(0);
    }
  });
});

describe('getTemplateV2', () => {
  it('returns fn for valid template id', () => {
    const fn = getTemplateV2('cover-classic');
    expect(typeof fn).toBe('function');
  });

  it('returns undefined for invalid id', () => {
    expect(getTemplateV2('nonexistent' as any)).toBeUndefined();
  });
});

describe('getTemplateDescriptorV2', () => {
  it('returns descriptor for valid id', () => {
    const desc = getTemplateDescriptorV2('content-title-body');
    expect(desc).toBeDefined();
    expect(desc?.id).toBe('content-title-body');
  });

  it('returns undefined for invalid id', () => {
    expect(getTemplateDescriptorV2('nonexistent' as any)).toBeUndefined();
  });
});

describe('getTemplatesByCategoryV2', () => {
  it('returns only cover templates', () => {
    const covers = getTemplatesByCategoryV2('cover');
    expect(covers.every((d) => d.category === 'cover')).toBe(true);
  });

  it('returns only content templates', () => {
    const contents = getTemplatesByCategoryV2('content');
    expect(contents.every((d) => d.category === 'content')).toBe(true);
  });

  it('returns only end templates', () => {
    const ends = getTemplatesByCategoryV2('end');
    expect(ends.every((d) => d.category === 'end')).toBe(true);
  });
});

describe('getAllTemplateDescriptorsV2', () => {
  it('returns all template descriptors', () => {
    const all = getAllTemplateDescriptorsV2();
    expect(all.length).toBe(Object.keys(TEMPLATE_REGISTRY_V2).length);
  });
});

describe('assembleSlidesV2', () => {
  const theme = SKY_BLUE_THEME;

  it('assembles a complete deck from valid slots', () => {
    const slots: TemplateSlotV2[] = [
      { template: 'cover-classic', params: { title: 'Test Cover', subtitle: 'Subtitle' } },
      { template: 'content-title-body', params: { title: 'Page 1', bodyText: 'Hello world' } },
      { template: 'end-thanks', params: {} },
    ];

    const slides = assembleSlidesV2(slots, theme);
    expect(slides).toHaveLength(3);
    expect(slides[0].type).toBe('cover');
    expect(slides[1].type).toBe('content');
    expect(slides[2].type).toBe('end');
  });

  it('filters out unknown template ids with fallback', () => {
    const slots: TemplateSlotV2[] = [
      { template: 'cover-classic', params: { title: 'Cover', subtitle: 'Sub' } },
      { template: 'nonexistent-template' as any, params: { title: 'Bad' } },
      { template: 'content-title-body', params: { title: 'Good', bodyText: 'Body' } },
    ];

    const slides = assembleSlidesV2(slots, theme);
    expect(slides).toHaveLength(3);
    expect(slides[0].type).toBe('cover');
    // Slot 1 fallback is a content slide
    expect(slides[1].type).toBe('content');
    expect(slides[2].type).toBe('content');
  });

  it('uses fallback for slots with missing required params', () => {
    const slots: TemplateSlotV2[] = [
      { template: 'content-title-body', params: { title: 'Has Title', bodyText: '' } },
      { template: 'content-bullets', params: { title: '', bullets: [] } },
      { template: 'content-title-body', params: { title: 'Valid', bodyText: 'Valid body' } },
    ];

    const slides = assembleSlidesV2(slots, theme);
    expect(slides).toHaveLength(3);
    // Slot 0: bodyText is empty string → fallback
    // Slot 1: title empty AND bullets empty → fallback
    // Slot 2: valid
    expect(slides[2].elements.length).toBeGreaterThan(0);
  });

  it('returns empty array for empty slots', () => {
    expect(assembleSlidesV2([], theme)).toHaveLength(0);
  });

  it('content slides have theme metadata', () => {
    const slots: TemplateSlotV2[] = [
      { template: 'content-title-body', params: { title: 'T', bodyText: 'B' } },
    ];
    const slides = assembleSlidesV2(slots, theme);
    const slide = slides[0];
    expect(slide.theme).toBeDefined();
    expect(slide.theme.backgroundColor).toBe(theme.contentBg);
    expect(slide.theme.fontColor).toBe(theme.bodyColor);
  });

  it('cover slides have cover theme metadata', () => {
    const slots: TemplateSlotV2[] = [
      { template: 'cover-classic', params: { title: 'T', subtitle: 'S' } },
    ];
    const slides = assembleSlidesV2(slots, theme);
    const slide = slides[0];
    expect(slide.theme.backgroundColor).toBe(theme.coverBg);
    expect(slide.theme.fontColor).toBe(theme.coverTitleColor);
  });

  it('fallback slide has elements', () => {
    const slots: TemplateSlotV2[] = [
      { template: 'content-title-body', params: { title: '', bodyText: '' } },
    ];
    const slides = assembleSlidesV2(slots, theme);
    expect(slides[0].elements.length).toBeGreaterThan(0);
    expect(slides[0].type).toBe('content');
  });
});

describe('Premium templates', () => {
  const theme = SKY_BLUE_THEME;

  it('contentStats generates cards with accent bar and big numbers', () => {
    const slide = getTemplateV2('content-stats')!(
      {
        title: '数据统计',
        gridItems: [
          { title: '98%', text: '通过率' },
          { title: '1.2k', text: '学生数' },
          { title: '4.9', text: '评分' },
        ],
      },
      theme,
    );
    expect(slide.type).toBe('content');
    expect(slide.elements.length).toBeGreaterThan(6);
    const cards = slide.elements.filter((el) => (el as { id?: string }).id?.startsWith('stat_card'));
    expect(cards.length).toBe(3);
  });

  it('contentHighlight has left accent block + right text', () => {
    const slide = getTemplateV2('content-highlight')!(
      { title: '核心概念', bodyText: '详细解释', subtitle: '概念' },
      theme,
    );
    expect(slide.type).toBe('content');
    const block = slide.elements.find((el) => (el as { id?: string }).id?.startsWith('hl_block'));
    expect(block).toBeDefined();
  });

  it('contentDiagram has center circle + surrounding points', () => {
    const slide = getTemplateV2('content-diagram')!(
      {
        title: '概念关系',
        keyPoints: ['A', 'B', 'C', 'D'],
      },
      theme,
    );
    expect(slide.type).toBe('content');
    const center = slide.elements.find((el) => (el as { id?: string }).id?.startsWith('dia_center'));
    expect(center).toBeDefined();
  });
});
