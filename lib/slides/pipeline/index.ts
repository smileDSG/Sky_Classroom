/**
 * Slide Generation Pipeline
 *
 * Orchestrates the full v2 template generation flow:
 *   LLM call → JSON parse → capacity validation & auto-fix → assembly
 *
 * This module wraps the existing template-mode logic with
 * pre-assembly overflow detection and correction.
 */

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { createLogger } from '@/lib/logger';
import { getTheme } from '@/lib/slides';
import type { PptxThemeId } from '@/lib/slides/types';
import { assembleSlidesV2 } from '@/lib/slides/slide-templates-v2';
import type { TemplateSlotV2 } from '@/lib/slides/types';
import type { LanguageModel } from 'ai';
import type { ModelInfo } from '@/lib/types/provider';
import type { ImageGenerationConfig } from '@/lib/media/types';
import type { PipelineResult } from './types';
import { validateAndFixSlots } from './validator';
import { generateSlideImages, type SlideImageRequest } from '@/lib/slides/image-generation';

const log = createLogger('SlidesPipeline');

export type { PipelineOptions, PipelineResult } from './types';
export { validateAndFixSlots } from './validator';

/**
 * Run the slide generation pipeline.
 *
 * @param system          System prompt (from buildTemplatePrompt)
 * @param user            User prompt (from buildTemplatePrompt)
 * @param themeId         Selected theme ID
 * @param languageModel   Resolved Vercel AI SDK model
 * @param modelInfo       Model metadata (output window, etc.)
 * @param modelString     Human-readable model identifier for logging
 * @returns               PipelineResult with slides, fixes, and warnings
 */
export async function generateSlidesPipeline(
  system: string,
  user: string,
  themeId: string,
  languageModel: LanguageModel,
  modelInfo: ModelInfo | null | undefined,
  modelString: string,
  imageConfig?: ImageGenerationConfig,
): Promise<PipelineResult> {
  const startTime = Date.now();

  try {
    const rawResponse = await callLLM(
      {
        model: languageModel,
        system,
        prompt: user,
        maxOutputTokens: modelInfo?.outputWindow ?? 16384,
      },
      'sky-slides-template-v2',
      { retries: 2, validate: (text) => text.length > 100 },
    );

    const parsed = parseJsonResponse<{ slots: TemplateSlotV2[] }>(rawResponse.text);
    if (!parsed || !Array.isArray(parsed.slots)) {
      log.error(
        `Pipeline parse failed [model=${modelString}]. Raw (first 800 chars): ${rawResponse.text.substring(0, 800)}`,
      );
      return {
        slides: [],
        generationTime: Date.now() - startTime,
        fixes: [],
        warnings: ['Failed to parse AI response, fallback to legacy mode recommended'],
        fallbackToLegacy: true,
      };
    }

    const theme = getTheme(themeId as PptxThemeId);

    // ── Optional: generate images for cover / introduction slides ──
    let slots = parsed.slots;
    if (imageConfig) {
      const imageRequests: SlideImageRequest[] = slots
        .map((slot, i) => {
          if (!slot.imagePrompt || !slot.pageRole) return null;
          if (slot.pageRole !== 'cover' && slot.pageRole !== 'introduction') return null;
          return {
            slideIndex: i,
            pageRole: slot.pageRole,
            topic: user, // approximate topic from user prompt
            contentSummary: slot.imagePrompt,
            themeId: themeId as PptxThemeId,
          };
        })
        .filter(Boolean) as SlideImageRequest[];

      if (imageRequests.length > 0) {
        try {
          const imageResults = await generateSlideImages(imageRequests, imageConfig);
          const imageMap = new Map(imageResults.map((r) => [r.slideIndex, r.imageUrl]));
          slots = slots.map((slot, i) => {
            if (imageMap.has(i)) {
              return { ...slot, params: { ...slot.params, imageUrl: imageMap.get(i) } };
            }
            return slot;
          });
        } catch (err) {
          log.warn('Image generation failed, continuing without images:', err);
        }
      }
    }

    // ── Validate & fix overflow ──
    const { fixedSlots, fixes, warnings } = validateAndFixSlots(slots, theme);

    if (fixes.length > 0) {
      log.info(`Auto-fixed ${fixes.length} overflow(s): ${fixes.join(' | ')}`);
    }
    if (warnings.length > 0) {
      log.warn(`Validation warnings: ${warnings.join(' | ')}`);
    }

    const slides = assembleSlidesV2(fixedSlots, theme);

    return {
      slides,
      generationTime: Date.now() - startTime,
      fixes,
      warnings,
      fallbackToLegacy: false,
    };
  } catch (err) {
    log.error(`Pipeline error [model=${modelString}]:`, err);
    return {
      slides: [],
      generationTime: Date.now() - startTime,
      fixes: [],
      warnings: [err instanceof Error ? err.message : 'Pipeline execution error'],
      fallbackToLegacy: true,
    };
  }
}
