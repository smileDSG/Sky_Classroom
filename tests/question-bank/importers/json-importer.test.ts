import { describe, it, expect } from 'vitest';
import { createJsonImporter } from '@/lib/question-bank/importers/json-importer';

describe('createJsonImporter', () => {
  const importer = createJsonImporter();

  it('parses valid JSON array', async () => {
    const json = JSON.stringify([
      { subject: '数学', content: '1+1=?', answer: '2' },
      { subject: '物理', content: 'F=ma', answer: 'a=F/m' },
    ]);
    const result = await importer.parse(json);
    expect(result.entries).toHaveLength(2);
    expect(result.rawErrors).toHaveLength(0);
    expect(result.meta.totalRows).toBe(2);
  });

  it('parses JSON array with Chinese columns', async () => {
    const json = JSON.stringify([{ 学科: '数学', 题目: '1+1=?', 答案: '2', 难度: '简单' }]);
    const result = await importer.parse(json);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].subject).toBe('数学');
    expect(result.entries[0].difficulty).toBe('easy');
  });

  it('returns error for non-array JSON', async () => {
    const result = await importer.parse('{"subject":"数学"}');
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors[0].reason).toContain('数组');
  });

  it('returns error for invalid JSON string', async () => {
    const result = await importer.parse('not json');
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors[0].reason).toContain('解析失败');
  });

  it('returns error for empty array', async () => {
    const result = await importer.parse('[]');
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors).toHaveLength(0);
  });

  it('rejects non-object elements', async () => {
    const result = await importer.parse('[1, 2, 3]');
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors.length).toBeGreaterThan(0);
  });

  it('validates required fields', async () => {
    const json = JSON.stringify([
      { subject: '数学', content: '1+1=?', answer: '2' },
      { subject: '', content: '', answer: '' },
    ]);
    const result = await importer.parse(json);
    expect(result.entries.length).toBeLessThan(2);
    expect(result.rawErrors.length).toBeGreaterThan(0);
  });

  it('accepts array input directly', async () => {
    const arr = [{ subject: '数学', content: '1+1=?', answer: '2' }];
    const result = await importer.parse(arr);
    expect(result.entries).toHaveLength(1);
  });

  it('rejects non-string non-array input', async () => {
    const result = await importer.parse(123 as any);
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors[0].reason).toContain('JSON 字符串或对象数组');
  });

  it('enforces maxRows limit', async () => {
    const arr = Array.from({ length: 1001 }, (_, i) => ({
      subject: '数学',
      content: `题${i}`,
      answer: '1',
    }));
    const result = await importer.parse(arr, { maxRows: 1000 });
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors[0].reason).toContain('超过限制');
  });
});
