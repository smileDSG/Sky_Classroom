import { callLLM } from '@/lib/ai/llm';
import { loadPrompt } from '@/lib/prompts/loader';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { autoFixScript } from '@/lib/animation/schema';
import { validateScript } from '@/lib/animation/validate';
import type { AnimationScript } from '@/lib/animation/types';
import type { AnimationPlan } from './plan-agent';
import { resolveAnimationModel } from './model';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnimationScriptAgent');

const MAX_RETRIES = 3;

/** 大纲 → 完整分镜脚本。校验失败带错误反馈重试（指数退避），耗尽后 fail hard（spec §6）。 */
export async function generateAnimationScript(
  topic: string,
  plan: AnimationPlan,
): Promise<{ script: AnimationScript; warnings: string[] }> {
  const modelConfig = resolveAnimationModel();
  if (!modelConfig) throw new Error('未配置任何可用的 LLM provider');
  const { getModel } = await import('@/lib/ai/providers');
  const { model } = getModel(modelConfig);
  const prompt = loadPrompt('generators/animation-script');
  if (!prompt) throw new Error('加载 prompt generators/animation-script 失败');

  const baseUser = `话题：${topic}\n\n讲解大纲（严格按此推进）：\n${JSON.stringify(plan, null, 2)}`;
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // 重试时把上一轮的校验错误反馈给模型
    const attemptUser =
      attempt > 1 ? `${baseUser}\n\n上一次输出存在以下校验错误，务必修复：${lastError}` : baseUser;
    try {
      const result = await callLLM(
        {
          model,
          system: prompt.systemPrompt,
          prompt: attemptUser,
          maxOutputTokens: 8192,
          temperature: 0.4,
        },
        'animation-script',
        { retries: 1, timeoutMs: 240000 },
        { mode: 'disabled', enabled: false },
      );

      const { script, fixes } = autoFixScript(parseJsonResponse(result.text));
      const { errors, warnings } = validateScript(script);
      if (fixes.length) log.warn(`autoFix 修复 ${fixes.length} 处`, fixes);

      if (errors.length === 0) {
        return { script, warnings: warnings.map((w) => w.message) };
      }
      // 反馈串封顶：退化输出可能产生大量校验错误，全量拼接会撑爆重试 prompt
      const feedback = errors
        .slice(0, 20)
        .map((e) => e.message)
        .join('；');
      lastError = errors.length > 20 ? `${feedback}；…等共 ${errors.length} 个错误` : feedback;
      log.warn(`attempt ${attempt}: ${errors.length} 个校验错误，将重试`, lastError);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      log.warn(`attempt ${attempt} 抛错: ${lastError}`);
    }
    // 末次尝试后不再等待，立即上抛
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }

  throw new Error(`分镜脚本生成失败（共尝试 ${MAX_RETRIES} 次）：${lastError}`);
}
