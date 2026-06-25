/**
 * Slide content generation for classroom scenes.
 *
 * This uses the OpenMAIC element-level slide generator: the model produces
 * Canvas/PPT elements directly, and the classroom renderer displays those
 * elements through the existing slide canvas. It intentionally avoids the
 * template-data layout path so `/classroom` keeps richer generated slides.
 */

import katex from 'katex';
import { nanoid } from 'nanoid';
import { MAX_VISION_IMAGES } from '@/lib/constants/generation';
import type {
  SceneOutline,
  PdfImage,
  ImageMapping,
  GeneratedSlideContent,
} from '@/lib/types/generation';
import type { PPTElement, SlideBackground } from '@/lib/types/slides';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { createLogger } from '@/lib/logger';
import type { AgentInfo, AICallFn, GeneratedSlideData } from '../pipeline-types';
import type { ClassroomThemeSelection } from '../classroom-design-dna';
import {
  formatImageDescription,
  formatImagePlaceholder,
  formatTeacherPersonaForPrompt,
} from '../prompt-formatters';
import { parseJsonResponse } from '../json-repair';
import { polishGeneratedSlideData, polishSlideElements } from './slide-polish';

const log = createLogger('Generation');

function isImageIdReference(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('data:')) return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  if (value.startsWith('/')) return false;
  return /^img_\d+$/i.test(value);
}

function isGeneratedMediaId(value: string): boolean {
  if (!value) return false;
  return /^gen_(img|vid)_[\w-]+$/i.test(value);
}

function resolveImageIds(
  elements: GeneratedSlideData['elements'],
  imageMapping?: ImageMapping,
  generatedMediaMapping?: ImageMapping,
): GeneratedSlideData['elements'] {
  return elements
    .map((el) => {
      if (el.type === 'image') {
        if (!('src' in el)) {
          log.warn('Image element missing src, removing element');
          return null;
        }

        const src = el.src as string;
        if (isImageIdReference(src)) {
          if (!imageMapping?.[src]) {
            log.warn(`No mapping for image ID: ${src}, removing element`);
            return null;
          }
          return { ...el, src: imageMapping[src] };
        }

        if (isGeneratedMediaId(src)) {
          if (generatedMediaMapping?.[src]) {
            return { ...el, src: generatedMediaMapping[src] };
          }
          return el;
        }
      }

      if (el.type === 'video') {
        const mediaRef = (el as Record<string, unknown>).mediaRef;
        if (!('src' in el) && typeof mediaRef !== 'string') {
          log.warn('Video element missing src/mediaRef, removing element');
          return null;
        }

        const src = el.src as string | undefined;
        if (src && isGeneratedMediaId(src)) {
          if (generatedMediaMapping?.[src]) {
            return { ...el, src: generatedMediaMapping[src] };
          }
          return el;
        }
      }

      return el;
    })
    .filter((el): el is NonNullable<typeof el> => el !== null);
}

function normalizeGeneratedVideoRefs(
  elements: GeneratedSlideData['elements'],
  generatedVideoEntries: SceneOutline['mediaGenerations'] = [],
): GeneratedSlideData['elements'] {
  const validRefs = generatedVideoEntries
    .filter((mg) => mg.type === 'video')
    .map((mg) => mg.elementId);
  const validRefSet = new Set(validRefs);
  const onlyRef = validRefs.length === 1 ? validRefs[0] : undefined;

  return elements
    .map((el) => {
      if (el.type !== 'video') return el;

      const videoEl = { ...el } as Record<string, unknown>;
      const mediaRef = typeof videoEl.mediaRef === 'string' ? videoEl.mediaRef : undefined;
      const src = typeof videoEl.src === 'string' ? videoEl.src : undefined;
      const hasGeneratedSrc = !!src && isGeneratedMediaId(src);
      const hasDirectSrc = !!src && !hasGeneratedSrc;

      if (hasDirectSrc) {
        if (mediaRef) delete videoEl.mediaRef;
        return videoEl as typeof el;
      }

      if (mediaRef && validRefSet.has(mediaRef)) {
        if (hasGeneratedSrc) delete videoEl.src;
        return videoEl as typeof el;
      }

      if (src && validRefSet.has(src)) {
        videoEl.mediaRef = src;
        delete videoEl.src;
        return videoEl as typeof el;
      }

      if ((mediaRef || hasGeneratedSrc) && onlyRef) {
        log.warn(`Correcting generated video reference "${mediaRef || src}" to "${onlyRef}"`);
        videoEl.mediaRef = onlyRef;
        if (hasGeneratedSrc) delete videoEl.src;
        return videoEl as typeof el;
      }

      if (mediaRef || hasGeneratedSrc) {
        log.warn(`Invalid generated video reference "${mediaRef || src}", removing element`);
        return null;
      }

      return el;
    })
    .filter((el): el is NonNullable<typeof el> => el !== null);
}

function fixElementDefaults(
  elements: GeneratedSlideData['elements'],
  assignedImages?: PdfImage[],
): GeneratedSlideData['elements'] {
  return elements.map((el) => {
    if (el.type === 'line') {
      const lineEl = el as Record<string, unknown>;
      if (!Array.isArray(lineEl.points) || lineEl.points.length !== 2) {
        lineEl.points = ['', ''];
      }
      if (!Array.isArray(lineEl.start)) {
        lineEl.start = [el.left ?? 0, el.top ?? 0];
      }
      if (!Array.isArray(lineEl.end)) {
        lineEl.end = [(el.left ?? 0) + (el.width ?? 100), (el.top ?? 0) + (el.height ?? 0)];
      }
      lineEl.style ??= 'solid';
      lineEl.color ??= '#333333';
      return lineEl as typeof el;
    }

    if (el.type === 'text') {
      const textEl = el as Record<string, unknown>;
      textEl.defaultFontName ??= 'Microsoft YaHei';
      textEl.defaultColor ??= '#333333';
      textEl.content ??= '';
      return textEl as typeof el;
    }

    if (el.type === 'image') {
      const imageEl = el as Record<string, unknown>;
      imageEl.fixedRatio ??= true;

      if (assignedImages && typeof imageEl.src === 'string') {
        const imgMeta = assignedImages.find((img) => img.id === imageEl.src);
        if (imgMeta?.width && imgMeta?.height) {
          const knownRatio = imgMeta.width / imgMeta.height;
          const curW = (el.width || 400) as number;
          const curH = (el.height || 300) as number;
          if (Math.abs(curW / curH - knownRatio) / knownRatio > 0.1) {
            const newH = Math.round(curW / knownRatio);
            if (newH > 462) {
              imageEl.width = Math.round(462 * knownRatio);
              imageEl.height = 462;
            } else {
              imageEl.height = newH;
            }
          }
        }
      }

      return imageEl as typeof el;
    }

    if (el.type === 'shape') {
      const shapeEl = el as Record<string, unknown>;
      const w = el.width ?? 100;
      const h = el.height ?? 100;
      shapeEl.viewBox ??= `0 0 ${w} ${h}`;
      shapeEl.path ??= `M0 0 L${w} 0 L${w} ${h} L0 ${h} Z`;
      shapeEl.fill ??= '#5b9bd5';
      shapeEl.fixedRatio ??= false;
      return shapeEl as typeof el;
    }

    return el;
  });
}

function processLatexElements(
  elements: GeneratedSlideData['elements'],
): GeneratedSlideData['elements'] {
  return elements
    .map((el) => {
      if (el.type !== 'latex') return el;

      const latexStr = el.latex as string | undefined;
      if (!latexStr) {
        log.warn('Latex element missing latex string, removing');
        return null;
      }

      try {
        const html = katex.renderToString(latexStr, {
          throwOnError: false,
          displayMode: true,
          output: 'html',
        });

        return {
          ...el,
          html,
          fixedRatio: true,
        };
      } catch (err) {
        log.warn(`Failed to render latex "${latexStr}":`, err);
        return null;
      }
    })
    .filter((el): el is NonNullable<typeof el> => el !== null);
}

function toSlideBackground(background: GeneratedSlideData['background']): SlideBackground | undefined {
  if (!background) return undefined;
  if (background.type === 'solid' && background.color) {
    return { type: 'solid', color: background.color };
  }
  if (background.type === 'gradient' && background.gradient) {
    return { type: 'gradient', gradient: background.gradient };
  }
  return undefined;
}

function formatThemeDirective(themeSelection?: ClassroomThemeSelection): string {
  if (!themeSelection) {
    return [
      'No course theme was provided. Use a restrained neutral classroom style.',
      'Avoid copying sample colors literally unless they fit the topic.',
    ].join('\n');
  }

  const { palette, fonts } = themeSelection;
  return [
    `Course theme: ${themeSelection.styleName} (${themeSelection.paletteName}), mood: ${themeSelection.mood}.`,
    `Use these palette tokens consistently on this slide:`,
    `- content background: #${palette.contentBg}`,
    `- primary accent: #${palette.accent}`,
    `- secondary accent: #${palette.accentSecondary}`,
    `- light panel fill: #${palette.accentLight}`,
    `- title text: #${palette.textPrimary}`,
    `- body text: #${palette.textBody}`,
    `- muted text: #${palette.textMuted}`,
    `- text on dark/accent: #${palette.textOnDark}`,
    `Typography: heading ${fonts.heading}, body ${fonts.body}, English ${fonts.en}.`,
    `Do not default to the sample blue palette (#2f80d1/#dbeafe) unless it is one of the theme colors above.`,
  ].join('\n');
}

export async function generateSlideContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  assignedImages?: PdfImage[],
  imageMapping?: ImageMapping,
  visionEnabled?: boolean,
  generatedMediaMapping?: ImageMapping,
  agents?: AgentInfo[],
  languageDirective?: string,
  themeSelection?: ClassroomThemeSelection,
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
      if (assignedImagesText.includes('No images')) {
        assignedImagesText = mediaText;
      } else {
        assignedImagesText += `\n\n${mediaText}`;
      }
    }
  }

  const canvasWidth = 1000;
  const canvasHeight = 562.5;
  const teacherContext = formatTeacherPersonaForPrompt(agents);
  const prompts = buildPrompt(PROMPT_IDS.SLIDE_CONTENT, {
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    elements: '(Generate from the key points)',
    assignedImages: assignedImagesText,
    canvas_width: canvasWidth,
    canvas_height: canvasHeight,
    teacherContext,
    languageDirective: languageDirective || '',
    themeDirective: formatThemeDirective(themeSelection),
    imageElementEnabled,
    generatedImageEnabled,
    generatedVideoEnabled,
    mediaElementEnabled,
  });

  if (!prompts) return null;

  log.debug(`Generating element-level slide content for: ${outline.title}`);
  const response = await aiCall(prompts.system, prompts.user, visionImages);
  const generatedData = parseJsonResponse<GeneratedSlideData>(response);

  if (!generatedData?.elements || !Array.isArray(generatedData.elements)) {
    log.error(`Failed to parse AI slide response for: ${outline.title}`);
    return null;
  }

  const polishedData = polishGeneratedSlideData(generatedData, {
    title: outline.title,
    keyPoints: outline.keyPoints,
    themeSelection,
  });
  const fixedElements = fixElementDefaults(polishedData.elements, assignedImages);
  const latexProcessedElements = processLatexElements(fixedElements);
  const resolvedElements = resolveImageIds(
    latexProcessedElements,
    imageMapping,
    generatedMediaMapping,
  );
  const videoNormalizedElements = normalizeGeneratedVideoRefs(
    resolvedElements,
    outline.mediaGenerations,
  );
  const polishedElements = polishSlideElements(videoNormalizedElements, {
    title: outline.title,
    keyPoints: outline.keyPoints,
    themeSelection,
  });

  const processedElements = polishedElements.map((el) => ({
    ...el,
    id: `${el.type}_${nanoid(8)}`,
    rotate: el.type === 'line' ? undefined : ((el as { rotate?: number }).rotate ?? 0),
  })) as PPTElement[];

  return {
    elements: processedElements,
    background: toSlideBackground(generatedData.background),
    remark: generatedData.remark || outline.description,
  };
}
