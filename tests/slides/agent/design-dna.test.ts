import { describe, it, expect } from 'vitest';
import {
  validateDesignDNA,
  getDefaultDesignDNA,
  COLOR_PALETTES,
  FONT_PAIRS,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_FONT_PAIR,
} from '@/lib/slides/agent/design-dna';
import type { DesignDNA } from '@/lib/slides/agent/design-dna';

function makeValidDNA(overrides: Partial<DesignDNA> = {}): DesignDNA {
  return {
    styleName: '科技深色',
    recommended: true,
    colors: { ...COLOR_PALETTES['tech-dark-cn'] },
    fonts: { ...FONT_PAIRS['georgia-calibri'] },
    decoration: { motif: 'neon-grid', density: 'moderate', cornerWeight: 'top-right' },
    components: { cardStyle: 'accent-left-bar', bulletStyle: 'dot', pageNumberStyle: 'number-slash-total' },
    mood: '科技前沿',
    bestFor: ['物理', '编程'],
    ...overrides,
  };
}

describe('DesignDNA', () => {
  describe('validateDesignDNA', () => {
    it('passes valid DNA unchanged', () => {
      const dna = makeValidDNA();
      const result = validateDesignDNA(dna);
      expect(result.valid).toBe(true);
      expect(result.replacementCount).toBe(0);
      expect(result.designDNA.styleName).toBe('科技深色');
    });

    it('replaces invalid color with default palette color', () => {
      const dna = makeValidDNA({ colors: { ...COLOR_PALETTES['tech-dark-cn'], coverBg: 'FF00FF' } });
      const result = validateDesignDNA(dna);
      expect(result.replacementCount).toBeGreaterThan(0);
      expect(result.designDNA.colors.coverBg).not.toBe('FF00FF');
      expect(result.designDNA.colors.coverBg).toBe(DEFAULT_COLOR_PALETTE.coverBg);
    });

    it('replaces invalid motif with geometric-lines', () => {
      const dna = makeValidDNA({ decoration: { motif: 'invalid-motif' as never, density: 'moderate', cornerWeight: 'top-right' } });
      const result = validateDesignDNA(dna);
      expect(result.designDNA.decoration.motif).toBe('geometric-lines');
    });

    it('replaces invalid card style', () => {
      const dna = makeValidDNA({ components: { cardStyle: 'bogus' as never, bulletStyle: 'dot', pageNumberStyle: 'simple-number' } });
      const result = validateDesignDNA(dna);
      expect(result.designDNA.components.cardStyle).toBe('accent-left-bar');
    });

    it('fills missing fields from defaults', () => {
      const incomplete = { styleName: 'test', recommended: false };
      const result = validateDesignDNA(incomplete);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.designDNA.colors.coverBg).toBe(DEFAULT_COLOR_PALETTE.coverBg);
      expect(result.designDNA.fonts.en).toBe(DEFAULT_FONT_PAIR.en);
    });

    it('marks invalid when replacementCount > 3', () => {
      const dna = makeValidDNA({
        colors: { coverBg: 'FF0001', contentBg: 'FF0002', accent: 'FF0003', accentSecondary: 'FF0004', accentLight: 'FF0005', textPrimary: 'FF0006', textBody: 'FF0007', textMuted: 'FF0008', textOnDark: 'FF0009' },
        decoration: { motif: 'bad' as never, density: 'bad' as never, cornerWeight: '' },
      });
      const result = validateDesignDNA(dna);
      expect(result.valid).toBe(false);
      expect(result.replacementCount).toBeGreaterThan(3);
    });

    it('validates hex color format', () => {
      const dna = makeValidDNA({ colors: { ...COLOR_PALETTES['tech-dark-cn'], coverBg: 'GGGGGG' } });
      const result = validateDesignDNA(dna);
      expect(result.designDNA.colors.coverBg).toBe(DEFAULT_COLOR_PALETTE.coverBg);
    });
  });

  describe('getDefaultDesignDNA', () => {
    it('returns complete valid DNA', () => {
      const dna = getDefaultDesignDNA();
      const result = validateDesignDNA(dna);
      expect(result.valid).toBe(true);
      expect(dna.colors.coverBg).toBeTruthy();
      expect(dna.fonts.en).toBeTruthy();
      expect(dna.decoration.motif).toBeTruthy();
    });
  });

  describe('Color Palettes', () => {
    it('all palettes have 9 color fields', () => {
      for (const [name, palette] of Object.entries(COLOR_PALETTES)) {
        expect(Object.keys(palette).length, `Palette ${name} missing fields`).toBe(9);
      }
    });

    it('all colors are valid 6-char hex', () => {
      for (const palette of Object.values(COLOR_PALETTES)) {
        for (const color of Object.values(palette)) {
          expect(color).toMatch(/^[0-9A-Fa-f]{6}$/);
        }
      }
    });
  });

  describe('Font Pairs', () => {
    it('all pairs have required fields', () => {
      for (const [name, pair] of Object.entries(FONT_PAIRS)) {
        expect(pair.heading, `Font pair ${name} missing heading`).toBeTruthy();
        expect(pair.en, `Font pair ${name} missing en`).toBeTruthy();
        expect(pair.headingSize, `Font pair ${name} headingSize out of range`).toBeGreaterThan(0);
      }
    });
  });
});
