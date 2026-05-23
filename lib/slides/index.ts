/**
 * Sky Classroom slides module — barrel export.
 */

export type {
  AvatarConfig,
  AvatarVoiceConfig,
  AvatarSpeech,
  SlideGenerationOptions,
  SlideGenerationResult,
  CourseExportConfig,
  CourseExportResult,
  ThemeToken,
  ThemeGradient,
  DecorationDef,
  PptxThemeId,
  TemplateParamsV2,
  TemplateDescriptorV2,
  TemplateSlotV2,
  TemplateIdV2,
  CoverTemplateIdV2,
  ContentTemplateIdV2,
  EndTemplateIdV2,
} from './types';

export { generateSlides } from './slide-generator';

export {
  LAYOUTS,
  getSlideLayout,
  getAllLayoutTypes,
  isValidLayoutType,
  getLayoutAIPromptHint,
} from './layouts';
export type { SlideLayoutType, SlideLayout } from './layouts';

export { AVATAR_CONFIGS, getAvatarById } from './avatar-config';
export { AVATAR_PRESETS, getAvatarPresetById } from './avatar-presets';
export type { AvatarPreset } from './avatar-presets';
export {
  generateAvatarSpeech,
  extractTextFromSlides,
  extractTextFromSlideElements,
  splitSentences,
  estimateAudioDuration,
  buildSlideScript,
  buildFullScript,
} from './avatar-speech';
export type { TTSGenerateFn, TTSGenResult, AvatarSpeechOptions } from './avatar-speech';
export type { SpeechSegment, SlideScript } from './speech-script';

export { exportPptx } from './pptx-exporter';
export type { PptxExportOptions, PptxExportResult } from './pptx-exporter';

// ── Legacy template system (backward compatible) ───────────────────

export {
  assembleSlides,
  getTemplate,
  getTemplateDescriptor,
  getTemplatesByCategory,
  getAllTemplateDescriptors,
  TEMPLATE_REGISTRY,
} from './slide-templates';
export type {
  TemplateId,
  TemplateParams,
  TemplateSlot,
  TemplateDescriptor,
  CoverTemplateId,
  ContentTemplateId,
  EndTemplateId,
} from './slide-templates';

// ── v2 Theme + Template system (new) ───────────────────────────────

export {
  SKY_BLUE_THEME,
  MINIMAL_THEME,
  ACADEMIC_THEME,
  TECH_DARK_THEME,
  NATURE_FRESH_THEME,
  ALL_THEMES,
  THEME_MAP,
  getThemeById,
  getAllThemeIds,
  getAllThemes,
} from './themes';

export {
  getPptxTheme,
  getTheme,
} from './pptx-themes';
export type { PptxTheme } from './pptx-themes';

export {
  generateCoverDecorations,
  generateBulletElements,
  generateStepBadges,
  generateCardBackgrounds,
  generateDivider,
  generateQuoteDecoration,
  generateTableCells,
  buildGradientBackground,
} from './template-decorators';

export {
  TEMPLATE_REGISTRY_V2,
  getTemplateV2,
  getTemplateDescriptorV2,
  getTemplatesByCategoryV2,
  getAllTemplateDescriptorsV2,
  assembleSlidesV2,
} from './slide-templates-v2';

// Re-export specific templates for direct use
export {
  coverClassic,
  coverModern,
  coverBold,
  coverFullImage,
  coverGradient,
  contentTitleBody,
  contentTwoCol,
  contentBullets,
  contentFormula,
  contentSteps,
  contentQuote,
  contentGrid2x2,
  contentImage,
  contentTable,
  contentFullImage,
  contentTimeline,
  contentProsCons,
  contentCode,
  contentBigIdea,
  contentStats,
  contentHighlight,
  contentDiagram,
  contentInfographic3,
  contentProcessH,
  contentPyramid,
  contentVenn,
  contentSplitHighlight,
  endSummary,
  endThanks,
  endQA,
} from './slide-templates-v2';
