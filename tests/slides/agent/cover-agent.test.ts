import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLM = vi.fn();
vi.mock('@/lib/ai/llm', () => ({ callLLM: (...args: unknown[]) => mockCallLLM(...args) }));

import { generateCovers } from '@/lib/slides/agent/cover-agent';
import type { LanguageModel } from 'ai';

const mockModel = { modelId: 'test-model' } as unknown as LanguageModel;

function makeSkeleton(index: number, recommended: boolean) {
  const paletteKeys = [
    'midnight-executive',
    'forest-moss',
    'coral-energy',
    'warm-terracotta',
    'ocean-gradient',
    'charcoal-minimal',
    'teal-trust',
    'berry-cream',
    'sage-calm',
    'cherry-bold',
    'classical-chinese',
    'tech-dark-cn',
  ];
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

/** Build a single valid skeleton JSON string for one slot */
function slotSkeleton(index: number) {
  return JSON.stringify({
    styleName: `风格 ${index + 1}`,
    fontId: 'georgia-calibri',
    density: 'moderate',
    mood: '专业学术',
    bestFor: ['数学'],
  });
}

describe('CoverAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates 12 covers from skeletons', async () => {
    mockCallLLM.mockResolvedValue({ text: slotSkeleton(0) });

    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.success).toBe(true);
    expect(result.covers).toHaveLength(12);
    expect(result.covers![0].recommended).toBe(true);
  });

  it('assembles full DesignDNA with correct colors', async () => {
    mockCallLLM.mockResolvedValue({ text: slotSkeleton(0) });

    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.success).toBe(true);
    // Colors should be populated from COLOR_PALETTES
    expect(result.covers![0].designDNA.colors.coverBg).toMatch(/^[0-9A-F]{6}$/);
    expect(result.covers![0].designDNA.fonts.en).toBe('Georgia');
  });

  it('ensures exactly one recommended', async () => {
    mockCallLLM.mockResolvedValue({ text: slotSkeleton(0) });

    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.covers!.filter((c) => c.recommended)).toHaveLength(1);
  });

  it('falls back on bad JSON', async () => {
    mockCallLLM.mockResolvedValue({ text: 'not json at all' });
    const result = await generateCovers('勾股定理', '高中', mockModel);
    // With 12 slots all returning bad JSON, we get < MIN_SUCCESSFUL_COVERS
    expect(result.success).toBe(false);
    expect(result.error).toContain('封面生成不完整');
  });

  it('returns success when enough slots succeed even if some fail', async () => {
    let callCount = 0;
    mockCallLLM.mockImplementation(() => {
      callCount++;
      if (callCount <= 8) return Promise.resolve({ text: slotSkeleton(callCount) });
      return Promise.resolve({ text: 'bad json' });
    });
    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.success).toBe(true);
    expect(result.covers!.length).toBeGreaterThanOrEqual(8);
  });

  it('handles LLM failure', async () => {
    mockCallLLM.mockRejectedValue(new Error('API timeout'));
    const result = await generateCovers('勾股定理', '高中', mockModel);
    expect(result.success).toBe(false);
    expect(result.error).toContain('封面生成不完整');
  });

  it('returns valid DesignDNA for all palette IDs', async () => {
    mockCallLLM.mockResolvedValue({ text: slotSkeleton(0) });
    const result = await generateCovers('test', '高中', mockModel);
    expect(result.success).toBe(true);
    for (const cover of result.covers!) {
      expect(cover.designDNA.colors.coverBg).toMatch(/^[0-9A-F]{6}$/);
    }
  });
});
