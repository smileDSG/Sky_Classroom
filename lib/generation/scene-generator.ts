/**
 * Stage 2: Scene content and action generation.
 *
 * Generates full scenes (slide/quiz/interactive/pbl with actions)
 * from scene outlines. Dispatches to scene-content/ and scene-actions/ modules.
 */

import { nanoid } from 'nanoid';
import pMap from 'p-map';
import type {
  SceneOutline,
  GeneratedSlideContent,
  GeneratedQuizContent,
  GeneratedInteractiveContent,
  GeneratedPBLContent,
  PdfImage,
  ImageMapping,
} from '@/lib/types/generation';
import type { LanguageModel } from 'ai';
import type { StageStore } from '@/lib/api/stage-api';
import { createStageAPI } from '@/lib/api/stage-api';
import type { Slide, SlideTheme } from '@/lib/types/slides';
import type { Action } from '@/lib/types/action';
import type {
  AgentInfo,
  SceneGenerationContext,
  AICallFn,
  GenerationResult,
  GenerationCallbacks,
} from './pipeline-types';
import type { ThinkingConfig } from '@/lib/types/provider';
import { GENERATION_CONCURRENCY } from '@/lib/constants/generation';
import { generationCache } from './cache';
import { scoreContent, isAcceptable } from './quality-scorer';
import { createLogger } from '@/lib/logger';
import { selectThemeForOutline, selectThemeForTemplate, type ClassroomThemeSelection } from './classroom-design-dna';
import {
  layoutContentWithTemplate,
  selectTemplateForOutline,
} from './classroom-template-layout-agent';

// Content generators
import { generateSlideContent } from './scene-content/slide-generator';
import { generateQuizContent } from './scene-content/quiz-generator';
import {
  generateWidgetContent,
  convertInteractiveConfigToWidget,
} from './scene-content/interactive-generator';
import { generatePBLSceneContent } from './scene-content/pbl-generator';

// Action generators
import { generateSlideActions } from './scene-actions/slide-actions';
import { generateQuizActions } from './scene-actions/quiz-actions';
import {
  generateInteractiveActions,
  generatePBLActions,
} from './scene-actions/interactive-actions';

// Shared action processing
import { processActions } from './scene-actions/_shared';

const log = createLogger('Generation');

// ── Options interfaces ──

export interface SceneContentOptions {
  assignedImages?: PdfImage[];
  imageMapping?: ImageMapping;
  languageModel?: LanguageModel;
  visionEnabled?: boolean;
  generatedMediaMapping?: ImageMapping;
  agents?: AgentInfo[];
  languageDirective?: string;
  thinkingConfig?: ThinkingConfig;
  themeSelection?: ClassroomThemeSelection;
  courseTemplate?: string;
}

export interface SceneActionsOptions {
  ctx?: SceneGenerationContext;
  agents?: AgentInfo[];
  userProfile?: string;
  languageDirective?: string;
}

// Re-export processActions for the action modules
export { processActions };

// ==================== Stage 2: Full Scenes (Two-Step) ====================

export async function generateFullScenes(
  sceneOutlines: SceneOutline[],
  store: StageStore,
  aiCall: AICallFn,
  callbacks?: GenerationCallbacks,
  languageDirective?: string,
  courseTemplate?: string,
): Promise<GenerationResult<string[]>> {
  const api = createStageAPI(store);
  const totalScenes = sceneOutlines.length;
  let completedCount = 0;

  callbacks?.onProgress?.({
    currentStage: 3,
    overallProgress: 66,
    stageProgress: 0,
    statusMessage: `Generating ${totalScenes} scenes in parallel...`,
    scenesGenerated: 0,
    totalScenes,
  });

  const results = await pMap(
    sceneOutlines,
    async (outline, index) => {
      try {
        const sceneId = await generateSingleScene(outline, api, aiCall, languageDirective, courseTemplate);

        completedCount++;
        callbacks?.onProgress?.({
          currentStage: 3,
          overallProgress: 66 + Math.floor((completedCount / totalScenes) * 34),
          stageProgress: Math.floor((completedCount / totalScenes) * 100),
          statusMessage: `Completed ${completedCount}/${totalScenes} scenes`,
          scenesGenerated: completedCount,
          totalScenes,
        });

        return { success: true, sceneId, index };
      } catch (error) {
        completedCount++;
        callbacks?.onError?.(`Failed to generate scene ${outline.title}: ${error}`);
        return { success: false, sceneId: null, index };
      }
    },
    { concurrency: GENERATION_CONCURRENCY },
  );

  const sceneIds = results
    .filter(
      (r): r is { success: true; sceneId: string; index: number } =>
        r.success && r.sceneId !== null,
    )
    .sort((a, b) => a.index - b.index)
    .map((r) => r.sceneId);

  return { success: true, data: sceneIds };
}

export async function generateSingleScene(
  outline: SceneOutline,
  api: ReturnType<typeof createStageAPI>,
  aiCall: AICallFn,
  languageDirective?: string,
  courseTemplate?: string,
): Promise<string | null> {
  const cacheKey = generationCache.buildKey(outline, { languageDirective });

  let content:
    | GeneratedSlideContent
    | GeneratedQuizContent
    | GeneratedInteractiveContent
    | GeneratedPBLContent
    | null = generationCache.get(`${cacheKey}:content`) ?? null;
  let actions: Action[] | null = generationCache.get<Action[]>(`${cacheKey}:actions`) ?? null;

  if (content && actions) {
    log.info(`Cache hit for: ${outline.title}`);
    return createSceneWithActions(outline, content, actions, api);
  }

  log.info(`Step 3.1: Generating content for: ${outline.title}`);
  content = await generateSceneContent(outline, aiCall, { languageDirective, courseTemplate });
  if (!content) {
    log.error(`Failed to generate content for: ${outline.title}`);
    return null;
  }

  // Log content generation result
  if ('templateData' in content) {
    log.info(`[SingleScene] Content generated for "${outline.title}": hasTemplateData=${!!content.templateData}, legacyElements=${content.elements.length}`);
  } else {
    log.info(`[SingleScene] Content generated for "${outline.title}": type=${outline.type}, no templateData field`);
  }

  generationCache.set(`${cacheKey}:content`, content);

  // Quality scoring
  const score = scoreContent({
    type: outline.type as 'slide' | 'quiz' | 'interactive' | 'pbl',
    content,
  } as Parameters<typeof scoreContent>[0]);
  if (!isAcceptable(score)) {
    log.warn(
      `Low quality score for "${outline.title}": overall=${score.overall.toFixed(2)} issues=${score.issues.join('; ')}`,
    );
  } else {
    log.info(`Quality score for "${outline.title}": overall=${score.overall.toFixed(2)}`);
  }

  log.info(`Step 3.2: Generating actions for: ${outline.title}`);
  actions = await generateSceneActions(outline, content, aiCall, { languageDirective });
  log.info(`Generated ${actions.length} actions for: ${outline.title}`);
  generationCache.set(`${cacheKey}:actions`, actions);

  return createSceneWithActions(outline, content, actions, api);
}

// ==================== Content Dispatcher ====================

export async function generateSceneContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  options: SceneContentOptions = {},
): Promise<
  | GeneratedSlideContent
  | GeneratedQuizContent
  | GeneratedInteractiveContent
  | GeneratedPBLContent
  | null
> {
  const {
    assignedImages,
    imageMapping,
    languageModel,
    visionEnabled,
    generatedMediaMapping,
    agents,
    languageDirective,
    thinkingConfig,
    themeSelection,
    courseTemplate,
  } = options;

  log.info(`[SceneContent] Generating content for "${outline.title}" (type=${outline.type}, order=${outline.order})`);

  // Unified path for interactive scenes (both normal and ultra mode)
  if (outline.type === 'interactive') {
    if (!outline.widgetType && outline.interactiveConfig) {
      log.info(`Converting legacy interactiveConfig for: ${outline.title}`);
      outline = convertInteractiveConfigToWidget(outline);
    }

    if (!outline.widgetType) {
      log.warn(
        `Interactive outline "${outline.title}" has no widgetType, falling back to simulation`,
      );
      outline = {
        ...outline,
        widgetType: 'simulation' as import('@/lib/types/widgets').WidgetType,
        widgetOutline: { concept: outline.title },
      };
    }

    return generateWidgetContent(outline, aiCall, languageDirective);
  }

  // Cover slide: template-driven (order === 1 is the cover)
  if (outline.type === 'slide' && outline.order === 1) {
    const selectedTemplate = courseTemplate || selectTemplateForOutline(outline.title);
    log.info(`[SceneGen] Cover template: ${selectedTemplate} (courseTemplate=${courseTemplate || 'none'}) for "${outline.title}"`);

    const coverContent = {
      type: 'cover' as const,
      title: outline.title,
      subtitle: outline.description || '',
      instructor: '讲师：星穹课堂',
      date: `${new Date().getFullYear()}年${new Date().getMonth() + 1}月${new Date().getDate()}日`,
    };

    const templateData = await layoutContentWithTemplate(coverContent as unknown as import('./classroom-content-agent').StructuredContent, selectedTemplate);
    log.info(`[SceneGen] Cover template loaded: ${templateData.templateName}/${templateData.pageName}`);

    return {
      elements: [],
      background: undefined,
      remark: outline.description,
      templateData,
    };
  }

  switch (outline.type) {
    case 'slide':
      return generateSlideContent(
        outline,
        aiCall,
        assignedImages,
        imageMapping,
        visionEnabled,
        generatedMediaMapping,
        agents,
        languageDirective,
        themeSelection,
        courseTemplate,
      );
    case 'quiz':
      return generateQuizContent(outline, aiCall, languageDirective);
    case 'pbl':
      return generatePBLSceneContent(outline, languageModel, languageDirective, thinkingConfig);
    default:
      return null;
  }
}

// ==================== Action Dispatcher ====================

/**
 * Step 3.2: Generate Actions based on content and script
 */
export async function generateSceneActions(
  outline: SceneOutline,
  content:
    | GeneratedSlideContent
    | GeneratedQuizContent
    | GeneratedInteractiveContent
    | GeneratedPBLContent,
  aiCall: AICallFn,
  options: SceneActionsOptions = {},
): Promise<Action[]> {
  const { ctx, agents, userProfile, languageDirective } = options;

  // Debug: Log content type and teacherActions presence for interactive scenes
  if (outline.type === 'interactive') {
    const hasHtml = 'html' in content;
    const teacherActionsCount = hasHtml ? content.teacherActions?.length || 0 : 0;
    log.info(
      `[Actions Gen] Interactive "${outline.title}": hasHtml=${hasHtml}, teacherActions=${teacherActionsCount}, widgetType=${hasHtml ? content.widgetType : 'N/A'}`,
    );
  }

  if (outline.type === 'slide' && 'elements' in content) {
    return generateSlideActions(outline, content, aiCall, {
      ctx,
      agents,
      userProfile,
      languageDirective,
    });
  }

  if (outline.type === 'quiz' && 'questions' in content) {
    return generateQuizActions(outline, content, aiCall, { ctx, agents, languageDirective });
  }

  if (outline.type === 'interactive' && 'html' in content) {
    return generateInteractiveActions(outline, content, aiCall, { ctx, agents, languageDirective });
  }

  if (outline.type === 'pbl' && 'projectConfig' in content) {
    return generatePBLActions(outline, content, aiCall, { ctx, agents, languageDirective });
  }

  return [];
}

// ==================== Scene Creation ====================

export function createSceneWithActions(
  outline: SceneOutline,
  content:
    | GeneratedSlideContent
    | GeneratedQuizContent
    | GeneratedInteractiveContent
    | GeneratedPBLContent,
  actions: Action[],
  api: ReturnType<typeof createStageAPI>,
  themeSelection?: import('./classroom-design-dna').ClassroomThemeSelection,
): string | null {
  if (outline.type === 'slide' && 'elements' in content) {
    const slideContent = content as GeneratedSlideContent;
    const theme = themeSelection ?? (
      slideContent.templateData
        ? selectThemeForTemplate(slideContent.templateData.templateName)
        : selectThemeForOutline(outline)
    );
    const palette = theme.palette;
    const slideTheme: SlideTheme = {
      backgroundColor: `#${palette.contentBg}`,
      themeColors: [
        `#${palette.accent}`,
        `#${palette.accentSecondary}`,
        `#${palette.accentLight}`,
        `#${palette.textPrimary}`,
        `#${palette.textMuted}`,
      ],
      fontColor: `#${palette.textPrimary}`,
      fontName: theme.fonts.heading,
      outline: { color: `#${palette.accentSecondary}`, width: 2, style: 'solid' },
      shadow: { h: 0, v: 0, blur: 10, color: '#000000' },
    };
    const hasTemplateData = !!slideContent.templateData;
    log.info(`[SceneCreate] Creating slide for "${outline.title}": hasTemplateData=${hasTemplateData}, legacyElements=${slideContent.elements.length}`);

    if (hasTemplateData) {
      log.info(`[SceneCreate] Template data: ${slideContent.templateData!.templateName}/${slideContent.templateData!.pageName}, ${slideContent.templateData!.page.elements.length} elements`);
    }

    const slide: Slide = {
      id: nanoid(),
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: slideTheme,
      elements: slideContent.elements,
      background: slideContent.background,
      templateData: slideContent.templateData,
      layoutVersion: slideContent.templateData ? 2 : 1,
    };

    log.info(`[SceneCreate] Slide created: id=${slide.id}, layoutVersion=${slide.layoutVersion}, templateData=${!!slide.templateData}`);

    const sceneResult = api.scene.create({
      type: 'slide',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'slide',
        canvas: slide,
      },
      actions,
    });

    if (!sceneResult.success) {
      log.error(`[SceneCreate] Failed to create scene for "${outline.title}": ${sceneResult.error}`);
    } else {
      log.info(`[SceneCreate] Scene created successfully for "${outline.title}": sceneId=${sceneResult.data}`);
    }

    return sceneResult.success ? (sceneResult.data ?? null) : null;
  }

  if (outline.type === 'quiz' && 'questions' in content) {
    const sceneResult = api.scene.create({
      type: 'quiz',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'quiz',
        questions: content.questions,
        knowledgePoints: content.knowledgePoints,
      },
      actions,
    });

    return sceneResult.success ? (sceneResult.data ?? null) : null;
  }

  if (outline.type === 'interactive' && 'html' in content) {
    const sceneResult = api.scene.create({
      type: 'interactive',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'interactive',
        url: '',
        html: content.html,
        widgetType: content.widgetType,
        widgetConfig: content.widgetConfig,
        teacherActions: content.teacherActions,
      },
      actions,
    });

    return sceneResult.success ? (sceneResult.data ?? null) : null;
  }

  if (outline.type === 'pbl' && 'projectConfig' in content) {
    const sceneResult = api.scene.create({
      type: 'pbl',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'pbl',
        projectConfig: content.projectConfig,
      },
      actions,
    });

    return sceneResult.success ? (sceneResult.data ?? null) : null;
  }

  return null;
}
