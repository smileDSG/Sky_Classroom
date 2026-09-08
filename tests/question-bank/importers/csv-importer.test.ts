import { describe, it, expect } from 'vitest';
import { createCsvImporter } from '@/lib/question-bank/importers/csv-importer';

describe('createCsvImporter', () => {
  const importer = createCsvImporter();

  it('parses simple CSV with English headers', async () => {
    const csv = 'subject,content,answer\n数学,1+1=?,2\n物理,F=ma,a=F/m';
    const result = await importer.parse(csv);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].subject).toBe('数学');
    expect(result.entries[0].content).toBe('1+1=?');
    expect(result.rawErrors).toHaveLength(0);
  });

  it('parses CSV with Chinese headers', async () => {
    const csv = '学科,题目,答案\n数学,1+1=?,2\n物理,F=ma,a=F/m';
    const result = await importer.parse(csv);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].subject).toBe('数学');
    expect(result.entries[0].content).toBe('1+1=?');
  });

  it('handles quoted fields with commas', async () => {
    const csv =
      'subject,content,answer\n数学,"已知 a, b, c 为三边, 求面积",S=\\sqrt{p(p-a)(p-b)(p-c)}';
    const result = await importer.parse(csv);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].content).toBe('已知 a, b, c 为三边, 求面积');
  });

  it('handles CRLF line endings', async () => {
    const csv = 'subject,content,answer\r\n数学,1+1=?,2\r\n物理,F=ma,a=F/m';
    const result = await importer.parse(csv);
    expect(result.entries).toHaveLength(2);
  });

  it('strips UTF-8 BOM', async () => {
    const csv = '\uFEFF学科,题目,答案\n数学,1+1=?,2';
    const result = await importer.parse(csv);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].subject).toBe('数学');
  });

  it('skips empty rows', async () => {
    const csv = 'subject,content,answer\n数学,1+1=?,2\n\n\n物理,F=ma,a=F/m';
    const result = await importer.parse(csv);
    expect(result.entries).toHaveLength(2);
  });

  it('validates required fields', async () => {
    const csv = 'subject,content,answer\n数学,1+1=?,2\n数学,,2\n物理,F=ma,a=F/m';
    const result = await importer.parse(csv);
    expect(result.entries.length).toBeLessThan(3);
    expect(result.rawErrors.length).toBeGreaterThan(0);
  });

  it('returns error for non-string input', async () => {
    const result = await importer.parse(123 as any);
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors[0].reason).toContain('CSV 输入必须是字符串');
  });

  it('returns error for empty CSV', async () => {
    const result = await importer.parse('');
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors[0].reason).toContain('CSV 文件为空');
  });

  it('enforces maxRows limit', async () => {
    const lines = ['subject,content,answer'];
    for (let i = 0; i < 1001; i++) {
      lines.push(`数学,题${i},1`);
    }
    const result = await importer.parse(lines.join('\n'), { maxRows: 1000 });
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors[0].reason).toContain('超过限制');
  });
});
