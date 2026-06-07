import { describe, it, expect, vi } from 'vitest';
import { addImageToSlide, resolveImages, isSafeImageUrl } from '@/lib/slides/pptx-image-handler';
import type { ThemeToken } from '@/lib/slides/types';

function mockSlide() {
  return {
    addImage: vi.fn(),
    addShape: vi.fn(),
    addText: vi.fn(),
  } as unknown as { addImage: ReturnType<typeof vi.fn>; addShape: ReturnType<typeof vi.fn>; addText: ReturnType<typeof vi.fn> };
}

function baseTheme(): ThemeToken {
  return {
    id: 'sky-blue',
    name: 'Sky Blue',
    fontFamily: 'Microsoft YaHei',
    headingFont: 'Arial',
    coverTitleSize: 44,
    coverSubSize: 20,
    titleFontSize: 32,
    bodyFontSize: 18,
    bulletSize: 16,
    bulletStyle: 'dot',
    pageMargin: 60,
    contentMaxWidth: 880,
    accent: '#3b82f6',
    accentSecondary: '#60a5fa',
    accentLight: '#dbeafe',
    coverTitleColor: '#1e3a8a',
    coverSubColor: '#64748b',
    bodyColor: '#1e293b',
    bodyMutedColor: '#64748b',
    dividerColor: '#cbd5e1',
    coverBg: '#f8fafc',
    contentBg: '#ffffff',
    shapeOutlineColor: '#e2e8f0',
    coverBgGradient: undefined,
    pageNumColor: '#94a3b8',
  };
}

describe('pptx-image-handler', () => {
  it('renders image from base64 source', () => {
    const slide = mockSlide();
    const theme = baseTheme();

    addImageToSlide(
      slide as any,
      {
        id: 'img-1',
        type: 'image',
        left: 100,
        top: 100,
        width: 200,
        height: 150,
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      },
      { theme, ratioPx2Inch: 96 },
    );

    expect(slide.addImage).toHaveBeenCalledOnce();
    const opts = slide.addImage.mock.calls[0][0];
    expect(opts.x).toBeCloseTo(100 / 96, 4);
    expect(opts.y).toBeCloseTo(100 / 96, 4);
    expect(opts.w).toBeCloseTo(200 / 96, 4);
    expect(opts.h).toBeCloseTo(150 / 96, 4);
  });

  it('renders placeholder when no source', () => {
    const slide = mockSlide();
    const theme = baseTheme();

    const result = addImageToSlide(
      slide as any,
      { id: 'img-1', type: 'image', left: 0, top: 0, width: 100, height: 100 },
      { theme, ratioPx2Inch: 96 },
    );

    expect(result.success).toBe(false);
    expect(slide.addShape).toHaveBeenCalled();
    expect(slide.addText).toHaveBeenCalled();
  });

  it('uses resolved image over element src', () => {
    const slide = mockSlide();
    const theme = baseTheme();
    const resolvedSrc = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD';

    addImageToSlide(
      slide as any,
      {
        id: 'img-1',
        type: 'image',
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        src: 'https://example.com/image.png',
      },
      { theme, ratioPx2Inch: 96, resolvedImages: new Map([['img-1', resolvedSrc]]) },
    );

    expect(slide.addImage).toHaveBeenCalledOnce();
    expect(slide.addImage.mock.calls[0][0].path).toBe(resolvedSrc);
  });

  it('adds border when specified', () => {
    const slide = mockSlide();
    const theme = baseTheme();

    addImageToSlide(
      slide as any,
      {
        id: 'img-1',
        type: 'image',
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        border: { color: '#ff0000', width: 2, style: 'solid' },
      },
      { theme, ratioPx2Inch: 96 },
    );

    const opts = slide.addImage.mock.calls[0][0];
    expect(opts.line).toBeDefined();
    expect(opts.line.color).toBe('ff0000');
  });

  it('validates safe image URLs', () => {
    expect(isSafeImageUrl('https://example.com/image.png')).toBe(true);
    expect(isSafeImageUrl('http://example.com/image.png')).toBe(true);
    expect(isSafeImageUrl('http://localhost/image.png')).toBe(false);
    expect(isSafeImageUrl('http://127.0.0.1/image.png')).toBe(false);
    expect(isSafeImageUrl('http://192.168.1.1/image.png')).toBe(false);
    expect(isSafeImageUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeImageUrl('http://10.0.0.1/image.png')).toBe(false);
  });

  it('resolveImages returns empty map for empty input', async () => {
    const result = await resolveImages([]);
    expect(result.size).toBe(0);
  });

  it('resolveImages skips elements without src', async () => {
    const result = await resolveImages([{ id: 'img-1' }]);
    expect(result.size).toBe(0);
  });

  it('resolveImages handles base64 src directly', async () => {
    const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const result = await resolveImages([{ id: 'img-1', src }]);
    expect(result.has('img-1')).toBe(true);
    expect(result.get('img-1')?.startsWith('data:')).toBe(true);
  });
});
