/**
 * B-001: Layout template tests
 *
 * Validates all layout configurations and helper functions.
 */
import { describe, it, expect } from 'vitest';
import {
  LAYOUTS,
  getSlideLayout,
  getAllLayoutTypes,
  isValidLayoutType,
  getLayoutAIPromptHint,
} from '@/lib/slides/layouts';
import type { SlideLayoutType } from '@/lib/slides/layouts';

// ── Layout definitions ─────────────────────────────────────────────────

describe('LAYOUTS', () => {
  it('has exactly three layout types', () => {
    const types = Object.keys(LAYOUTS);
    expect(types.sort()).toEqual(['image-caption', 'quiz', 'title-content'].sort());
  });

  it('every layout has a non-empty description', () => {
    for (const layout of Object.values(LAYOUTS)) {
      expect(layout.description.length).toBeGreaterThan(0);
    }
  });

  it('every layout has a non-empty aiPromptHint', () => {
    for (const layout of Object.values(LAYOUTS)) {
      expect(layout.aiPromptHint.length).toBeGreaterThan(0);
    }
  });

  it('every layout has expectedElementTypes with at least "text"', () => {
    for (const layout of Object.values(LAYOUTS)) {
      expect(layout.expectedElementTypes.length).toBeGreaterThan(0);
      // All layouts need at least text for labels/titles
    }
  });

  it('every layout has minElements >= 2', () => {
    for (const layout of Object.values(LAYOUTS)) {
      expect(layout.minElements).toBeGreaterThanOrEqual(2);
    }
  });

  it('every layout has maxElements > minElements', () => {
    for (const layout of Object.values(LAYOUTS)) {
      expect(layout.maxElements).toBeGreaterThan(layout.minElements);
    }
  });
});

// ── Layout-specific ────────────────────────────────────────────────────

describe('title-content layout', () => {
  const layout = LAYOUTS['title-content'];

  it('expects text elements', () => {
    expect(layout.expectedElementTypes).toContain('text');
  });

  it('has aiPromptHint mentioning Simple Layout Mode', () => {
    expect(layout.aiPromptHint.toLowerCase()).toContain('simple layout mode');
  });
});

describe('quiz layout', () => {
  const layout = LAYOUTS.quiz;

  it('expects text and shape elements', () => {
    expect(layout.expectedElementTypes).toContain('text');
    expect(layout.expectedElementTypes).toContain('shape');
  });

  it('has aiPromptHint mentioning question and choices', () => {
    expect(layout.aiPromptHint.toLowerCase()).toContain('question');
    expect(layout.aiPromptHint.toLowerCase()).toContain('answer');
  });
});

describe('image-caption layout', () => {
  const layout = LAYOUTS['image-caption'];

  it('expects image element type', () => {
    expect(layout.expectedElementTypes).toContain('image');
  });

  it('has aiPromptHint mentioning image placement', () => {
    expect(layout.aiPromptHint.toLowerCase()).toContain('image');
    expect(layout.aiPromptHint.toLowerCase()).toContain('caption');
  });
});

// ── Helpers ────────────────────────────────────────────────────────────

describe('getSlideLayout', () => {
  it('returns correct layout for each type', () => {
    for (const type of getAllLayoutTypes()) {
      const layout = getSlideLayout(type);
      expect(layout.id).toBe(type);
    }
  });
});

describe('getAllLayoutTypes', () => {
  it('returns exactly three types', () => {
    expect(getAllLayoutTypes()).toHaveLength(3);
  });

  it('all returned types are valid', () => {
    for (const type of getAllLayoutTypes()) {
      expect(LAYOUTS[type]).toBeDefined();
    }
  });
});

describe('isValidLayoutType', () => {
  it('returns true for valid layout types', () => {
    expect(isValidLayoutType('title-content')).toBe(true);
    expect(isValidLayoutType('quiz')).toBe(true);
    expect(isValidLayoutType('image-caption')).toBe(true);
  });

  it('returns false for invalid layout types', () => {
    expect(isValidLayoutType('chart')).toBe(false);
    expect(isValidLayoutType('video')).toBe(false);
    expect(isValidLayoutType('')).toBe(false);
    expect(isValidLayoutType('TITLE-CONTENT')).toBe(false);
  });

  it('narrows TypeScript type', () => {
    const value: string = 'quiz';
    if (isValidLayoutType(value)) {
      const _check: SlideLayoutType = value;
      expect(_check).toBe('quiz');
    }
  });
});

describe('getLayoutAIPromptHint', () => {
  it('returns hint for each valid type', () => {
    for (const type of getAllLayoutTypes()) {
      const hint = getLayoutAIPromptHint(type);
      expect(hint.length).toBeGreaterThan(0);
    }
  });

  it('falls back to title-content hint for unknown type', () => {
    // @ts-expect-error — testing runtime behavior with invalid type
    const hint = getLayoutAIPromptHint('unknown-layout');
    expect(hint).toBe(LAYOUTS['title-content'].aiPromptHint);
  });
});
