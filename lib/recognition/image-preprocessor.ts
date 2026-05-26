/**
 * Image preprocessor — Canvas-based preprocessing for problem images.
 * Handles: cropping, shadow removal, brightness/contrast enhancement.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('ImagePreprocessor');

export interface PreprocessOptions {
  crop?: boolean;
  removeShadow?: boolean;
  enhance?: boolean;
  brightness?: number;   // -100 to 100
  contrast?: number;     // -100 to 100
}

/**
 * Preprocess an image blob for OCR/recognition.
 * Returns a processed blob ready for recognition.
 */
export async function preprocessImage(
  imageBlob: Blob,
  options: PreprocessOptions = {},
): Promise<Blob> {
  const img = await createImageFromBlob(imageBlob);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(img, 0, 0);

  if (options.crop) {
    // Detect content bounds and crop
    const bounds = detectContentBounds(ctx, img.width, img.height);
    if (bounds) {
      const padding = 10;
      const croppedData = ctx.getImageData(
        Math.max(0, bounds.x - padding),
        Math.max(0, bounds.y - padding),
        Math.min(bounds.width + padding * 2, img.width),
        Math.min(bounds.height + padding * 2, img.height),
      );
      canvas.width = croppedData.width;
      canvas.height = croppedData.height;
      ctx.putImageData(croppedData, 0, 0);
      log.debug('Image cropped to content bounds');
    }
  }

  if (options.removeShadow) {
    removeShadow(ctx, canvas.width, canvas.height);
  }

  if (options.enhance) {
    enhanceImage(ctx, canvas.width, canvas.height, {
      brightness: options.brightness ?? 10,
      contrast: options.contrast ?? 20,
    });
  }

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

interface ContentBounds { x: number; y: number; width: number; height: number; }

function detectContentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): ContentBounds | null {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const threshold = 240; // near-white = background

  let minX = width, minY = height, maxX = 0, maxY = 0;
  const step = 4; // sample every 4th pixel for performance

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avg < threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX) return null; // all white

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function removeShadow(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Simple adaptive thresholding: if a pixel is significantly darker
  // than its local neighborhood, it's likely content; otherwise lighten
  const radius = 15;
  const temp = new Uint8ClampedArray(data);

  for (let y = radius; y < height - radius; y += 2) {
    for (let x = radius; x < width - radius; x += 2) {
      const i = (y * width + x) * 4;
      let localAvg = 0;
      let count = 0;

      for (let dy = -radius; dy <= radius; dy += 3) {
        for (let dx = -radius; dx <= radius; dx += 3) {
          const ni = ((y + dy) * width + (x + dx)) * 4;
          localAvg += (data[ni] + data[ni + 1] + data[ni + 2]) / 3;
          count++;
        }
      }

      localAvg /= count;
      const pixelVal = (data[i] + data[i + 1] + data[i + 2]) / 3;

      // Shadow pixels are mid-range gray in a mostly light area
      if (localAvg > 180 && pixelVal < localAvg - 20) {
        const factor = localAvg / Math.max(pixelVal, 1);
        for (let c = 0; c < 3; c++) {
          data[i + c] = Math.min(255, Math.round(temp[i + c] * factor * 0.8));
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function enhanceImage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { brightness, contrast }: { brightness: number; contrast: number },
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = data[i + c] + brightness;
      val = contrastFactor * (val - 128) + 128;
      data[i + c] = Math.max(0, Math.min(255, Math.round(val)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
