/**
 * PNG Converter — converts PPTX to PNG using LibreOffice headless.
 *
 * Parallelized via semaphore=3 and unique user profiles per process.
 * Windows LibreOffice file lock conflicts are avoided by passing
 * -env:UserInstallation to each instance.
 */
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
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

// 3 concurrent LibreOffice instances — each ~200MB, safe on typical dev machines
const semaphore = new Semaphore(3);

// ── Configuration ──────────────────────────────────────────────────────

const SOFFICE_PATH = process.platform === 'win32'
  ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
  : 'soffice';

const CONVERT_TIMEOUT_MS = 15_000;

// ── Public API ─────────────────────────────────────────────────────────

export interface PngConvertResult {
  success: boolean;
  pngPath?: string;
  error?: string;
}

export async function convertPptxToPng(pptxPath: string, outputDir: string): Promise<PngConvertResult> {
  const baseName = path.basename(pptxPath, '.pptx');
  const expectedPng = path.join(outputDir, `${baseName}.png`);

  // Retry loop — LO transient failures are common on Windows with parallel instances
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await convertOnce(pptxPath, outputDir, baseName, expectedPng);
    if (result.success) return result;
    if (attempt === 0) {
      log.warn(`PNG conversion attempt ${attempt + 1} failed: ${result.error}. Retrying...`);
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      return result;
    }
  }
  return { success: false, error: 'Unreachable' };
}

async function convertOnce(
  pptxPath: string,
  outputDir: string,
  baseName: string,
  expectedPng: string,
): Promise<PngConvertResult> {
  await semaphore.acquire();

  // Unique dirs per conversion to prevent LibreOffice lock conflicts
  const workDir = path.join(outputDir, `_conv_${baseName}`);
  const userProfileDir = path.join(os.tmpdir(), `lo-profile-${baseName}-${Date.now()}`);

  try {
    await fs.mkdir(workDir, { recursive: true });
    await fs.mkdir(userProfileDir, { recursive: true });

    const proc = spawn(SOFFICE_PATH, [
      '--headless',
      '--convert-to', 'png',
      '--outdir', workDir,
      pptxPath,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: CONVERT_TIMEOUT_MS,
      env: {
        ...process.env,
        SYSUSERCONFIG: userProfileDir, // independent user profile per process
      },
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
      await cleanupDirs([workDir, userProfileDir]);
      return { success: false, error: stderr || `Exit code ${exitCode}` };
    }

    // Move PNG from work dir to output dir
    const workFiles = await fs.readdir(workDir);
    const pngFile = workFiles.find((f) => f.endsWith('.png'));
    if (pngFile) {
      await fs.rename(path.join(workDir, pngFile), expectedPng);
      await cleanupDirs([workDir, userProfileDir]);
      return { success: true, pngPath: expectedPng };
    }

    log.warn(`PNG not found after conversion. Output: ${stdout}`);
    await cleanupDirs([workDir, userProfileDir]);
    return { success: false, error: 'PNG file not created' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`PNG conversion failed: ${msg}`);
    await cleanupDirs([workDir, userProfileDir]);
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

async function cleanupDirs(dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    try { await fs.rm(dir, { recursive: true }); } catch { /* ignore */ }
  }
}
