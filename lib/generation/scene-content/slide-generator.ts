/**
 * Slide content generation.
 *
 * Generates slide elements, background, and remark from a SceneOutline.
 */

import { nanoid } from 'nanoid';
import { MAX_VISION_IMAGES } from '@/lib/constants/generation';
import type {
  SceneOutline,
  PdfImage,
  ImageMapping,
  GeneratedSlideContent,
} from '@/lib/types/generation';
import type { PPTElement, SlideBackground } from '@/lib/types/slides';
import type { AgentInfo, GeneratedSlideData, AICallFn } from '../pipeline-types';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { parseJsonResponse } from '../json-repair';
import {
  formatImageDescription,
  formatImagePlaceholder,
  formatTeacherPersonaForPrompt,
} from '../prompt-formatters';
import { fixElementDefaults, processLatexElements } from '../element-fixer';
import { resolveImageIds, normalizeGeneratedVideoRefs } from '../media-resolver';
import { createLogger } from '@/lib/logger';
const log = createLogger('Generation');

export async function generateSlideContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  assignedImages?: PdfImage[],
  imageMapping?: ImageMapping,
  visionEnabled?: boolean,
  generatedMediaMapping?: ImageMapping,
  agents?: AgentInfo[],
  languageDirective?: string,
): Promise<GeneratedSlideContent | null> {
  let assignedImagesText = 'No images available. Do not insert any image elements.';
  let visionImages: Array<{ id: string; src: string }> | undefined;

  if (assignedImages && assignedImages.length > 0) {
    if (visionEnabled && imageMapping) {
      const withSrc = assignedImages.filter((img) => imageMapping[img.id]);
      const visionSlice = withSrc.slice(0, MAX_VISION_IMAGES);
      const textOnlySlice = withSrc.slice(MAX_VISION_IMAGES);
      const noSrcImages = assignedImages.filter((img) => !imageMapping[img.id]);

      const visionDescriptions = visionSlice.map((img) => formatImagePlaceholder(img));
      const textDescriptions = [...textOnlySlice, ...noSrcImages].map((img) =>
        formatImageDescription(img),
      );
      assignedImagesText = [...visionDescriptions, ...textDescriptions].join('\n');

      visionImages = visionSlice.map((img) => ({
        id: img.id,
        src: imageMapping[img.id],
        width: img.width,
        height: img.height,
      }));
    } else {
      assignedImagesText = assignedImages.map((img) => formatImageDescription(img)).join('\n');
    }
  }

  const generatedImageEntries = outline.mediaGenerations?.filter((mg) => mg.type === 'image') ?? [];
  const generatedVideoEntries = outline.mediaGenerations?.filter((mg) => mg.type === 'video') ?? [];
  const hasAssignedImages = (assignedImages?.length ?? 0) > 0;
  const generatedImageEnabled = generatedImageEntries.length > 0;
  const generatedVideoEnabled = generatedVideoEntries.length > 0;
  const imageElementEnabled = hasAssignedImages || generatedImageEnabled;
  const mediaElementEnabled = imageElementEnabled || generatedVideoEnabled;

  if (outline.mediaGenerations && outline.mediaGenerations.length > 0) {
    const genImgDescs = generatedImageEntries
      .map((mg) => `- ${mg.elementId}: "${mg.prompt}" (aspect ratio: ${mg.aspectRatio || '16:9'})`)
      .join('\n');
    const genVidDescs = generatedVideoEntries
      .map((mg) => `- ${mg.elementId}: "${mg.prompt}" (aspect ratio: ${mg.aspectRatio || '16:9'})`)
      .join('\n');

    const mediaParts: string[] = [];
    if (genImgDescs) {
      mediaParts.push(`AI-Generated Images (use these IDs as image element src):\n${genImgDescs}`);
    }
    if (genVidDescs) {
      mediaParts.push(
        `AI-Generated Videos (use these IDs as video element mediaRef):\n${genVidDescs}`,
      );
    }

    if (mediaParts.length > 0) {
      const mediaText = mediaParts.join('\n\n');
      if (
        assignedImagesText.includes('Do not insert') ||
        assignedImagesText.includes('No images')
      ) {
        assignedImagesText = mediaText;
      } else {
        assignedImagesText += `\n\n${mediaText}`;
      }
    }
  }

  const canvasWidth = 1000;
  const canvasHeight = 562.5;

  const teacherContext = formatTeacherPersonaForPrompt(agents);

  const prompts = buildPrompt(PROMPT_IDS.SLIDE_CONTENT_V2, {
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    elements: '(auto-generated from key points)',
    assignedImages: assignedImagesText,
    canvas_width: canvasWidth,
    canvas_height: canvasHeight,
    teacherContext,
    languageDirective: languageDirective || '',
    imageElementEnabled,
    generatedImageEnabled,
    generatedVideoEnabled,
    mediaElementEnabled,
  });

  if (!prompts) {
    return null;
  }

  log.debug(`Generating slide content for: ${outline.title}`);
  if (assignedImages && assignedImages.length > 0) {
    log.debug(`Assigned images: ${assignedImages.map((img) => img.id).join(', ')}`);
  }
  if (visionImages && visionImages.length > 0) {
    log.debug(`Vision images: ${visionImages.map((img) => img.id).join(', ')}`);
  }

  const response = await aiCall(prompts.system, prompts.user, visionImages);
  const generatedData = parseJsonResponse<GeneratedSlideData>(response);

  if (!generatedData || !generatedData.elements || !Array.isArray(generatedData.elements)) {
    log.error(`Failed to parse AI response for: ${outline.title}`);
    return null;
  }

  log.debug(`Got ${generatedData.elements.length} elements for: ${outline.title}`);

  const imageElements = generatedData.elements.filter((el) => el.type === 'image');
  if (imageElements.length > 0) {
    log.debug(
      `Image elements before resolution:`,
      imageElements.map((el) => ({
        type: el.type,
        src:
          (el as Record<string, unknown>).src &&
          String((el as Record<string, unknown>).src).substring(0, 50),
      })),
    );
    log.debug(`imageMapping keys:`, imageMapping ? Object.keys(imageMapping).length : '0 keys');
  }

  const fixedElements = fixElementDefaults(generatedData.elements, assignedImages);
  log.debug(`After element fixing: ${fixedElements.length} elements`);

  const latexProcessedElements = processLatexElements(fixedElements);
  log.debug(`After LaTeX processing: ${latexProcessedElements.length} elements`);

  const resolvedElements = resolveImageIds(
    latexProcessedElements,
    imageMapping,
    generatedMediaMapping,
  );
  log.debug(`After image resolution: ${resolvedElements.length} elements`);

  const videoNormalizedElements = normalizeGeneratedVideoRefs(
    resolvedElements,
    outline.mediaGenerations,
  );
  log.debug(`After video reference normalization: ${videoNormalizedElements.length} elements`);

  const processedElements: PPTElement[] = videoNormalizedElements.map((el) => ({
    ...el,
    id: `${el.type}_${nanoid(8)}`,
    rotate: 0,
  })) as PPTElement[];

  let background: SlideBackground | undefined;
  if (generatedData.background) {
    if (generatedData.background.type === 'solid' && generatedData.background.color) {
      background = { type: 'solid', color: generatedData.background.color };
    } else if (generatedData.background.type === 'gradient' && generatedData.background.gradient) {
      background = {
        type: 'gradient',
        gradient: generatedData.background.gradient,
      };
    }
  }

  return {
    elements: processedElements,
    background,
    remark: generatedData.remark || outline.description,
  };
}
