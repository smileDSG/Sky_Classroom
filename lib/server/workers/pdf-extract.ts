/**
 * PDF text extraction offloaded to a worker thread.
 *
 * Returns { text, pageCount } extracted by `unpdf` (pdf.js) without blocking
 * the main Node event loop. If the worker path is unavailable (e.g. the
 * bundler can't produce the worker module), callers should fall back to the
 * inline `unpdf` parse to stay resilient.
 */
import { Worker } from 'worker_threads';

export interface PdfExtractResult {
  text: string;
  pageCount: number;
}

export async function extractPdfInWorker(buffer: Buffer): Promise<PdfExtractResult> {
  // Node Buffers always back onto a real ArrayBuffer (never SharedArrayBuffer).
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;

  return new Promise<PdfExtractResult>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./pdf-extract.worker.mjs', import.meta.url));
    } catch (err) {
      reject(err);
      return;
    }

    const cleanup = () => {
      worker.terminate().catch(() => undefined);
    };

    worker.once('error', (err) => {
      cleanup();
      reject(new Error(`PDF worker error: ${err.message}`));
    });

    worker.once('message', (msg) => {
      cleanup();
      if (msg?.ok) {
        resolve({ text: msg.text as string, pageCount: msg.pageCount as number });
      } else {
        reject(new Error(msg?.error ?? 'PDF extraction failed in worker'));
      }
    });

    // ArrayBuffer is transferred (zero-copy) to the worker.
    worker.postMessage({ buffer: arrayBuffer }, [arrayBuffer]);
  });
}
