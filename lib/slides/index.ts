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
  PptxThemeId,
} from './types';

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

export {
  getPptxTheme,
  getTheme,
} from './pptx-themes';
export type { PptxTheme } from './pptx-themes';
