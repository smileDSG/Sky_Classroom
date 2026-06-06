/**
 * PNG Converter — converts PPTX to PNG using LibreOffice headless.
 *
 * This module is a **hard dependency** on LibreOffice. If LO is unavailable
 * or misconfigured, it fails fast with a clear error. No silent fallbacks.
 *
 * Stability measures:
 * - `-env:UserInstallation=file:///` isolates each process to prevent
 *   profile corruption / lock conflicts.
 * - Semaphore limits concurrent instances to 3.
 * - 2 attempts with 2s backoff for transient LO failures.
 */
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { createLogger } from '@/lib/logger';

const log = createLogger('PngConverter');

// ── Semaphore ─────────────────────────────────────────────────────────

class Semaphore {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrent: number) {}

  acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
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

const semaphore = new Semaphore(3);

// ── Configuration ─────────────────────────────────────────────────────

const SOFFICE_CANDIDATES = [
  // 1. Env override (highest priority)
  ...(process.env.LO_SOFFICE_PATH ? [process.env.LO_SOFFICE_PATH] : []),
  // 2. Windows
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  // 3. macOS
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  // 4. Linux (various distros)
  '/usr/lib/libreoffice/program/soffice',
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
  '/usr/lib64/libreoffice/program/soffice',
];

const CONVERT_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 2_000;
const MAX_RETRIES = 2;

// ── LO discovery (lightweight, no execution) ──────────────────────────

async function findLibreOffice(): Promise<string | null> {
  for (const candidate of SOFFICE_CANDIDATES) {
    try {
      await fs.access(candidate);
      log.info(`LibreOffice resolved: ${candidate}`);
      return candidate;
    } catch { /* not found */ }
  }
  log.warn(`LibreOffice not found. Candidates checked: ${SOFFICE_CANDIDATES.length}. Set LO_SOFFICE_PATH env var to override.`);
  return null;
}

// ── Public types ──────────────────────────────────────────────────────

export interface PngConvertResult {
  success: boolean;
  pngPath?: string;
  error?: string;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Convert a PPTX file to PNG using LibreOffice.
 *
 * Fails fast if LO is not installed or crashes. Callers should surface
 * the error to the user so the environment can be fixed.
 */
export async function convertPptxToPng(
  pptxPath: string,
  outputDir: string,
): Promise<PngConvertResult> {
  const loPath = await findLibreOffice();
  if (!loPath) {
    return {
      success: false,
      error: `LibreOffice not found. Install it, then either restart the app or set LO_SOFFICE_PATH env var. Run "pnpm setup:lo" for platform-specific instructions.`,
    };
  }

  const baseName = path.basename(pptxPath, '.pptx');
  const expectedPng = path.join(outputDir, `${baseName}.png`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await convertOnce(loPath, pptxPath, outputDir, baseName, expectedPng);
    if (result.success) return result;

    if (attempt < MAX_RETRIES) {
      log.warn(`LO conversion attempt ${attempt}/${MAX_RETRIES} failed: ${result.error}. Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      log.error(`LO conversion failed after ${MAX_RETRIES} attempts: ${result.error}`);
      return result;
    }
  }

  return { success: false, error: 'Unreachable' };
}

async function convertOnce(
  loPath: string,
  pptxPath: string,
  outputDir: string,
  baseName: string,
  expectedPng: string,
): Promise<PngConvertResult> {
  await semaphore.acquire();

  const workDir = path.join(outputDir, `_conv_${baseName}`);
  const userProfileDir = path.join(os.tmpdir(), `lo-profile-${baseName}-${Date.now()}`);

  try {
    await fs.mkdir(workDir, { recursive: true });
    await fs.mkdir(userProfileDir, { recursive: true });

    // CRITICAL: -env:UserInstallation=file:/// isolates each LO process
    // to prevent profile corruption and file-lock conflicts.
    const userInstallationUrl = 'file:///' + userProfileDir.replace(/\\/g, '/');

    const proc = spawn(loPath, [
      '--headless',
      '-env:UserInstallation=' + userInstallationUrl,
      '--convert-to', 'png',
      '--outdir', workDir,
      pptxPath,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    // Manual timeout: Node.js spawn() does NOT support the timeout option
    const timeoutId = setTimeout(() => {
      log.error(`LibreOffice conversion timed out after ${CONVERT_TIMEOUT_MS}ms, killing process`);
      proc.kill('SIGKILL');
    }, CONVERT_TIMEOUT_MS);

    const exitCode = await new Promise<number | null>((resolve) => {
      proc.on('close', (code) => { clearTimeout(timeoutId); resolve(code); });
      proc.on('error', (err) => { clearTimeout(timeoutId); log.error('LibreOffice spawn error:', err); resolve(null); });
    });

    if (exitCode !== 0) {
      const detail = stderr || stdout || `exit code ${exitCode}`;
      log.warn(`LibreOffice exited with code ${exitCode}: ${detail.slice(0, 500)}`);
      await cleanupDirs([workDir, userProfileDir]);
      return { success: false, error: `LibreOffice error: ${detail.slice(0, 500)}` };
    }

    const workFiles = await fs.readdir(workDir);
    const pngFile = workFiles.find((f) => f.endsWith('.png'));
    if (pngFile) {
      await fs.rename(path.join(workDir, pngFile), expectedPng);
      await cleanupDirs([workDir, userProfileDir]);
      return { success: true, pngPath: expectedPng };
    }

    log.warn(`PNG not found after conversion. Output: ${stdout.slice(0, 500)}`);
    await cleanupDirs([workDir, userProfileDir]);
    return { success: false, error: 'PNG file not created after conversion' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`PNG conversion exception: ${msg}`);
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
