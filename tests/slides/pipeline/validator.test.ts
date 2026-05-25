import { describe, expect, test } from 'vitest';
import { validateAndFixSlots } from '@/lib/slides/pipeline';
import type { TemplateSlotV2, ThemeToken } from '@/lib/slides/types';

const mockTheme: ThemeToken = {
  id: 'sky-blue',
  name: '天空蓝',
  description: '',
  coverBg: '#FFA4AB',
  contentBg: '#ffffff',
  accent: '#222BB1',
  accentSecondary: '#ECAFCC',
  accentLight: '#ffe4e6',
  coverTitleColor: '#222BB1',
  coverSubColor: '#595EAA',
  bodyColor: '#1e293b',
  bodyMutedColor: '#64748b',
  pageNumColor: '#ECAFCC',
  dividerColor: '#ffd1d5',
  fontFamily: 'Microsoft YaHei',
  headingFont: 'Montserrat',
  coverTitleSize: 40,
  coverSubSize: 20,
  titleFontSize: 28,
  bodyFontSize: 16,
  captionFontSize: 12,
  bulletSize: 18,
  useWideContent: false,
  pageMargin: 60,
  contentMaxWidth: 880,
  coverDecorations: [],
  bulletStyle: 'dot',
  shadowColor: '',
  shapeOutlineColor: '',
};

describe('pipeline validator', () => {
  test('passes through slots that fit capacity', () => {
    const slots: TemplateSlotV2[] = [
      {
        template: 'content-title-body',
        params: { title: '标题', bodyText: '短正文' },
      },
    ];
    const result = validateAndFixSlots(slots, mockTheme);
    expect(result.fixedSlots).toHaveLength(1);
    expect(result.fixes).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.fixedSlots[0].params.bodyText).toBe('短正文');
  });

  test('auto-truncates overflowing bodyText', () => {
    const slots: TemplateSlotV2[] = [
      {
        template: 'content-title-body',
        params: { title: '标题', bodyText: '溢'.repeat(500) },
      },
    ];
    const result = validateAndFixSlots(slots, mockTheme);
    expect(result.fixes.length).toBeGreaterThan(0);
    expect(result.fixedSlots[0].params.bodyText).not.toEqual(slots[0].params.bodyText);
  });

  test('auto-truncates overflowing bullets', () => {
    const slots: TemplateSlotV2[] = [
      {
        template: 'content-bullets',
        params: {
          title: '要点',
          bullets: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        },
      },
    ];
    const result = validateAndFixSlots(slots, mockTheme);
    expect(result.fixes.length).toBeGreaterThan(0);
    expect((result.fixedSlots[0].params.bullets as string[]).length).toBe(6);
  });

  test('warns for unknown template without capacity', () => {
    const slots = [
      {
        template: 'unknown-template',
        params: { title: 'test' },
      },
    ] as unknown as TemplateSlotV2[];
    const result = validateAndFixSlots(slots, mockTheme);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.fixedSlots[0].params.title).toBe('test');
  });
});
