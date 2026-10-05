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

  it('候选按声明顺序取优先级：deepseek 优先于 glm', () => {
    const cfg = resolveAnimationModel({
      env: { DEEPSEEK_API_KEY: 'dk', GLM_API_KEY: 'gk' },
    });
    expect(cfg?.providerId).toBe('deepseek');
    expect(cfg?.apiKey).toBe('dk');
  });

  it('DEFAULT_MODEL 无冒号时回退到候选列表', () => {
    const cfg = resolveAnimationModel({ env: { DEFAULT_MODEL: 'garbage', GLM_API_KEY: 'k' } });
    expect(cfg?.providerId).toBe('glm');
    expect(cfg?.apiKey).toBe('k');
  });

  it('DEFAULT_MODEL 指向非候选 provider 时不误路由，回退候选列表后无 key 返回 null', () => {
    const cfg = resolveAnimationModel({
      env: { DEFAULT_MODEL: 'google:gemini-3-flash-preview', GOOGLE_API_KEY: 'gk' },
    });
    expect(cfg).toBeNull();
  });

  it('DEFAULT_MODEL 分支：去除首尾空白并透传 DEEPSEEK_BASE_URL', () => {
    const cfg = resolveAnimationModel({
      env: {
        DEFAULT_MODEL: '  deepseek:deepseek-flash  ',
        DEEPSEEK_API_KEY: 'sk-test',
        DEEPSEEK_BASE_URL: 'https://example.com/v1',
      },
    });
    expect(cfg?.modelId).toBe('deepseek-flash');
    expect(cfg?.baseUrl).toBe('https://example.com/v1');
  });
});
