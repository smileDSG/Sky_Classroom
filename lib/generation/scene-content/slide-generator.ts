/**
 * Slide content generation.
 *
 * Two-stage pipeline:
 * 1. Content Agent (LLM) → StructuredContent JSON
 * 2. Layout Agent (Code) → Canvas PPTElement[] + background
 * 3. Post-processing → Media resolution, fallback, LaTeX fix
 */

import { nanoid } from 'nanoid';
import { MAX_VISION_IMAGES } from '@/lib/constants/generation';
import type {
  SceneOutline,
  PdfImage,
  ImageMapping,
  GeneratedSlideContent,
} from '@/lib/types/generation';
import type { PPTElement } from '@/lib/types/slides';
import type { AgentInfo, AICallFn } from '../pipeline-types';
import { formatImageDescription, formatImagePlaceholder } from '../prompt-formatters';
import { resolveImageIds } from '../media-resolver';
import { selectThemeForTemplate, type ClassroomThemeSelection } from '../classroom-design-dna';
import { generateStructuredContent } from '../classroom-content-agent';
import {
  layoutContentWithTemplate,
  selectTemplateForOutline,
} from '../classroom-template-layout-agent';
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
  themeSelection?: ClassroomThemeSelection,
  courseTemplate?: string,
): Promise<GeneratedSlideContent | null> {
  log.info(`[SlideGen] Starting slide generation for: "${outline.title}"`);

  // ── Unified theme selection: template drives everything ──
  const selectedTemplate = courseTemplate || selectTemplateForOutline(outline.title);
  const theme = themeSelection ?? selectThemeForTemplate(selectedTemplate);
  log.info(
    `[SlideGen] Theme selected: ${theme.paletteName} (${theme.styleName}) [template=${selectedTemplate}] for "${outline.title}"`,
  );

  // ── Phase 1: Content Generation (LLM) ──
  const assignedImagesText = buildAssignedImagesText(
    outline,
    assignedImages,
    imageMapping,
    visionEnabled,
  );
  const mediaElementEnabled =
    (assignedImages?.length ?? 0) > 0 || (outline.mediaGenerations?.length ?? 0) > 0;

  const contentResult = await generateStructuredContent({
    outline,
    aiCallFn: aiCall,
    subject: undefined,
    grade: undefined,
    languageDirective,
    assignedImages: assignedImagesText,
    mediaElementEnabled,
    teacherContext:
      agents && agents.length > 0 ? agents.map((a) => `${a.name} (${a.role})`).join(', ') : '',
    themePaletteName: theme.paletteName,
    mood: theme.mood,
    palette: theme.palette,
    fonts: theme.fonts,
  });

  if (!contentResult.success || !contentResult.data) {
    log.error(`[SlideGen] Content Agent failed for: ${outline.title} — ${contentResult.error}`);
    return null;
  }

  const structuredContent = contentResult.data;
  log.info(
    `[SlideGen] Content Agent produced type=${structuredContent.type} for: ${outline.title}`,
  );

  // ── Phase 2: Layout Generation (Template-Driven) ──
  const templateData = await layoutContentWithTemplate(structuredContent, selectedTemplate);
  log.info(
    `[SlideGen] Template layout ready: ${templateData.templateName}/${templateData.pageName} with ${templateData.page.elements.length} elements for "${outline.title}"`,
  );

  // ── Phase 3: Post-Processing ──
  // Legacy elements path kept for backward compatibility
  let elements: PPTElement[] = [];

  // If template data has image placeholders, resolve them
  if (imageMapping || generatedMediaMapping || outline.mediaGenerations) {
    // Build a minimal element list for media resolution tracking
    const mediaElements: PPTElement[] = [];
    for (const el of templateData.page.elements) {
      if (el.elementType === 'image' && el.src?.startsWith('placeholder:')) {
        mediaElements.push({
          type: 'image',
          id: el.elementId,
          left: el.bounds[0],
          top: el.bounds[1],
          width: el.bounds[2],
          height: el.bounds[3],
          src: el.src,
          fixedRatio: true,
          rotate: 0,
        } as PPTElement);
      }
    }

    if (mediaElements.length > 0) {
      log.info(
        `[SlideGen] Resolving ${mediaElements.length} media placeholders for "${outline.title}"`,
      );
      const resolved = resolveImageIds(
        mediaElements as unknown as GeneratedSlideData['elements'],
        imageMapping,
        generatedMediaMapping,
      ) as unknown as PPTElement[];

      // Update template data with resolved image URLs
      for (const resolvedEl of resolved) {
        const templateEl = templateData.page.elements.find((e) => e.elementId === resolvedEl.id);
        if (templateEl && resolvedEl.type === 'image') {
          templateEl.src = resolvedEl.src;
        }
      }
    }
  }

  log.info(
    `[SlideGen] Completed for "${outline.title}": templateData=${templateData.templateName}/${templateData.pageName}, elements=${elements.length}, hasBackground=${!!templateData.page.background}`,
  );

  return {
    elements,
    background: undefined,
    remark: outline.description,
    templateData,
  };
}

// ── Helper: Build assigned images text for prompt ───────────────────

function buildAssignedImagesText(
  outline: SceneOutline,
  assignedImages?: PdfImage[],
  imageMapping?: ImageMapping,
  visionEnabled?: boolean,
): string {
  let assignedImagesText = 'No images available. Do not insert any image elements.';

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
    } else {
      assignedImagesText = assignedImages.map((img) => formatImageDescription(img)).join('\n');
    }
  }

  // Append generated media descriptions
  const generatedImageEntries = outline.mediaGenerations?.filter((mg) => mg.type === 'image') ?? [];
  const generatedVideoEntries = outline.mediaGenerations?.filter((mg) => mg.type === 'video') ?? [];

  if (generatedImageEntries.length > 0 || generatedVideoEntries.length > 0) {
    const mediaParts: string[] = [];
    const genImgDescs = generatedImageEntries
      .map((mg) => `- ${mg.elementId}: "${mg.prompt}" (aspect ratio: ${mg.aspectRatio || '16:9'})`)
      .join('\n');
    const genVidDescs = generatedVideoEntries
      .map((mg) => `- ${mg.elementId}: "${mg.prompt}" (aspect ratio: ${mg.aspectRatio || '16:9'})`)
      .join('\n');

    if (genImgDescs) mediaParts.push(`AI-Generated Images:\n${genImgDescs}`);
    if (genVidDescs) mediaParts.push(`AI-Generated Videos:\n${genVidDescs}`);

    if (mediaParts.length > 0) {
      const mediaText = mediaParts.join('\n\n');
      if (assignedImagesText.includes('No images')) {
        assignedImagesText = mediaText;
      } else {
        assignedImagesText += `\n\n${mediaText}`;
      }
    }
  }

  return assignedImagesText;
}
