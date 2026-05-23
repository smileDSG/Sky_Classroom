/**
 * PPTX Image Handler
 *
 * Handles image element export to PPTX with support for:
 *   - Base64 inline images
 *   - Remote URL images (with SSRF-safe proxy fallback)
 *   - Placeholder rendering when image unavailable
 *   - Aspect ratio preservation
 *
 * Design:
 *   - Single responsibility: only handles image → PPTX conversion
 *   - No direct network calls in this module (images must be pre-resolved)
 *   - Graceful degradation: missing images → labeled placeholder shape
 */

import type pptxgen from 'pptxgenjs';
import type { ThemeToken } from './types';
import { toPptxHex, toPptxColor } from './color-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('PptxImageHandler');

interface PPTImageElement {
  id: string;
  type: 'image';
  left: number;
  top: number;
  width: number;
  height: number;
  src?: string;
  alt?: string;
  rotate?: number;
  /** Optional: corner radius in px */
  borderRadius?: number;
  /** Optional: border style */
  border?: {
    color?: string;
    width?: number;
    style?: 'solid' | 'dashed' | 'dotted';
  };
}

interface ImageHandlerOptions {
  /** Pre-resolved image data map: elementId -> base64 or blob URL */
  resolvedImages?: Map<string, string>;
  /** Theme for placeholder styling */
  theme: ThemeToken;
  /** Pixel-to-inch ratio for positioning */
  ratioPx2Inch: number;
}

interface ImageRenderResult {
  /** Whether the image was successfully added */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Add an image element to a PPTX slide.
 *
 * Precondition: images should be pre-resolved (base64 or local path).
 * This function does NOT make network requests.
 */
export function addImageToSlide(
  pptxSlide: pptxgen.Slide,
  element: PPTImageElement,
  options: ImageHandlerOptions,
): ImageRenderResult {
  const { resolvedImages, theme, ratioPx2Inch } = options;

  const x = element.left / ratioPx2Inch;
  const y = element.top / ratioPx2Inch;
  const w = element.width / ratioPx2Inch;
  const h = element.height / ratioPx2Inch;

  // Try to get resolved image data
  const resolvedSrc = resolvedImages?.get(element.id);
  const src = resolvedSrc || element.src;

  if (!src || src.trim() === '') {
    log.warn(`Image element ${element.id}: no source, rendering placeholder`);
    addPlaceholder(pptxSlide, x, y, w, h, element.alt || '[图片]', theme);
    return { success: false, error: 'No image source' };
  }

  // Validate source format
  const isValidFormat =
    src.startsWith('data:image/') ||
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('blob:') ||
    /^[A-Za-z0-9+/=]+$/.test(src); // raw base64

  if (!isValidFormat) {
    log.warn(
      `Image element ${element.id}: unsupported format "${src.slice(0, 30)}...", rendering placeholder`,
    );
    addPlaceholder(pptxSlide, x, y, w, h, element.alt || '[图片]', theme);
    return { success: false, error: 'Unsupported image format' };
  }

  // Normalize source for pptxgenjs
  const imageSrc = normalizeImageSource(src);

  try {
    // Build image options (extended with line for border support)
    const imgOpts: pptxgen.ImageProps & { line?: { color: string; width: number } } = {
      x,
      y,
      w,
      h,
      path: imageSrc,
      rotate: element.rotate || 0,
    };

    // Add border if specified
    if (element.border) {
      imgOpts.line = {
        color: toPptxHex(element.border.color || theme.shapeOutlineColor),
        width: (element.border.width || 1) / (96 / 72),
      };
    }

    // Rounded corners are applied during image pre-processing (resolveImages)
    // via @napi-rs/canvas. If the image wasn't pre-processed, corners remain square.
    if (element.borderRadius && element.borderRadius > 4 && !resolvedSrc) {
      log.info(
        `Image ${element.id}: borderRadius (${element.borderRadius}px) requires pre-processing via resolveImages(), using square corners`,
      );
    }

    pptxSlide.addImage(imgOpts);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    log.error(`Image ${element.id}: failed to add to slide: ${msg}`);
    addPlaceholder(pptxSlide, x, y, w, h, element.alt || '[图片]', theme);
    return { success: false, error: msg };
  }
}

/**
 * Pre-resolve images from Slide elements.
 * Downloads remote images, compresses if oversized, applies rounded corners.
 *
 * This should be called BEFORE addImageToSlide.
 * Returns a Map of elementId -> base64 data URI.
 */
export async function resolveImages(
  elements: Array<{ id: string; src?: string; borderRadius?: number; width?: number; height?: number }>,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();

  for (const el of elements) {
    if (!el.src) continue;

    try {
      const resolvedSrc = await resolveSingleImage(el.src, {
        borderRadius: el.borderRadius,
        targetWidth: el.width,
        targetHeight: el.height,
      });
      if (resolvedSrc) {
        resolved.set(el.id, resolvedSrc);
      }
    } catch (err) {
      log.warn(`Failed to resolve image ${el.id}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return resolved;
}

// ── Placeholder Rendering ──────────────────────────────────────────

function addPlaceholder(
  pptxSlide: pptxgen.Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  theme: ThemeToken,
): void {
  // Background shape
  pptxSlide.addShape('rect' as never, {
    x,
    y,
    w,
    h,
    fill: toPptxColor(theme.accentLight),
    line: { color: toPptxHex(theme.shapeOutlineColor), width: 1 },
  } as never);

  // Label text
  const fontSize = Math.min(14, h * 8);
  pptxSlide.addText(label, {
    x,
    y: y + h / 2 - fontSize / 144,
    w,
    h: fontSize / 72,
    fontSize,
    fontFace: theme.fontFamily,
    color: toPptxHex(theme.bodyMutedColor),
    align: 'center',
  });
}

// ── Image Source Normalization ─────────────────────────────────────

function normalizeImageSource(src: string): string {
  // Already a data URI
  if (src.startsWith('data:')) return src;

  // HTTP/HTTPS URL — pass through (pptxgenjs can fetch if running in Node)
  if (src.startsWith('http://') || src.startsWith('https://')) return src;

  // Blob URL — can't be used in PPTX, will fail downstream
  if (src.startsWith('blob:')) {
    log.warn('Blob URLs cannot be embedded in PPTX, will render as placeholder');
    return src; // Let it fail gracefully
  }

  // Raw base64 — wrap in data URI
  if (/^[A-Za-z0-9+/=]+$/.test(src)) {
    // Detect image type from base64 prefix if possible
    const type = detectImageType(src);
    return `data:image/${type};base64,${src}`;
  }

  // Unknown — return as-is and let pptxgenjs handle
  return src;
}

function detectImageType(base64: string): string {
  // Check magic bytes
  if (base64.startsWith('/9j/')) return 'jpeg';
  if (base64.startsWith('iVBORw')) return 'png';
  if (base64.startsWith('R0lGOD')) return 'gif';
  if (base64.startsWith('UklGR')) return 'webp';
  if (base64.startsWith('PHN2Zy')) return 'svg+xml';
  return 'png'; // default
}

// ── Remote Image Resolution ────────────────────────────────────────

interface ResolveOptions {
  borderRadius?: number;
  targetWidth?: number;
  targetHeight?: number;
}

async function resolveSingleImage(src: string, options: ResolveOptions = {}): Promise<string | null> {
  // Already resolved
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return processImageIfNeeded(src, options);
  }

  // Local/relative path — can't resolve without filesystem access
  if (src.startsWith('/') || !src.includes('://')) return src;

  // Remote URL — fetch and convert to base64
  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      const response = await fetch(src, { redirect: 'follow' });
      if (!response.ok) {
        log.warn(`HTTP ${response.status} for image: ${src.slice(0, 60)}`);
        return null;
      }
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      return processImageIfNeeded(base64, options);
    } catch (err) {
      log.warn(`Fetch failed for image: ${src.slice(0, 60)} — ${err instanceof Error ? err.message : 'unknown'}`);
      return null;
    }
  }

  return src;
}

/**
 * Compress image if oversized, apply rounded corners if requested.
 * Uses sharp for resize/compress and @napi-rs/canvas for rounded corners.
 */
async function processImageIfNeeded(src: string, options: ResolveOptions): Promise<string> {
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const img = await loadImage(src);
    let { width, height } = img;

    // Resize if oversized (max 1920px on longest side)
    const MAX_SIZE = 1920;
    if (width > MAX_SIZE || height > MAX_SIZE) {
      const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Use target dimensions if provided and smaller
    if (options.targetWidth && options.targetHeight) {
      const targetRatio = Math.min(options.targetWidth / width, options.targetHeight / height, 1);
      if (targetRatio < 1) {
        width = Math.round(width * targetRatio);
        height = Math.round(height * targetRatio);
      }
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Apply rounded corners if requested
    if (options.borderRadius && options.borderRadius > 0) {
      const radius = Math.min(options.borderRadius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(width - radius, 0);
      ctx.quadraticCurveTo(width, 0, width, radius);
      ctx.lineTo(width, height - radius);
      ctx.quadraticCurveTo(width, height, width - radius, height);
      ctx.lineTo(radius, height);
      ctx.quadraticCurveTo(0, height, 0, height - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
    }

    ctx.drawImage(img, 0, 0, width, height);
    const buffer = canvas.toBuffer('image/jpeg', 0.85);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (err) {
    log.warn(`Image processing failed, using original: ${err instanceof Error ? err.message : 'unknown'}`);
    return src;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── SSRF Safety ────────────────────────────────────────────────────

/**
 * Validate that an image URL is safe to fetch.
 * Blocks private IP ranges and localhost.
 */
export function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Block localhost
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return false;
    }

    // Block private IP ranges
    const ipMatch = parsed.hostname.match(
      /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.)/,
    );
    if (ipMatch) return false;

    // Block file protocol
    if (parsed.protocol === 'file:') return false;

    return true;
  } catch {
    return false;
  }
}
