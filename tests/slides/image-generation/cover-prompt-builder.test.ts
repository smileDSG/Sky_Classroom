import { describe, expect, test } from 'vitest';
import { buildCoverPrompt, buildConceptPrompt, buildSlideImagePrompt } from '@/lib/slides/image-generation';
import type { ThemeToken } from '@/lib/slides/types';

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

describe('cover-prompt-builder', () => {
  test('buildCoverPrompt includes topic and palette', () => {
    const prompt = buildCoverPrompt('勾股定理', mockTheme);
    expect(prompt).toContain('勾股定理');
    expect(prompt).toContain(mockTheme.accent);
    expect(prompt).toContain('16:9');
    expect(prompt).toContain('No text');
  });

  test('buildConceptPrompt includes concept summary', () => {
    const prompt = buildConceptPrompt('勾股定理', '直角三角形三边关系', mockTheme);
    expect(prompt).toContain('勾股定理');
    expect(prompt).toContain('直角三角形三边关系');
    expect(prompt).toContain('infographic');
  });

  test('buildSlideImagePrompt selects cover builder for cover role', () => {
    const prompt = buildSlideImagePrompt('牛顿定律', '运动定律', mockTheme, 'cover');
    expect(prompt).toContain('Educational presentation cover illustration');
  });

  test('buildSlideImagePrompt selects concept builder for concept role', () => {
    const prompt = buildSlideImagePrompt('牛顿定律', '运动定律', mockTheme, 'concept');
    expect(prompt).toContain('Educational illustration explaining');
  });
});
