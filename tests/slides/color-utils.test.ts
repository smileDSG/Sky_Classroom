/**
 * B-001: Color conversion utilities tests
 *
 * Validates toPptxColor / toPptxHex for hex, rgb, rgba inputs.
 */
import { describe, it, expect } from 'vitest';
import { toPptxColor, toPptxHex, resolveTextColor } from '@/lib/slides/color-utils';

describe('toPptxColor', () => {
  it('converts 6-digit hex to color without #', () => {
    expect(toPptxColor('#2563eb')).toEqual({ color: '2563eb' });
    expect(toPptxColor('#ffffff')).toEqual({ color: 'ffffff' });
    expect(toPptxColor('#000000')).toEqual({ color: '000000' });
  });

  it('converts 3-digit hex by duplicating each channel', () => {
    expect(toPptxColor('#fff')).toEqual({ color: 'ffffff' });
    expect(toPptxColor('#abc')).toEqual({ color: 'aabbcc' });
  });

  it('converts rgb() to hex color', () => {
    expect(toPptxColor('rgb(37, 99, 235)')).toEqual({ color: '2563eb' });
    expect(toPptxColor('rgb(0,0,0)')).toEqual({ color: '000000' });
    expect(toPptxColor('rgb(255, 255, 255)')).toEqual({ color: 'ffffff' });
  });

  it('converts rgba() to hex + transparency', () => {
    expect(toPptxColor('rgba(56, 189, 248, 0.15)')).toEqual({
      color: '38bdf8',
      transparency: 85,
    });
    expect(toPptxColor('rgba(0, 0, 0, 0.5)')).toEqual({
      color: '000000',
      transparency: 50,
    });
    expect(toPptxColor('rgba(255, 255, 255, 1)')).toEqual({
      color: 'ffffff',
    });
  });

  it('omits transparency when alpha is 1 or missing', () => {
    expect(toPptxColor('rgba(255, 0, 0, 1)')).toEqual({ color: 'ff0000' });
    expect(toPptxColor('rgb(255, 0, 0)')).toEqual({ color: 'ff0000' });
  });

  it('handles edge case alpha values', () => {
    expect(toPptxColor('rgba(0, 0, 0, 0)')).toEqual({
      color: '000000',
      transparency: 100,
    });
    expect(toPptxColor('rgba(128, 128, 128, 0.75)')).toEqual({
      color: '808080',
      transparency: 25,
    });
  });

  it('clamps out-of-range rgb values', () => {
    expect(toPptxColor('rgb(300, 0, 128)')).toEqual({ color: 'ff0080' });
    expect(toPptxColor('rgba(999, 0, 0, 2)')).toEqual({ color: 'ff0000' });
  });

  it('falls back to stripping # for unknown formats', () => {
    expect(toPptxColor('ff0000')).toEqual({ color: 'ff0000' });
    expect(toPptxColor('red')).toEqual({ color: 'red' });
  });

  it('trims whitespace before parsing', () => {
    expect(toPptxColor('  #2563eb  ')).toEqual({ color: '2563eb' });
    expect(toPptxColor('  rgb(37,99,235)  ')).toEqual({ color: '2563eb' });
  });
});

describe('toPptxHex', () => {
  it('returns hex string for all supported formats', () => {
    expect(toPptxHex('#2563eb')).toBe('2563eb');
    expect(toPptxHex('rgb(37, 99, 235)')).toBe('2563eb');
    expect(toPptxHex('rgba(56, 189, 248, 0.15)')).toBe('38bdf8');
  });
});

describe('resolveTextColor', () => {
  it('returns theme color when element color conflicts with dark background', () => {
    // Dark bg + dark element color → conflict → use theme color (light)
    expect(resolveTextColor('#333333', '#f1f5f9', '#0f172a')).toBe('#f1f5f9');
  });

  it('returns theme color when element color conflicts with light background', () => {
    // Light bg + light element color → conflict → use theme color (dark)
    expect(resolveTextColor('#e2e8f0', '#1e293b', '#ffffff')).toBe('#1e293b');
  });

  it('returns element color when no conflict with background', () => {
    // Dark element on light bg → no conflict → keep element color
    expect(resolveTextColor('#333333', '#f1f5f9', '#ffffff')).toBe('#333333');
    // Light element on dark bg → no conflict → keep element color
    expect(resolveTextColor('#f1f5f9', '#333333', '#0f172a')).toBe('#f1f5f9');
  });

  it('returns theme color when element color is undefined', () => {
    expect(resolveTextColor(undefined, '#f1f5f9', '#0f172a')).toBe('#f1f5f9');
  });
});
