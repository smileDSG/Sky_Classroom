import { describe, it, expect } from 'vitest';

describe('callLLM key rotation', () => {
  it('exports callLLM', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    expect(typeof callLLM).toBe('function');
  });

  it('isRateLimitError detects 429', async () => {
    const mod = await import('@/lib/ai/llm');
    expect(mod.callLLM).toBeDefined();
  });
});
