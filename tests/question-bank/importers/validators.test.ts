import { describe, it, expect } from 'vitest';
import { validateRow, validateRows } from '@/lib/question-bank/importers/validators';

describe('validateRow', () => {
  it('accepts valid row', () => {
    const result = validateRow({
      subject: '数学',
      content: '1+1=?',
      answer: '2',
    }, 1);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.subject).toBe('数学');
    expect(result.data!.difficulty).toBe('medium');
    expect(result.data!.questionType).toBe('solve');
  });

  it('rejects missing content', () => {
    const result = validateRow({ subject: '数学', answer: '2' }, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'content')).toBe(true);
  });

  it('rejects missing answer', () => {
    const result = validateRow({ subject: '数学', content: '1+1=?' }, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'answer')).toBe(true);
  });

  it('rejects missing subject', () => {
    const result = validateRow({ content: '1+1=?', answer: '2' }, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'subject')).toBe(true);
  });

  it('coerces Chinese difficulty labels', () => {
    const result = validateRow({ subject: '数学', content: 'x', answer: '1', difficulty: '困难' }, 1);
    expect(result.valid).toBe(true);
    expect(result.data!.difficulty).toBe('hard');
  });

  it('coerces Chinese question type labels', () => {
    const result = validateRow({ subject: '数学', content: 'x', answer: '1', questionType: '选择题' }, 1);
    expect(result.valid).toBe(true);
    expect(result.data!.questionType).toBe('choice');
  });

  it('coerces JSON string arrays', () => {
    const result = validateRow({
      subject: '数学',
      content: 'x',
      answer: '1',
      knowledgePoints: '["代数", "方程"]',
    }, 1);
    expect(result.valid).toBe(true);
    expect(result.data!.knowledgePoints).toEqual(['代数', '方程']);
  });

  it('coerces comma-separated strings to arrays', () => {
    const result = validateRow({
      subject: '数学',
      content: 'x',
      answer: '1',
      knowledgePoints: '代数, 方程',
    }, 1);
    expect(result.valid).toBe(true);
    expect(result.data!.knowledgePoints).toEqual(['代数', '方程']);
  });

  it('coerces verified boolean from string', () => {
    const result = validateRow({
      subject: '数学',
      content: 'x',
      answer: '1',
      verified: '是',
    }, 1);
    expect(result.valid).toBe(true);
    expect(result.data!.verified).toBe(true);
  });

  it('returns all errors for invalid row', () => {
    const result = validateRow({}, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('validateRows', () => {
  it('separates valid and invalid rows', () => {
    const result = validateRows([
      { subject: '数学', content: '1+1=?', answer: '2' },
      { subject: '', content: '', answer: '' },
      { subject: '物理', content: 'F=ma', answer: '牛顿第二定律' },
    ]);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(1);
    expect(result.validEntries.length).toBe(2);
    expect(result.allErrors.length).toBeGreaterThan(0);
  });

  it('returns empty for empty array', () => {
    const result = validateRows([]);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(0);
    expect(result.allErrors).toEqual([]);
  });
});
