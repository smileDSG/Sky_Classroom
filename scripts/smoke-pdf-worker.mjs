// Smoke-test the BUILT pdf worker asset exactly as Next launches it at runtime:
// spawn a node Worker on .next/server/assets/pdf-extract.worker.*.ts and ask it
// to extract text from a generated PDF.

import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';

function makeMinimalPdf(text) {
  const enc = new TextEncoder();
  const objs = [];
  objs.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objs.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objs.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
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
  for (let i = 1; i <= objs.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  body += xref + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(body);
}

// Locate the emitted worker asset (or accept an explicit worker path).
const assetsDir = resolve('.next', 'server', 'assets');
let workerFile = process.argv[2];
let workerPath;
if (workerFile) {
  workerPath = resolve(workerFile);
} else {
  workerFile = readdirSync(assetsDir).find((f) => f.startsWith('pdf-extract.worker'));
  if (!workerFile) {
    console.error('FAIL: no emitted pdf-extract.worker asset found');
    process.exit(2);
  }
  workerPath = resolve(assetsDir, workerFile);
}
console.log('worker asset:', workerPath);

const pdf = makeMinimalPdf('Hello Worker PDF');
const ab = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);

const result = await new Promise((resolvePromise) => {
  let w;
  try {
    w = new Worker(workerPath);
  } catch (e) {
    resolvePromise({ ok: false, error: 'spawn: ' + e.message });
    return;
  }
  const timer = setTimeout(() => resolvePromise({ ok: false, error: 'timeout' }), 15000);
  w.once('message', (m) => { clearTimeout(timer); w.terminate(); resolvePromise(m); });
  w.once('error', (e) => { clearTimeout(timer); resolvePromise({ ok: false, error: 'worker-error: ' + e.message }); });
  w.postMessage({ buffer: ab }, [ab]);
});

if (result.ok) {
  console.log('PASS: pageCount=%d text=%j', result.pageCount, result.text.slice(0, 40));
} else {
  console.error('FAIL:', result.error);
  process.exit(1);
}