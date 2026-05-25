import { describe, expect, test } from 'vitest';
import { countChars, estimateLines, estimateContentFit } from '@/lib/slides/content-sizing';
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

describe('text-measurer', () => {
  test('countChars counts CJK correctly', () => {
    expect(countChars('')).toBe(0);
    expect(countChars('hello')).toBe(5);
    expect(countChars('你好世界')).toBe(4);
    expect(countChars('Hello 世界')).toBe(8);
  });

  test('estimateLines for empty text', () => {
    expect(estimateLines('', 16, 880)).toBe(0);
  });

  test('estimateLines for short text', () => {
    const text = '短文本';
    const lines = estimateLines(text, 16, 880, 'Microsoft YaHei');
    expect(lines).toBe(1);
  });

  test('estimateLines accounts for line breaks', () => {
    const text = '第一行\n第二行\n第三行';
    const lines = estimateLines(text, 16, 880, 'Microsoft YaHei');
    expect(lines).toBeGreaterThanOrEqual(3);
  });

  test('estimateLines for long CJK text', () => {
    // 880px width, 16px font, ~14px avg char width => ~62 chars/line
    const text = '这是一段很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长的文本';
    const lines = estimateLines(text, 16, 880, 'Microsoft YaHei');
    expect(lines).toBeGreaterThan(1);
  });

  test('estimateContentFit passes for content within capacity', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-title-body',
      params: {
        title: '简短标题',
        bodyText: '这是正文内容，长度适中，不应该溢出。',
      },
    };
    const result = estimateContentFit(slot, mockTheme);
    expect(result.fits).toBe(true);
    expect(result.overflows).toHaveLength(0);
  });

  test('estimateContentFit detects body text overflow', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-title-body',
      params: {
        title: '标题',
        bodyText: '溢'.repeat(500), // 500 chars > 350 limit
      },
    };
    const result = estimateContentFit(slot, mockTheme);
    expect(result.fits).toBe(false);
    expect(result.overflows.length).toBeGreaterThan(0);
    expect(result.overflows[0].field).toBe('bodyText');
  });

  test('estimateContentFit detects bullet overflow', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-bullets',
      params: {
        title: '要点',
        bullets: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], // 7 > 6 limit
      },
    };
    const result = estimateContentFit(slot, mockTheme);
    expect(result.fits).toBe(false);
    expect(result.overflows.some((o) => o.field === 'bullets')).toBe(true);
  });

  test('estimateContentFit detects step overflow', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-steps',
      params: {
        title: '步骤',
        steps: [
          { title: '1', text: 'a' },
          { title: '2', text: 'b' },
          { title: '3', text: 'c' },
          { title: '4', text: 'd' },
          { title: '5', text: 'e' }, // 5 > 4 limit
        ],
      },
    };
    const result = estimateContentFit(slot, mockTheme);
    expect(result.fits).toBe(false);
  });

  test('unknown template returns fits=true', () => {
    const slot = {
      template: 'nonexistent-template',
      params: { title: 'test' },
    } as unknown as TemplateSlotV2;
    const result = estimateContentFit(slot, mockTheme);
    expect(result.fits).toBe(true);
  });
});
