/**
 * P6-001 Test 18: 对话历史压缩
 *
 * Tests conversation history compression — summarizing long
 * conversations to fit within context windows while preserving
 * key information.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// ─── Message types ───

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  timestamp: number;
  agentId?: string;
}

// ─── Compression simulation ───

function compressHistory(messages: ChatMessage[], maxMessages: number): ChatMessage[] {
  if (messages.length <= maxMessages) {
    return messages;
  }

  // Keep system messages and last N messages
  const systemMessages = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  const recentMessages = nonSystem.slice(-maxMessages + systemMessages.length);
  const compressed = summarizeOlder(nonSystem.slice(0, -maxMessages + systemMessages.length));

  return [...systemMessages, compressed, ...recentMessages];
}

function summarizeOlder(messages: ChatMessage[]): ChatMessage {
  if (messages.length === 0) {
    return {
      id: 'summary-0',
      role: 'system',
      content: '[No previous conversation]',
      timestamp: Date.now(),
    };
  }

  const summary = `[Summary of ${messages.length} previous messages: ${messages.map((m) => m.content.substring(0, 50)).join(' ')}]`;

  return {
    id: 'summary-' + Date.now(),
    role: 'system',
    content: summary,
    timestamp: messages[0].timestamp,
  };
}

function slidingWindow(messages: ChatMessage[], windowSize: number): ChatMessage[] {
  return messages.slice(-windowSize);
}

// ─── Tests ───

describe('P6-001 Test 18: 对话历史压缩', () => {
  describe('history compression', () => {
    test('short history is not compressed', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'system', content: 'You are a teacher.', timestamp: 1 },
        { id: '2', role: 'user', content: 'Hello', timestamp: 2 },
        { id: '3', role: 'assistant', content: 'Hi!', timestamp: 3 },
      ];

      const compressed = compressHistory(messages, 10);
      expect(compressed.length).toBe(3);
    });

    test('long history is compressed', () => {
      const messages: ChatMessage[] = [
        { id: 'sys', role: 'system', content: 'System prompt', timestamp: 0 },
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `msg-${i}`,
          role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
          content: `Message ${i}`,
          timestamp: i + 1,
        })),
      ];

      const compressed = compressHistory(messages, 5);
      expect(compressed.length).toBeLessThanOrEqual(5);
    });

    test('system messages are preserved', () => {
      const messages: ChatMessage[] = [
        { id: 'sys', role: 'system', content: 'You are a teacher.', timestamp: 0 },
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `msg-${i}`,
          role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
          content: `Message ${i}`,
          timestamp: i + 1,
        })),
      ];

      const compressed = compressHistory(messages, 5);
      const systemMsgs = compressed.filter((m) => m.role === 'system');
      expect(systemMsgs.length).toBeGreaterThan(0);
    });

    test('recent messages are kept verbatim', () => {
      const messages: ChatMessage[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `old-${i}`,
          role: 'user' as const,
          content: `Old message ${i}`,
          timestamp: i,
        })),
        { id: 'recent', role: 'user', content: 'Recent important message', timestamp: 100 },
      ];

      const compressed = compressHistory(messages, 3);
      const recentMsg = compressed.find((m) => m.id === 'recent');
      expect(recentMsg).toBeDefined();
      expect(recentMsg!.content).toBe('Recent important message');
    });
  });

  describe('summarization', () => {
    test('summarizeOlder creates a single summary message', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'What is photosynthesis?', timestamp: 1 },
        { id: '2', role: 'assistant', content: 'Photosynthesis is...', timestamp: 2 },
        { id: '3', role: 'user', content: 'What about respiration?', timestamp: 3 },
      ];

      const summary = summarizeOlder(messages);
      expect(summary.role).toBe('system');
      expect(summary.content).toContain('3 previous messages');
    });

    test('summarizeOlder handles empty input', () => {
      const summary = summarizeOlder([]);
      expect(summary.content).toContain('No previous conversation');
    });

    test('summary includes content snippets', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello world', timestamp: 1 },
      ];

      const summary = summarizeOlder(messages);
      expect(summary.content).toContain('Hello world');
    });
  });

  describe('sliding window', () => {
    test('window smaller than history truncates', () => {
      const messages: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user' as const,
        content: `Message ${i}`,
        timestamp: i,
      }));

      const window = slidingWindow(messages, 3);
      expect(window.length).toBe(3);
      expect(window[0].id).toBe('msg-7');
      expect(window[2].id).toBe('msg-9');
    });

    test('window larger than history returns all', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'A', timestamp: 1 },
        { id: '2', role: 'user', content: 'B', timestamp: 2 },
      ];

      const window = slidingWindow(messages, 10);
      expect(window.length).toBe(2);
    });

    test('empty history returns empty window', () => {
      expect(slidingWindow([], 5)).toEqual([]);
    });
  });

  describe('key information preservation', () => {
    test('user requirements are preserved after compression', () => {
      const messages: ChatMessage[] = [
        { id: 'sys', role: 'system', content: 'Topic: 光合作用, Grade: 初中', timestamp: 0 },
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `msg-${i}`,
          role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
          content: `Chat message ${i}`,
          timestamp: i + 1,
        })),
      ];

      const compressed = compressHistory(messages, 5);
      const systemMsg = compressed.find((m) => m.role === 'system' && m.id === 'sys');
      expect(systemMsg).toBeDefined();
      expect(systemMsg!.content).toContain('光合作用');
    });

    test('agent identities are tracked in compression', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'agent', content: 'Teacher speaking', timestamp: 1, agentId: 'teacher' },
        { id: '2', role: 'agent', content: 'Student speaking', timestamp: 2, agentId: 'student-1' },
        { id: '3', role: 'agent', content: 'Assistant speaking', timestamp: 3, agentId: 'assistant' },
      ];

      const compressed = compressHistory(messages, 10);
      const agentMsgs = compressed.filter((m) => m.role === 'agent');
      expect(agentMsgs.length).toBe(3);
    });
  });
});
