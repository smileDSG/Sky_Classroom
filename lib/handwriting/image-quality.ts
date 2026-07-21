import type { ImageQualityIssue } from './types';

export interface HandwritingImageQualityResult {
  width: number;
  height: number;
  qualityScore: number;
  qualityIssues: ImageQualityIssue[];
  metrics: {
    sharpness: number;
    overexposedRatio: number;
    underexposedRatio: number;
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function computeSharpness(grayscale: Float64Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSquares = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const laplacian =
        4 * grayscale[index] -
        grayscale[index - 1] -
        grayscale[index + 1] -
        grayscale[index - width] -
        grayscale[index + width];
      sum += laplacian;
      sumSquares += laplacian * laplacian;
      count += 1;
    }
  }

  const mean = sum / count;
  const variance = sumSquares / count - mean * mean;
  return clamp01(variance / 2_000);
}

export async function analyzeHandwritingImage(
  buffer: Buffer,
): Promise<HandwritingImageQualityResult> {
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const image = await loadImage(buffer);
    const width = image.width;
    const height = image.height;
    if (width < 1 || height < 1) throw new Error('invalid dimensions');

    const scale = Math.min(1, 512 / Math.max(width, height));
    const analysisWidth = Math.max(1, Math.round(width * scale));
    const analysisHeight = Math.max(1, Math.round(height * scale));
    const canvas = createCanvas(analysisWidth, analysisHeight);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, analysisWidth, analysisHeight);
    const pixels = context.getImageData(0, 0, analysisWidth, analysisHeight).data;
    const grayscale = new Float64Array(analysisWidth * analysisHeight);
    let overexposed = 0;
    let underexposed = 0;

    for (let pixel = 0; pixel < grayscale.length; pixel += 1) {
      const offset = pixel * 4;
      const value =
        0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2];
      grayscale[pixel] = value;
      if (value >= 250) overexposed += 1;
      if (value <= 20) underexposed += 1;
    }

    const sharpness = computeSharpness(grayscale, analysisWidth, analysisHeight);
    const overexposedRatio = overexposed / grayscale.length;
    const underexposedRatio = underexposed / grayscale.length;
    const shortSide = Math.min(width, height);
    const resolutionScore = clamp01(shortSide / 1_000);
    const overexposurePenalty = clamp01((overexposedRatio - 0.9) / 0.1);
    const underexposurePenalty = clamp01((underexposedRatio - 0.3) / 0.7);
    const exposureScore = clamp01(1 - 0.6 * overexposurePenalty - 0.7 * underexposurePenalty);
    const qualityScore = round(0.35 * resolutionScore + 0.45 * sharpness + 0.2 * exposureScore);
    const qualityIssues: ImageQualityIssue[] = [];

    if (shortSide < 800) {
      qualityIssues.push({
        code: 'low_resolution',
        severity: 'blocking',
        confidence: 1,
        message: '图片分辨率过低，请靠近后重新拍摄',
      });
    }
    if (sharpness < 0.08) {
      qualityIssues.push({
        code: 'blur',
        severity: 'blocking',
        confidence: round(1 - sharpness),
        message: '图片过于模糊，请保持镜头稳定后重拍',
      });
    } else if (sharpness < 0.18) {
      qualityIssues.push({
        code: 'blur',
        severity: 'warning',
        confidence: round(1 - sharpness),
        message: '图片清晰度偏低，请确认公式和上下标',
      });
    }
    if (overexposedRatio > 0.985) {
      qualityIssues.push({
        code: 'glare',
        severity: 'blocking',
        confidence: round(overexposedRatio),
        message: '图片大面积过曝或内容为空，请调整光线后重拍',
      });
    } else if (overexposedRatio > 0.95) {
      qualityIssues.push({
        code: 'glare',
        severity: 'warning',
        confidence: round(overexposedRatio),
        message: '图片高亮区域较多，请确认内容没有被反光遮挡',
      });
    }
    if (underexposedRatio > 0.6) {
      qualityIssues.push({
        code: 'shadow',
        severity: 'blocking',
        confidence: round(underexposedRatio),
        message: '图片整体过暗，请补充光线后重拍',
      });
    } else if (underexposedRatio > 0.35) {
      qualityIssues.push({
        code: 'shadow',
        severity: 'warning',
        confidence: round(underexposedRatio),
        message: '图片阴影较重，请确认文字仍然清晰',
      });
    }

    return {
      width,
      height,
      qualityScore,
      qualityIssues,
      metrics: {
        sharpness: round(sharpness),
        overexposedRatio: round(overexposedRatio),
        underexposedRatio: round(underexposedRatio),
      },
    };
  } catch {
    throw new Error('无法解析图片内容');
  }
}
