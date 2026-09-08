import { describe, it, expect, vi } from 'vitest';
import { importFromPdf, type PdfImportDeps } from '@/lib/question-bank/importers/pdf-importer';

describe('importFromPdf', () => {
  it('imports high-confidence questions directly', async () => {
    const deps: PdfImportDeps = {
      parsePdf: vi.fn().mockResolvedValue({ text: '题目1\n题目2' }),
      splitQuestions: vi.fn().mockResolvedValue([
        { text: '题1', confidence: 0.9 },
        { text: '题2', confidence: 0.85 },
      ]),
      extractStructure: vi.fn().mockResolvedValue({
        data: { subject: '数学', content: '1+1=?', answer: '2' },
        confidence: 0.92,
      }),
      insertBatch: vi.fn().mockResolvedValue({ total: 2, inserted: 2, duplicates: 0, errors: [] }),
    };

    const result = await importFromPdf(Buffer.from('pdf'), {}, deps);
    expect(result.total).toBe(2);
    expect(result.inserted).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('imports low-confidence questions directly', async () => {
    const insertBatch = vi
      .fn()
      .mockResolvedValue({ total: 1, inserted: 1, duplicates: 0, errors: [] });
    const deps: PdfImportDeps = {
      parsePdf: vi.fn().mockResolvedValue({ text: '题目1' }),
      splitQuestions: vi.fn().mockResolvedValue([{ text: '题1', confidence: 0.7 }]),
      extractStructure: vi.fn().mockResolvedValue({
        data: { subject: '数学', content: '1+1=?', answer: '2' },
        confidence: 0.6,
      }),
      insertBatch,
    };

    const result = await importFromPdf(Buffer.from('pdf'), {}, deps);
    expect(result.total).toBe(1);
    expect(result.inserted).toBe(1);
    expect(insertBatch).toHaveBeenCalledWith([expect.objectContaining({ verified: true })]);
  });

  it('handles extraction failures gracefully', async () => {
    const deps: PdfImportDeps = {
      parsePdf: vi.fn().mockResolvedValue({ text: '题目1\n题目2' }),
      splitQuestions: vi.fn().mockResolvedValue([
        { text: '题1', confidence: 0.9 },
        { text: '题2', confidence: 0.9 },
      ]),
      extractStructure: vi
        .fn()
        .mockResolvedValueOnce({
          data: { subject: '数学', content: '1+1=?', answer: '2' },
          confidence: 0.92,
        })
        .mockResolvedValueOnce(null),
    };

    const result = await importFromPdf(Buffer.from('pdf'), {}, deps);
    expect(result.total).toBe(2);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].reason).toContain('结构化提取失败');
  });

  it('returns error when PDF parsing fails', async () => {
    const deps: PdfImportDeps = {
      parsePdf: vi.fn().mockRejectedValue(new Error('PDF 损坏')),
      splitQuestions: vi.fn(),
      extractStructure: vi.fn(),
    };

    const result = await importFromPdf(Buffer.from('pdf'), {}, deps);
    expect(result.total).toBe(0);
    expect(result.errors[0].reason).toContain('PDF 解析失败');
  });

  it('returns error when no text extracted', async () => {
    const deps: PdfImportDeps = {
      parsePdf: vi.fn().mockResolvedValue({ text: '' }),
      splitQuestions: vi.fn(),
      extractStructure: vi.fn(),
    };

    const result = await importFromPdf(Buffer.from('pdf'), {}, deps);
    expect(result.total).toBe(0);
    expect(result.errors[0].reason).toContain('未提取到文本');
  });

  it('returns error when no questions found', async () => {
    const deps: PdfImportDeps = {
      parsePdf: vi.fn().mockResolvedValue({ text: '这是一段普通文本' }),
      splitQuestions: vi.fn().mockResolvedValue([]),
      extractStructure: vi.fn(),
    };

    const result = await importFromPdf(Buffer.from('pdf'), {}, deps);
    expect(result.total).toBe(0);
    expect(result.errors[0].reason).toContain('未从 PDF 中识别出题目');
  });
});
