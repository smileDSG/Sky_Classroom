/**
 * Generate a learning plan with an LLM.
 *
 * Thin wrapper around the unified LLM layer that turns a system/user prompt
 * pair into a raw JSON string. The caller (learning-plan-service) is responsible
 * for parsing and validating the result.
 */

import { getModel } from '@/lib/ai/providers';
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { ProviderId } from '@/lib/types/provider';

const log = createLogger('GeneratePlan');

function parseModelRef(ref: string): { providerId: string; modelId: string } {
  const parts = ref.split(':');
  if (parts.length !== 2) {
    throw new Error(`模型格式错误：${ref}，应为 provider:model-id`);
  }
  return { providerId: parts[0], modelId: parts[1] };
}

function resolveApiKey(providerId: string): string | undefined {
  const envKey = process.env[`${providerId.toUpperCase()}_API_KEY`];
  if (envKey) return envKey;

  // Support comma-separated key pools
  const envKeys = process.env[`${providerId.toUpperCase()}_API_KEYS`];
  if (envKeys) {
    const keys = envKeys
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    return keys[0];
  }

  return undefined;
}

export interface GeneratePlanOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  retries?: number;
  timeoutMs?: number;
}

export async function generatePlanWithLLM(
  systemPrompt: string,
  userPrompt: string,
  options: GeneratePlanOptions = {},
): Promise<string> {
  const modelRef = options.model ?? process.env.LEARNING_PLAN_MODEL ?? 'deepseek:deepseek-v4-pro';
  const { providerId, modelId } = parseModelRef(modelRef);
  const apiKey = resolveApiKey(providerId);

  if (!apiKey) {
    throw new Error(`缺少环境变量：${providerId.toUpperCase()}_API_KEY 或 API_KEYS`);
  }

  const { model } = getModel({ providerId: providerId as ProviderId, modelId, apiKey });

  log.info(`[generatePlanWithLLM] model=${modelRef}`);

  const result = await callLLM(
    {
      model,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: options.temperature ?? 0.5,
      maxOutputTokens: options.maxOutputTokens ?? 4096,
    },
    'generate-learning-plan',
    {
      retries: options.retries ?? 2,
      timeoutMs: options.timeoutMs ?? 120_000,
    },
    undefined,
    systemPrompt,
  );

  return result.text.trim();
}
