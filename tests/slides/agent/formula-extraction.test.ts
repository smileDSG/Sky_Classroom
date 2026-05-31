import { describe, it, expect } from 'vitest';
import { unicodeMathToLatex, extractFormulasFromText } from '@/lib/slides/agent/content-schemas';

describe('unicodeMathToLatex', () => {
  it('converts Unicode superscripts to LaTeX', () => {
    expect(unicodeMathToLatex('Zn²⁺')).toContain('Zn^{2+}');
    expect(unicodeMathToLatex('Ca²⁺')).toContain('Ca^{2+}');
    expect(unicodeMathToLatex('H⁺')).toContain('H^{+}');
  });

  it('converts Unicode subscripts to LaTeX', () => {
    expect(unicodeMathToLatex('H₂O')).toContain('H_{2}O');
    expect(unicodeMathToLatex('CO₂')).toContain('CO_{2}');
    expect(unicodeMathToLatex('C₆H₁₂O₆')).toContain('C_{6}H_{12}O_{6}');
  });

  it('converts arrows to LaTeX', () => {
    expect(unicodeMathToLatex('A → B')).toContain('\\rightarrow');
    expect(unicodeMathToLatex('A ⇌ B')).toContain('\\rightleftharpoons');
  });

  it('converts Greek letters to LaTeX', () => {
    expect(unicodeMathToLatex('ΔG = -nFE')).toContain('\\Delta');
    expect(unicodeMathToLatex('α + β')).toContain('\\alpha');
    expect(unicodeMathToLatex('α + β')).toContain('\\beta');
  });

  it('handles combined chemical equations', () => {
    const result = unicodeMathToLatex('Zn²⁺ + Cu → Zn + Cu²⁺');
    expect(result).toContain('Zn^{2+}');
    expect(result).toContain('\\rightarrow');
    expect(result).toContain('Cu^{2+}');
  });

  it('handles degree symbols', () => {
    expect(unicodeMathToLatex('25°C')).toContain('^\\circ');
  });
});

describe('extractFormulasFromText', () => {
  it('extracts chemical equations with arrows', () => {
    const text = '锌铜原电池中，Zn + Cu²⁺ → Zn²⁺ + Cu 是总反应。';
    const formulas = extractFormulasFromText(text);
    expect(formulas.length).toBeGreaterThan(0);
    expect(formulas[0]).toContain('\\rightarrow');
  });

  it('extracts math equations with equals sign', () => {
    const text = '根据能斯特方程，E = E° - (RT/nF)lnQ。';
    const formulas = extractFormulasFromText(text);
    expect(formulas.length).toBeGreaterThan(0);
    expect(formulas[0]).toContain('E');
  });

  it('extracts Gibbs free energy equation', () => {
    const text = 'ΔG = -nFE 与等温方程联立。';
    const formulas = extractFormulasFromText(text);
    expect(formulas.length).toBeGreaterThan(0);
    expect(formulas[0]).toContain('\\Delta');
  });

  it('extracts logarithmic expressions', () => {
    const text = '代入公式 E = -0.76 - (0.0592/2)lg(1/0.1) = -0.7896 V。';
    const formulas = extractFormulasFromText(text);
    expect(formulas.length).toBeGreaterThan(0);
    expect(formulas[0]).toContain('lg');
  });

  it('returns empty array for text without formulas', () => {
    const text = '这是一段普通的教学描述文字，没有任何数学或化学公式。';
    expect(extractFormulasFromText(text)).toHaveLength(0);
  });

  it('deduplicates repeated formulas', () => {
    const text = 'E = mc² 和 E = mc² 是同一个公式。';
    const formulas = extractFormulasFromText(text);
    expect(formulas.length).toBe(1);
  });
});
