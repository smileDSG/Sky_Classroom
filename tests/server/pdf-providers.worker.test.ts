import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePDF } from '@/lib/pdf/pdf-providers';
import type { PDFProviderConfig } from '@/lib/pdf/types';

const { extractPdfInWorkerMock } = vi.hoisted(() => ({
  extractPdfInWorkerMock: vi.fn(),
}));

// The worker-thread path itself (worker_threads + unpdf inside the real `.mjs`
// asset) is verified by `scripts/smoke-pdf-worker.mjs` under plain Node. Here
// we mock the runner at the pdf-providers boundary to assert the two behaviors
// that matter for resilience: worker success is used, and failure falls back to
// inline parsing so the API never breaks because a worker asset is missing.
vi.mock('@/lib/server/workers/pdf-extract', () => ({
  extractPdfInWorker: extractPdfInWorkerMock,
}));

/**
 * Build a tiny, structurally valid one-page PDF with a single text run and a
 * correctly computed xref table, so pdf.js can parse it deterministically.
 */
function makeMinimalPdf(text: string): Buffer {
  const enc = new TextEncoder();
  const objs: string[] = [];
  objs.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objs.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objs.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
  );
  const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
  objs.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  objs.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const o of objs) {
    offsets.push(enc.encode(body).length);
    body += o;
  }
  const xrefPos = enc.encode(body).length;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body +=
    xref + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(body);
}

const unpdfConfig = { providerId: 'unpdf' as const } as PDFProviderConfig;

describe('PDF parsing resilience', () => {
  beforeEach(() => {
    extractPdfInWorkerMock.mockReset();
  });

  it('uses the worker result when the worker succeeds', async () => {
    extractPdfInWorkerMock.mockResolvedValue({ text: 'text from worker', pageCount: 1 });

    const result = await parsePDF(unpdfConfig, makeMinimalPdf('ignored'));

    expect(extractPdfInWorkerMock).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('text from worker');
    expect(result.metadata?.pageCount).toBe(1);
    expect(result.metadata?.parser).toBe('unpdf');
  });

  it('falls back to inline parsing when the worker is unavailable', async () => {
    extractPdfInWorkerMock.mockRejectedValue(new Error('URL must be of scheme file'));

    const result = await parsePDF(unpdfConfig, makeMinimalPdf('Fallback Text'));
    // Inline pdf.js parse returns the extracted text; must not throw/reject.
    expect(result.text).toContain('Fallback Text');
    expect(result.metadata?.pageCount).toBe(1);
  });
});
