/**
 * Slide Image Generation Types
 */

import type { PptxThemeId } from '@/lib/slides/types';
import type { PageRole } from '@/lib/slides/types';

export interface SlideImageRequest {
  slideIndex: number;
  pageRole: PageRole;
  topic: string;
  contentSummary: string;
  themeId: PptxThemeId;
  styleHint?: string;
}

export interface SlideImageResult {
  slideIndex: number;
  imageUrl: string;
  localPath?: string;
}
