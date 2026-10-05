import type { BuiltInProviderId, ModelConfig } from '@/lib/types/provider';

/**
 * 候选 provider → 环境变量 key 名（与 lib/solve/solver-constants.ts 的
 * ENV_KEY_MAP/ENV_URL_MAP 同源约定）。候选 modelId 均已在
 * lib/ai/providers-registry.ts 注册，且为普通文本模型（非 vision）。
 */
const CANDIDATES: {
  providerId: BuiltInProviderId;
  modelId: string;
  envKey: string;
  baseUrlEnv?: string;
}[] = [
  {
    providerId: 'deepseek',
    modelId: 'deepseek-flash',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
  },
  {
    providerId: 'glm',
    modelId: 'glm-4.7-flash',
    envKey: 'GLM_API_KEY',
    baseUrlEnv: 'GLM_BASE_URL',
  },
  { providerId: 'qwen', modelId: 'qwen3-max', envKey: 'QWEN_API_KEY', baseUrlEnv: 'QWEN_BASE_URL' },
];

export interface ResolveEnv {
  DEFAULT_MODEL?: string;
  [key: string]: string | undefined;
}

/**
 * 动画讲解用模型：DEFAULT_MODEL=provider:model-id 仅当 provider 是候选之一时优先
 * （动画管线仅认候选 provider 的 DEFAULT_MODEL，未知 provider 不误路由——
 * 否则会把未知 provider 硬套 openai 类型打向 api.openai.com——回退到候选列表），
 * 否则取第一个配置了 key 的候选。
 */
export function resolveAnimationModel(opts?: { env?: ResolveEnv }): ModelConfig | null {
  const env = opts?.env ?? process.env;

  const def = env.DEFAULT_MODEL?.trim();
  if (def && def.includes(':')) {
    const [providerId, modelId] = def.split(':', 2);
    const cand = CANDIDATES.find((c) => c.providerId === providerId);
    if (cand) {
      const key = env[cand.envKey];
      if (key) {
        return {
          providerId: cand.providerId,
          modelId,
          apiKey: key,
          baseUrl: cand.baseUrlEnv ? env[cand.baseUrlEnv] || undefined : undefined,
          providerType: 'openai',
        };
      }
    }
  }

  for (const c of CANDIDATES) {
    const key = env[c.envKey];
    if (key) {
      return {
        providerId: c.providerId,
        modelId: c.modelId,
        apiKey: key,
        baseUrl: c.baseUrlEnv ? env[c.baseUrlEnv] || undefined : undefined,
        providerType: 'openai',
      };
    }
  }
  return null;
}
