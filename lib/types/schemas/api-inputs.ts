/**
 * Zod Schemas for API Input Validation
 *
 * Provides runtime validation for all API-facing inputs,
 * replacing manual type assertions.
 */

import { z } from 'zod';

// ── Provider schemas ──

export const ProviderIdSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'qwen',
  'kimi',
  'minimax',
  'glm',
  'siliconflow',
  'doubao',
  'openrouter',
  'grok',
  'tencent-hunyuan',
  'xiaomi',
  'lemonade',
  'ollama',
]) as z.ZodType<import('@/lib/types/provider').BuiltInProviderId>;

export const ThinkingModeSchema = z.enum(['default', 'disabled', 'enabled', 'auto']);
export const ThinkingEffortSchema = z.enum([
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]);
export const ThinkingLevelSchema = z.enum(['minimal', 'low', 'medium', 'high']);

export const ThinkingConfigSchema = z.object({
  mode: ThinkingModeSchema.optional(),
  effort: ThinkingEffortSchema.optional(),
  level: ThinkingLevelSchema.optional(),
  enabled: z.boolean().optional(),
  budgetTokens: z.number().int().positive().optional(),
  excludeReasoningOutput: z.boolean().optional(),
}) satisfies z.ZodType<import('../provider').ThinkingConfig>;

export const ModelConfigSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  apiKey: z.string().min(1, { message: 'API key is required' }),
  baseUrl: z.string().url().optional(),
  proxy: z.string().url().optional(),
  providerType: z.enum(['openai', 'anthropic', 'google']).optional(),
});

// ── Chat / Session schemas ──

export const SessionTypeSchema = z.enum(['qa', 'discussion', 'lecture']);
export const SessionStatusSchema = z.enum(['idle', 'active', 'interrupted', 'completed']);

export const MessageActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().optional(),
  variant: z.enum(['spotlight', 'highlight', 'reset', 'insert', 'draw']).optional(),
});

export const CreateSessionRequestSchema = z.object({
  type: SessionTypeSchema,
  title: z.string().min(1).max(200).optional(),
  trigger: z.object({
    message: z.string().optional(),
    agentIds: z.array(z.string().min(1)).min(1).max(20),
    triggerAgentId: z.string().optional(),
    maxTurns: z.number().int().min(1).max(50).optional(),
  }),
}) satisfies z.ZodType<import('../chat').CreateSessionRequest>;

export const SendMessageRequestSchema = z.object({
  content: z.string().min(1).max(10000),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
  storeState: z.object({
    stage: z.unknown(),
    scenes: z.array(z.unknown()),
    currentSceneId: z.string().nullable(),
    mode: z.enum(['autonomous', 'playback']),
    whiteboardOpen: z.boolean(),
  }),
}) satisfies z.ZodType<import('../chat').SendMessageRequest>;

// ── Generation schemas ──

export const UploadedDocumentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  type: z.enum(['pdf', 'docx', 'pptx', 'txt', 'md', 'image', 'other']),
  size: z.number().int().nonnegative(),
  pageCount: z.number().int().min(1).optional(),
});

export const UserRequirementsSchema = z.object({
  requirement: z.string().min(1).max(5000),
  userNickname: z.string().max(50).optional(),
  userBio: z.string().max(2000).optional(),
  webSearch: z.boolean().optional(),
  interactiveMode: z.boolean().optional(),
}) satisfies z.ZodType<import('../generation').UserRequirements>;

export const WidgetOutlineSchema = z.object({
  concept: z.string().optional(),
  keyVariables: z.array(z.string()).optional(),
  diagramType: z.enum(['flowchart', 'mindmap', 'hierarchy', 'system']).optional(),
  language: z.enum(['python', 'javascript', 'typescript', 'java', 'cpp']).optional(),
  gameType: z.enum(['quiz', 'puzzle', 'strategy', 'card', 'action']).optional(),
  visualizationType: z
    .enum(['molecular', 'solar', 'anatomy', 'geometry', 'physics', 'custom'])
    .optional(),
  objects: z.array(z.string()).optional(),
  interactions: z.array(z.string()).optional(),
  challenge: z.string().optional(),
  playerControls: z.array(z.string()).optional(),
  nodeCount: z.number().int().positive().optional(),
  challengeType: z.string().optional(),
});

export const SceneOutlineSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['slide', 'quiz', 'interactive', 'pbl']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  keyPoints: z.array(z.string().min(1)).min(1).max(20),
  teachingObjective: z.string().max(1000).optional(),
  estimatedDuration: z.number().int().positive().optional(),
  order: z.number().int().nonnegative(),
  languageNote: z.string().optional(),
  suggestedImageIds: z.array(z.string()).optional(),
  mediaGenerations: z.array(z.object({})).optional(),
  quizConfig: z
    .object({
      questionCount: z.number().int().min(1).max(50),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      questionTypes: z.array(z.enum(['single', 'multiple', 'text'])).min(1),
    })
    .optional(),
  pblConfig: z
    .object({
      projectTopic: z.string().min(1).max(500),
      projectDescription: z.string().min(1).max(3000),
      targetSkills: z.array(z.string()).min(1).max(20),
      issueCount: z.number().int().min(1).max(10).optional(),
    })
    .optional(),
  widgetType: z.string().optional(),
  widgetOutline: WidgetOutlineSchema.optional(),
});

// ── Stage / Scene schemas ──

export const StageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  languageDirective: z.string().optional(),
  style: z.string().optional(),
  whiteboard: z.array(z.object({})).optional(),
  videoManifest: z.record(z.string(), z.unknown()).optional(),
  agentIds: z.array(z.string()).optional(),
  generatedAgentConfigs: z.array(z.object({})).optional(),
  interactiveMode: z.boolean().optional(),
});

export const SceneSchema = z.object({
  id: z.string().min(1),
  stageId: z.string().min(1),
  type: z.enum(['slide', 'quiz', 'interactive', 'pbl']),
  title: z.string().min(1).max(200),
  order: z.number().int().nonnegative(),
  content: z.object({}),
  actions: z.array(z.object({})).optional(),
  whiteboards: z.array(z.object({})).optional(),
  multiAgent: z
    .object({
      enabled: z.boolean(),
      agentIds: z.array(z.string()).min(1),
      directorPrompt: z.string().optional(),
    })
    .optional(),
  createdAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
});

// ── Validation helpers ──

/**
 * Validate and parse input against a Zod schema.
 * Returns the parsed value on success, throws on failure.
 */
export function validateInput<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input);
}

/**
 * Validate and parse input, returning a result object instead of throwing.
 */
export function tryValidateInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}
