/**
 * Stage 1: Generate scene outlines from user requirements.
 * Also contains outline fallback logic.
 */

import { nanoid } from 'nanoid';
import { MAX_PDF_CONTENT_CHARS, MAX_VISION_IMAGES } from '@/lib/constants/generation';
import type {
  UserRequirements,
  SceneOutline,
  PdfImage,
  ImageMapping,
} from '@/lib/types/generation';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { formatImageDescription, formatImagePlaceholder } from './prompt-formatters';
import { parseJsonResponse } from './json-repair';
import { uniquifyMediaElementIds } from './scene-builder';
import type { AICallFn, GenerationResult, GenerationCallbacks } from './pipeline-types';
import { createLogger } from '@/lib/logger';
const log = createLogger('Generation');

/**
 * Used when the outline stage fails to produce an explicit directive (LLM
 * schema regression, empty response, upstream error). Downstream prompts
 * still need *something* that steers the model toward the requirement's
 * language rather than defaulting to the training-distribution prior.
 */
export const DEFAULT_LANGUAGE_DIRECTIVE = '使用中文进行教学。所有内容、标题、说明均使用中文输出。';

/**
 * Generate scene outlines from user requirements
 * Now uses simplified UserRequirements with just requirement text and language
 */
export async function generateSceneOutlinesFromRequirements(
  requirements: UserRequirements,
  pdfText: string | undefined,
  pdfImages: PdfImage[] | undefined,
  aiCall: AICallFn,
  callbacks?: GenerationCallbacks,
  options?: {
    visionEnabled?: boolean;
    imageMapping?: ImageMapping;
    imageGenerationEnabled?: boolean;
    videoGenerationEnabled?: boolean;
    researchContext?: string;
    teacherContext?: string;
  },
): Promise<GenerationResult<{ languageDirective: string; outlines: SceneOutline[] }>> {
  // Build available images description for the prompt
  let availableImagesText = 'No images available';
  let visionImages: Array<{ id: string; src: string }> | undefined;

  if (pdfImages && pdfImages.length > 0) {
    if (options?.visionEnabled && options?.imageMapping) {
      // Vision mode: split into vision images (first N) and text-only (rest)
      const allWithSrc = pdfImages.filter((img) => options.imageMapping![img.id]);
      const visionSlice = allWithSrc.slice(0, MAX_VISION_IMAGES);
      const textOnlySlice = allWithSrc.slice(MAX_VISION_IMAGES);
      const noSrcImages = pdfImages.filter((img) => !options.imageMapping![img.id]);

      const visionDescriptions = visionSlice.map((img) => formatImagePlaceholder(img));
      const textDescriptions = [...textOnlySlice, ...noSrcImages].map((img) =>
        formatImageDescription(img),
      );
      availableImagesText = [...visionDescriptions, ...textDescriptions].join('\n');

      visionImages = visionSlice.map((img) => ({
        id: img.id,
        src: options.imageMapping![img.id],
        width: img.width,
        height: img.height,
      }));
    } else {
      // Text-only mode: full descriptions
      availableImagesText = pdfImages.map((img) => formatImageDescription(img)).join('\n');
    }
  }

  // Build user profile string for prompt injection
  const userProfileText =
    requirements.userNickname || requirements.userBio
      ? `## Student Profile\n\nStudent: ${requirements.userNickname || 'Unknown'}${requirements.userBio ? ` — ${requirements.userBio}` : ''}\n\nConsider this student's background when designing the course. Adapt difficulty, examples, and teaching approach accordingly.\n\n---`
      : '';

  // Build media snippet conditions based on enabled flags.
  const imageEnabled = options?.imageGenerationEnabled ?? false;
  const videoEnabled = options?.videoGenerationEnabled ?? false;
  const mediaEnabled = imageEnabled || videoEnabled;
  const hasSourceImages = (pdfImages?.length ?? 0) > 0;

  // Use simplified prompt variables
  const prompts = buildPrompt(PROMPT_IDS.OUTLINE, {
    // New simplified variables
    requirement: requirements.requirement,
    pdfContent: pdfText ? pdfText.substring(0, MAX_PDF_CONTENT_CHARS) : 'None',
    availableImages: availableImagesText,
    userProfile: userProfileText,
    hasSourceImages,
    imageEnabled,
    videoEnabled,
    mediaEnabled,
    researchContext: options?.researchContext || 'None',
    // Server-side generation populates this via options; client-side populates via formatTeacherPersonaForPrompt
    teacherContext: options?.teacherContext || '',
  });

  if (!prompts) {
    return { success: false, error: 'Prompt template not found' };
  }

  try {
    callbacks?.onProgress?.({
      currentStage: 1,
      overallProgress: 20,
      stageProgress: 50,
      statusMessage: 'Analyzing requirements, generating scene outlines...',
      scenesGenerated: 0,
      totalScenes: 0,
    });

    const response = await aiCall(prompts.system, prompts.user, visionImages);
    const parsed = parseJsonResponse<
      { languageDirective: string; outlines: SceneOutline[] } | SceneOutline[]
    >(response);

    let languageDirective: string;
    let rawOutlines: SceneOutline[];

    if (Array.isArray(parsed)) {
      // Fallback: LLM returned old flat array format
      languageDirective = DEFAULT_LANGUAGE_DIRECTIVE;
      rawOutlines = parsed;
    } else if (parsed && parsed.outlines) {
      languageDirective = parsed.languageDirective || DEFAULT_LANGUAGE_DIRECTIVE;
      rawOutlines = parsed.outlines;
    } else {
      return { success: false, error: 'Failed to parse scene outlines response' };
    }

    if (!Array.isArray(rawOutlines)) {
      return { success: false, error: 'Failed to parse scene outlines response' };
    }

    const mergedOutlines = mergeSparseSlideOutlines(rawOutlines);

    // Ensure IDs and order
    const enriched = mergedOutlines.map((outline, index) => ({
      ...outline,
      id: outline.id || nanoid(),
      order: index + 1,
    }));

    // Replace sequential gen_img_N/gen_vid_N with globally unique IDs
    const result = uniquifyMediaElementIds(enriched);

    log.info(
      `[OutlineGen] Generated ${result.length} outlines. Titles: ${result.map((o) => `"${o.title}"[${o.type}]`).join(', ')}`,
    );

    callbacks?.onProgress?.({
      currentStage: 1,
      overallProgress: 50,
      stageProgress: 100,
      statusMessage: `Generated ${result.length} scene outlines`,
      scenesGenerated: 0,
      totalScenes: result.length,
    });

    return { success: true, data: { languageDirective, outlines: result } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

const SPARSE_SLIDE_TEXT_LIMIT = 170;
const SPARSE_SLIDE_POINT_LIMIT = 3;
const MERGED_SLIDE_POINT_LIMIT = 8;
const MERGED_SLIDE_TEXT_LIMIT = 520;

function normalizedTextLength(value: string | undefined): number {
  return (value || '').replace(/\s+/g, '').length;
}

function outlineTextLength(outline: SceneOutline): number {
  return (
    normalizedTextLength(outline.title) +
    normalizedTextLength(outline.description) +
    normalizedTextLength(outline.teachingObjective) +
    outline.keyPoints.reduce((sum, point) => sum + normalizedTextLength(point), 0)
  );
}

function hasBoundMedia(outline: SceneOutline): boolean {
  return (
    (outline.suggestedImageIds?.length ?? 0) > 0 || (outline.mediaGenerations?.length ?? 0) > 0
  );
}

function isSparseSlide(outline: SceneOutline): boolean {
  if (outline.type !== 'slide' || hasBoundMedia(outline)) {
    return false;
  }

  const pointCount = outline.keyPoints.length;
  const textLength = outlineTextLength(outline);

  return pointCount <= SPARSE_SLIDE_POINT_LIMIT && textLength <= SPARSE_SLIDE_TEXT_LIMIT;
}

function dedupeKeyPoints(points: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const point of points) {
    const normalized = point.trim().replace(/\s+/g, ' ');
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(point);
  }

  return result;
}

function mergeOutlineTitle(first: SceneOutline, second: SceneOutline): string {
  if (first.title === second.title) {
    return first.title;
  }

  const slashTitle = `${first.title} / ${second.title}`;
  if (normalizedTextLength(slashTitle) <= 34) {
    return slashTitle;
  }

  const colonTitle = `${first.title}: ${second.title}`;
  if (normalizedTextLength(colonTitle) <= 42) {
    return colonTitle;
  }

  return first.title;
}

function mergeOptionalSentence(first?: string, second?: string): string | undefined {
  const values = [first, second].map((value) => value?.trim()).filter(Boolean) as string[];
  if (values.length === 0) {
    return undefined;
  }
  if (values.length === 1 || values[0] === values[1]) {
    return values[0];
  }
  return values.join(' ');
}

function canMergeSparseSlides(first: SceneOutline, second: SceneOutline): boolean {
  if (!isSparseSlide(first) || !isSparseSlide(second)) {
    return false;
  }

  const mergedPointCount = dedupeKeyPoints([...first.keyPoints, ...second.keyPoints]).length;
  const mergedTextLength = outlineTextLength(first) + outlineTextLength(second);

  return (
    mergedPointCount <= MERGED_SLIDE_POINT_LIMIT && mergedTextLength <= MERGED_SLIDE_TEXT_LIMIT
  );
}

function mergeSparseSlidePair(first: SceneOutline, second: SceneOutline): SceneOutline {
  return {
    ...first,
    title: mergeOutlineTitle(first, second),
    description:
      mergeOptionalSentence(first.description, second.description) ||
      mergeOutlineTitle(first, second),
    keyPoints: dedupeKeyPoints([...first.keyPoints, ...second.keyPoints]),
    teachingObjective: mergeOptionalSentence(first.teachingObjective, second.teachingObjective),
    estimatedDuration:
      typeof first.estimatedDuration === 'number' || typeof second.estimatedDuration === 'number'
        ? (first.estimatedDuration || 0) + (second.estimatedDuration || 0)
        : undefined,
    languageNote: mergeOptionalSentence(first.languageNote, second.languageNote),
  };
}

/**
 * Merge adjacent, low-density slide outlines before scene generation.
 *
 * This reduces decks where the model splits tiny ideas into many almost-empty
 * pages. Non-slide scenes and media-bound slides stay as hard boundaries.
 */
export function mergeSparseSlideOutlines(outlines: SceneOutline[]): SceneOutline[] {
  const result: SceneOutline[] = [];
  let index = 0;

  while (index < outlines.length) {
    const current = outlines[index];
    const next = outlines[index + 1];

    if (next && canMergeSparseSlides(current, next)) {
      result.push(mergeSparseSlidePair(current, next));
      index += 2;
      continue;
    }

    result.push(current);
    index += 1;
  }

  return result.map((outline, order) => ({ ...outline, order: order + 1 }));
}

/**
 * Apply type fallbacks for outlines that can't be generated as their declared type.
 * - interactive without interactiveConfig OR widgetType+widgetOutline → slide
 * - pbl without pblConfig or languageModel → slide
 */
export function applyOutlineFallbacks(
  outline: SceneOutline,
  hasLanguageModel: boolean,
): SceneOutline {
  // Ultra Mode: interactive scenes with widgetType + widgetOutline are valid
  const hasWidgetConfig = outline.widgetType && outline.widgetOutline;

  if (outline.type === 'interactive' && !outline.interactiveConfig && !hasWidgetConfig) {
    log.warn(
      `Interactive outline "${outline.title}" missing interactiveConfig and widget config, falling back to slide`,
    );
    return { ...outline, type: 'slide' };
  }
  if (outline.type === 'pbl' && (!outline.pblConfig || !hasLanguageModel)) {
    log.warn(
      `PBL outline "${outline.title}" missing pblConfig or languageModel, falling back to slide`,
    );
    return { ...outline, type: 'slide' };
  }
  return outline;
}
