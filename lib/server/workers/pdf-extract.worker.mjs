/**
 * PDF text-extraction worker entry (plain ESM, no type annotations, so any
 * Node runtime can load it directly).
 *
 * Runs the heavy pdf.js (unpdf) parse off the main event loop so a single
 * large PDF upload doesn't stall every other user's request in multi-user
 * (classroom) deployments.
 *
 * unpdf is resolved at runtime from the process root (dev: repo node_modules,
 * standalone: standalone/node_modules) instead of relying on the bundler to
 * inline it into the emitted worker asset.
 *
 * Interface: { buffer: ArrayBuffer } -> { ok, text, pageCount }
 */
import { parentPort } from 'worker_threads';
import { createRequire } from 'node:module';
import path from 'node:path';

const requireFromRoot = createRequire(path.join(process.cwd(), '__unpdf_resolver.cjs'));
const unpdf = requireFromRoot('unpdf');

parentPort.on('message', async (msg) => {
  try {
    if (!msg || !msg.buffer) throw new Error('No buffer provided');
    const pdf = await unpdf.getDocumentProxy(new Uint8Array(msg.buffer));
    const numPages = pdf.numPages;
    const { text } = await unpdf.extractText(pdf, { mergePages: true });
    parentPort.postMessage({ ok: true, text, pageCount: numPages });
  } catch (err) {
    parentPort.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});