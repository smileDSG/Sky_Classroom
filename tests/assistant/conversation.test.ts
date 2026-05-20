import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateMessageTokens,
  trimMessages,
  getRecentContext,
  summarizeConversation,
  type ChatMessage,
} from '@/lib/assistant/conversation';

function msg(role: ChatMessage['role'], content: string): ChatMessage {
  return { role, content };
}

// ── estimateTokens ─────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('estimates tokens from character count', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });

  it('empty string returns 0', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('rounds up', () => {
    expect(estimateTokens('abcde')).toBe(2); // 5 chars / 4 = 1.25 → 2
  });
});

// ── estimateMessageTokens ──────────────────────────────────────────

describe('estimateMessageTokens', () => {
  it('sums tokens across messages', () => {
    const messages = [
      msg('user', 'aaaaaaaa'), // 2 tokens
      msg('assistant', 'bbbbbbbb'), // 2 tokens
    ];
    expect(estimateMessageTokens(messages)).toBe(4);
  });
});

// ── trimMessages ───────────────────────────────────────────────────

describe('trimMessages', () => {
  it('under budget → no trimming', () => {
    const messages = [msg('user', 'hi'), msg('assistant', 'hello')];
    expect(trimMessages(messages, 1000)).toHaveLength(2);
  });

  it('over budget → removes oldest first', () => {
    const messages = [
      msg('user', 'old message'),
      msg('assistant', 'old reply'),
      msg('user', 'new message'),
    ];
    // Set token budget to only fit 1 message (1 token each since short)
    const result = trimMessages(messages, 1);
    expect(result.length).toBeLessThan(messages.length);
    // Should keep the last message
    expect(result[result.length - 1].content).toBe('new message');
  });

  it('always keeps at least one message', () => {
    const messages = [msg('user', 'a very long message that exceeds budget')];
    const result = trimMessages(messages, 1);
    expect(result).toHaveLength(1);
  });

  it('empty array → empty array', () => {
    expect(trimMessages([], 100)).toHaveLength(0);
  });
});

// ── getRecentContext ───────────────────────────────────────────────

describe('getRecentContext', () => {
  it('returns most recent messages within budget', () => {
    const messages = [
      msg('user', 'old'),
      msg('assistant', 'old-reply'),
      msg('user', 'recent'),
      msg('assistant', 'recent-reply'),
    ];
    // Budget = 1 token, should only get the last message
    const result = getRecentContext(messages, 1);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('recent-reply');
  });

  it('returns all if under budget', () => {
    const messages = [msg('user', 'hi')];
    expect(getRecentContext(messages, 1000)).toHaveLength(1);
  });

  it('empty array → empty array', () => {
    expect(getRecentContext([])).toHaveLength(0);
  });
});

// ── summarizeConversation ──────────────────────────────────────────

describe('summarizeConversation', () => {
  it('creates summary of recent exchanges', () => {
    const messages = [
      msg('user', '什么是二次函数？'),
      msg('assistant', '二次函数是形如 y=ax²+bx+c 的函数。'),
    ];
    const summary = summarizeConversation(messages);
    expect(summary).toContain('学生');
    expect(summary).toContain('二次函数');
  });

  it('filters out system messages', () => {
    const messages = [
      msg('system', 'You are a helpful assistant.'),
      msg('user', 'hello'),
      msg('assistant', 'hi there'),
    ];
    const summary = summarizeConversation(messages);
    expect(summary).not.toContain('helpful assistant');
    expect(summary).toContain('hello');
  });

  it('truncates long messages to 80 chars', () => {
    const longText = 'a'.repeat(100);
    const messages = [msg('user', longText)];
    const summary = summarizeConversation(messages);
    const contentStart = summary.indexOf('学生：') + 4;
    const content = summary.slice(contentStart);
    // Should be truncated with …
    expect(content.length).toBeLessThan(longText.length);
    expect(summary).toContain('…');
  });

  it('empty messages → empty string', () => {
    expect(summarizeConversation([])).toBe('');
  });

  it('respects maxExchanges', () => {
    const messages = [
      msg('user', 'q1'),
      msg('assistant', 'a1'),
      msg('user', 'q2'),
      msg('assistant', 'a2'),
      msg('user', 'q3'),
      msg('assistant', 'a3'),
    ];
    const summary = summarizeConversation(messages, 1);
    // Only the last exchange (q3, a3)
    expect(summary).toContain('q3');
    expect(summary).not.toContain('q1');
  });
});
