// tests/animation/animation.eval.test.ts
/**
 * Eval：真实 LLM 生成 → 校验通过率回归网（vitest.eval.config.ts 专用，pnpm test 不跑）。
 * 运行：ANIMATION_EVAL=1 pnpm vitest --config vitest.eval.config.ts tests/animation/animation.eval.test.ts
 * 需要 .env.local 配置 LLM key。单个用例超时 10 分钟。
 */
import { describe, it, expect } from 'vitest';
import { runAnimationGeneration } from '@/lib/animation/generate/pipeline';
import { scriptSchema } from '@/lib/animation/schema';
import { validateScript } from '@/lib/animation/validate';

const maybe = process.env.ANIMATION_EVAL === '1' ? describe : describe.skip;

const TOPICS = ['二叉堆的插入与上浮', '快速排序的 partition 过程', '单摆的运动规律'];

maybe('animation eval', () => {
  it.each(TOPICS)(
    '"%s" 生成的脚本通过 schema 与结构校验',
    async (topic) => {
      const { script } = await runAnimationGeneration(topic);
      expect(scriptSchema.safeParse(script).success).toBe(true);
      const { errors } = validateScript(script);
      expect(errors).toEqual([]);
      expect(script.steps.length).toBeGreaterThanOrEqual(5);
      expect(script.steps.length).toBeLessThanOrEqual(20);
    },
    600_000,
  );
});
