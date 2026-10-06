import { nanoid } from 'nanoid';
import { planAnimation, type AnimationPlan } from './plan-agent';
import { generateAnimationScript } from './script-agent';
import type { AnimationScript } from '@/lib/animation/types';

export type GenerationStage = 'planning' | 'scripting' | 'validating' | 'done' | 'failed';

export type ProgressCallback = (stage: GenerationStage, progress: number, message?: string) => void;

export interface GenerationResult {
  script: AnimationScript;
  warnings: string[];
}

/**
 * script 阶段失败时携带已成功的 plan 上抛——调用方（API route）把它存进
 * job，前端降级展示大纲文字版（spec §8.1）。
 */
export class AnimationGenerationError extends Error {
  plan?: AnimationPlan;
  constructor(message: string, plan?: AnimationPlan) {
    super(message);
    this.name = 'AnimationGenerationError';
    this.plan = plan;
  }
}

/**
 * 完整生成流程（spec §6）：plan → script（内含校验+重试）→ 完成。
 * 进度点：planning:10 → planning:30 → scripting:40 → scripting:70 → done:100。
 */
export async function runAnimationGeneration(
  topic: string,
  opts: { onProgress?: ProgressCallback } = {},
): Promise<GenerationResult> {
  const onProgress = opts.onProgress ?? (() => {});

  onProgress('planning', 10, '正在规划讲解步骤');
  const plan: AnimationPlan = await planAnimation(topic);
  onProgress('planning', 30, `已规划 ${plan.steps.length} 个步骤`);

  onProgress('scripting', 40, '正在编写分镜脚本');
  let scriptResult: Awaited<ReturnType<typeof generateAnimationScript>>;
  try {
    scriptResult = await generateAnimationScript(topic, plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onProgress('failed', 100, msg);
    throw new AnimationGenerationError(msg, plan);
  }
  onProgress('scripting', 70, '分镜脚本完成，正在校验');

  const finalScript: AnimationScript = {
    ...scriptResult.script,
    id: scriptResult.script.id || `anim-${nanoid(8)}`,
  };
  onProgress('done', 100, '完成');
  return { script: finalScript, warnings: scriptResult.warnings };
}

export { planAnimation, generateAnimationScript };
