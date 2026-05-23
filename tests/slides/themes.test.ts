/**
 * B-001: Modern Editor Theme Token tests
 *
 * Validates theme definitions, color consistency, and registry lookups.
 */
import { describe, it, expect } from 'vitest';
import {
  SKY_BLUE_THEME,
  MINIMAL_THEME,
  ACADEMIC_THEME,
  TECH_DARK_THEME,
  NATURE_FRESH_THEME,
  ALL_THEMES,
  THEME_MAP,
  getThemeById,
  getAllThemes,
  getAllThemeIds,
} from '@/lib/slides/themes/modern-editor';
import type { ThemeToken } from '@/lib/slides/types';

describe('ALL_THEMES', () => {
  it('contains exactly 6 themes', () => {
    expect(ALL_THEMES).toHaveLength(6);
  });

  it('every theme has a unique id', () => {
    const ids = ALL_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every theme has required color fields', () => {
    for (const theme of ALL_THEMES) {
      expect(theme.coverBg).toBeTruthy();
      expect(theme.contentBg).toBeTruthy();
      expect(theme.accent).toBeTruthy();
      expect(theme.accentSecondary).toBeTruthy();
      expect(theme.accentLight).toBeTruthy();
      expect(theme.coverTitleColor).toBeTruthy();
      expect(theme.coverSubColor).toBeTruthy();
      expect(theme.bodyColor).toBeTruthy();
      expect(theme.bodyMutedColor).toBeTruthy();
      expect(theme.dividerColor).toBeTruthy();
    }
  });

  it('every theme has required typography fields', () => {
    for (const theme of ALL_THEMES) {
      expect(theme.fontFamily).toBeTruthy();
      expect(theme.headingFont).toBeTruthy();
      expect(theme.coverTitleSize).toBeGreaterThan(0);
      expect(theme.titleFontSize).toBeGreaterThan(0);
      expect(theme.bodyFontSize).toBeGreaterThan(0);
    }
  });

  it('every theme has layout fields', () => {
    for (const theme of ALL_THEMES) {
      expect(theme.pageMargin).toBeGreaterThan(0);
      expect(theme.contentMaxWidth).toBeGreaterThan(0);
      expect(theme.pageMargin * 2).toBeLessThanOrEqual(theme.contentMaxWidth);
    }
  });

  it('every theme has cover decorations', () => {
    for (const theme of ALL_THEMES) {
      expect(theme.coverDecorations).toBeInstanceOf(Array);
      expect(theme.coverDecorations.length).toBeGreaterThan(0);
    }
  });
});

describe('THEME_MAP', () => {
  it('contains all theme ids as keys', () => {
    for (const theme of ALL_THEMES) {
      expect(THEME_MAP[theme.id]).toBe(theme);
    }
  });
});

describe('getThemeById', () => {
  it('returns correct theme for each id', () => {
    expect(getThemeById('sky-blue').id).toBe('sky-blue');
    expect(getThemeById('minimal').id).toBe('minimal');
    expect(getThemeById('academic').id).toBe('academic');
    expect(getThemeById('tech-dark').id).toBe('tech-dark');
    expect(getThemeById('nature-fresh').id).toBe('nature-fresh');
  });

  it('falls back to NATURE_FRESH_THEME for unknown id', () => {
    expect(getThemeById('nonexistent').id).toBe('nature-fresh');
    expect(getThemeById('')).toBe(NATURE_FRESH_THEME);
  });
});

describe('getAllThemes', () => {
  it('returns all 6 themes', () => {
    expect(getAllThemes()).toHaveLength(6);
  });
});

describe('getAllThemeIds', () => {
  it('returns all theme ids', () => {
    const ids = getAllThemeIds();
    expect(ids).toHaveLength(6);
    expect(ids).toContain('sky-blue');
    expect(ids).toContain('tech-dark');
    expect(ids).toContain('macaron-pink');
  });
});

describe('Theme color consistency', () => {
  it('tech-dark has dark contentBg and light bodyColor', () => {
    const dark = TECH_DARK_THEME;
    expect(dark.contentBg).toMatch(/^#3d|#4a/); // deep purple
    expect(dark.bodyColor).toMatch(/^#e/); // light text
  });

  it('light themes have white/light contentBg and dark bodyColor', () => {
    for (const theme of [SKY_BLUE_THEME, MINIMAL_THEME, ACADEMIC_THEME, NATURE_FRESH_THEME]) {
      expect(theme.contentBg.toLowerCase()).toMatch(/^#fff|#faf|#f0f|#faf/);
      expect(theme.bodyColor.toLowerCase()).toMatch(/^#1e|#0f|#42|#2c|#21/);
    }
  });

  it('every theme has distinct accent color', () => {
    const accents = ALL_THEMES.map((t) => t.accent.toLowerCase());
    expect(new Set(accents).size).toBe(accents.length);
  });
});

describe('Theme gradient definitions', () => {
  it('themes with coverBgGradient have valid from/to colors', () => {
    for (const theme of ALL_THEMES) {
      if (theme.coverBgGradient) {
        expect(theme.coverBgGradient.from).toBeTruthy();
        expect(theme.coverBgGradient.to).toBeTruthy();
        expect(theme.coverBgGradient.angle).toBeGreaterThanOrEqual(0);
        expect(theme.coverBgGradient.angle).toBeLessThanOrEqual(360);
      }
    }
  });
});
