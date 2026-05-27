/**
 * PNG Converter — converts PPTX to PNG using LibreOffice headless.
 *
 * Uses a semaphore to limit concurrent LibreOffice processes.
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '@/lib/logger';

const log = createLogger('PngConverter');

// ── Semaphore for process pool management ──────────────────────────

class Semaphore {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrent: number) {}

  acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

const semaphore = new Semaphore(1); // Windows: LibreOffice lock conflicts on parallel dir writes

// ── Configuration ──────────────────────────────────────────────────────

const SOFFICE_PATH = process.platform === 'win32'
  ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
  : 'soffice';

const CONVERT_TIMEOUT_MS = 10_000;

// ── Public API ─────────────────────────────────────────────────────────

export interface PngConvertResult {
  success: boolean;
  pngPath?: string;
  error?: string;
}

export async function convertPptxToPng(pptxPath: string, outputDir: string): Promise<PngConvertResult> {
  const baseName = path.basename(pptxPath, '.pptx');
  const expectedPng = path.join(outputDir, `${baseName}.png`);

  await semaphore.acquire();

  try {
    // Use a unique temp dir per conversion to prevent LibreOffice lock conflicts
    const workDir = path.join(outputDir, `_conv_${baseName}`);
    await fs.mkdir(workDir, { recursive: true });

    const proc = spawn(SOFFICE_PATH, [
      '--headless',
      '--convert-to', 'png',
      '--outdir', workDir,
      pptxPath,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: CONVERT_TIMEOUT_MS,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    const exitCode = await new Promise<number | null>((resolve) => {
      proc.on('close', resolve);
      proc.on('error', () => resolve(null));
    });

    if (exitCode !== 0) {
      log.warn(`LibreOffice exited with code ${exitCode}: ${stderr}`);
      // Clean up work dir
      try { await fs.rm(workDir, { recursive: true }); } catch { /* ignore */ }
      return { success: false, error: stderr || `Exit code ${exitCode}` };
    }

    // Find the PNG in the work dir and move to outputDir
    const workFiles = await fs.readdir(workDir);
    const pngFile = workFiles.find((f) => f.endsWith('.png'));
    if (pngFile) {
      await fs.rename(path.join(workDir, pngFile), expectedPng);
      try { await fs.rm(workDir, { recursive: true }); } catch { /* ignore */ }
      return { success: true, pngPath: expectedPng };
    }

    log.warn(`PNG not found after conversion. Output: ${stdout}`);
    try { await fs.rm(workDir, { recursive: true }); } catch { /* ignore */ }
    return { success: false, error: 'PNG file not created' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`PNG conversion failed: ${msg}`);
    return { success: false, error: msg };
  } finally {
    semaphore.release();
  }
}

export async function convertMultiplePptx(
  pptxPaths: string[],
  outputDir: string,
): Promise<PngConvertResult[]> {
  const results = await Promise.all(
    pptxPaths.map((p) => convertPptxToPng(p, outputDir)),
  );
  return results;
}
