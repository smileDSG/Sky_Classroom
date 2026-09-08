import { useSettingsStore } from '@/lib/store/settings';
import type { ProviderId } from '@/lib/ai/providers';
import {
  getThinkingConfigKey,
  normalizeThinkingConfig,
  supportsConfigurableThinking,
} from '@/lib/ai/thinking-config';

function getModelConfig(providerId: ProviderId, modelId: string) {
  const { providersConfig, thinkingConfigs } = useSettingsStore.getState();
  const modelString = `${providerId}:${modelId}`;

  // Get current provider's config
  const providerConfig = providersConfig[providerId];
  const modelInfo = providerConfig?.models.find((model) => model.id === modelId);
  const thinking = modelInfo?.capabilities?.thinking;
  const thinkingConfig = supportsConfigurableThinking(thinking)
    ? normalizeThinkingConfig(thinking, thinkingConfigs[getThinkingConfigKey(providerId, modelId)])
    : undefined;

  return {
    providerId,
    modelId,
    modelString,
    apiKey: providerConfig?.apiKey || '',
    baseUrl: providerConfig?.baseUrl || '',
    providerType: providerConfig?.type,
    requiresApiKey: providerConfig?.requiresApiKey,
    isServerConfigured: providerConfig?.isServerConfigured,
    thinkingConfig,
  };
}

/**
 * Get current model configuration from settings store.
 * Reuses the chat-only selection remap so content/generation routes don't fall
 * back to an unreachable base model (e.g. openai:gpt-5.5) while chat picks a
 * reachable provider — both should resolve to the same effective model.
 */
export function getCurrentModelConfig() {
  const { providerId, modelId } = useSettingsStore.getState();
  const selection = resolveChatModelSelection(providerId, modelId);
  return getModelConfig(selection.providerId, selection.modelId);
}

/** Chat must not reuse the persisted GPT-5.5 selection. */
export function resolveChatModelSelection(providerId: ProviderId, modelId: string) {
  return providerId === 'openai' && modelId === 'gpt-5.5'
    ? { providerId: 'deepseek' as const, modelId: 'deepseek-chat' }
    : { providerId, modelId };
}

/** Get model configuration used exclusively by classroom chat. */
export function getChatModelConfig() {
  const { providerId, modelId } = useSettingsStore.getState();
  const selection = resolveChatModelSelection(providerId, modelId);
  return getModelConfig(selection.providerId, selection.modelId);
}
