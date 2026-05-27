import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLM = vi.fn();
vi.mock('@/lib/ai/llm', () => ({ callLLM: (...args: unknown[]) => mockCallLLM(...args) }));

import { generateCovers } from '@/lib/slides/agent/cover-agent';
import type { LanguageModel } from 'ai';

const mockModel = { modelId: 'test-model' } as unknown as LanguageModel;

function makeSkeleton(index: number, recommended: boolean) {
  const paletteKeys = ['midnight-executive', 'forest-moss', 'coral-energy', 'warm-terracotta', 'ocean-gradient', 'charcoal-minimal', 'teal-trust', 'berry-cream', 'sage-calm', 'cherry-bold', 'classical-chinese', 'tech-dark-cn'];
  return {
    styleName: `风格 ${index + 1}`,
    paletteId: paletteKeys[index % paletteKeys.length],
    fontId: 'georgia-calibri',
    motif: 'geometric-lines',
    density: 'moderate',
    recommended,
    mood: '专业学术',
    bestFor: ['数学'],
  };
}

describe('CoverAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates 12 covers from skeletons', async () => {
    const skeletons = Array.from({ length: 12 }, (_, i) => makeSkeleton(i, i === 0));
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(skeletons) });

    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.success).toBe(true);
    expect(result.covers).toHaveLength(12);
    expect(result.covers![0].recommended).toBe(true);
  });

  it('assembles full DesignDNA with correct colors', async () => {
    const skeletons = [makeSkeleton(0, true)];
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(skeletons) });

    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.success).toBe(true);
    // Colors should be populated from COLOR_PALETTES
    expect(result.covers![0].designDNA.colors.coverBg).toBe('1E2761');
    expect(result.covers![0].designDNA.fonts.en).toBe('Georgia');
  });

  it('ensures exactly one recommended', async () => {
    const skeletons = Array.from({ length: 12 }, (_, i) => makeSkeleton(i, true));
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(skeletons) });

    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.covers!.filter((c) => c.recommended)).toHaveLength(1);
  });

  it('falls back on bad JSON', async () => {
    mockCallLLM.mockResolvedValueOnce({ text: 'not json at all' });
    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.success).toBe(true);
    expect(result.covers).toHaveLength(12);
  });

  it('fills short arrays to 12', async () => {
    const skeletons = Array.from({ length: 3 }, (_, i) => makeSkeleton(i, i === 0));
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(skeletons) });
    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.covers).toHaveLength(12);
  });

  it('handles LLM failure', async () => {
    mockCallLLM.mockRejectedValueOnce(new Error('API timeout'));
    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.success).toBe(false);
    expect(result.error).toContain('API timeout');
  });

  it('returns valid DesignDNA for all palette IDs', async () => {
    const paletteKeys = Object.keys(await import('@/lib/slides/agent/design-dna').then(m => m.COLOR_PALETTES));
    const skeletons = paletteKeys.slice(0, 6).map((pid, i) => ({
      styleName: `Test ${i}`, paletteId: pid, fontId: 'georgia-calibri',
      motif: 'geometric-lines', density: 'moderate', recommended: i === 0,
      mood: 'test', bestFor: ['test'],
    }));
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify(skeletons) });
    const result = await generateCovers('test', '高中', mockModel);
    expect(result.success).toBe(true);
    for (const cover of result.covers!) {
      expect(cover.designDNA.colors.coverBg).toMatch(/^[0-9A-F]{6}$/);
    }
  });
});
