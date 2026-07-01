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
import { polishSlideElements } from './slide-polish';
import { auditSlideLayout } from '@/lib/slides/agent/layout-guard-agent';
import { DEFAULT_LANGUAGE_DIRECTIVE } from '@/lib/generation/outline-generator';
import { auditGeneratedSlideContent } from './classroom-slide-qa';
import { buildSlideStyleContract } from './slide-style-contract';

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

function toSlideBackground(
  background: GeneratedSlideData['background'],
): SlideBackground | undefined {
  if (!background) return undefined;
  if (background.type === 'solid' && background.color) {
    return { type: 'solid', color: background.color };
  }
  if (background.type === 'gradient' && background.gradient) {
    return { type: 'gradient', gradient: background.gradient };
  }
  return undefined;
}

function getBlockingLayoutIssueDetails(elements: PPTElement[]): string[] {
  return auditSlideLayout(elements)
    .filter((issue) =>
      [
        'readable_element_overlap',
        'foreground_overlay_collision',
        'latex_box_too_small',
        'unsafe_bottom_zone',
        'text_outside_background',
      ].includes(issue.type),
    )
    .map((issue) =>
      [
        issue.type,
        issue.textId ? `textId=${issue.textId}` : '',
        issue.backgroundId ? `backgroundId=${issue.backgroundId}` : '',
        issue.detail,
      ]
        .filter(Boolean)
        .join(' | '),
    );
}

function getRawDesignBlockingLayoutIssueDetails(
  elements: GeneratedSlideData['elements'],
): string[] {
  const numericElements = elements.filter(
    (element) =>
      typeof element.left === 'number' &&
      typeof element.top === 'number' &&
      typeof element.width === 'number',
  ) as unknown as PPTElement[];

  return auditSlideLayout(numericElements)
    .filter((issue) =>
      ['readable_element_overlap', 'foreground_overlay_collision'].includes(issue.type),
    )
    .map((issue) =>
      [
        issue.type,
        issue.textId ? `textId=${issue.textId}` : '',
        issue.backgroundId ? `backgroundId=${issue.backgroundId}` : '',
        issue.detail,
      ]
        .filter(Boolean)
        .join(' | '),
    );
}

function uniqueIssueDetails(issues: string[]): string[] {
  return [...new Set(issues)];
}

function stripGeneratedHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getGeneratedChineseTitle(generatedData: GeneratedSlideData): string | undefined {
  const title = generatedData.elements
    .filter((element) => element.type === 'text')
    .sort((a, b) => Number(a.top ?? 0) - Number(b.top ?? 0))
    .map((element) =>
      stripGeneratedHtml(String((element as Record<string, unknown>).content ?? '')),
    )
    .find((text) => /[\u4e00-\u9fff]/.test(text));

  return title || undefined;
}

function finalizeSlideElements(
  generatedData: GeneratedSlideData,
  outline: SceneOutline,
  assignedImages: PdfImage[] | undefined,
  imageMapping: ImageMapping | undefined,
  generatedMediaMapping: ImageMapping | undefined,
  options: { polish?: boolean } = {},
): PPTElement[] {
  const fixedElements = fixElementDefaults(generatedData.elements, assignedImages);
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

  const processedElements = videoNormalizedElements.map((el) => ({
    ...el,
    id: `${el.type}_${nanoid(8)}`,
    rotate: 0,
  })) as PPTElement[];

  if (options.polish === false) return processedElements;

  return polishSlideElements(processedElements, {
    title: getGeneratedChineseTitle(generatedData) ?? outline.title,
    keyPoints: outline.keyPoints,
    order: outline.order,
    decorate: false,
  }) as PPTElement[];
}

export async function generateSlideContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  assignedImages?: PdfImage[],
  imageMapping?: ImageMapping,
  visionEnabled?: boolean,
  generatedMediaMapping?: ImageMapping,
  agents?: AgentInfo[],
  _languageDirective?: string,
  _themeSelection?: ClassroomThemeSelection,
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
  const effectiveLanguageDirective = DEFAULT_LANGUAGE_DIRECTIVE;
  const prompts = buildPrompt(PROMPT_IDS.SLIDE_CONTENT, {
    title: outline.title,
    order: outline.order,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    layoutContract: buildSlideStyleContract(outline),
    elements: '(Generate from the key points)',
    assignedImages: assignedImagesText,
    canvas_width: canvasWidth,
    canvas_height: canvasHeight,
    teacherContext,
    languageDirective: effectiveLanguageDirective,
    imageElementEnabled,
    generatedImageEnabled,
    generatedVideoEnabled,
    mediaElementEnabled,
  });

  if (!prompts) return null;

  log.debug(`Generating element-level slide content for: ${outline.title}`);
  const response = await aiCall(prompts.system, prompts.user, visionImages);
  let generatedData = parseJsonResponse<GeneratedSlideData>(response);

  if (!generatedData?.elements || !Array.isArray(generatedData.elements)) {
    log.warn(`AI slide response for "${outline.title}" missed elements; retrying schema repair.`);
    const retryPrompt = `${prompts.user}

## REQUIRED SCHEMA RETRY

Your previous response did not match the OpenMAIC slide schema. Return the slide again as pure JSON with this exact top-level shape:

{
  "background": { "type": "solid", "color": "#ffffff" },
  "elements": [
    {
      "id": "title_001",
      "type": "text",
      "left": 60,
      "top": 50,
      "width": 880,
      "height": 76,
      "content": "<p style=\\"font-size:32px;\\"><strong>${outline.title}</strong></p>",
      "defaultFontName": "",
      "defaultColor": "#333333"
    }
  ],
  "remark": "speaker note"
}

Hard rules:
- All visible slide text must follow this language directive: ${effectiveLanguageDirective}
- Do NOT return plan fields such as "layout", "bullets", "visual", or "takeaway" unless they are inside a rendered element's text.
- Every visible item must be an element in the "elements" array with left/top/width/height.
- Use separate "latex" elements for formulas.
- Return pure JSON only.`;

    const retryResponse = await aiCall(prompts.system, retryPrompt, visionImages);
    generatedData = parseJsonResponse<GeneratedSlideData>(retryResponse);

    if (!generatedData?.elements || !Array.isArray(generatedData.elements)) {
      log.error(`Failed to parse AI slide response for: ${outline.title}`);
      return null;
    }
  }

  let polishedElements = finalizeSlideElements(
    generatedData,
    outline,
    assignedImages,
    imageMapping,
    generatedMediaMapping,
  );
  let blockingIssues = uniqueIssueDetails([
    ...getRawDesignBlockingLayoutIssueDetails(generatedData.elements),
    ...getBlockingLayoutIssueDetails(polishedElements),
  ]);

  if (blockingIssues.length > 0) {
    log.warn(
      `OpenMAIC slide QA found ${blockingIssues.length} blocking layout issue(s) for "${outline.title}"; retrying page design.`,
    );
    const retryPrompt = `${prompts.user}

## OPENMAIC QA LAYOUT RETRY

Your previous slide JSON rendered with blocking layout problems. Regenerate the full slide as pure JSON.

Blocking issues:
${blockingIssues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

Previous slide JSON:
${JSON.stringify(generatedData).slice(0, 12000)}

Hard layout rules for the retry:
- All visible slide text must follow this language directive: ${effectiveLanguageDirective}
- If you create 2-4 card backgrounds in a row, each card's icon/title/body/formula must be inside that same card's left/top/width/height.
- Do not reuse the same left/top coordinates for different card labels.
- Keep formulas in a latex element with enough height; simple formulas need at least 64px height.
- Do not allow readable text or latex boxes to overlap.
- Keep all readable content inside the safe area: left >= 48, right <= 952, top >= 48, bottom <= 514.5.
- Return the same top-level schema: { "background": ..., "elements": [...], "remark": "..." }.
- Return pure JSON only.`;

    const retryResponse = await aiCall(prompts.system, retryPrompt, visionImages);
    const retryData = parseJsonResponse<GeneratedSlideData>(retryResponse);

    if (retryData?.elements && Array.isArray(retryData.elements)) {
      const retryElements = finalizeSlideElements(
        retryData,
        outline,
        assignedImages,
        imageMapping,
        generatedMediaMapping,
      );
      const retryIssues = uniqueIssueDetails([
        ...getRawDesignBlockingLayoutIssueDetails(retryData.elements),
        ...getBlockingLayoutIssueDetails(retryElements),
      ]);
      if (retryIssues.length <= blockingIssues.length) {
        generatedData = retryData;
        polishedElements = retryElements;
        blockingIssues = retryIssues;
      }
    } else {
      log.warn(`OpenMAIC slide QA retry for "${outline.title}" did not return valid elements.`);
    }
  }

  let slideContent: GeneratedSlideContent = {
    elements: polishedElements,
    background: toSlideBackground(generatedData.background),
    remark: generatedData.remark || outline.description,
  };
  let slideQa = auditGeneratedSlideContent(slideContent);

  if (!slideQa.pass) {
    const blockingQaIssues = slideQa.issues.filter((issue) => issue.severity === 'blocking');
    log.warn(
      `OpenMAIC slide QA found ${blockingQaIssues.length} blocking content issue(s) for "${outline.title}"; retrying content design.`,
    );
    const retryPrompt = `${prompts.user}

## OPENMAIC QA CONTENT RETRY

Your previous slide JSON failed the classroom quality gate. Regenerate the full slide as pure JSON.

Blocking issues:
${blockingQaIssues
  .map((issue, index) => {
    const element = issue.elementId ? ` element=${issue.elementId}` : '';
    return `${index + 1}. ${issue.type}${element}: ${issue.detail}`;
  })
  .join('\n')}

Previous slide JSON:
${JSON.stringify(generatedData).slice(0, 12000)}

Hard content rules for the retry:
- All visible slide text must be Simplified Chinese. Keep English technical tokens only inside Chinese explanations.
- Replace generic labels such as "要点一", "要点二", "Step 1", or "Advanced Features" with concrete Chinese teaching headings.
- Do not make a thin page. Excluding the title/subtitle, provide at least 4 concrete teaching units.
- If the topic is programming or Redis, use a command sequence, scenario explanation, caution point, and summary.
- Include a semantic visual anchor when content is short: table, flow, command diagram, formula, or code block.
- Keep all readable content inside the safe area: left >= 48, right <= 952, top >= 48, bottom <= 514.5.
- Return the same top-level schema: { "background": ..., "elements": [...], "remark": "..." }.
- Return pure JSON only.`;

    const retryResponse = await aiCall(prompts.system, retryPrompt, visionImages);
    const retryData = parseJsonResponse<GeneratedSlideData>(retryResponse);

    if (retryData?.elements && Array.isArray(retryData.elements)) {
      const retryElements = finalizeSlideElements(
        retryData,
        outline,
        assignedImages,
        imageMapping,
        generatedMediaMapping,
        { polish: false },
      );
      const retrySlideContent: GeneratedSlideContent = {
        elements: retryElements,
        background: toSlideBackground(retryData.background),
        remark: retryData.remark || outline.description,
      };
      const retryQa = auditGeneratedSlideContent(retrySlideContent);
      if (retryQa.blockingIssueCount <= slideQa.blockingIssueCount) {
        generatedData = retryData;
        slideContent = retrySlideContent;
        slideQa = retryQa;
      }
    } else {
      log.warn(
        `OpenMAIC slide content QA retry for "${outline.title}" did not return valid elements.`,
      );
    }
  }

  return {
    ...slideContent,
    qa: slideQa,
  };
}
