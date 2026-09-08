import { describe, it, expect, afterAll } from 'vitest';
import { renderCoverPptx, renderDesignCoverSlide } from '@/lib/slides/agent/cover-renderer';
import { getDefaultDesignDNA, ALLOWED_LAYOUT_TYPES } from '@/lib/slides/agent/design-dna';
import pptxgen from 'pptxgenjs';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('CoverRenderer', () => {
  const tmpDir = path.join(os.tmpdir(), 'openmaic-test-covers');
  const dna = getDefaultDesignDNA();

  afterAll(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true });
    } catch {
      /* ignore */
    }
  });

  it('renders a single cover PPTX', async () => {
    const result = await renderCoverPptx(dna, '测试标题', '测试副标题', tmpDir, 1);

    expect(result.success).toBe(true);
    expect(result.pptxPath).toBeTruthy();

    // Verify file exists and is non-empty
    const stat = await fs.stat(result.pptxPath!);
    expect(stat.size).toBeGreaterThan(1000);
  });

  it('handles different motifs', async () => {
    const motifs = ['geometric-lines', 'organic-circles', 'ink-wash', 'chinese-seal', 'neon-grid'];

    for (const motif of motifs) {
      const d = {
        ...dna,
        decoration: { ...dna.decoration, motif: motif as typeof dna.decoration.motif },
      };
      const result = await renderCoverPptx(d, '测试', '副标题', tmpDir, motifs.indexOf(motif) + 2);
      expect(result.success).toBe(true);
    }
  });

  it('uses default geometric-lines for unknown motifs', async () => {
    const d = { ...dna, decoration: { ...dna.decoration, motif: 'unknown-motif' as never } };
    const result = await renderCoverPptx(d, 'test', 'sub', tmpDir, 99);
    expect(result.success).toBe(true);
  });

  it('renderDesignCoverSlide renders every layout type onto a deck slide', async () => {
    for (const layoutType of ALLOWED_LAYOUT_TYPES) {
      const pres = new pptxgen();
      pres.layout = 'LAYOUT_WIDE';
      const slide = pres.addSlide();
      expect(() =>
        renderDesignCoverSlide(slide, pres, { ...dna, layoutType }, '标题', '副标题'),
      ).not.toThrow();
      const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
      expect(buffer.length).toBeGreaterThan(1000);
    }
  });

  it('renderDesignCoverSlide falls back to hero-left for unknown layout', () => {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';
    const slide = pres.addSlide();
    expect(() =>
      renderDesignCoverSlide(
        slide,
        pres,
        { ...dna, layoutType: 'not-a-layout' as never },
        '标题',
        '副标题',
      ),
    ).not.toThrow();
  });
});
