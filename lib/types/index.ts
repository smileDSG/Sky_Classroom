/**
 * OpenMAIC Type Definitions — Barrel Export
 *
 * All type modules are re-exported here. Import from `@/lib/types` to
 * access the entire type surface, or import specific sub-paths for
 * tree-shaking (e.g. `@/lib/types/provider`).
 */

// ── Core types ──
export type {
  BuiltInProviderId,
  ProviderId,
  ProviderType,
  ThinkingControlType,
  ThinkingMode,
  ThinkingEffort,
  ThinkingLevel,
  ThinkingRequestAdapter,
  ThinkingCapability,
  ThinkingConfig,
  ModelInfo,
  ProviderConfig,
  ModelConfig,
} from './provider';

export type {
  SceneType,
  StageMode,
  Whiteboard,
  VideoManifestEntry,
  VideoManifest,
  Stage,
  Scene,
  SceneContent,
  SlideContent,
  QuizContent,
  QuizOption,
  QuizQuestion,
  InteractiveContent,
  PBLContent,
} from './stage';

export type {
  ActionBase,
  SpotlightAction,
  LaserAction,
  SpeechAction,
  WbOpenAction,
  WbDrawTextAction,
  WbDrawShapeAction,
  WbDrawChartAction,
  WbDrawLatexAction,
  WbDrawTableAction,
  WbDrawLineAction,
  WbClearAction,
  WbDeleteAction,
  WbCloseAction,
  WbDrawCodeAction,
  WbEditCodeAction,
  PlayVideoAction,
  DiscussionAction,
  WidgetHighlightAction,
  WidgetSetStateAction,
  WidgetAnnotationAction,
  WidgetRevealAction,
  Action,
  ActionType,
  PercentageGeometry,
} from './action';

export { FIRE_AND_FORGET_ACTIONS, SLIDE_ONLY_ACTIONS, SYNC_ACTIONS } from './action';

export type {
  ChatMessageMetadata,
  MessageAction,
  ChatSession,
  SessionConfig,
  ToolCallRequest,
  ToolCallRecord,
  SessionEvent,
  SessionSummary,
  CreateSessionRequest,
  SendMessageRequest,
  ToolResultsRequest,
  SessionListItem,
  LectureNoteItem,
  LectureNoteEntry,
  DirectorState,
  StatelessChatRequest,
  ParsedAction,
  ParsedToolCall,
  StatelessEvent,
} from './chat';

export { toSessionListItem } from './chat';

export type {
  PdfImage,
  ImageMapping,
  UploadedDocument,
  UserRequirements,
  WidgetOutline,
  SceneOutline,
  GeneratedSlideContent,
  GeneratedQuizContent,
  GeneratedPBLContent,
  ScientificModel,
  GeneratedInteractiveContent,
  SuggestedSlideElement,
  SuggestedQuizQuestion,
  SuggestedAction,
  GenerationProgress,
  GenerationSession,
} from './generation';

// ── Auxiliary type modules ──
export type { Slide, PPTElement, SlideBackground } from './slides';
export type { WidgetType, WidgetConfig, TeacherAction } from './widgets';
export type {
  ElementOrderCommands,
  ElementAlignCommands,
  OperateBorderLines,
  OperateResizeHandlers,
  OperateLineHandlers,
  AlignmentLineAxis,
  AlignmentLineProps,
  MultiSelectRange,
  ImageClipedEmitData,
  CreateElementSelectionData,
  CreateCustomShapeData,
  CreatingTextElement,
  CreatingShapeElement,
  CreatingLineElement,
  CreatingElement,
  TextFormatPainterKeys,
  TextFormatPainter,
  ShapeFormatPainter,
} from './edit';
export type { DialogForExportTypes } from './export';
export type { ParsedPdfContent, ParsePdfRequest, ParsePdfResponse } from './pdf';
export type { SettingsSection, ProviderSettings, ProvidersConfig, EditingModel } from './settings';
export type {
  ParticipantRole,
  Participant,
  MessageAction as RoundtableMessageAction,
  Message as RoundtableMessage,
} from './roundtable';
export type { WebSearchSource, WebSearchResult } from './web-search';

// ── Provider registry (runtime) ──
export {
  registerProvider,
  unregisterProvider,
  getProviderConfig,
  isProviderRegistered,
  listRegisteredProviderIds,
  listRegisteredProviders,
  listProvidersByType,
  registerProviders,
  clearProviderRegistry,
} from './provider-registry';

// ── Zod schemas for API input validation ──
export {
  ProviderIdSchema,
  ThinkingConfigSchema,
  ModelConfigSchema,
  SessionTypeSchema,
  SessionStatusSchema,
  MessageActionSchema,
  CreateSessionRequestSchema,
  SendMessageRequestSchema,
  UploadedDocumentSchema,
  UserRequirementsSchema,
  WidgetOutlineSchema,
  SceneOutlineSchema,
  StageSchema,
  SceneSchema,
  validateInput,
  tryValidateInput,
} from './schemas/api-inputs';

// ── AI provider infrastructure ──
export {
  buildThinkingBodyParams,
  getThinkingStrategy,
  type ThinkingStrategy,
  SimpleToggleStrategy,
  DeepSeekStrategy,
  QwenStrategy,
  SiliconFlowStrategy,
  DoubaoStrategy,
  OpenRouterStrategy,
  HunyuanStrategy,
  LemonadeStrategy,
} from '@/lib/ai/strategies/thinking-strategy';

export { normalizeMiniMaxBaseUrl } from '@/lib/ai/adapters/minimax-adapter';

export { createProxyFetch, resetProxyCache } from '@/lib/ai/adapters/google-adapter';

export {
  checkProviderHealth,
  checkAllProvidersHealth,
  summarizeHealth,
  type ProviderHealthResult,
  type HealthReport,
} from '@/lib/ai/health';

export {
  registerFailover,
  unregisterFailover,
  getFailoverTarget,
  getFailoverConfig,
  recordFailure,
  recordSuccess,
  resetFailoverState,
  clearFailoverState,
  getFailoverStats,
  type FailoverTarget,
} from '@/lib/ai/failover';

export {
  estimateCost,
  recordUsage,
  getCostStats,
  clearUsageHistory,
  getEntryCount,
  type TokenUsage,
  type CostEntry,
  type CostStats,
} from '@/lib/ai/cost-tracker';

// ── Stage / Scene serialization ──
export {
  serializeStage,
  deserializeStage,
  serializeScene,
  deserializeScene,
  serializeScenes,
  deserializeScenes,
  type SerializableStage,
  type SerializableScene,
} from './stage-serialization';
