/**
 * Theme Token System Tests
 *
 * Validates the ThemeToken registry integrity, including the handdrawn theme.
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_THEMES,
  THEME_MAP,
  getThemeById,
  getAllThemeIds,
  getAllThemes,
  HANDDRAWN_THEME,
} from '@/lib/slides/themes/modern-editor';
import { PPTX_THEMES, getPptxTheme } from '@/lib/slides/pptx-themes';
import type { PptxThemeId } from '@/lib/slides/types';

describe('Theme Registry', () => {
  it('should contain exactly 7 themes', () => {
    expect(ALL_THEMES).toHaveLength(7);
  });

  it('should include all expected theme IDs', () => {
    const ids = getAllThemeIds();
    expect(ids).toEqual([
      'sky-blue',
      'minimal',
      'academic',
      'tech-dark',
      'nature-fresh',
      'macaron-pink',
      'handdrawn',
    ]);
  });

  it('should have each theme accessible by ID via THEME_MAP', () => {
    for (const theme of ALL_THEMES) {
      expect(THEME_MAP[theme.id]).toBeDefined();
      expect(THEME_MAP[theme.id].id).toBe(theme.id);
    }
  });

  it('should return the correct theme via getThemeById', () => {
    expect(getThemeById('sky-blue').id).toBe('sky-blue');
    expect(getThemeById('handdrawn').id).toBe('handdrawn');
  });

  it('should fallback to nature-fresh for unknown IDs', () => {
    const fallback = getThemeById('nonexistent-theme');
    expect(fallback.id).toBe('nature-fresh');
  });

  it('should return all themes via getAllThemes', () => {
    expect(getAllThemes()).toHaveLength(7);
    expect(getAllThemes()).toBe(ALL_THEMES);
  });
});

describe('Handdrawn Theme', () => {
  it('should be defined with correct ID', () => {
    expect(HANDDRAWN_THEME.id).toBe('handdrawn');
  });

  it('should have correct display metadata', () => {
    expect(HANDDRAWN_THEME.name).toBe('手绘风');
    expect(HANDDRAWN_THEME.description).toContain('暖黄纸张');
  });

  it('should use paper-inspired color palette', () => {
    expect(HANDDRAWN_THEME.coverBg).toBe('#F5F0E6');
    expect(HANDDRAWN_THEME.contentBg).toBe('#FDFCF8');
    expect(HANDDRAWN_THEME.accent).toBe('#D4A574');
  });

  it('should have cover decorations', () => {
    expect(HANDDRAWN_THEME.coverDecorations.length).toBeGreaterThan(0);
  });

  it('should have a gradient on cover', () => {
    expect(HANDDRAWN_THEME.coverBgGradient).toBeDefined();
    expect(HANDDRAWN_THEME.coverBgGradient!.from).toBe('#F5F0E6');
    expect(HANDDRAWN_THEME.coverBgGradient!.to).toBe('#EDE4D3');
  });

  it('should be accessible via theme lookup', () => {
    const found = getThemeById('handdrawn');
    expect(found.id).toBe('handdrawn');
    expect(found.name).toBe('手绘风');
  });
});

describe('PPTX Themes (backward compatibility)', () => {
  it('should contain exactly 7 PPTX themes', () => {
    expect(Object.keys(PPTX_THEMES)).toHaveLength(7);
  });

  it('should include handdrawn in PPTX_THEMES', () => {
    expect(PPTX_THEMES['handdrawn']).toBeDefined();
    expect(PPTX_THEMES['handdrawn'].id).toBe('handdrawn');
  });

  it('should map each PptxThemeId to a valid PptxTheme', () => {
    const ids: PptxThemeId[] = [
      'sky-blue',
      'minimal',
      'academic',
      'tech-dark',
      'nature-fresh',
      'macaron-pink',
      'handdrawn',
    ];

    for (const id of ids) {
      const theme = getPptxTheme(id);
      expect(theme).toBeDefined();
      expect(theme.id).toBe(id);
    }
  });

  it('should fallback to sky-blue for unknown PPTX theme IDs', () => {
    const fallback = getPptxTheme('unknown-id' as PptxThemeId);
    expect(fallback.id).toBe('sky-blue');
  });
});
