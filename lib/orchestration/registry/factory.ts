/**
 * Agent Factory
 *
 * Creates AgentConfig instances from templates, LLM output, and custom parameters.
 * Replaces the manual field-spreading previously scattered across store.ts and the
 * agent-profiles API.
 */
import { nanoid } from 'nanoid';
import { ALL_DEFAULT_TEMPLATES } from './templates';
import { getActionsForRole, type AgentConfig, type AgentTemplate } from './types';
import type { TTSProviderId } from '@/lib/audio/types';

// ==================== Types ====================

export interface GeneratedAgentParams {
  name: string;
  role: string;
  persona: string;
  avatar?: string;
  color?: string;
  priority?: number;
  voiceConfig?: { providerId: string; voiceId: string };
}

export interface CustomAgentParams {
  name: string;
  role: string;
  persona: string;
  personaType?: string;
  avatar?: string;
  color?: string;
  priority?: number;
  allowedActions?: string[];
  voiceConfig?: { providerId: string; voiceId: string };
}

export interface CourseInfo {
  name: string;
  description?: string;
  sceneTypes?: string[];
  sceneCount?: number;
}

// ==================== AgentFactory ====================

export class AgentFactory {
  private templates: Map<string, AgentTemplate>;

  constructor(templates?: Record<string, AgentTemplate>) {
    this.templates = new Map(Object.entries(templates ?? ALL_DEFAULT_TEMPLATES));
  }

  // ─── Template-based creation ───

  /**
   * Create an AgentConfig from a registered template.
   * Optionally override any field via `overrides`.
   */
  createFromTemplate(
    templateId: string,
    overrides?: Partial<AgentConfig>,
  ): AgentConfig | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const now = new Date();
    return {
      id: overrides?.id ?? `tmpl-${nanoid(8)}`,
      name: template.name,
      role: template.role,
      persona: template.persona,
      personaType: template.personaType,
      avatar: template.avatar,
      color: template.color,
      allowedActions: [...(template.allowedActions ?? getActionsForRole(template.role))],
      priority: template.priority ?? 5,
      voiceConfig: template.voiceConfig,
      createdAt: now,
      updatedAt: now,
      isDefault: true,
      ...overrides,
    };
  }

  /**
   * Create all default agents from the built-in template set.
   * Returns a Record<string, AgentConfig> keyed by agent ID,
   * matching the old DEFAULT_AGENTS shape for backward compatibility.
   */
  createDefaults(): Record<string, AgentConfig> {
    const result: Record<string, AgentConfig> = {};
    const templateOrder = [
      ['default-1', 'teacher'],
      ['default-2', 'assistant'],
      ['default-3', 'curious'],
      ['default-4', 'analytical'],
      ['default-5', 'creative'],
      ['default-6', 'note-taker'],
    ] as const;

    for (const [id, templateId] of templateOrder) {
      const agent = this.createFromTemplate(templateId, { id });
      if (agent) {
        result[id] = agent;
      }
    }
    return result;
  }

  // ─── LLM output → AgentConfig ───

  /**
   * Create an AgentConfig from LLM-generated agent profile parameters.
   * Assigns defaults for missing fields (avatar, color, priority, actions).
   */
  createFromLLM(
    params: GeneratedAgentParams,
    fallbackAvatar?: string,
    fallbackColor?: string,
  ): AgentConfig {
    const now = new Date();
    return {
      id: `gen-${nanoid(8)}`,
      name: params.name,
      role: params.role,
      persona: params.persona,
      avatar: params.avatar || fallbackAvatar || '/avatars/user.png',
      color: params.color || fallbackColor || '#888888',
      allowedActions: getActionsForRole(params.role),
      priority:
        params.priority ??
        (params.role === 'teacher' ? 10 : params.role === 'assistant' ? 7 : 5),
      voiceConfig: params.voiceConfig
        ? { providerId: params.voiceConfig.providerId as TTSProviderId, voiceId: params.voiceConfig.voiceId }
        : undefined,
      createdAt: now,
      updatedAt: now,
      isDefault: false,
      isGenerated: true,
    };
  }

  // ─── Custom agent creation ───

  /**
   * Create a user-defined custom agent.
   */
  createCustom(params: CustomAgentParams, id?: string): AgentConfig {
    const now = new Date();
    return {
      id: id ?? `custom-${nanoid(8)}`,
      name: params.name,
      role: params.role,
      persona: params.persona,
      personaType: params.personaType,
      avatar: params.avatar || '/avatars/user.png',
      color: params.color || '#888888',
      allowedActions: params.allowedActions ?? getActionsForRole(params.role),
      priority: params.priority ?? 5,
      voiceConfig: params.voiceConfig
        ? { providerId: params.voiceConfig.providerId as TTSProviderId, voiceId: params.voiceConfig.voiceId }
        : undefined,
      createdAt: now,
      updatedAt: now,
      isDefault: false,
    };
  }

  // ─── Template registry ───

  /** Register a new template (for user-defined templates). */
  registerTemplate(id: string, template: AgentTemplate): void {
    this.templates.set(id, template);
  }

  /** Remove a template. */
  removeTemplate(id: string): void {
    this.templates.delete(id);
  }

  /** List all registered templates, optionally filtered by role. */
  listTemplates(role?: string): AgentTemplate[] {
    const all = Array.from(this.templates.values());
    if (!role) return all;
    return all.filter((t) => t.role === role);
  }

  /** Get a template by ID. */
  getTemplate(id: string): AgentTemplate | undefined {
    return this.templates.get(id);
  }
}

// ==================== Singleton ====================

let _factory: AgentFactory | null = null;

export function getAgentFactory(): AgentFactory {
  if (!_factory) {
    _factory = new AgentFactory();
  }
  return _factory;
}

export function resetAgentFactory(): void {
  _factory = null;
}
