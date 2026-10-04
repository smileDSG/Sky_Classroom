import { describe, it, expect } from 'vitest';
import { resolveAnimationModel } from '@/lib/animation/generate/model';

describe('resolveAnimationModel', () => {
  it('DEFAULT_MODEL=provider:model 优先', () => {
    const cfg = resolveAnimationModel({
      env: { DEFAULT_MODEL: 'deepseek:deepseek-flash', DEEPSEEK_API_KEY: 'sk-test' },
    });
    expect(cfg).toMatchObject({
      providerId: 'deepseek',
      modelId: 'deepseek-flash',
      apiKey: 'sk-test',
    });
  });

  it('无 DEFAULT_MODEL 时回退到第一个配置了 key 的候选', () => {
    const cfg = resolveAnimationModel({ env: { GLM_API_KEY: 'k' } });
    expect(cfg?.apiKey).toBe('k');
  });

  it('全未配置返回 null', () => {
    expect(resolveAnimationModel({ env: {} })).toBeNull();
  });
});
