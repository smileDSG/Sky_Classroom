import { describe, test, expect } from 'vitest';
import { validateImage } from '@/lib/recognition/image-validator';

function makeFile(type: string, size: number): File {
  const content = new Uint8Array(size).fill(65);
  return new File([content], 'test.' + (type.split('/')[1] || 'png'), { type });
}

describe('validateImage — 图片校验', () => {
  test('接受 JPEG', () => {
    expect(validateImage(makeFile('image/jpeg', 1024)).valid).toBe(true);
  });

  test('接受 PNG', () => {
    expect(validateImage(makeFile('image/png', 2048)).valid).toBe(true);
  });

  test('接受 WebP', () => {
    expect(validateImage(makeFile('image/webp', 512)).valid).toBe(true);
  });

  test('拒绝 GIF', () => {
    const r = validateImage(makeFile('image/gif', 1024));
    expect(r.valid).toBe(false);
    expect(r.error).toContain('不支持的图片格式');
  });

  test('拒绝 BMP', () => {
    expect(validateImage(makeFile('image/bmp', 1024)).valid).toBe(false);
  });

  test('拒绝超过 10MB 的文件', () => {
    const r = validateImage(makeFile('image/png', 11 * 1024 * 1024));
    expect(r.valid).toBe(false);
    expect(r.error).toContain('超过限制');
  });

  test('接受恰好 10MB 的文件', () => {
    expect(validateImage(makeFile('image/png', 10 * 1024 * 1024)).valid).toBe(true);
  });

  test('拒绝 0 字节空文件', () => {
    const r = validateImage(makeFile('image/png', 0));
    expect(r.valid).toBe(false);
    expect(r.error).toContain('空');
  });

  test('拒绝空 MIME 类型', () => {
    expect(validateImage(makeFile('', 1024)).valid).toBe(false);
  });

  test('拒绝 SVG', () => {
    expect(validateImage(makeFile('image/svg+xml', 1024)).valid).toBe(false);
  });
});
