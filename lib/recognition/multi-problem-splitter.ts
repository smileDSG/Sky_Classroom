/**
 * Multi-problem splitter — detects and separates multiple problems in a single image.
 * Uses contour detection to find distinct problem regions.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('MultiProblemSplitter');

export interface ProblemRegion {
  imageData: Blob;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Split an image containing multiple problems into separate problem regions.
 * Uses horizontal projection profiling to detect gaps between problems.
 */
export async function splitProblems(
  imageBlob: Blob,
): Promise<ProblemRegion[]> {
  const img = await createImageFromBlob(imageBlob);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  // Horizontal projection: find rows with significant content
  const rowDensity = computeRowDensity(imageData, img.width, img.height);
  const regions = findContentRegions(rowDensity, img.height);

  if (regions.length <= 1) {
    // Single problem, return original image
    return [{
      imageData: imageBlob,
      bounds: { x: 0, y: 0, width: img.width, height: img.height },
    }];
  }

  log.debug(`Split image into ${regions.length} problem regions`);

  // Extract each region
  const results: ProblemRegion[] = [];
  for (const region of regions) {
    const regionCanvas = document.createElement('canvas');
    regionCanvas.width = img.width;
    regionCanvas.height = region.height;
    const regionCtx = regionCanvas.getContext('2d');
    if (!regionCtx) continue;

    regionCtx.drawImage(
      canvas,
      0, region.y, img.width, region.height,
      0, 0, img.width, region.height,
    );

    const blob = await new Promise<Blob>((resolve) => {
      regionCanvas.toBlob((b) => resolve(b!), 'image/png');
    });

    results.push({
      imageData: blob,
      bounds: { x: 0, y: region.y, width: img.width, height: region.height },
    });
  }

  return results;
}

function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function computeRowDensity(
  imageData: ImageData,
  width: number,
  height: number,
): number[] {
  const data = imageData.data;
  const densities: number[] = [];
  const threshold = 240;

  for (let y = 0; y < height; y++) {
    let darkPixels = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avg < threshold) darkPixels++;
    }
    densities.push(darkPixels / width);
  }

  return densities;
}

function findContentRegions(
  rowDensity: number[],
  height: number,
): Array<{ y: number; height: number }> {
  const minDensity = 0.02;   // 2% dark pixels threshold
  const minGap = 30;          // minimum gap between problems (pixels)
  const minRegionHeight = 50; // minimum problem height

  const regions: Array<{ y: number; height: number }> = [];
  let inRegion = false;
  let regionStart = 0;
  let gapStart = 0;

  for (let y = 0; y < height; y++) {
    if (!inRegion && rowDensity[y] > minDensity) {
      inRegion = true;
      regionStart = y;
    } else if (inRegion && rowDensity[y] <= minDensity) {
      if (gapStart === 0) gapStart = y;

      if (y - gapStart >= minGap) {
        const regionHeight = gapStart - regionStart;
        if (regionHeight >= minRegionHeight) {
          regions.push({ y: regionStart, height: regionHeight });
        }
        inRegion = false;
        gapStart = 0;
      }
    } else if (inRegion && rowDensity[y] > minDensity) {
      gapStart = 0;
    }
  }

  // Close last region
  if (inRegion) {
    const regionHeight = height - regionStart;
    if (regionHeight >= minRegionHeight) {
      regions.push({ y: regionStart, height: regionHeight });
    }
  }

  return regions.length > 0 ? regions : [{ y: 0, height }];
}
