/**
 * Prompt System Type Definitions
 *
 * Unified type system for the new modular prompt architecture.
 * Maintains backward compatibility with legacy PromptId / SnippetId unions.
 */

// ==================== Fragment System ====================

/** Category of a prompt fragment — determines the composability layer */
export type PromptFragmentCategory =
  | 'core'        // Base framework (agent-base, director-base, output-format)
  | 'role'        // Teaching role definition (teacher, assistant)
  | 'persona'     // Student persona (curious, analytical, creative, note-taker)
  | 'generator'   // Content generator (outline, slide-content, quiz, etc.)
  | 'snippet'     // Reusable inline snippet
  | 'user';       // User-defined override (highest priority)

/** A single composable prompt fragment */
export interface PromptFragment {
  id: string;
  category: PromptFragmentCategory;
  content: string;
  priority: number;            // Higher = overrides lower when overlapping
  language?: string;           // ISO language code (en, zh, ja, ru)
  version?: string;            // Semantic version string
  metadata?: Record<string, unknown>;
}

/** Options for composing a full prompt from fragments */
export interface ComposeOptions {
  /** Fragment IDs to include, in composition order */
  fragments: string[];
  /** Runtime variables for interpolation */
  variables: Record<string, unknown>;
  /** Target language for i18n fragment selection */
  language?: string;
  /** Specific version to use (for A/B testing) */
  version?: string;
}

/** Result of a prompt composition */
export interface ComposeResult {
  system: string;
  user: string;
  meta: ComposeMeta;
}

export interface ComposeMeta {
  fragmentIds: string[];
  version?: string;
  language?: string;
  resolvedFragments: number;
  missingFragments: string[];
}

// ==================== Prompt Composer Interface ====================

export interface IPromptComposer {
  /** Register a fragment into the registry */
  register(fragment: PromptFragment): void;
  /** Remove a fragment by ID */
  unregister(fragmentId: string): void;
  /** Get all registered fragments (optionally filtered by category) */
  list(category?: PromptFragmentCategory): PromptFragment[];
  /** Compose fragments + variables into a complete prompt */
  compose(options: ComposeOptions): ComposeResult;
  /** Reload a fragment from its source file */
  reload(fragmentId: string): Promise<void>;
  /** Load a user override fragment from a custom path */
  loadUserOverride(fragmentId: string, filePath: string): Promise<void>;
}

// ==================== Version Management ====================

export interface PromptVersionMeta {
  author?: string;
  createdAt: string;   // ISO-8601
  description?: string;
  evaluation?: {
    score: number;
    sampleSize: number;
    evaluator?: string;
  };
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: string;     // semver
  content: string;
  metadata: PromptVersionMeta;
}

export interface ABTestConfig {
  id: string;
  promptId: string;
  variantA: string;    // version ID (control)
  variantB: string;    // version ID (experiment)
  trafficSplit: number; // 0–1, proportion routed to variant B
  startAt: string;     // ISO-8601
  enabled: boolean;
}

export interface ABTestMetrics {
  variantA: {
    calls: number;
    avgTokenUsage?: number;
    avgScore?: number;
  };
  variantB: {
    calls: number;
    avgTokenUsage?: number;
    avgScore?: number;
  };
}

export interface IVersionManager {
  /** Register a prompt version */
  registerVersion(version: PromptVersion): void;
  /** Get a specific version */
  getVersion(promptId: string, version: string): PromptVersion | null;
  /** List all versions for a prompt */
  listVersions(promptId: string): PromptVersion[];
  /** Resolve which version to use based on active A/B tests */
  resolveVersion(promptId: string, language?: string): string | null;
  /** Create an A/B test */
  createABTest(config: ABTestConfig): void;
  /** Get active A/B test for a prompt */
  getABTest(promptId: string): ABTestConfig | null;
  /** Record a metric event for an A/B test */
  recordMetric(abTestId: string, variant: 'A' | 'B', data: Record<string, unknown>): void;
  /** Get metrics for an A/B test */
  getMetrics(abTestId: string): ABTestMetrics | null;
}

// ==================== Legacy (backward-compatible) ====================

/**
 * Legacy prompt template identifier — kept for backward compatibility
 * during the phased migration from templates/ to the new structure.
 */
export type PromptId =
  // Generation pipeline (legacy)
  | 'requirements-to-outlines'
  | 'interactive-outlines'
  | 'web-search-query-rewrite'
  | 'slide-content'
  | 'quiz-content'
  | 'slide-actions'
  | 'quiz-actions'
  | 'interactive-actions'
  | 'simulation-content'
  | 'diagram-content'
  | 'code-content'
  | 'game-content'
  | 'visualization3d-content'
  | 'widget-teacher-actions'
  | 'pbl-actions'
  // Orchestration (legacy)
  | 'agent-system'
  | 'agent-system-wb-teacher'
  | 'agent-system-wb-assistant'
  | 'agent-system-wb-student'
  | 'director'
  | 'pbl-design'
  // New modular generators (Phase 3+)
  | 'generators/outline'
  | 'generators/interactive-outlines'
  | 'generators/slide-content'
  | 'generators/slide-actions'
  | 'generators/quiz'
  | 'generators/quiz-actions'
  | 'generators/widget-teacher-actions'
  | 'generators/interactive-actions'
  | 'generators/pbl-design'
  | 'generators/pbl-actions'
  | 'generators/web-search-query-rewrite'
  | 'generators/agent-profiles'
  // Ultra Mode widgets (Phase 4+)
  | 'generators/simulation-content'
  | 'generators/diagram-content'
  | 'generators/code-content'
  | 'generators/game-content'
  | 'generators/visualization3d-content';

/**
 * Legacy snippet identifier — kept for backward compatibility.
 */
export type SnippetId =
  | 'json-output-rules'
  | 'element-types'
  | 'action-types'
  | 'image-instructions'
  | 'video-instructions'
  | 'media-safety-guidelines'
  | 'slide-image-instructions'
  | 'slide-generated-image-instructions'
  | 'slide-video-instructions'
  | 'speech-guidelines'
  | 'whiteboard-reference';

/**
 * Legacy loaded prompt — kept for backward compatibility.
 */
export interface LoadedPrompt {
  id: PromptId;
  systemPrompt: string;
  userPromptTemplate: string;
}
