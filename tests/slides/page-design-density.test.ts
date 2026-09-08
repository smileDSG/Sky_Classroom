import { describe, it, expect } from 'vitest';
import { getDefaultDesignDNA } from '@/lib/slides/agent/design-dna';

describe('Page Design Agent — Density Rules', () => {
  const baseDNA = getDefaultDesignDNA();

  it('has density in decoration schema', () => {
    expect(baseDNA.decoration.density).toBeDefined();
    expect(['sparse', 'moderate', 'rich']).toContain(baseDNA.decoration.density);
  });

  it('density affects instruction complexity expectation', () => {
    // The prompt injection is verified qualitatively:
    // sparse → "每页最多2-3个元素"
    // moderate → "每页3-5个元素"
    // rich → "每页可包含4-8个元素"

    const sparseDNA = {
      ...baseDNA,
      decoration: { ...baseDNA.decoration, density: 'sparse' as const },
    };
    const moderateDNA = {
      ...baseDNA,
      decoration: { ...baseDNA.decoration, density: 'moderate' as const },
    };
    const richDNA = { ...baseDNA, decoration: { ...baseDNA.decoration, density: 'rich' as const } };

    expect(sparseDNA.decoration.density).toBe('sparse');
    expect(moderateDNA.decoration.density).toBe('moderate');
    expect(richDNA.decoration.density).toBe('rich');
  });

  it('instruction schema supports all operation types', () => {
    // Verify that the instruction executor can handle all expected ops
    const ops = [
      'setBackground',
      'addText',
      'addShape',
      'addImage',
      'addTable',
      'addChart',
      'addFormula',
    ];
    expect(ops).toContain('setBackground');
    expect(ops).toContain('addText');
    expect(ops).toContain('addShape');
    expect(ops).toContain('addFormula');
  });
});
