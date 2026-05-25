/**
 * Slide Image Generation Module
 *
 * Generates AI images for slide covers and concept illustrations.
 */

export type { SlideImageRequest, SlideImageResult } from './types';
export { buildCoverPrompt, buildConceptPrompt, buildSlideImagePrompt } from './cover-prompt-builder';
export { generateSlideImages } from './slide-image-service';
