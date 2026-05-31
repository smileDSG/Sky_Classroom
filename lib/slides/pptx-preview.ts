/**
 * Shared PPTX → preview images conversion
 * Extracted from preview API so generate API can reuse it.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger('PPTXPreview');

const PREVIEW_BASE_DIR = path.join(process.cwd(), 'public', 'temp', 'preview');
const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const PYTHON_PATHS = [
  path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'python.exe'),
  path.join(process.cwd(), '.venv', 'Scripts', 'python.exe'),
  path.join(process.cwd(), '.venv', 'bin', 'python'),
  'python3',
  'python',
];

let cachedPythonPath: string | null | undefined = undefined;

async function findPython(): Promise<string | null> {
  if (cachedPythonPath !== undefined) return cachedPythonPath;
  for (const p of PYTHON_PATHS) {
    try {
      // Check both python-pptx and PyMuPDF (fitz) are available
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(p, ['-c', 'import pptx, fitz; print(pptx.__version__)']);
        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d; });
        proc.on('close', (code) => {
          if (code === 0 && stdout.includes('1.')) resolve();
          else reject();
        });
        proc.on('error', reject);
      });
      cachedPythonPath = p;
      return p;
    } catch {
      // try next
    }
  }
  cachedPythonPath = null;
  return null;
}

function scheduleCleanup(previewDir: string) {
  setTimeout(() => {
    try {
      if (fs.existsSync(previewDir)) {
        fs.rmSync(previewDir, { recursive: true, force: true });
        log.info(`Cleaned up preview dir: ${previewDir}`);
      }
    } catch (err) {
      log.warn('Failed to cleanup preview dir:', err);
    }
  }, PREVIEW_TTL_MS);
}

export interface PptxPreviewResult {
  success: boolean;
  previewId: string;
  slideImages: string[];
  error?: string;
}

/**
 * Strip Windows duplicate-file markers like "(2)", "(3)" from a filename.
 * e.g. "file(2).pptx" → "file.pptx"
 */
function stripWindowsDuplicateMarker(filePath: string): string {
  return filePath.replace(/\(\d+\)(\.[^.]+)$/i, '$1');
}

/**
 * Resolve the actual PPTX file path, handling Windows duplicate markers.
 * If the exact path doesn't exist, try stripping "(N)" suffixes.
 */
function resolvePptxPath(pptxUrl: string): string {
  const publicDir = path.join(process.cwd(), 'public');
  const relPath = pptxUrl.replace(/^\//, '');
  const absPath = path.join(publicDir, relPath);

  if (fs.existsSync(absPath)) return absPath;

  // Try stripping Windows duplicate marker: "file(2).pptx" → "file.pptx"
  const normalized = stripWindowsDuplicateMarker(relPath);
  if (normalized !== relPath) {
    const normalizedAbs = path.join(publicDir, normalized);
    if (fs.existsSync(normalizedAbs)) {
      log.info(`Resolved duplicate marker: ${relPath} → ${normalized}`);
      return normalizedAbs;
    }
  }

  return absPath; // Return original; caller will report "not found"
}

/**
 * Convert an existing PPTX file to preview PNG images.
 * @param pptxUrl - Public URL path, e.g. "/temp/pptx/xxx.pptx"
 * @param existingPreviewId - Optional: reuse existing preview directory
 */
export async function generatePreviewFromPptx(
  pptxUrl: string,
  existingPreviewId?: string,
): Promise<PptxPreviewResult> {
  try {
    const absPptxPath = resolvePptxPath(pptxUrl);
    // Security: validate resolved path is under public dir and is a .pptx file
    const publicDir = path.resolve(process.cwd(), 'public');
    if (!absPptxPath.startsWith(publicDir) || !absPptxPath.endsWith('.pptx')) {
      return { success: false, previewId: '', slideImages: [], error: 'Invalid pptxUrl' };
    }
    if (!fs.existsSync(absPptxPath)) {
      return { success: false, previewId: '', slideImages: [], error: `PPTX not found: ${pptxUrl}` };
    }

    const previewId = existingPreviewId || randomUUID().replace(/-/g, '').slice(0, 16);
    if (existingPreviewId && !/^[a-f0-9]{16}$/i.test(existingPreviewId)) {
      return { success: false, previewId: '', slideImages: [], error: 'Invalid previewId' };
    }
    const previewDir = path.join(PREVIEW_BASE_DIR, previewId);
    const imagesDir = path.join(previewDir, 'images');
    const pptxPath = path.join(previewDir, 'source.pptx');

    // Reuse existing preview if available
    if (existingPreviewId && fs.existsSync(pptxPath)) {
      const existingImagesDir = imagesDir;
      if (fs.existsSync(existingImagesDir)) {
        const files = fs.readdirSync(existingImagesDir).filter((f) => f.endsWith('.png'));
        if (files.length > 0) {
          const slideImages = files.map((img) => `/temp/preview/${previewId}/images/${img}`);
          log.info(`Reused existing preview: ${files.length} images, previewId=${previewId}`);
          return { success: true, previewId, slideImages };
        }
      }
    }

    fs.mkdirSync(imagesDir, { recursive: true });
    fs.copyFileSync(absPptxPath, pptxPath);

    const pythonPath = await findPython();
    if (!pythonPath) {
      return { success: false, previewId: '', slideImages: [], error: 'Python with pptx not available' };
    }

    const scriptPath = path.join(process.cwd(), 'scripts', 'pptx-to-images.py');
    if (!fs.existsSync(scriptPath)) {
      return { success: false, previewId: '', slideImages: [], error: 'pptx-to-images script not found' };
    }

    log.info(`Converting PPTX to images: ${pptxPath}`);
    const PREVIEW_SPAWN_TIMEOUT_MS = 120_000;
    const { images } = await new Promise<{ images: string[] }>((resolve, reject) => {
      const proc = spawn(pythonPath, [scriptPath, pptxPath, imagesDir]);
      let stdout = '';
      let stderr = '';
      let killedByTimeout = false;

      const timeoutId = setTimeout(() => {
        killedByTimeout = true;
        proc.kill('SIGTERM');
        // Force kill after 5s if still alive
        setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, PREVIEW_SPAWN_TIMEOUT_MS);

      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });

      proc.on('close', (code, signal) => {
        clearTimeout(timeoutId);
        if (killedByTimeout) {
          reject(new Error(`Preview generation timed out after ${PREVIEW_SPAWN_TIMEOUT_MS}ms`));
          return;
        }
        if (code !== 0) {
          reject(new Error(`pptx-to-images.py exited with code ${code}: ${stderr}`));
          return;
        }
        try {
          const result = JSON.parse(stdout.trim().split('\n').pop() || '{}');
          if (!result.success) {
            reject(new Error(result.error || 'Unknown conversion error'));
            return;
          }
          resolve(result);
        } catch {
          reject(new Error(`Invalid JSON from pptx-to-images.py: ${stdout}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });

    const slideImages = images.map((img) => `/temp/preview/${previewId}/images/${img}`);
    scheduleCleanup(previewDir);

    log.info(`Preview ready: ${slideImages.length} images, previewId=${previewId}`);
    return { success: true, previewId, slideImages };
  } catch (err: any) {
    log.error('PPTX preview generation failed:', err);
    return { success: false, previewId: '', slideImages: [], error: err.message || 'Preview generation failed' };
  }
}
