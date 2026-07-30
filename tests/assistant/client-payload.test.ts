import { describe, expect, it } from 'vitest';

import { sanitizeAssistantMessages } from '@/lib/assistant/client-payload';

describe('sanitizeAssistantMessages', () => {
  it('drops system messages and client-only message fields', () => {
    const messages = sanitizeAssistantMessages([
      { role: 'system', content: 'CLIENT_SYSTEM_PROMPT' },
      { role: 'user', content: 'Explain calculus', id: 'local-id', memoryContext: 'private' },
      { role: 'assistant', content: 'Previous answer', id: 'local-id-2' },
    ]);

    expect(messages).toEqual([
      { role: 'user', content: 'Explain calculus' },
      { role: 'assistant', content: 'Previous answer' },
    ]);
  });
});
