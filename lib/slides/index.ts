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
} from './types';

export { generateSlides } from './slide-generator';

export { AVATAR_CONFIGS, getAvatarById } from './avatar-config';
export {
  generateAvatarSpeech,
  extractTextFromSlides,
  extractTextFromSlideElements,
  splitSentences,
  estimateAudioDuration,
} from './avatar-speech';
export type { TTSGenerateFn, TTSGenResult, AvatarSpeechOptions } from './avatar-speech';
