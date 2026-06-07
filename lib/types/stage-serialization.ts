/**
 * Stage / Scene Serialization Utilities
 *
 * Provides consistent JSON serialization and deserialization
 * with validation, default value injection, and version awareness.
 */

import type { Stage, Scene, SceneContent } from './stage';

/**
 * JSON-serializable representation of a Stage.
 * All Date objects are converted to numeric timestamps.
 */
export interface SerializableStage {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  languageDirective?: string;
  style?: string;
  whiteboard?: unknown[];
  videoManifest?: Record<string, unknown>;
  agentIds?: string[];
  generatedAgentConfigs?: Array<Record<string, unknown>>;
  interactiveMode?: boolean;
}

/**
 * JSON-serializable representation of a Scene.
 */
export interface SerializableScene {
  id: string;
  stageId: string;
  type: string;
  title: string;
  order: number;
  content: unknown;
  actions?: unknown[];
  whiteboards?: unknown[];
  multiAgent?: {
    enabled: boolean;
    agentIds: string[];
    directorPrompt?: string;
  };
  createdAt?: number;
  updatedAt?: number;
}

// ── Serialization ──

/**
 * Convert a Stage to a plain JSON object suitable for stringification.
 */
export function serializeStage(stage: Stage): SerializableStage {
  return {
    id: stage.id,
    name: stage.name,
    description: stage.description,
    createdAt: stage.createdAt,
    updatedAt: stage.updatedAt,
    languageDirective: stage.languageDirective,
    style: stage.style,
    whiteboard: stage.whiteboard,
    videoManifest: stage.videoManifest,
    agentIds: stage.agentIds,
    generatedAgentConfigs: stage.generatedAgentConfigs,
    interactiveMode: stage.interactiveMode,
  };
}

/**
 * Deserialize a plain JSON object back into a Stage.
 * Applies defaults for missing optional fields.
 */
export function deserializeStage(data: unknown): Stage {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('Stage data must be an object');
  }

  const obj = data as Record<string, unknown>;
  const now = Date.now();

  return {
    id: assertString(obj.id, 'Stage.id'),
    name: assertString(obj.name, 'Stage.name'),
    description: optionalString(obj.description),
    createdAt: assertNumber(obj.createdAt ?? now, 'Stage.createdAt'),
    updatedAt: assertNumber(obj.updatedAt ?? now, 'Stage.updatedAt'),
    languageDirective: optionalString(obj.languageDirective),
    style: optionalString(obj.style),
    whiteboard: obj.whiteboard as Stage['whiteboard'],
    videoManifest: obj.videoManifest as Stage['videoManifest'],
    agentIds: obj.agentIds as Stage['agentIds'],
    generatedAgentConfigs: obj.generatedAgentConfigs as Stage['generatedAgentConfigs'],
    interactiveMode: obj.interactiveMode as Stage['interactiveMode'],
  };
}

/**
 * Convert a Scene to a plain JSON object suitable for stringification.
 */
export function serializeScene(scene: Scene): SerializableScene {
  return {
    id: scene.id,
    stageId: scene.stageId,
    type: scene.type,
    title: scene.title,
    order: scene.order,
    content: scene.content as unknown,
    actions: scene.actions as unknown[] | undefined,
    whiteboards: scene.whiteboards as unknown[] | undefined,
    multiAgent: scene.multiAgent,
    createdAt: scene.createdAt,
    updatedAt: scene.updatedAt,
  };
}

/**
 * Deserialize a plain JSON object back into a Scene.
 * Applies defaults for missing optional fields.
 */
export function deserializeScene(data: unknown): Scene {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('Scene data must be an object');
  }

  const obj = data as Record<string, unknown>;
  const now = Date.now();

  return {
    id: assertString(obj.id, 'Scene.id'),
    stageId: assertString(obj.stageId, 'Scene.stageId'),
    type: assertEnum(
      obj.type,
      ['slide', 'quiz', 'interactive', 'pbl'],
      'Scene.type',
    ) as Scene['type'],
    title: assertString(obj.title, 'Scene.title'),
    order: assertNumber(obj.order, 'Scene.order'),
    content: obj.content as SceneContent,
    actions: obj.actions as Scene['actions'],
    whiteboards: obj.whiteboards as Scene['whiteboards'],
    multiAgent: obj.multiAgent as Scene['multiAgent'],
    createdAt: (obj.createdAt as number) ?? now,
    updatedAt: (obj.updatedAt as number) ?? now,
  };
}

/**
 * Serialize a batch of scenes into a JSON-safe array.
 */
export function serializeScenes(scenes: Scene[]): SerializableScene[] {
  return scenes.map(serializeScene);
}

/**
 * Deserialize a batch of scenes from a JSON array.
 */
export function deserializeScenes(data: unknown[]): Scene[] {
  return data.map(deserializeScene);
}

// ── Assertion helpers ──

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function assertNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`${field} must be a valid number`);
  }
  return value;
}

function assertEnum(value: unknown, values: string[], field: string): string {
  const str = assertString(value, field);
  if (!values.includes(str)) {
    throw new TypeError(`${field} must be one of: ${values.join(', ')}, got "${str}"`);
  }
  return str;
}
