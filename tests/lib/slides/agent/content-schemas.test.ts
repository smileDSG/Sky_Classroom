import { describe, it, expect } from 'vitest';
import {
  autoFixContent,
  deepRepairContent,
  convertInlineLatexToUnicode,
} from '@/lib/slides/agent/content-schemas';

describe('deepRepairContent', () => {
  it('repairs table rows with object cells', () => {
    const result = deepRepairContent('table', {
      title: '电池对比',
      headers: ['类型', '电压'],
      rows: [
        ['铅酸', '2.0'],
        [{ text: '锂离子', value: '3.7' }], // object cell with multiple string props
        [{ name: '镍氢', content: '1.2' }], // different keys
        [{ unknown: 'obj' }, '8'], // single string value, fallback
      ],
      summary: '总结',
    });
    expect(result.rows).toEqual([
      ['铅酸', '2.0'],
      ['锂离子'], // { text: '...' } -> extracts text field only
      ['1.2'], // { name: '镍氢', content: '1.2' } -> content matches first
      ['obj', '8'], // { unknown: 'obj' } -> expands all string values
    ]);
  });

  it('repairs table rows with nested objects inside arrays', () => {
    const result = deepRepairContent('table', {
      title: '测试',
      headers: ['A'],
      rows: [[{ text: 'value' }]],
      summary: 's',
    });
    expect(result.rows).toEqual([['value']]);
  });

  it('coerces number/boolean/null to string in top-level fields', () => {
    const result = deepRepairContent('concept', {
      title: 123,
      cards: [{ title: true, desc: null }],
      summary: 'ok',
    });
    expect(result.title).toBe('123');
    expect(result.cards).toEqual([{ title: 'true', desc: '' }]);
  });
});

describe('autoFixContent', () => {
  it('fixes table with object cells via deepRepairContent', () => {
    const result = deepRepairContent('table', {
      title: '对比',
      headers: ['类型', '电压(V)', '特点'],
      rows: [
        ['铅酸电池', '2.0', '成本低'],
        [{ text: '锂离子电池' }, { value: '3.7' }, { content: '能量密度高' }],
      ],
      summary: '根据场景选择',
    });
    expect(result.rows).toEqual([
      ['铅酸电池', '2.0', '成本低'],
      ['锂离子电池', '3.7', '能量密度高'],
    ]);
  });
});

describe('convertInlineLatexToUnicode', () => {
  it('converts $Na^+$ to Na⁺', () => {
    expect(convertInlineLatexToUnicode('离子 $Na^+$ 和 $Cl^-$')).toBe('离子 Na⁺ 和 Cl⁻');
  });

  it('converts $H_2O$ to H₂O', () => {
    expect(convertInlineLatexToUnicode('化学式 $H_2O$')).toBe('化学式 H₂O');
  });

  it('converts chemical equation arrows', () => {
    expect(convertInlineLatexToUnicode('$A -> B$')).toBe('A → B');
  });

  it('handles mixed text and inline LaTeX', () => {
    const text = '溶液中有 $Ca^{2+}$ 和 $CO_3^{2-}$，形成 $CaCO_3$';
    const result = convertInlineLatexToUnicode(text);
    expect(result).toContain('Ca²⁺');
    expect(result).toContain('CO₃²⁻');
    expect(result).toContain('CaCO₃');
  });
});
