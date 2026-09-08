import { describe, expect, test, vi } from 'vitest';
import { generateSlideImages } from '@/lib/slides/image-generation';
import type { SlideImageRequest } from '@/lib/slides/image-generation';
import type { ImageGenerationConfig } from '@/lib/media/types';

const mocks = vi.hoisted(() => ({
  generateImageResult: { url: 'https://example.com/image.png', width: 1024, height: 576 },
}));

vi.mock('@/lib/media/image-providers', () => ({
  generateImage: vi.fn().mockImplementation(async () => mocks.generateImageResult),
}));

describe('slide-image-service', () => {
  test('generates images for all requests', async () => {
    const requests: SlideImageRequest[] = [
      {
        slideIndex: 0,
        pageRole: 'cover',
        topic: '勾股定理',
        contentSummary: '',
        themeId: 'sky-blue',
      },
      {
        slideIndex: 2,
        pageRole: 'concept',
        topic: '勾股定理',
        contentSummary: '直角三角形',
        themeId: 'sky-blue',
      },
    ];
    const config: ImageGenerationConfig = { providerId: 'openai-image', apiKey: 'test-key' };

    const results = await generateSlideImages(requests, config);

    expect(results).toHaveLength(2);
    expect(results[0].slideIndex).toBe(0);
    expect(results[0].imageUrl).toBe('https://example.com/image.png');
    expect(results[1].slideIndex).toBe(2);
  });

  test('omits failed requests gracefully', async () => {
    const { generateImage } = await import('@/lib/media/image-providers');
    vi.mocked(generateImage).mockRejectedValueOnce(new Error('Rate limit'));

    const requests: SlideImageRequest[] = [
      { slideIndex: 0, pageRole: 'cover', topic: 'A', contentSummary: '', themeId: 'sky-blue' },
      { slideIndex: 1, pageRole: 'cover', topic: 'B', contentSummary: '', themeId: 'sky-blue' },
    ];
    const config: ImageGenerationConfig = { providerId: 'openai-image', apiKey: 'test-key' };

    const results = await generateSlideImages(requests, config);

    expect(results).toHaveLength(1);
    expect(results[0].slideIndex).toBe(1);
  });

  test('uses base64 fallback when url is absent', async () => {
    const { generateImage } = await import('@/lib/media/image-providers');
    vi.mocked(generateImage).mockResolvedValueOnce({
      base64: 'abc123',
      width: 1024,
      height: 576,
    });

    const requests: SlideImageRequest[] = [
      { slideIndex: 0, pageRole: 'cover', topic: 'A', contentSummary: '', themeId: 'sky-blue' },
    ];
    const config: ImageGenerationConfig = { providerId: 'openai-image', apiKey: 'test-key' };

    const results = await generateSlideImages(requests, config);

    expect(results[0].imageUrl).toContain('data:image/png;base64,abc123');
  });
});
