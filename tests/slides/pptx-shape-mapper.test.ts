/**
 * B-001: PPTX Shape Mapper tests
 *
 * Validates shape preset library and high-level mapping behavior.
 */
import { describe, it, expect } from 'vitest';
import {
  mapShapeToPptx,
  isNativeShape,
  getShapePreset,
} from '@/lib/slides/pptx-shape-mapper';

describe('getShapePreset', () => {
  it('returns preset for known shapes', () => {
    expect(getShapePreset('rect')).toEqual({
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
    });
    expect(getShapePreset('ellipse')).toEqual({
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
    });
    expect(getShapePreset('arrow')).toEqual({
      path: 'M 0 30 L 60 30 L 60 0 L 100 50 L 60 100 L 60 70 L 0 70 Z',
      viewBox: '0 0 100 100',
    });
  });

  it('returns null for unknown shape names', () => {
    expect(getShapePreset('hexagon' as any)).toBeNull();
    expect(getShapePreset('' as any)).toBeNull();
  });

  it('all presets have non-empty path and viewBox', () => {
    const knownShapes = ['rect', 'roundRect', 'ellipse', 'triangle', 'arrow', 'chevron', 'cross', 'plus', 'donut'];
    for (const name of knownShapes) {
      const preset = getShapePreset(name as any);
      expect(preset).toBeDefined();
      expect(preset!.path.length).toBeGreaterThan(0);
      expect(preset!.viewBox.length).toBeGreaterThan(0);
    }
  });
});

describe('mapShapeToPptx', () => {
  it('returns a valid mapping for simple rectangle paths', () => {
    const result = mapShapeToPptx('M 0 0 L 100 0 L 100 100 L 0 100 Z', '0 0 100 100');
    expect(result).toBeDefined();
    expect(result!.shapeType).toBeTruthy();
  });

  it('returns a valid mapping for circle/ellipse paths', () => {
    const result = mapShapeToPptx(
      'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      '0 0 100 100',
    );
    expect(result).toBeDefined();
    expect(result!.shapeType).toBeTruthy();
  });

  it('returns null for empty input', () => {
    expect(mapShapeToPptx('', '')).toBeNull();
    expect(mapShapeToPptx('', '0 0 100 100')).toBeNull();
  });

  it('returns a mapping with shapeType in allowed set', () => {
    const allowed = ['rect', 'roundRect', 'ellipse', 'triangle', 'arrow', 'chevron', 'cross', 'plus', 'donut', 'custGeom'];
    const preset = getShapePreset('rect');
    const result = mapShapeToPptx(preset!.path, preset!.viewBox);
    expect(result).toBeDefined();
    expect(allowed).toContain(result!.shapeType);
  });
});

describe('isNativeShape', () => {
  it('returns true for preset rect path', () => {
    const preset = getShapePreset('rect');
    expect(isNativeShape(preset!.path, preset!.viewBox)).toBe(true);
  });

  it('returns true for preset ellipse path', () => {
    const preset = getShapePreset('ellipse');
    expect(isNativeShape(preset!.path, preset!.viewBox)).toBe(true);
  });

  it('returns false for empty input', () => {
    expect(isNativeShape('', '')).toBe(false);
  });
});
