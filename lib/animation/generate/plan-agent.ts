import { z } from 'zod';
import { callLLM } from '@/lib/ai/llm';
import { loadPrompt } from '@/lib/prompts/loader';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveAnimationModel } from './model';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnimationPlanAgent');

const planSchema = z.object({
  title: z.string().min(1),
  subjectArea: z.enum(['algorithm', 'data-structure', 'math', 'physics']),
  steps: z
    .array(z.object({ title: z.string().min(1), intent: z.string().min(1) }))
    .min(5)
    .max(20),
});

export interface AnimationPlan {
  title: string;
  subjectArea: 'algorithm' | 'data-structure' | 'math' | 'physics';
  steps: { title: string; intent: string }[];
}

/** 话题 → 讲解大纲（5~20 步，每步一句意图）。schema 校验失败即抛错（spec §6）。 */
export async function planAnimation(topic: string): Promise<AnimationPlan> {
  if (!topic.trim()) throw new Error('话题不能为空');
  const modelConfig = resolveAnimationModel();
  if (!modelConfig) {
    throw new Error('未配置任何可用的 LLM provider（检查 .env 中的 API key 或 DEFAULT_MODEL）');
  }
  const { getModel } = await import('@/lib/ai/providers');
  const { model } = getModel(modelConfig);
  const prompt = loadPrompt('generators/animation-plan');
  if (!prompt) throw new Error('加载 prompt generators/animation-plan 失败');

  const result = await callLLM(
    {
      model,
      system: prompt.systemPrompt,
      prompt: `话题：${topic}`,
      maxOutputTokens: 4096,
      temperature: 0.6,
    },
    'animation-plan',
    {
      retries: 2,
      timeoutMs: 180000,
      validate: (text: string) => {
        const parsed = parseJsonResponse(text);
        return !!parsed && planSchema.safeParse(parsed).success;
      },
    },
    { mode: 'disabled', enabled: false },
  );

  const parsed = planSchema.safeParse(parseJsonResponse(result.text));
  if (!parsed.success) {
    log.error('plan 解析失败', parsed.error);
    throw new Error('讲解大纲生成失败：LLM 输出不符合 schema');
  }
  log.info(`plan ok: ${parsed.data.steps.length} 步`);
  return parsed.data;
}
