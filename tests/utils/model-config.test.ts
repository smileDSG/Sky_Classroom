import { describe, expect, it } from 'vitest';
import { resolveChatModelSelection } from '@/lib/utils/model-config';

describe('resolveChatModelSelection', () => {
  it('uses DeepSeek chat when persisted selection is GPT-5.5', () => {
    expect(resolveChatModelSelection('openai', 'gpt-5.5')).toEqual({
      providerId: 'deepseek',
      modelId: 'deepseek-chat',
    });
  });

  it('keeps non-GPT-5.5 selections unchanged', () => {
    expect(resolveChatModelSelection('qwen', 'qwen3-max')).toEqual({
      providerId: 'qwen',
      modelId: 'qwen3-max',
    });
  });
});
