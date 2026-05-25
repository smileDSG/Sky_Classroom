/**
 * Slide Generation Pipeline Types
 */

import type { Slide } from '@/lib/types/slides';
import type { ImageGenerationConfig } from '@/lib/media/types';

export interface PipelineOptions {
  topic: string;
  slideCount: number;
  difficulty?: 'junior' | 'senior' | 'college';
  themeId: string;
  personaPrompt?: string;
  language?: string;
  avatarId?: string;
  /** Optional image generation config to produce cover/concept illustrations */
  imageConfig?: ImageGenerationConfig;
}

export interface PipelineResult {
  slides: Slide[];
  generationTime: number;
  fixes: string[];
  warnings: string[];
  /** True if the pipeline itself failed and caller should fallback to legacy mode */
  fallbackToLegacy?: boolean;
}
