import { describe, it, expect } from 'vitest';
import { buildThemeFromDesignDNA } from '@/lib/slides/pptx-themes';
import {
  getDefaultDesignDNA,
  COLOR_PALETTES,
  FONT_PAIRS,
  type DesignDNA,
} from '@/lib/slides/agent/design-dna';

function dnaWithPalette(paletteId: string, fontId: string): DesignDNA {
  const base = getDefaultDesignDNA();
  return {
    ...base,
    colors: { ...COLOR_PALETTES[paletteId] },
    fonts: { ...FONT_PAIRS[fontId] },
  };
}

describe('buildThemeFromDesignDNA', () => {
  it('overrides theme colors and fonts from DesignDNA', () => {
    const dna = dnaWithPalette('forest-moss', 'impact-arial');
    const theme = buildThemeFromDesignDNA(dna, 'sky-blue');

    expect(theme.coverBg).toBe('#2C5F2D');
    expect(theme.contentBg).toBe('#F5F5F5');
    expect(theme.accent).toBe('#97BC62');
    expect(theme.accentSecondary).toBe('#2C5F2D');
    expect(theme.accentLight).toBe('#E8F0E0');
    expect(theme.coverTitleColor).toBe('#F5F5F5'); // textOnDark
    expect(theme.coverSubColor).toBe('#94A3B8'); // textMuted
    expect(theme.bodyColor).toBe('#1B3A1D'); // textPrimary
    expect(theme.bodyMutedColor).toBe('#94A3B8');
    expect(theme.pageNumColor).toBe('#94A3B8');
    expect(theme.dividerColor).toBe('#E8F0E0');
    expect(theme.shapeOutlineColor).toBe('#E8F0E0');
    expect(theme.fontFamily).toBe('Noto Sans SC');
    expect(theme.headingFont).toBe('Noto Sans SC');
  });

  it('forces 思源黑体 and base-theme title sizes regardless of DNA font pair', () => {
    const dna = dnaWithPalette('midnight-executive', 'georgia-calibri');
    const theme = buildThemeFromDesignDNA(dna, 'minimal');

    expect(theme.coverTitleSize).toBe(42); // base minimal coverTitleSize
    expect(theme.titleFontSize).toBe(30); // base minimal titleFontSize
    expect(theme.bodyFontSize).toBe(15); // bodySize 13 + 2
    expect(theme.coverSubSize).toBe(20); // base minimal coverSubSize
  });

  it('clamps font sizes to sane PPTX ranges', () => {
    const dna = dnaWithPalette('midnight-executive', 'impact-arial'); // headingSize 56
    const theme = buildThemeFromDesignDNA(dna, 'tech-dark');
    expect(theme.coverTitleSize).toBe(40); // base tech-dark coverTitleSize
    expect(theme.bodyFontSize).toBe(16); // bodySize 14 + 2
    expect(theme.captionFontSize).toBe(12); // captionSize 10 + 2
  });

  it('keeps base theme layout metrics and decorations', () => {
    const dna = getDefaultDesignDNA();
    const theme = buildThemeFromDesignDNA(dna, 'academic-navy');

    expect(theme.id).toBe('academic-navy');
    expect(theme.pageMargin).toBe(60);
    expect(theme.useWideContent).toBe(false);
    expect(theme.coverDecorations.length).toBeGreaterThan(0);
    expect(theme.name).toContain(dna.styleName);
  });

  it('recolors the cover gradient with the template palette', () => {
    const dna = dnaWithPalette('coral-energy', 'calibri-light');
    const theme = buildThemeFromDesignDNA(dna, 'academic-navy');

    expect(theme.coverBgGradient).toBeDefined();
    expect(theme.coverBgGradient!.from).toBe('#F96167');
    expect(theme.coverBgGradient!.to).toBe('#FFF5E6');
  });

  it('works for every base theme id', () => {
    const ids = [
      'academic-navy',
      'minimal',
      'academic',
      'tech-dark',
      'nature-fresh',
      'macaron-pink',
    ] as const;
    for (const id of ids) {
      const theme = buildThemeFromDesignDNA(getDefaultDesignDNA(), id);
      expect(theme.coverBg).toBe('#1B2A4A');
      expect(theme.id).toBe(id);
    }
  });
});
