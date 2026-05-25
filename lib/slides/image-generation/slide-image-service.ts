/**
 * Slide Image Service
 *
 * Generates cover / concept images for slides by calling the project's
 * unified image generation provider (`generateImage`).
 */

import { generateImage } from '@/lib/media/image-providers';
import type { ImageGenerationConfig, ImageGenerationOptions } from '@/lib/media/types';
import { createLogger } from '@/lib/logger';
import { getTheme } from '@/lib/slides';
import type { SlideImageRequest, SlideImageResult } from './types';
import { buildSlideImagePrompt } from './cover-prompt-builder';

const log = createLogger('SlideImageService');

/**
 * Generate images for multiple slide requests in parallel.
 *
 * @param requests  Which slides need images
 * @param config    Image provider config (providerId, apiKey, model, etc.)
 * @returns         Array of results (failed requests are omitted)
 */
export async function generateSlideImages(
  requests: SlideImageRequest[],
  config: ImageGenerationConfig,
): Promise<SlideImageResult[]> {
  const promises = requests.map(async (req) => {
    try {
      const theme = getTheme(req.themeId);
      const prompt = buildSlideImagePrompt(req.topic, req.contentSummary, theme, req.pageRole);

      const options: ImageGenerationOptions = {
        prompt,
        aspectRatio: '16:9',
      };

      const result = await generateImage(config, options);

      const imageUrl = result.url ?? (result.base64 ? `data:image/png;base64,${result.base64}` : '');
      if (!imageUrl) {
        log.warn(`Slide ${req.slideIndex}: image generation returned no URL or base64`);
        return null;
      }

      return {
        slideIndex: req.slideIndex,
        imageUrl,
      } as SlideImageResult;
    } catch (err) {
      log.warn(`Slide ${req.slideIndex}: image generation failed — ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });

  const settled = await Promise.allSettled(promises);
  const results: SlideImageResult[] = [];

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) {
      results.push(r.value);
    }
  }

  log.info(`Generated ${results.length}/${requests.length} slide images`);
  return results;
}
