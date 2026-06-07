/**
 * Thinking Strategy — Strategy Pattern for Provider-Specific Request Params
 *
 * Replaces the 10+ case branches in getCompatThinkingBodyParams() with
 * a registry of strategy implementations. Each provider adapter maps
 * the unified ThinkingConfig to its vendor-specific HTTP body parameters.
 *
 * Usage:
 *   const strategy = getThinkingStrategy('deepseek');
 *   const bodyParams = strategy?.buildBodyParams(capability, config);
 */

import type { ThinkingConfig, ThinkingRequestAdapter } from '@/lib/types/provider';
import type { ThinkingCapability } from '@/lib/types/provider';
import { getThinkingMode } from '../thinking-config';

/** Interface that all thinking strategies must implement. */
export interface ThinkingStrategy {
  /**
   * Build provider-specific HTTP body params from unified thinking config.
   * Returns undefined if no params should be added (default mode).
   */
  buildBodyParams(
    capability: ThinkingCapability,
    config: ThinkingConfig,
  ): Record<string, unknown> | undefined;
}

/**
 * Kimi / GLM / Xiaomi strategy
 * Uses { thinking: { type: 'disabled' | 'enabled' } }
 * No budget control.
 */
export class SimpleToggleStrategy implements ThinkingStrategy {
  buildBodyParams(
    capability: ThinkingCapability,
    config: ThinkingConfig,
  ): Record<string, unknown> | undefined {
    const mode = getThinkingMode(config) ?? capability.defaultMode;
    if (mode === 'disabled') return { thinking: { type: 'disabled' } };
    if (mode === 'enabled') return { thinking: { type: 'enabled' } };
    return undefined;
  }
}

/**
 * DeepSeek strategy
 * Uses { thinking: { type: 'enabled' }, reasoning_effort: 'high' | 'max' }
 */
export class DeepSeekStrategy implements ThinkingStrategy {
  buildBodyParams(
    capability: ThinkingCapability,
    config: ThinkingConfig,
  ): Record<string, unknown> | undefined {
    const mode = getThinkingMode(config) ?? capability.defaultMode;
    if (mode === 'disabled' || config.effort === 'none') {
      return { thinking: { type: 'disabled' } };
    }
    const effort = config.effort === 'max' || config.effort === 'xhigh' ? 'max' : 'high';
    return {
      thinking: { type: 'enabled' },
      reasoning_effort: effort,
    };
  }
}

/**
 * Qwen strategy
 * Uses { enable_thinking: boolean, thinking_budget: number }
 */
export class QwenStrategy implements ThinkingStrategy {
  buildBodyParams(
    capability: ThinkingCapability,
    config: ThinkingConfig,
  ): Record<string, unknown> | undefined {
    const mode = getThinkingMode(config) ?? capability.defaultMode;
    if (mode === 'disabled') return { enable_thinking: false };

    const budget = pickBudget(capability, config);
    const body: Record<string, unknown> = {};
    if (mode === 'enabled') body.enable_thinking = true;
    if (budget !== undefined) body.thinking_budget = budget;
    return Object.keys(body).length > 0 ? body : undefined;
  }
}

/**
 * SiliconFlow strategy
 * Uses { enable_thinking: boolean, thinking_budget: number }
 * Toggle-budget control type.
 */
export class SiliconFlowStrategy implements ThinkingStrategy {
  buildBodyParams(
    capability: ThinkingCapability,
    config: ThinkingConfig,
  ): Record<string, unknown> | undefined {
    const mode = getThinkingMode(config) ?? capability.defaultMode;
    const body: Record<string, unknown> = {};

    if (capability.control === 'toggle-budget') {
      if (mode === 'disabled') body.enable_thinking = false;
      if (mode === 'enabled') body.enable_thinking = true;
    }

    const budget = pickBudget(capability, config);
    if (budget !== undefined) body.thinking_budget = budget;
    return Object.keys(body).length > 0 ? body : undefined;
  }
}

/**
 * Doubao strategy
 * Uses reasoning_effort for effort control, or { thinking: { type } } otherwise.
 */
export class DoubaoStrategy implements ThinkingStrategy {
  buildBodyParams(
    capability: ThinkingCapability,
    config: ThinkingConfig,
  ): Record<string, unknown> | undefined {
    const mode = getThinkingMode(config) ?? capability.defaultMode;

    if (capability.control === 'effort') {
      const effort =
        mode === 'disabled'
          ? 'minimal'
          : config.effort && capability.effortValues?.includes(config.effort)
            ? config.effort
            : mode === 'enabled'
              ? capability.defaultEffort
              : undefined;
      return effort ? { reasoning_effort: effort } : undefined;
    }

    if (mode === 'auto') return { thinking: { type: 'auto' } };
    if (mode === 'disabled') return { thinking: { type: 'disabled' } };
    if (mode === 'enabled') return { thinking: { type: 'enabled' } };
    return undefined;
  }
}

/**
 * OpenRouter strategy
 * Uses { reasoning: { enabled, effort, max_tokens, exclude } }
 */
export class OpenRouterStrategy implements ThinkingStrategy {
  buildBodyParams(
    capability: ThinkingCapability,
    config: ThinkingConfig,
  ): Record<string, unknown> | undefined {
    const mode = getThinkingMode(config) ?? capability.defaultMode;
    const reasoning: Record<string, unknown> = {};

    if (mode === 'disabled') reasoning.enabled = false;
    if (mode === 'enabled') reasoning.enabled = true;
    if (config.effort) reasoning.effort = config.effort;

    const budget = pickBudget(capability, config);
    if (budget !== undefined) reasoning.max_tokens = budget;

    if (typeof config.excludeReasoningOutput === 'boolean') {
      reasoning.exclude = config.excludeReasoningOutput;
    }

    return Object.keys(reasoning).length > 0 ? { reasoning } : undefined;
  }
}

/**
 * Tencent Hunyuan strategy
 * Uses { chat_template_kwargs: { reasoning_effort: 'no_think' | 'low' | 'high' } }
 */
export class HunyuanStrategy implements ThinkingStrategy {
  buildBodyParams(
    capability: ThinkingCapability,
    config: ThinkingConfig,
  ): Record<string, unknown> | undefined {
    const mode = getThinkingMode(config) ?? capability.defaultMode;
    let reasoningEffort: 'no_think' | 'low' | 'high' | undefined;

    if (mode === 'disabled' || config.effort === 'none') {
      reasoningEffort = 'no_think';
    } else if (config.effort === 'high' || config.effort === 'max' || config.effort === 'xhigh') {
      reasoningEffort = 'high';
    } else if (
      config.effort === 'low' ||
      config.effort === 'medium' ||
      config.effort === 'minimal'
    ) {
      reasoningEffort = 'low';
    } else if (mode === 'enabled') {
      reasoningEffort = capability.defaultEffort === 'high' ? 'high' : 'low';
    }

    return reasoningEffort
      ? { chat_template_kwargs: { reasoning_effort: reasoningEffort } }
      : undefined;
  }
}

/**
 * Lemonade strategy
 * Uses { chat_template_kwargs: { enable_thinking, thinking_budget } }
 */
export class LemonadeStrategy implements ThinkingStrategy {
  buildBodyParams(
    capability: ThinkingCapability,
    config: ThinkingConfig,
  ): Record<string, unknown> | undefined {
    const mode = getThinkingMode(config) ?? capability.defaultMode;
    const chatTemplateKwargs: Record<string, unknown> = {};

    if (mode === 'enabled') {
      chatTemplateKwargs.enable_thinking = true;
    } else {
      chatTemplateKwargs.enable_thinking = false;
    }

    const budget = pickBudget(capability, config);
    if (mode === 'enabled' && budget !== undefined) {
      chatTemplateKwargs.thinking_budget = budget;
    }

    return { chat_template_kwargs: chatTemplateKwargs };
  }
}

// ── Registry ──

const strategyMap = new Map<ThinkingRequestAdapter, ThinkingStrategy>();

function registerStrategy(adapter: ThinkingRequestAdapter, strategy: ThinkingStrategy): void {
  strategyMap.set(adapter, strategy);
}

// Register all strategies
registerStrategy('kimi', new SimpleToggleStrategy());
registerStrategy('glm', new SimpleToggleStrategy());
registerStrategy('xiaomi', new SimpleToggleStrategy());
registerStrategy('deepseek', new DeepSeekStrategy());
registerStrategy('qwen', new QwenStrategy());
registerStrategy('siliconflow', new SiliconFlowStrategy());
registerStrategy('doubao', new DoubaoStrategy());
registerStrategy('openrouter', new OpenRouterStrategy());
registerStrategy('hunyuan', new HunyuanStrategy());
registerStrategy('lemonade', new LemonadeStrategy());

/**
 * Get the thinking strategy for a given provider adapter.
 * Returns undefined if no strategy is registered (e.g., 'openai', 'anthropic', 'google').
 */
export function getThinkingStrategy(adapter: ThinkingRequestAdapter): ThinkingStrategy | undefined {
  return strategyMap.get(adapter);
}

/**
 * Build provider-specific body params using the strategy pattern.
 * This is the direct replacement for getCompatThinkingBodyParams().
 */
export function buildThinkingBodyParams(
  capability: ThinkingCapability,
  config: ThinkingConfig,
): Record<string, unknown> | undefined {
  const adapter = capability.requestAdapter;
  if (!adapter || adapter === 'none') return undefined;

  const strategy = getThinkingStrategy(adapter);
  return strategy?.buildBodyParams(capability, config);
}

// ── Shared helper ──

/**
 * Pick the thinking budget from config, respecting the capability's budgetRange.
 * Mirrors the logic from thinking-config.ts pickThinkingBudget().
 */
function pickBudget(capability: ThinkingCapability, config: ThinkingConfig): number | undefined {
  const budget = config.budgetTokens;
  if (budget === undefined) return undefined;

  const range = capability.budgetRange;
  if (!range) return budget;

  const min = range.min ?? budget;
  const max = range.max ?? budget;
  return Math.min(Math.max(budget, min), max);
}
