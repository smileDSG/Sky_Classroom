import { describe, expect, it, vi } from 'vitest';
import { revealQuestionPanel } from '@/lib/chat/question-panel';

describe('question panel', () => {
  it('reveals the Q&A panel before the question request starts', () => {
    const switchToChat = vi.fn();
    const expandPanel = vi.fn();

    revealQuestionPanel(switchToChat, expandPanel);

    expect(switchToChat).toHaveBeenCalledOnce();
    expect(expandPanel).toHaveBeenCalledWith(false);
    expect(switchToChat.mock.invocationCallOrder[0]).toBeLessThan(
      expandPanel.mock.invocationCallOrder[0],
    );
  });
});
