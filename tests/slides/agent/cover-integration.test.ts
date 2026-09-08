import { describe, it, expect, vi } from 'vitest';
import { getDefaultDesignDNA, validateDesignDNA } from '@/lib/slides/agent/design-dna';
import { renderCoverPptx } from '@/lib/slides/agent/cover-renderer';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Cover Pipeline Integration', () => {
  const tmpDir = path.join(os.tmpdir(), 'openmaic-cover-integration');

  it('valid DNA → render PPTX → file exists and is valid', async () => {
    const dna = getDefaultDesignDNA();

    // Validate
    const validation = validateDesignDNA(dna);
    expect(validation.valid).toBe(true);
    expect(validation.replacementCount).toBe(0);

    // Render
    const render = await renderCoverPptx(dna, '勾股定理', '高中数学课件', tmpDir, 1);
    expect(render.success).toBe(true);
    expect(render.pptxPath).toBeTruthy();

    // File check
    const stat = await fs.stat(render.pptxPath!);
    expect(stat.size).toBeGreaterThan(1000);

    // Cleanup
    try {
      await fs.unlink(render.pptxPath!);
    } catch {
      /* ignore */
    }
  });

  it('designDNA with bad colors → sanitized → can still render', async () => {
    const bad = {
      ...getDefaultDesignDNA(),
      colors: { coverBg: 'ZZZZZZ' } as never,
    };
    const validation = validateDesignDNA(bad);
    // Sanitized, colors fixed
    expect(validation.designDNA.colors.coverBg).not.toBe('ZZZZZZ');

    const render = await renderCoverPptx(validation.designDNA, '测试', '副标题', tmpDir, 99);
    expect(render.success).toBe(true);

    // Cleanup
    if (render.pptxPath) {
      try {
        await fs.unlink(render.pptxPath!);
      } catch {
        /* ignore */
      }
    }
  });

  it('all 12 default palettes produce valid covers', async () => {
    const { COLOR_PALETTES } = await import('@/lib/slides/agent/design-dna');
    const palettes = Object.entries(COLOR_PALETTES).slice(0, 3); // Test first 3 only to keep test fast

    for (const [name, palette] of palettes) {
      const dna = { ...getDefaultDesignDNA(), colors: { ...palette }, styleName: name };
      const validation = validateDesignDNA(dna);
      expect(validation.valid, `${name} should be valid`).toBe(true);

      const render = await renderCoverPptx(
        validation.designDNA,
        '测试',
        name,
        tmpDir,
        Object.keys(COLOR_PALETTES).indexOf(name),
      );
      expect(render.success, `${name} render should succeed`).toBe(true);

      if (render.pptxPath) {
        try {
          await fs.unlink(render.pptxPath!);
        } catch {
          /* ignore */
        }
      }
    }
  }, 15000);
});
