/**
 * Prompt System — unified public API
 *
 * Exports both the legacy template API (PROMPT_IDS, buildPrompt, loadPrompt)
 * and the new modular composability API (PromptComposer, VersionManager).
 * The two APIs coexist during the phased migration; consumers can adopt
 * the new API incrementally.
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

import type { PromptId } from './types';
export type {
  // Legacy
  PromptId,
  SnippetId,
  LoadedPrompt,
  // New modular system
  PromptFragment,
  PromptFragmentCategory,
  ComposeOptions,
  ComposeResult,
  ComposeMeta,
  IPromptComposer,
  PromptVersion,
  PromptVersionMeta,
  ABTestConfig,
  ABTestMetrics,
  IVersionManager,
} from './types';

// ═══════════════════════════════════════════════════════════════
// Legacy API (backward-compatible)
// ═══════════════════════════════════════════════════════════════

export {
  loadPrompt,
  loadSnippet,
  buildPrompt,
  interpolateVariables,
  processSnippets,
  processConditionalBlocks,
  enableCache,
  disableCache,
  clearCache,
  getCacheStats,
  startFileWatcher,
  stopFileWatcher,
} from './loader';

// ═══════════════════════════════════════════════════════════════
// New Modular API
// ═══════════════════════════════════════════════════════════════

export {
  PromptComposer,
  getPromptComposer,
  resetPromptComposer,
} from './composability';

export {
  VersionManager,
  getVersionManager,
  resetVersionManager,
} from './version-manager';

// ═══════════════════════════════════════════════════════════════
// Prompt ID Constants (legacy — will be replaced by fragment IDs)
// ═══════════════════════════════════════════════════════════════

export const PROMPT_IDS = {
  // Legacy templates
  REQUIREMENTS_TO_OUTLINES: 'requirements-to-outlines',
  INTERACTIVE_OUTLINES: 'interactive-outlines',
  WEB_SEARCH_QUERY_REWRITE: 'web-search-query-rewrite',
  SLIDE_CONTENT: 'slide-content',
  QUIZ_CONTENT: 'quiz-content',
  SLIDE_ACTIONS: 'slide-actions',
  QUIZ_ACTIONS: 'quiz-actions',
  INTERACTIVE_ACTIONS: 'interactive-actions',
  SIMULATION_CONTENT: 'simulation-content',
  DIAGRAM_CONTENT: 'diagram-content',
  CODE_CONTENT: 'code-content',
  GAME_CONTENT: 'game-content',
  VISUALIZATION3D_CONTENT: 'visualization3d-content',
  WIDGET_TEACHER_ACTIONS: 'widget-teacher-actions',
  PBL_ACTIONS: 'pbl-actions',
  AGENT_SYSTEM: 'agent-system',
  AGENT_SYSTEM_WB_TEACHER: 'agent-system-wb-teacher',
  AGENT_SYSTEM_WB_ASSISTANT: 'agent-system-wb-assistant',
  AGENT_SYSTEM_WB_STUDENT: 'agent-system-wb-student',
  DIRECTOR: 'director',
  PBL_DESIGN: 'pbl-design',
  // New modular generators (Phase 3+)
  OUTLINE: 'generators/outline',
  INTERACTIVE_OUTLINES_V2: 'generators/interactive-outlines',
  SLIDE_CONTENT_V2: 'generators/slide-content',
  SLIDE_ACTIONS_V2: 'generators/slide-actions',
  QUIZ: 'generators/quiz',
  QUIZ_ACTIONS_V2: 'generators/quiz-actions',
  WIDGET_TEACHER_ACTIONS_V2: 'generators/widget-teacher-actions',
  INTERACTIVE_ACTIONS_V2: 'generators/interactive-actions',
  PBL_DESIGN_V2: 'generators/pbl-design',
  PBL_ACTIONS_V2: 'generators/pbl-actions',
  WEB_SEARCH_QUERY_REWRITE_V2: 'generators/web-search-query-rewrite',
  AGENT_PROFILES: 'generators/agent-profiles',
  // New modular generators — Ultra Mode widgets (Phase 4+)
  SIMULATION_CONTENT_V2: 'generators/simulation-content',
  DIAGRAM_CONTENT_V2: 'generators/diagram-content',
  CODE_CONTENT_V2: 'generators/code-content',
  GAME_CONTENT_V2: 'generators/game-content',
  VISUALIZATION3D_CONTENT_V2: 'generators/visualization3d-content',
} as const satisfies Record<string, PromptId>;
