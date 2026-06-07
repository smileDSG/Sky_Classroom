/**
 * Two-Stage Generation Pipeline
 *
 * Barrel re-export — all symbols previously exported from this file
 * are now spread across focused sub-modules.
 */

// Types
export type {
  AgentInfo,
  SceneGenerationContext,
  GeneratedSlideData,
  GenerationResult,
  GenerationCallbacks,
  AICallFn,
} from './pipeline-types';

// Prompt formatters
export {
  buildCourseContext,
  formatAgentsForPrompt,
  formatTeacherPersonaForPrompt,
  formatImageDescription,
  formatImagePlaceholder,
  buildVisionUserContent,
  buildLanguageText,
} from './prompt-formatters';

// JSON repair
export {
  parseJsonResponse,
  tryParseJson,
  parseWithSchema,
  parseJsonResponseWithSchema,
  getDefaultPipeline,
  registerRepairStrategy,
  registerExtractionStrategy,
  unregisterStrategy,
  repairTelemetry,
  parseWithTelemetry,
} from './json-repair';
export type { TelemetrySnapshot, StrategyStats } from './json-repair';

// Outline generator (Stage 1)
export { generateSceneOutlinesFromRequirements, applyOutlineFallbacks } from './outline-generator';

// Scene generator (Stage 2)
export {
  generateFullScenes,
  generateSceneContent,
  generateSceneActions,
  createSceneWithActions,
} from './scene-generator';
export type { SceneContentOptions, SceneActionsOptions } from './scene-generator';

// Scene builder (standalone)
export {
  buildSceneFromOutline,
  buildCompleteScene,
  uniquifyMediaElementIds,
} from './scene-builder';

// Pipeline runner
export { createGenerationSession, runGenerationPipeline } from './pipeline-runner';

// Cache
export { GenerationCache, generationCache } from './cache';
export type { CacheStats } from './cache';

// Quality scorer
export {
  scoreContent,
  scoreSlideContent,
  scoreQuizContent,
  scoreInteractiveContent,
  scorePBLContent,
  isAcceptable,
} from './quality-scorer';
export type { QualityScore, QualityScorerOptions, ScorableContent } from './quality-scorer';

// Incremental generation
export {
  createSceneOutline,
  addSceneToSession,
  regenerateScene,
  removeSceneOutline,
  updateSceneOutline,
  reorderScenes,
} from './incremental';

// Element fixer
export { fixElementDefaults, processLatexElements } from './element-fixer';

// Media resolver
export {
  isImageIdReference,
  isGeneratedImageId,
  resolveImageIds,
  normalizeGeneratedVideoRefs,
} from './media-resolver';

// Re-export generateSingleScene for incremental use
export { generateSingleScene } from './scene-generator';
