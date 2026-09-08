import { describe, expect, test } from 'vitest';
import { buildSyntheticCases } from '@/eval/handwriting-recognition/synthetic-generator';
import { renderSyntheticCase } from '@/eval/handwriting-recognition/synthetic-renderer';

describe('synthetic handwriting recognition dataset', () => {
  test('builds a reproducible 50-sample evaluation set with balanced coverage', () => {
    const first = buildSyntheticCases(50, 20260722);
    const second = buildSyntheticCases(50, 20260722);

    expect(second).toEqual(first);
    expect(first).toHaveLength(50);
    expect(new Set(first.map((sample) => sample.id)).size).toBe(50);
    expect(new Set(first.map((sample) => sample.split))).toEqual(new Set(['tune', 'dev', 'test']));
    expect(new Set(first.map((sample) => sample.subject))).toEqual(new Set(['math', 'physics']));
    expect(first.some((sample) => sample.tags.includes('fraction'))).toBe(true);
    expect(first.some((sample) => sample.tags.includes('radical'))).toBe(true);
    expect(first.some((sample) => sample.tags.includes('superscript'))).toBe(true);
    expect(first.some((sample) => sample.tags.includes('integral'))).toBe(true);
    expect(first.some((sample) => sample.tags.includes('unit'))).toBe(true);
    expect(first.some((sample) => sample.degradation.blur > 0)).toBe(true);
    expect(first.some((sample) => Math.abs(sample.degradation.rotation) >= 3)).toBe(true);
    expect(first.every((sample) => sample.source === 'synthetic')).toBe(true);
    expect(first.every((sample) => sample.groundTruth.text.length > 0)).toBe(true);
  });

  test('renders each case as a non-empty PNG image', () => {
    const sample = buildSyntheticCases(1, 20260722)[0];
    const png = renderSyntheticCase(sample, 20260722);

    expect(png.byteLength).toBeGreaterThan(10_000);
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  });
});
