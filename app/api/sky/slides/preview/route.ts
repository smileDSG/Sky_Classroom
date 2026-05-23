/**
 * POST /api/sky/slides/preview
 * Generate PNG previews from PPTX — guarantees pixel-perfect consistency with export.
 */
import { NextRequest, NextResponse } from 'next/server';
import { exportPptxWithTemplate } from '@/lib/slides/template-exporter';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import type { Slide } from '@/lib/types/slides';

const log = createLogger('API:SkySlidesPreview');

const PREVIEW_BASE_DIR = path.join(process.cwd(), 'public', 'temp', 'preview');
const PREVIEW_TTL_MS = 10 * 60 * 1000; // 10 minutes

const PYTHON_PATHS = [
  path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'python.exe'),
  path.join(process.cwd(), '.venv', 'Scripts', 'python.exe'),
  path.join(process.cwd(), '.venv', 'bin', 'python'),
  'python3',
  'python',
];

async function findPython(): Promise<string | null> {
  for (const p of PYTHON_PATHS) {
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(p, ['-c', 'import pptx; print(pptx.__version__)']);
        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d; });
        proc.on('close', (code) => {
          if (code === 0 && stdout.includes('1.')) resolve();
          else reject();
        });
        proc.on('error', reject);
      });
      return p;
    } catch {
      // try next
    }
  }
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

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      slides,
      theme,
      previewId: incomingPreviewId,
      layoutMode,
    } = body as {
      title?: string;
      slides?: Slide[];
      theme?: string;
      previewId?: string;
      layoutMode?: 'ai' | 'template';
    };

    if (!title || !title.trim()) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required field: title');
    }
    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required field: slides');
    }

    const previewId = incomingPreviewId || randomUUID().replace(/-/g, '').slice(0, 16);
    const previewDir = path.join(PREVIEW_BASE_DIR, previewId);
    const imagesDir = path.join(previewDir, 'images');
    const pptxPath = path.join(previewDir, 'source.pptx');

    fs.mkdirSync(imagesDir, { recursive: true });

    // ── Step 1: Generate or reuse PPTX ──────────────────────────────
    let reused = false;
    if (incomingPreviewId && fs.existsSync(pptxPath)) {
      log.info(`Reusing existing PPTX for previewId=${previewId}`);
      reused = true;
    } else {
      log.info(`Generating PPTX for preview: ${title} (${slides.length} slides)`);
      const result = await exportPptxWithTemplate({
        title: title.trim(),
        slides,
        theme: theme as any,
        layoutMode: layoutMode,
      });
      fs.writeFileSync(pptxPath, result.buffer);
    }

    // ── Step 2: Convert PPTX to PNG images ──────────────────────────
    const pythonPath = await findPython();
    if (!pythonPath) {
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, 'Python with pptx not available');
    }

    const scriptPath = path.join(process.cwd(), 'scripts', 'pptx-to-images.py');
    if (!fs.existsSync(scriptPath)) {
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, 'pptx-to-images script not found');
    }

    log.info(`Converting PPTX to images: ${pptxPath}`);
    const { images } = await new Promise<{ images: string[] }>((resolve, reject) => {
      const proc = spawn(pythonPath, [scriptPath, pptxPath, imagesDir]);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });

      proc.on('close', (code) => {
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

      proc.on('error', (err) => reject(err));
    });

    // ── Step 3: Build public URLs ───────────────────────────────────
    const slideImages = images.map((img) => `/temp/preview/${previewId}/images/${img}`);

    // ── Step 4: Schedule cleanup (only if newly generated) ──────────
    if (!reused) {
      scheduleCleanup(previewDir);
    }

    const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS).toISOString();
    log.info(`Preview ready: ${slideImages.length} images, previewId=${previewId}`);

    return NextResponse.json({
      success: true,
      previewId,
      slideImages,
      reused,
      expiresAt,
    });
  } catch (err: any) {
    log.error('Preview generation failed:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, err.message || 'Preview generation failed');
  }
}

// Startup cleanup: remove stale preview dirs older than TTL
(function cleanupStalePreviews() {
  try {
    if (!fs.existsSync(PREVIEW_BASE_DIR)) return;
    const entries = fs.readdirSync(PREVIEW_BASE_DIR);
    const cutoff = Date.now() - PREVIEW_TTL_MS;
    for (const entry of entries) {
      const dir = path.join(PREVIEW_BASE_DIR, entry);
      try {
        const stat = fs.statSync(dir);
        if (stat.mtimeMs < cutoff) {
          fs.rmSync(dir, { recursive: true, force: true });
          log.info(`Cleaned stale preview dir: ${dir}`);
        }
      } catch {
        // ignore per-dir errors
      }
    }
  } catch {
    // ignore cleanup errors
  }
})();
