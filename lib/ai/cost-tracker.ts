/**
 * Cost Tracker — Token Usage and Fee Estimation
 *
 * Tracks token consumption per provider/model and estimates costs
 * based on known pricing. Provides cumulative and per-session stats.
 *
 * Usage:
 *   recordUsage({ providerId: 'openai', modelId: 'gpt-4o', inputTokens: 1500, outputTokens: 300 });
 *   const stats = getCostStats();
 */

import type { ProviderId } from '@/lib/types/provider';

/** Pricing per million tokens (USD) — approximate as of 2025-01 */
interface ModelPricing {
  inputPerM: number;
  outputPerM: number;
  cacheReadPerM?: number;
  cacheWritePerM?: number;
}

/** Pricing table — key is "providerId/modelId" or "providerId/*" as fallback */
const PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'openai/gpt-5.5': { inputPerM: 2.5, outputPerM: 15 },
  'openai/gpt-5.4-pro': { inputPerM: 2.5, outputPerM: 15 },
  'openai/gpt-5.4': { inputPerM: 1.25, outputPerM: 10 },
  'openai/gpt-5.4-mini': { inputPerM: 0.4, outputPerM: 4 },
  'openai/gpt-5.4-nano': { inputPerM: 0.1, outputPerM: 0.6 },
  'openai/*': { inputPerM: 2.5, outputPerM: 10 },

  // Anthropic
  'anthropic/claude-opus-4-7': {
    inputPerM: 15,
    outputPerM: 75,
    cacheReadPerM: 1.5,
    cacheWritePerM: 18.75,
  },
  'anthropic/claude-opus-4-6': {
    inputPerM: 15,
    outputPerM: 75,
    cacheReadPerM: 1.5,
    cacheWritePerM: 18.75,
  },
  'anthropic/claude-sonnet-4-6': {
    inputPerM: 3,
    outputPerM: 15,
    cacheReadPerM: 0.3,
    cacheWritePerM: 3.75,
  },
  'anthropic/claude-sonnet-4-5': {
    inputPerM: 3,
    outputPerM: 15,
    cacheReadPerM: 0.3,
    cacheWritePerM: 3.75,
  },
  'anthropic/claude-haiku-4-5': {
    inputPerM: 0.8,
    outputPerM: 4,
    cacheReadPerM: 0.08,
    cacheWritePerM: 1,
  },
  'anthropic/*': { inputPerM: 3, outputPerM: 15 },

  // Google
  'google/gemini-3.1-pro-preview': { inputPerM: 1.25, outputPerM: 10 },
  'google/gemini-3-flash-preview': { inputPerM: 0.3, outputPerM: 2.5 },
  'google/gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 },
  'google/gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.6 },
  'google/gemini-2.5-pro': { inputPerM: 1.25, outputPerM: 10 },
  'google/*': { inputPerM: 0.3, outputPerM: 2.5 },

  // DeepSeek
  'deepseek/deepseek-v4-pro': { inputPerM: 0.5, outputPerM: 2 },
  'deepseek/deepseek-v4-flash': { inputPerM: 0.1, outputPerM: 0.5 },
  'deepseek/*': { inputPerM: 0.5, outputPerM: 2 },

  // Qwen
  'qwen/*': { inputPerM: 0.5, outputPerM: 2 },

  // Kimi
  'kimi/*': { inputPerM: 1, outputPerM: 4 },

  // MiniMax
  'minimax/*': { inputPerM: 1, outputPerM: 4 },

  // SiliconFlow
  'siliconflow/*': { inputPerM: 0.5, outputPerM: 2 },

  // Doubao
  'doubao/*': { inputPerM: 0.5, outputPerM: 2 },

  // OpenRouter
  'openrouter/*': { inputPerM: 1, outputPerM: 5 },

  // Grok
  'grok/*': { inputPerM: 5, outputPerM: 15 },

  // Tencent Hunyuan
  'tencent-hunyuan/*': { inputPerM: 0.5, outputPerM: 2 },

  // Xiaomi
  'xiaomi/*': { inputPerM: 1, outputPerM: 4 },

  // Ollama (local, free)
  'ollama/*': { inputPerM: 0, outputPerM: 0 },

  // Lemonade (local, free)
  'lemonade/*': { inputPerM: 0, outputPerM: 0 },

  // GLM
  'glm/*': { inputPerM: 0.5, outputPerM: 2 },
};

export interface TokenUsage {
  providerId: ProviderId;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  sessionId?: string;
  timestamp?: number;
}

export interface CostEntry extends TokenUsage {
  estimatedCostUsd: number;
}

export interface CostStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  entries: CostEntry[];
  byProvider: Record<string, { tokens: number; costUsd: number }>;
  bySession: Record<string, { tokens: number; costUsd: number }>;
}

// ── In-memory store ──

const entries: CostEntry[] = [];

/**
 * Calculate estimated cost for a token usage record.
 */
export function estimateCost(usage: TokenUsage): number {
  const key = `${usage.providerId}/${usage.modelId}`;
  const fallbackKey = `${usage.providerId}/*`;
  const pricing = PRICING[key] ?? PRICING[fallbackKey];

  if (!pricing) return 0;

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerM;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerM;
  const cacheReadCost =
    pricing.cacheReadPerM && usage.cacheReadTokens
      ? (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadPerM
      : 0;
  const cacheWriteCost =
    pricing.cacheWritePerM && usage.cacheWriteTokens
      ? (usage.cacheWriteTokens / 1_000_000) * pricing.cacheWritePerM
      : 0;

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

/**
 * Record a token usage event.
 */
export function recordUsage(usage: TokenUsage): CostEntry {
  const cost = estimateCost(usage);
  const entry: CostEntry = {
    ...usage,
    timestamp: usage.timestamp ?? Date.now(),
    estimatedCostUsd: cost,
  };
  entries.push(entry);
  return entry;
}

/**
 * Get cumulative cost statistics.
 * Optionally filter by session ID.
 */
export function getCostStats(sessionId?: string): CostStats {
  const filtered = sessionId ? entries.filter((e) => e.sessionId === sessionId) : entries;

  const byProvider: Record<string, { tokens: number; costUsd: number }> = {};
  const bySession: Record<string, { tokens: number; costUsd: number }> = {};

  for (const entry of filtered) {
    const totalTokens = entry.inputTokens + entry.outputTokens;
    const providerKey = entry.providerId;
    const sessionKey = entry.sessionId ?? 'unknown';

    if (!byProvider[providerKey]) byProvider[providerKey] = { tokens: 0, costUsd: 0 };
    byProvider[providerKey].tokens += totalTokens;
    byProvider[providerKey].costUsd += entry.estimatedCostUsd;

    if (!bySession[sessionKey]) bySession[sessionKey] = { tokens: 0, costUsd: 0 };
    bySession[sessionKey].tokens += totalTokens;
    bySession[sessionKey].costUsd += entry.estimatedCostUsd;
  }

  return {
    totalInputTokens: filtered.reduce((sum, e) => sum + e.inputTokens, 0),
    totalOutputTokens: filtered.reduce((sum, e) => sum + e.outputTokens, 0),
    totalTokens: filtered.reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0),
    totalCostUsd: filtered.reduce((sum, e) => sum + e.estimatedCostUsd, 0),
    entries: filtered,
    byProvider,
    bySession,
  };
}

/**
 * Clear all recorded usage entries.
 */
export function clearUsageHistory(): void {
  entries.length = 0;
}

/**
 * Get the number of recorded entries.
 */
export function getEntryCount(): number {
  return entries.length;
}
