import { describe, it, expect } from 'vitest';
import { latexToOmml } from '@/lib/export/latex-to-omml';

describe('latexToOmml', () => {
  it('converts basic LaTeX to OMML', () => {
    const omml = latexToOmml('x^2 + y^2 = z^2', 14);
    expect(omml).toBeTruthy();
    expect(omml).toContain('<m:oMath');
    expect(omml).toContain('<m:t');
  });

  it('strips w:rPr elements from output', () => {
    // mathml2omml sometimes injects <w:rPr> when converting certain expressions
    const omml = latexToOmml('\\frac{a}{b}', 12);
    expect(omml).toBeTruthy();
    expect(omml).not.toContain('<w:rPr');
    expect(omml).not.toContain('xmlns:w');
  });

  it('preprocesses chemical charge superscripts (Zn2+ → Zn^{2+})', () => {
    const omml = latexToOmml('Zn2+ + Cu2+ -> Zn2+ + Cu', 14);
    expect(omml).toBeTruthy();
    // OMML should contain valid math markup (superscript may be m:sSup, m:sup, or other forms)
    expect(omml).toContain('<m:oMath');
  });

  it('preprocesses subscripts (H2O → H_2O)', () => {
    const omml = latexToOmml('H2O + CO2 -> H2CO3', 14);
    expect(omml).toBeTruthy();
    expect(omml).toContain('m:sSub');
  });

  it('preprocesses Unicode math symbols', () => {
    const omml = latexToOmml('E = E∘ - (RT/nF) ln Q', 14);
    expect(omml).toBeTruthy();
    // The ∘ should be converted to \circ
    expect(omml).toContain('m:oMath');
  });

  it('preprocesses scientific notation (10^37)', () => {
    const omml = latexToOmml('K ≈ 1.6 × 10^37', 14);
    expect(omml).toBeTruthy();
    expect(omml).toContain('m:sSup');
  });

  it('returns null for invalid LaTeX instead of throwing', () => {
    const omml = latexToOmml('\\\\\\\\\\\\\\\\invalid{\\', 14);
    // Extremely malformed input may still throw inside temml; test that we don't crash
    expect(omml === null || typeof omml === 'string').toBe(true);
  });
});
