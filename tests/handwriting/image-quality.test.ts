import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { analyzeHandwritingImage } from '@/lib/handwriting';

function blankImage(width: number, height: number): Buffer {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  return canvas.toBuffer('image/png');
}

function sharpImage(width: number, height: number): Buffer {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  for (let x = 0; x < width; x += 16) {
    context.fillStyle = x % 32 === 0 ? '#ffffff' : '#000000';
    context.fillRect(x, 0, 16, height);
  }
  return canvas.toBuffer('image/png');
}

describe('handwriting image quality', () => {
  it('flags a tiny blank page with blocking quality issues', async () => {
    const result = await analyzeHandwritingImage(blankImage(100, 100));

    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.qualityIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'low_resolution', severity: 'blocking' }),
        expect.objectContaining({ code: 'blur', severity: 'blocking' }),
      ]),
    );
  });

  it('scores a high-resolution high-contrast page above a tiny blank page', async () => {
    const lowQuality = await analyzeHandwritingImage(blankImage(100, 100));
    const highQuality = await analyzeHandwritingImage(sharpImage(1200, 1600));

    expect(highQuality.qualityScore).toBeGreaterThan(lowQuality.qualityScore);
    expect(highQuality.qualityIssues.some((issue) => issue.severity === 'blocking')).toBe(false);
  });

  it('rejects undecodable image bytes', async () => {
    await expect(analyzeHandwritingImage(Buffer.from('not-an-image'))).rejects.toThrow(
      '无法解析图片内容',
    );
  });
});
