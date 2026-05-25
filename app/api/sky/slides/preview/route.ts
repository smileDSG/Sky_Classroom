/**
 * POST /api/sky/slides/preview
 * Generate PNG previews from PPTX — guarantees pixel-perfect consistency with export.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { generatePreviewFromPptx } from '@/lib/slides/pptx-preview';

const log = createLogger('API:SkySlidesPreview');

const PREVIEW_BASE_DIR = path.join(process.cwd(), 'public', 'temp', 'preview');
const PREVIEW_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
    const { pptxUrl } = body as {
      pptxUrl?: string;
    };

    if (!pptxUrl) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required field: pptxUrl');
    }

    const result = await generatePreviewFromPptx(pptxUrl);
    if (!result.success) {
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, result.error || 'Preview generation failed');
    }

    scheduleCleanup(path.join(PREVIEW_BASE_DIR, result.previewId));

    return NextResponse.json({
      success: true,
      previewId: result.previewId,
      slideImages: result.slideImages,
      reused: false,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString(),
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
